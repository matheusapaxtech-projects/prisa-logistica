-- Migration 0400: pessoa PF/PJ, contatos, contas bancárias e Pix.
--
-- Documentos com máscara (cpf, cnpj, cep, favorecido_documento) são `text`, não `char(n)`:
-- atribuir '529.982.247-25' a char(11) falha com 22001 (value too long) ANTES de o trigger
-- before insert/update poder normalizar. Em `text` o trigger tira a máscara e o check de
-- formato exato (`^[0-9]{n}$`) roda depois, sobre o valor já normalizado.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.tipo_pessoa as enum ('pf', 'pj');
create type public.situacao_cadastro as enum ('cancelado', 'pendente', 'normal');
create type public.sexo as enum ('masculino', 'feminino');
create type public.raca_cor as enum ('branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_informado');
create type public.estado_civil as enum ('solteiro', 'casado', 'separado', 'viuvo', 'outro');
create type public.grau_instrucao as enum (
  'fundamental_incompleto', 'fundamental_completo', 'medio_incompleto',
  'medio_completo', 'superior_incompleto', 'superior_completo');
create type public.situacao_cpf as enum (
  'regular', 'titular_falecido', 'suspensa', 'pendente_regularizacao',
  'cancelada_multiplicidade', 'nula', 'cancelada_oficio');
