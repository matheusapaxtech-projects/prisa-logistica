-- Migration 20261025000100: cliente (papel da pessoa) e locais de coleta/descarga.
--
-- cliente é um papel de uma pessoa (PK = pessoa_id), como motorista e proprietario. Os dados
-- cadastrais ficam em pessoa; aqui só o que é específico do cliente (faturamento e exigências).
-- Local de coleta/descarga reaproveita pessoa_endereco com tipo = 'coleta_descarga' (o enum
-- tipo_endereco já tem o valor); só ganha janela de atendimento e contato do local.
-- on delete restrict: pessoa que é cliente não pode ser apagada sem antes tirar o papel.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.condicao_faturamento as enum ('por_cte', 'semanal', 'quinzenal', 'mensal');

-- ---------------------------------------------------------------------------
-- cliente
-- ---------------------------------------------------------------------------
create table public.cliente (
  pessoa_id uuid primary key references public.pessoa (id) on delete restrict,
  condicao_faturamento public.condicao_faturamento not null default 'por_cte',
  email_xml text,
  email_cobranca text,
  exige_gr boolean not null default false,
  gerenciadora text,
  exige_sm boolean not null default false,
  exigencias text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger cliente_set_updated_at
  before update on public.cliente
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Locais de coleta/descarga: dois campos novos em pessoa_endereco
-- ---------------------------------------------------------------------------
alter table public.pessoa_endereco add column janela_atendimento text;
alter table public.pessoa_endereco add column contato_local text;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS governa select/insert/update/delete)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.cliente from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.cliente from anon;

-- ---------------------------------------------------------------------------
-- RLS: leitura pode_ler; escrita pode_editar; exclusão só admin
-- ---------------------------------------------------------------------------
alter table public.cliente enable row level security;

create policy cliente_select on public.cliente
  for select to authenticated using ((select public.pode_ler()));
create policy cliente_insert on public.cliente
  for insert to authenticated with check ((select public.pode_editar()));
create policy cliente_update on public.cliente
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy cliente_delete on public.cliente
  for delete to authenticated using ((select public.eh_admin()));

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
select public.auditar('public.cliente');
