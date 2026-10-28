-- Migration 20261107000300: acesso do motorista ao app (login por código no WhatsApp).
--
-- O app nunca usa a chave secreta, então o sistema web não cria usuário no Auth. Em vez disso:
-- 1. A operação libera o celular do motorista na ficha dele (liberar_acesso_app).
-- 2. O motorista entra no app com o código que chega no WhatsApp desse número (o Supabase Auth cria o usuário
--    com auth.users.phone verificado).
-- 3. O app chama ativar_acesso_app(): se o celular verificado é o liberado, nasce o perfil de papel motorista
--    ligado ao cadastro dele.
-- Revogar desativa o perfil na hora. Celular = só dígitos com o 55 do Brasil (o formato de auth.users.phone).

create table public.motorista_acesso_app (
  motorista_id uuid primary key references public.motorista (pessoa_id) on delete cascade,
  celular text not null unique,
  liberado_em timestamptz not null default now(),
  liberado_por uuid default auth.uid(),
  revogado_em timestamptz,
  revogado_por uuid,
  constraint motorista_acesso_app_celular check (celular ~ '^55[1-9][0-9]9[0-9]{8}$')
);

comment on table public.motorista_acesso_app is 'Celular liberado para o motorista entrar no app. Só as funções gravam.';

revoke insert, update, delete, truncate, references, trigger on public.motorista_acesso_app from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.motorista_acesso_app from anon;
alter table public.motorista_acesso_app enable row level security;
create policy motorista_acesso_app_select on public.motorista_acesso_app
  for select to authenticated using ((select public.pode_ler()));
select public.auditar('public.motorista_acesso_app');

-- Libera (ou troca) o celular do motorista. Aceita com ou sem máscara e com ou sem o 55.
create function public.liberar_acesso_app(p_motorista uuid, p_celular text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cel text := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação liberam o app' using errcode = '42501';
  end if;
  if length(v_cel) in (10, 11) then
    v_cel := '55' || v_cel;
  end if;
  if v_cel !~ '^55[1-9][0-9]9[0-9]{8}$' then
    raise exception 'Informe o celular com DDD e o 9 na frente (ex.: (43) 99999-8888).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.motorista where pessoa_id = p_motorista) then
    raise exception 'Motorista não encontrado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.motorista_acesso_app where celular = v_cel and motorista_id <> p_motorista) then
    raise exception 'Este celular já está liberado para outro motorista.' using errcode = 'P0001';
  end if;

  -- Celular trocado: o acesso antigo (de outro número) deixa de valer.
  update public.perfil_usuario p set ativo = false
   where p.motorista_id = p_motorista
     and exists (select 1 from public.motorista_acesso_app a where a.motorista_id = p_motorista and a.celular <> v_cel);

  insert into public.motorista_acesso_app (motorista_id, celular)
  values (p_motorista, v_cel)
  on conflict (motorista_id) do update
    set celular = excluded.celular, liberado_em = now(), liberado_por = (select auth.uid()),
        revogado_em = null, revogado_por = null;
  return v_cel;
end $$;

create function public.revogar_acesso_app(p_motorista uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação revogam o app' using errcode = '42501';
  end if;
  update public.motorista_acesso_app set revogado_em = now(), revogado_por = (select auth.uid())
   where motorista_id = p_motorista and revogado_em is null;
  update public.perfil_usuario set ativo = false where motorista_id = p_motorista;
end $$;

-- Primeira entrada no app: liga o usuário (celular verificado pelo código) ao motorista liberado.
create function public.ativar_acesso_app()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cel text;
  v_m uuid;
  v_perfil public.perfil_usuario%rowtype;
begin
  if v_uid is null then
    raise exception 'entre com o código do WhatsApp' using errcode = '42501';
  end if;
  select u.phone into v_cel from auth.users u where u.id = v_uid and u.phone_confirmed_at is not null;
  select a.motorista_id into v_m from public.motorista_acesso_app a
   where a.celular = v_cel and a.revogado_em is null;
  if v_m is null then
    raise exception 'este celular não está liberado no app da Prisa. Fale com a operação.' using errcode = '42501';
  end if;

  select * into v_perfil from public.perfil_usuario where user_id = v_uid;
  if found then
    if v_perfil.papel <> 'motorista' or v_perfil.motorista_id <> v_m then
      raise exception 'este usuário já tem outro acesso no NILT' using errcode = '42501';
    end if;
    update public.perfil_usuario set ativo = true where user_id = v_uid and not ativo;
    return v_m;
  end if;

  -- Outro usuário do mesmo motorista (celular trocado e entrou de novo): o antigo deixa de valer.
  update public.perfil_usuario set ativo = false where motorista_id = v_m;
  delete from public.perfil_usuario where motorista_id = v_m and not ativo;
  insert into public.perfil_usuario (user_id, nome, papel, motorista_id)
  select v_uid, coalesce(nullif(btrim(p.apelido), ''), p.nome), 'motorista', v_m
  from public.pessoa p where p.id = v_m;
  return v_m;
end $$;

revoke execute on function public.liberar_acesso_app(uuid, text) from public, anon;
revoke execute on function public.revogar_acesso_app(uuid) from public, anon;
revoke execute on function public.ativar_acesso_app() from public, anon;
grant execute on function public.liberar_acesso_app(uuid, text) to authenticated;
grant execute on function public.revogar_acesso_app(uuid) to authenticated;
grant execute on function public.ativar_acesso_app() to authenticated;
