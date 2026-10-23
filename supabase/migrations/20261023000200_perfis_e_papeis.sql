-- Migration 0200: perfis de usuário, papéis e funções de permissão.

create type public.app_papel as enum ('admin', 'operacao', 'financeiro', 'leitura');

create table public.perfil_usuario (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel public.app_papel not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger perfil_usuario_set_updated_at
  before update on public.perfil_usuario
  for each row execute function public.fn_set_updated_at();

-- Papel do usuário logado; null se não tem perfil ou está inativo.
create function public.papel_atual()
returns public.app_papel
language sql
stable
security definer
set search_path = public
as $$
  select p.papel
  from public.perfil_usuario p
  where p.user_id = (select auth.uid())
    and p.ativo
$$;

create function public.tem_papel(variadic p public.app_papel[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.papel_atual() = any (p), false)
$$;

create function public.pode_ler()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel('admin', 'operacao', 'financeiro', 'leitura')
$$;

create function public.pode_editar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel('admin', 'operacao')
$$;

create function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel('admin')
$$;

revoke execute on function public.papel_atual() from public, anon;
revoke execute on function public.tem_papel(public.app_papel[]) from public, anon;
revoke execute on function public.pode_ler() from public, anon;
revoke execute on function public.pode_editar() from public, anon;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.tem_papel(public.app_papel[]) to authenticated;
grant execute on function public.pode_ler() to authenticated;
grant execute on function public.pode_editar() to authenticated;
grant execute on function public.eh_admin() to authenticated;

alter table public.perfil_usuario enable row level security;

create policy perfil_usuario_select on public.perfil_usuario
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.eh_admin()));

create policy perfil_usuario_insert on public.perfil_usuario
  for insert to authenticated
  with check ((select public.eh_admin()));

create policy perfil_usuario_update on public.perfil_usuario
  for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy perfil_usuario_delete on public.perfil_usuario
  for delete to authenticated
  using ((select public.eh_admin()));
