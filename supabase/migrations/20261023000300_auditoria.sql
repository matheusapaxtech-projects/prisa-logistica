-- Migration 0300: auditoria genérica por trigger.

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('insert', 'update', 'delete', 'visualizacao')),
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  em timestamptz not null default now()
);

create index auditoria_tabela_registro_idx on public.auditoria (tabela, registro_id);

alter table public.auditoria enable row level security;

-- Só leitura para admin; ninguém grava pela API (somente o trigger, via security definer).
revoke insert, update, delete, truncate, references, trigger on public.auditoria from anon, authenticated;
revoke select on public.auditoria from anon;
grant select on public.auditoria to authenticated;

create policy auditoria_select on public.auditoria
  for select to authenticated
  using ((select public.eh_admin()));

-- Função de trigger: registro_id = valores da chave primária (texto), unidos por ':' na ordem da chave.
-- Para chave simples vira apenas o valor (id, pessoa_id, ...).
create function public.fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha jsonb;
  v_registro_id text;
begin
  if tg_op = 'DELETE' then
    v_linha := to_jsonb(old);
  else
    v_linha := to_jsonb(new);
  end if;

  select string_agg(v_linha ->> a.attname::text, ':' order by k.ord)
    into v_registro_id
  from pg_index i
  cross join lateral unnest(i.indkey::smallint[]) with ordinality as k (attnum, ord)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = tg_relid and i.indisprimary;

  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id)
  values (
    tg_table_name,
    coalesce(v_registro_id, ''),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    (select auth.uid())
  );

  return null;
end $$;

-- Liga a auditoria em uma tabela (idempotente). Exige chave primária.
create function public.auditar(p_tabela regclass)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from pg_index where indrelid = p_tabela and indisprimary
  ) then
    raise exception 'auditar: a tabela % não tem chave primária', p_tabela;
  end if;

  execute format(
    'create or replace trigger trg_auditoria after insert or update or delete on %s '
    'for each row execute function public.fn_auditoria()',
    p_tabela);
end $$;

-- Só migrations (papel postgres) chamam auditar; triggers não exigem EXECUTE do chamador.
revoke execute on function public.fn_auditoria() from public, anon, authenticated;
revoke execute on function public.auditar(regclass) from public, anon, authenticated;

-- Mudanças de papel/ativo são sensíveis à segurança (spec 4.4).
select public.auditar('public.perfil_usuario');
