-- Migration 0500: motorista, referências do motorista e proprietário.
--
-- motorista e proprietario são papéis de uma pessoa (PK = pessoa_id): a mesma pessoa PF pode
-- ser os dois. Os dados cadastrais ficam em pessoa; aqui só o que é específico do papel.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.categoria_cnh as enum ('provisoria', 'a', 'b', 'c', 'd', 'e', 'ab', 'ac', 'ad', 'ae');
create type public.situacao_gr as enum ('sem_consulta', 'habilitado', 'vencido');
create type public.tipo_referencia as enum ('pessoal', 'comercial');
create type public.enquadramento_antt as enum ('etc', 'tac', 'ctc', 'etc_equiparado');
create type public.desconto_inss as enum ('nao', 'inss_sest_senat', 'sest_senat');
create type public.regra_pgto_frete as enum (
  'peso_saida', 'peso_chegada', 'peso_chegada_se_menor',
  'peso_chegada_com_tolerancia', 'peso_chegada_acima_tolerancia');

-- ---------------------------------------------------------------------------
-- motorista
-- ---------------------------------------------------------------------------
create table public.motorista (
  pessoa_id uuid primary key references public.pessoa (id) on delete cascade,
  cnh_registro varchar(11),
  cnh_formulario varchar(10),
  cnh_seguranca varchar(11),
  cnh_renach varchar(11),
  cnh_categoria public.categoria_cnh,
  cnh_validade date,
  cnh_emissao date,
  cnh_primeira_habilitacao date,
  cnh_cidade_emissao text,
  cnh_uf public.uf,
  cnh_observacao text,
  situacao_cadastro public.situacao_cadastro not null default 'pendente',
  situacao_gr public.situacao_gr not null default 'sem_consulta',
  gr_validade date,
  qualificado_gmp boolean,
  dt_qualificacao_gmp date,
  radio text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger motorista_set_updated_at
  before update on public.motorista
  for each row execute function public.fn_set_updated_at();

-- Motorista precisa ser pessoa física.
-- security definer + search_path fixo: lê pessoa independentemente da visibilidade (RLS) de quem grava.
create function public.fn_motorista_so_pf()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.pessoa p where p.id = new.pessoa_id and p.tipo = 'pf') then
    raise exception 'motorista precisa ser pessoa física';
  end if;
  return new;
end $$;

create trigger motorista_so_pf
  before insert or update on public.motorista
  for each row execute function public.fn_motorista_so_pf();

-- ---------------------------------------------------------------------------
-- motorista_referencia
-- ---------------------------------------------------------------------------
create table public.motorista_referencia (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motorista (pessoa_id) on delete cascade,
  tipo public.tipo_referencia not null,
  nome text not null,
  telefone varchar(16),
  dt_referencia date,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index motorista_referencia_motorista_id_idx on public.motorista_referencia (motorista_id);

create trigger motorista_referencia_set_updated_at
  before update on public.motorista_referencia
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- proprietario
-- ---------------------------------------------------------------------------
create table public.proprietario (
  pessoa_id uuid primary key references public.pessoa (id) on delete cascade,
  rntrc varchar(9),
  enquadramento_antt public.enquadramento_antt,
  rntrc_emissao date,
  rntrc_validade date,
  responsavel_nome text,
  responsavel_telefone varchar(16),
  responsavel_whatsapp boolean,
  responsavel_email text,
  autoriza_desconto_inss public.desconto_inss not null default 'nao',
  alto_desempenho boolean not null default false,
  qualificado_gmp boolean,
  dt_qualificacao_gmp date,
  situacao_cadastro public.situacao_cadastro not null default 'pendente',
  taxa_adm_valor numeric(12, 2),
  taxa_adm_percentual numeric(5, 2),
  regra_pgto_frete public.regra_pgto_frete,
  limite_adiantamento_percentual numeric(5, 2),
  limite_adiantamento_valor numeric(12, 2),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Percentuais: null passa (between devolve null), então não precisa de "is null or".
  constraint proprietario_taxa_adm_percentual_faixa check (taxa_adm_percentual between 0 and 100),
  constraint proprietario_limite_adiantamento_percentual_faixa check (limite_adiantamento_percentual between 0 and 100)
);

create trigger proprietario_set_updated_at
  before update on public.proprietario
  for each row execute function public.fn_set_updated_at();

-- TAC (transportador autônomo) só existe para pessoa física.
create function public.fn_proprietario_tac_so_pf()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.enquadramento_antt = 'tac'
     and not exists (select 1 from public.pessoa p where p.id = new.pessoa_id and p.tipo = 'pf') then
    raise exception 'TAC só para pessoa física';
  end if;
  return new;
end $$;

create trigger proprietario_tac_so_pf
  before insert or update on public.proprietario
  for each row execute function public.fn_proprietario_tac_so_pf();

-- ---------------------------------------------------------------------------
-- Funções de trigger: só o próprio trigger as executa
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_motorista_so_pf() from public, anon, authenticated;
revoke execute on function public.fn_proprietario_tac_so_pf() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- View de situação do motorista
-- ---------------------------------------------------------------------------
-- Datas nulas não vencem: sem cnh_validade/gr_validade a situação é 'habilitado'
-- (a comparação com null não é verdadeira e cai no else).
create view public.v_motorista_situacao
with (security_invoker = true) as
select
  m.pessoa_id,
  p.nome,
  p.cpf,
  m.cnh_validade,
  case
    when m.cnh_validade < current_date or m.gr_validade < current_date then 'vencido'
    else 'habilitado'
  end as situacao_dados
from public.motorista m
join public.pessoa p on p.id = m.pessoa_id;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS governa select/insert/update/delete)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.motorista from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.motorista from anon;
revoke truncate, references, trigger on public.motorista_referencia from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.motorista_referencia from anon;
revoke truncate, references, trigger on public.proprietario from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.proprietario from anon;
-- A view é só leitura; anon não lê nada.
revoke select, insert, update, delete, truncate, references, trigger on public.v_motorista_situacao from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_motorista_situacao from authenticated;

-- ---------------------------------------------------------------------------
-- RLS: leitura pode_ler; escrita pode_editar; exclusão só admin
-- ---------------------------------------------------------------------------
alter table public.motorista enable row level security;
alter table public.motorista_referencia enable row level security;
alter table public.proprietario enable row level security;

-- motorista
create policy motorista_select on public.motorista
  for select to authenticated using ((select public.pode_ler()));
create policy motorista_insert on public.motorista
  for insert to authenticated with check ((select public.pode_editar()));
create policy motorista_update on public.motorista
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy motorista_delete on public.motorista
  for delete to authenticated using ((select public.eh_admin()));

-- motorista_referencia
create policy motorista_referencia_select on public.motorista_referencia
  for select to authenticated using ((select public.pode_ler()));
create policy motorista_referencia_insert on public.motorista_referencia
  for insert to authenticated with check ((select public.pode_editar()));
create policy motorista_referencia_update on public.motorista_referencia
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy motorista_referencia_delete on public.motorista_referencia
  for delete to authenticated using ((select public.eh_admin()));

-- proprietario
create policy proprietario_select on public.proprietario
  for select to authenticated using ((select public.pode_ler()));
create policy proprietario_insert on public.proprietario
  for insert to authenticated with check ((select public.pode_editar()));
create policy proprietario_update on public.proprietario
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy proprietario_delete on public.proprietario
  for delete to authenticated using ((select public.eh_admin()));

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
select public.auditar('public.motorista');
select public.auditar('public.motorista_referencia');
select public.auditar('public.proprietario');