create type public.tipo_endereco as enum ('residencial', 'comercial', 'coleta_descarga', 'cobranca', 'correspondencia');
create type public.tipo_telefone as enum ('residencial', 'comercial', 'celular', 'fax', 'radio');
create type public.tipo_conta as enum ('corrente', 'poupanca', 'salario');
create type public.tipo_chave_pix as enum ('cpf', 'cnpj', 'celular', 'email', 'aleatoria');
create type public.uf as enum (
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO');

-- ---------------------------------------------------------------------------
-- pessoa
-- ---------------------------------------------------------------------------
create table public.pessoa (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_pessoa not null,
  nome varchar(110) not null,
  apelido text,
  cpf text unique,
  cnpj text unique,
  situacao_cadastro public.situacao_cadastro not null default 'pendente',
  observacao text,
  -- pessoa física
  rg varchar(20),
  rg_orgao text,
  rg_uf public.uf,
  rg_emissao date,
  nascimento date,
  sexo public.sexo,
  raca_cor public.raca_cor,
  estado_civil public.estado_civil,
  grau_instrucao public.grau_instrucao,
  naturalidade text,
  naturalidade_uf public.uf,
  nr_inss varchar(11),
  situacao_cpf public.situacao_cpf,
  dt_consulta_cpf date,
  pai varchar(80),
  mae varchar(80),
  nr_dependentes smallint,
  -- pessoa jurídica
  nome_fantasia text,
  fundacao date,
  inscricao_estadual_isento boolean,
  inscricao_estadual text,
  inscricao_municipal text,
  natureza_juridica text,
  cnae_principal text,
  optante_simples boolean,
  dt_consulta_simples date,
  dados_brasilapi jsonb,
  dt_consulta_brasilapi timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint pessoa_cpf_formato check (cpf ~ '^[0-9]{11}$' and public.cpf_valido(cpf)),
  constraint pessoa_cnpj_formato check (cnpj ~ '^[0-9]{14}$' and public.cnpj_valido(cnpj)),
  constraint pessoa_pf_pj_exclusivo check (
    (tipo = 'pf' and cpf is not null and cnpj is null)
    or (tipo = 'pj' and cnpj is not null and cpf is null))
);

-- Tira a máscara; string sem dígitos vira null (e aí o check PF/PJ recusa).
create function public.fn_pessoa_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cpf := nullif(public.so_digitos(new.cpf), '');
  new.cnpj := nullif(public.so_digitos(new.cnpj), '');
  return new;
end $$;

create trigger pessoa_normalizar
  before insert or update on public.pessoa
  for each row execute function public.fn_pessoa_normalizar();

create trigger pessoa_set_updated_at
  before update on public.pessoa
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- pessoa_endereco
-- ---------------------------------------------------------------------------
create table public.pessoa_endereco (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  tipo public.tipo_endereco,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text not null,
  uf public.uf not null,
  ponto_referencia text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint pessoa_endereco_cep_formato check (cep ~ '^[0-9]{8}$')
);

create index pessoa_endereco_pessoa_id_idx on public.pessoa_endereco (pessoa_id);
create unique index pessoa_endereco_um_principal on public.pessoa_endereco (pessoa_id) where principal;

create function public.fn_pessoa_endereco_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cep := nullif(public.so_digitos(new.cep), '');
  return new;
end $$;

create trigger pessoa_endereco_normalizar
  before insert or update on public.pessoa_endereco
  for each row execute function public.fn_pessoa_endereco_normalizar();

create trigger pessoa_endereco_set_updated_at
  before update on public.pessoa_endereco
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- pessoa_telefone
-- ---------------------------------------------------------------------------
create table public.pessoa_telefone (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  numero varchar(16) not null,
  ramal varchar(4),
  contato varchar(100),
  tipo public.tipo_telefone,
  principal boolean not null default false,
  whatsapp boolean not null default false,
  restrito boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index pessoa_telefone_pessoa_id_idx on public.pessoa_telefone (pessoa_id);
create unique index pessoa_telefone_um_principal on public.pessoa_telefone (pessoa_id) where principal;

create trigger pessoa_telefone_set_updated_at
  before update on public.pessoa_telefone
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- pessoa_email
-- ---------------------------------------------------------------------------
create table public.pessoa_email (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  email text not null,
  principal boolean not null default false,
  recebe_cte boolean not null default false,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index pessoa_email_pessoa_id_idx on public.pessoa_email (pessoa_id);
create unique index pessoa_email_um_principal on public.pessoa_email (pessoa_id) where principal;

create trigger pessoa_email_set_updated_at
  before update on public.pessoa_email
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- banco (tabela de apoio, chave natural = código COMPE)
-- ---------------------------------------------------------------------------
create table public.banco (
  codigo char(3) primary key,
  nome text not null
);

insert into public.banco (codigo, nome) values
  ('001', 'Banco do Brasil'),
  ('033', 'Santander'),
  ('041', 'Banrisul'),
  ('077', 'Inter'),
  ('084', 'Sisprime'),
  ('085', 'Ailos'),
  ('104', 'Caixa Econômica Federal'),
  ('133', 'Cresol'),
  ('136', 'Unicred'),
  ('237', 'Bradesco'),
  ('260', 'Nubank'),
  ('290', 'PagSeguro'),
  ('336', 'C6 Bank'),
  ('341', 'Itaú'),
  ('348', 'XP'),
  ('403', 'Cora'),
  ('422', 'Safra'),
  ('707', 'Daycoval'),
  ('748', 'Sicredi'),
  ('756', 'Sicoob');

-- ---------------------------------------------------------------------------
-- pessoa_conta_bancaria
-- ---------------------------------------------------------------------------
create table public.pessoa_conta_bancaria (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  banco_codigo char(3) references public.banco (codigo),
  tipo public.tipo_conta,
  agencia varchar(5),
  agencia_digito varchar(2),
  conta varchar(20),
  conta_digito varchar(2),
  favorecido_nome text,
  favorecido_documento text,
  principal boolean not null default false,
  swift text,
  titular_confere boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint pessoa_conta_favorecido_documento_formato check (favorecido_documento ~ '^[0-9]{11}([0-9]{3})?$')
);

create index pessoa_conta_bancaria_pessoa_id_idx on public.pessoa_conta_bancaria (pessoa_id);
create index pessoa_conta_bancaria_banco_codigo_idx on public.pessoa_conta_bancaria (banco_codigo);
create unique index pessoa_conta_bancaria_um_principal on public.pessoa_conta_bancaria (pessoa_id) where principal;

-- Normaliza o documento do favorecido e calcula titular_confere (favorecido = CPF/CNPJ da pessoa).
-- security definer + search_path fixo: lê pessoa independentemente da visibilidade (RLS) de quem grava.
create function public.fn_conta_bancaria_titular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento text;
begin
  new.favorecido_documento := nullif(public.so_digitos(new.favorecido_documento), '');

  select coalesce(p.cpf, p.cnpj) into v_documento
  from public.pessoa p
  where p.id = new.pessoa_id;

  new.titular_confere := new.favorecido_documento is not null
    and new.favorecido_documento = v_documento;
  return new;
end $$;

create trigger pessoa_conta_bancaria_titular
  before insert or update on public.pessoa_conta_bancaria
  for each row execute function public.fn_conta_bancaria_titular();

create trigger pessoa_conta_bancaria_set_updated_at
  before update on public.pessoa_conta_bancaria
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- pessoa_chave_pix
-- ---------------------------------------------------------------------------
create table public.pessoa_chave_pix (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoa (id) on delete cascade,
  tipo public.tipo_chave_pix not null,
  chave text not null,
  conta_id uuid references public.pessoa_conta_bancaria (id) on delete set null,
  principal boolean not null default false,
  descricao varchar(30),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint pessoa_chave_pix_tipo_chave_key unique (tipo, chave)
);

create index pessoa_chave_pix_pessoa_id_idx on public.pessoa_chave_pix (pessoa_id);
create index pessoa_chave_pix_conta_id_idx on public.pessoa_chave_pix (conta_id);
create unique index pessoa_chave_pix_um_principal on public.pessoa_chave_pix (pessoa_id) where principal;

create trigger pessoa_chave_pix_set_updated_at
  before update on public.pessoa_chave_pix
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de trigger: só o próprio trigger as executa
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_pessoa_normalizar() from public, anon, authenticated;
revoke execute on function public.fn_pessoa_endereco_normalizar() from public, anon, authenticated;
revoke execute on function public.fn_conta_bancaria_titular() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios de tabela (explícitos; RLS governa select/insert/update/delete)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.pessoa from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa from anon;
revoke truncate, references, trigger on public.pessoa_endereco from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa_endereco from anon;
revoke truncate, references, trigger on public.pessoa_telefone from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa_telefone from anon;
revoke truncate, references, trigger on public.pessoa_email from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa_email from anon;
revoke truncate, references, trigger on public.banco from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.banco from anon;
revoke truncate, references, trigger on public.pessoa_conta_bancaria from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa_conta_bancaria from anon;
revoke truncate, references, trigger on public.pessoa_chave_pix from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pessoa_chave_pix from anon;

-- ---------------------------------------------------------------------------
-- RLS: leitura pode_ler; escrita pode_editar (contas e Pix também financeiro); exclusão só admin
-- ---------------------------------------------------------------------------
alter table public.pessoa enable row level security;
alter table public.pessoa_endereco enable row level security;
alter table public.pessoa_telefone enable row level security;
alter table public.pessoa_email enable row level security;
alter table public.banco enable row level security;
alter table public.pessoa_conta_bancaria enable row level security;
alter table public.pessoa_chave_pix enable row level security;

-- pessoa
create policy pessoa_select on public.pessoa
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_insert on public.pessoa
  for insert to authenticated with check ((select public.pode_editar()));
create policy pessoa_update on public.pessoa
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy pessoa_delete on public.pessoa
  for delete to authenticated using ((select public.eh_admin()));

-- pessoa_endereco
create policy pessoa_endereco_select on public.pessoa_endereco
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_endereco_insert on public.pessoa_endereco
  for insert to authenticated with check ((select public.pode_editar()));
create policy pessoa_endereco_update on public.pessoa_endereco
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy pessoa_endereco_delete on public.pessoa_endereco
  for delete to authenticated using ((select public.eh_admin()));

-- pessoa_telefone
create policy pessoa_telefone_select on public.pessoa_telefone
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_telefone_insert on public.pessoa_telefone
  for insert to authenticated with check ((select public.pode_editar()));
create policy pessoa_telefone_update on public.pessoa_telefone
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy pessoa_telefone_delete on public.pessoa_telefone
  for delete to authenticated using ((select public.eh_admin()));

-- pessoa_email
create policy pessoa_email_select on public.pessoa_email
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_email_insert on public.pessoa_email
  for insert to authenticated with check ((select public.pode_editar()));
create policy pessoa_email_update on public.pessoa_email
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy pessoa_email_delete on public.pessoa_email
  for delete to authenticated using ((select public.eh_admin()));

-- banco (apoio: leitura geral, escrita só admin)
create policy banco_select on public.banco
  for select to authenticated using ((select public.pode_ler()));
create policy banco_insert on public.banco
  for insert to authenticated with check ((select public.eh_admin()));
create policy banco_update on public.banco
  for update to authenticated
  using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy banco_delete on public.banco
  for delete to authenticated using ((select public.eh_admin()));

-- pessoa_conta_bancaria (financeiro também edita)
create policy pessoa_conta_bancaria_select on public.pessoa_conta_bancaria
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_conta_bancaria_insert on public.pessoa_conta_bancaria
  for insert to authenticated
  with check ((select public.tem_papel('admin', 'operacao', 'financeiro')));
create policy pessoa_conta_bancaria_update on public.pessoa_conta_bancaria
  for update to authenticated
  using ((select public.tem_papel('admin', 'operacao', 'financeiro')))
  with check ((select public.tem_papel('admin', 'operacao', 'financeiro')));
create policy pessoa_conta_bancaria_delete on public.pessoa_conta_bancaria
  for delete to authenticated using ((select public.eh_admin()));

-- pessoa_chave_pix (financeiro também edita)
create policy pessoa_chave_pix_select on public.pessoa_chave_pix
  for select to authenticated using ((select public.pode_ler()));
create policy pessoa_chave_pix_insert on public.pessoa_chave_pix
  for insert to authenticated
  with check ((select public.tem_papel('admin', 'operacao', 'financeiro')));
create policy pessoa_chave_pix_update on public.pessoa_chave_pix
  for update to authenticated
  using ((select public.tem_papel('admin', 'operacao', 'financeiro')))
  with check ((select public.tem_papel('admin', 'operacao', 'financeiro')));
create policy pessoa_chave_pix_delete on public.pessoa_chave_pix
  for delete to authenticated using ((select public.eh_admin()));

-- ---------------------------------------------------------------------------
-- Auditoria (banco incluída: poucas linhas, mudanças raras e só por admin; custo desprezível)
-- ---------------------------------------------------------------------------
select public.auditar('public.pessoa');
select public.auditar('public.pessoa_endereco');
select public.auditar('public.pessoa_telefone');
select public.auditar('public.pessoa_email');
select public.auditar('public.banco');
select public.auditar('public.pessoa_conta_bancaria');
select public.auditar('public.pessoa_chave_pix');
