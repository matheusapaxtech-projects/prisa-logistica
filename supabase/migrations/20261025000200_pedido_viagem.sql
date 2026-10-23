-- Migration 20261025000200: pedido, viagem, eventos, pausas, ocorrências e canhoto (arquivo da viagem).
--
-- pedido            = o que o cliente pediu (tomador, remetente, destinatário, locais, produto, peso, frete).
-- viagem            = uma carga de um pedido num conjunto. status_campo nulo = Planejada; os demais
--                     valores são as colunas do Quadro da operação, na ordem do enum.
-- viagem_evento     = linha do tempo (de → para). Só as RPCs gravam (Tasks 3 e 4).
-- viagem_pausa      = pausas abertas a partir de Trânsito ou Em rota; uma aberta por viagem. Só as RPCs gravam.
-- viagem_ocorrencia = atraso, avaria, recusa... registradas e resolvidas pela operação (spec 6.4).
-- arquivo           = ganha o dono "viagem" (canhoto e outros). Caminho no Storage:
--                     viagem/<viagem_id>/<arquivo_id>-<nome>.
--
-- Storage: as políticas de storage.objects do bucket "documentos" (0800/0801) não olham o prefixo do
-- caminho (só bucket, pode_ler/pode_editar e arquivo_restrito(name)), então o prefixo viagem/ já é
-- atendido sem mudança. Também não há validação tipo × dono (aplica_* é só metadado para a tela).
-- O que assumia "dono = pessoa ou veículo" e muda aqui: o check arquivo_um_dono, o check
-- tipo_arquivo_aplica_algum e as views de cadastro (v_pendencias_documentos, v_vencimentos), que
-- passam a ignorar arquivos de viagem. As migrations já aplicadas não foram editadas.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.tipo_tarifa as enum ('total', 'por_tonelada');
create type public.origem_frete as enum ('manual', 'tabela');
create type public.situacao_pedido as enum ('aberto', 'cancelado');
create type public.status_campo as enum (
  'transito', 'aguardando_carregamento', 'em_carregamento', 'aguardando_nf_pagamento', 'em_rota', 'pausa',
  'aguardando_descarga', 'aguardando_contagem', 'resolucao_divergencia', 'frete_finalizado');
create type public.resultado_contagem as enum ('sem_divergencia', 'falta', 'sobra', 'avaria');
create type public.tipo_pausa as enum (
  'almoco', 'banheiro', 'descanso_pernoite', 'abastecimento', 'manutencao', 'problema', 'outro');
create type public.tipo_ocorrencia as enum ('atraso', 'avaria', 'recusa', 'sinistro', 'parada_nao_prevista', 'outro');

-- ---------------------------------------------------------------------------
-- pedido
-- ---------------------------------------------------------------------------
create table public.pedido (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  tomador_id uuid not null references public.cliente (pessoa_id) on delete restrict,
  remetente_id uuid not null references public.cliente (pessoa_id) on delete restrict,
  destinatario_id uuid not null references public.cliente (pessoa_id) on delete restrict,
  local_coleta_id uuid not null references public.pessoa_endereco (id) on delete restrict,
  local_descarga_id uuid not null references public.pessoa_endereco (id) on delete restrict,
  produto text not null,
  peso_total_kg numeric(12, 1) not null,
  coleta_prevista date,
  entrega_prevista date,
  frete_empresa_valor numeric(12, 2) not null,
  frete_empresa_tipo public.tipo_tarifa not null default 'por_tonelada',
  frete_empresa_origem public.origem_frete not null default 'manual',
  situacao public.situacao_pedido not null default 'aberto',
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint pedido_peso_total_positivo check (peso_total_kg > 0),
  constraint pedido_frete_empresa_nao_negativo check (frete_empresa_valor >= 0)
);

create index pedido_tomador_id_idx on public.pedido (tomador_id);
create index pedido_remetente_id_idx on public.pedido (remetente_id);
create index pedido_destinatario_id_idx on public.pedido (destinatario_id);
create index pedido_local_coleta_id_idx on public.pedido (local_coleta_id);
create index pedido_local_descarga_id_idx on public.pedido (local_descarga_id);

create trigger pedido_set_updated_at
  before update on public.pedido
  for each row execute function public.fn_set_updated_at();

-- validar_pedido: o local de coleta é um endereço coleta_descarga do remetente; o de descarga, do
-- destinatário. Só confere no insert e quando local ou cliente mudam (editar observação de um pedido
-- antigo não pode falhar porque o endereço mudou de tipo depois). security definer: enxerga o endereço
-- mesmo que o RLS do chamador esconda.
create function public.fn_validar_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.local_coleta_id is distinct from old.local_coleta_id
     or new.remetente_id is distinct from old.remetente_id then
    if not exists (
      select 1 from public.pessoa_endereco e
      where e.id = new.local_coleta_id and e.pessoa_id = new.remetente_id and e.tipo = 'coleta_descarga'
    ) then
      raise exception 'o local de coleta precisa ser um local de coleta/descarga do remetente';
    end if;
  end if;

  if tg_op = 'INSERT'
     or new.local_descarga_id is distinct from old.local_descarga_id
     or new.destinatario_id is distinct from old.destinatario_id then
    if not exists (
      select 1 from public.pessoa_endereco e
      where e.id = new.local_descarga_id and e.pessoa_id = new.destinatario_id and e.tipo = 'coleta_descarga'
    ) then
      raise exception 'o local de descarga precisa ser um local de coleta/descarga do destinatário';
    end if;
  end if;

  return new;
end $$;

revoke execute on function public.fn_validar_pedido() from public, anon, authenticated;

create trigger validar_pedido
  before insert or update on public.pedido
  for each row execute function public.fn_validar_pedido();

-- ---------------------------------------------------------------------------
-- viagem
-- ---------------------------------------------------------------------------
-- cavalo_id e motorista_id são cópia do conjunto no momento do planejamento (o conjunto pode mudar
-- depois, durante a viagem, sem mexer na viagem). Os campos de execução só mudam pelas RPCs.
create table public.viagem (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  pedido_id uuid not null references public.pedido (id) on delete restrict,
  conjunto_id uuid not null references public.conjunto (id) on delete restrict,
  cavalo_id uuid not null references public.veiculo (id) on delete restrict,
  motorista_id uuid not null references public.motorista (pessoa_id) on delete restrict,
  peso_previsto_kg numeric(12, 1) not null,
  frete_motorista_valor numeric(12, 2),
  frete_motorista_tipo public.tipo_tarifa,
  status_campo public.status_campo,
  status_desde timestamptz,
  iniciada_em timestamptz,
  iniciada_por uuid,
  liberacao_justificativa text,
  liberacao_aptidao jsonb,
  peso_saida_kg numeric(12, 1),
  chave_cte char(44),
  chave_mdfe char(44),
  pagamento_saida_em timestamptz,
  pagamento_saida_por uuid,
  peso_chegada_kg numeric(12, 1),
  divergencia public.resultado_contagem,
  divergencia_descricao text,
  resolucao text,
  finalizada_em timestamptz,
  cancelada_em timestamptz,
  cancelada_por uuid,
  cancelamento_motivo text,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint viagem_peso_previsto_positivo check (peso_previsto_kg > 0),
  constraint viagem_frete_motorista_nao_negativo check (frete_motorista_valor >= 0)
);

create index viagem_pedido_id_idx on public.viagem (pedido_id);
create index viagem_conjunto_id_idx on public.viagem (conjunto_id);
create index viagem_cavalo_id_idx on public.viagem (cavalo_id);
create index viagem_motorista_id_idx on public.viagem (motorista_id);

create trigger viagem_set_updated_at
  before update on public.viagem
  for each row execute function public.fn_set_updated_at();

-- validar_viagem (Ruling R2): só no insert e quando conjunto_id, cavalo_id ou motorista_id mudam de
-- fato. Um update de outra coluna (observação, ou as RPCs mudando status) não reconfere o conjunto,
-- senão uma troca de motorista no conjunto travaria a viagem em curso.
-- Regras: o conjunto só muda com status_campo nulo (Planejada); conjunto aberto; conjunto com
-- motorista; cavalo e motorista da viagem iguais aos do conjunto.
create function public.fn_validar_viagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cavalo uuid;
  v_motorista uuid;
  v_fim timestamptz;
begin
  if tg_op = 'UPDATE'
     and new.conjunto_id is not distinct from old.conjunto_id
     and new.cavalo_id is not distinct from old.cavalo_id
     and new.motorista_id is not distinct from old.motorista_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.conjunto_id is distinct from old.conjunto_id and old.status_campo is not null then
    raise exception 'o conjunto só muda antes de a viagem começar';
  end if;

  select c.cavalo_id, c.motorista_id, c.fim into v_cavalo, v_motorista, v_fim
  from public.conjunto c
  where c.id = new.conjunto_id;
  if not found then
    raise exception 'conjunto não encontrado';
  end if;

  if v_fim is not null then
    raise exception 'o conjunto está encerrado; escolha um conjunto aberto';
  end if;
  if v_motorista is null then
    raise exception 'o conjunto não tem motorista';
  end if;
  if new.cavalo_id is distinct from v_cavalo then
    raise exception 'o cavalo da viagem precisa ser o do conjunto';
  end if;
  if new.motorista_id is distinct from v_motorista then
    raise exception 'o motorista da viagem precisa ser o do conjunto';
  end if;

  return new;
end $$;

revoke execute on function public.fn_validar_viagem() from public, anon, authenticated;

create trigger validar_viagem
  before insert or update on public.viagem
  for each row execute function public.fn_validar_viagem();

-- ---------------------------------------------------------------------------
-- viagem_evento (linha do tempo; gravada só pelas RPCs)
-- ---------------------------------------------------------------------------
create table public.viagem_evento (
  id bigint generated always as identity primary key,
  viagem_id uuid not null references public.viagem (id) on delete cascade,
  de public.status_campo,
  para public.status_campo,
  em timestamptz not null default now(),
  por uuid default auth.uid(),
  motivo text,
  dados jsonb not null default '{}'
);

create index viagem_evento_viagem_id_idx on public.viagem_evento (viagem_id, em);

-- ---------------------------------------------------------------------------
-- viagem_pausa (gravada só pelas RPCs)
-- ---------------------------------------------------------------------------
create table public.viagem_pausa (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid not null references public.viagem (id) on delete cascade,
  tipo public.tipo_pausa not null,
  programada boolean not null,
  coluna_origem public.status_campo not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  constraint viagem_pausa_coluna_origem check (coluna_origem in ('transito', 'em_rota')),
  constraint viagem_pausa_fim_depois_do_inicio check (fim is null or fim > inicio)
);

create index viagem_pausa_viagem_id_idx on public.viagem_pausa (viagem_id);
-- Uma pausa aberta por viagem.
create unique index viagem_pausa_aberta_uk on public.viagem_pausa (viagem_id) where fim is null;

-- ---------------------------------------------------------------------------
-- viagem_ocorrencia (spec 6.4)
-- ---------------------------------------------------------------------------
create table public.viagem_ocorrencia (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid not null references public.viagem (id) on delete cascade,
  tipo public.tipo_ocorrencia not null,
  descricao text not null,
  aberta_em timestamptz not null default now(),
  aberta_por uuid default auth.uid(),
  resolvida_em timestamptz,
  resolvida_por uuid,
  resolucao text,
  -- resolvida exige o texto da resolução, e texto de resolução exige a data.
  constraint viagem_ocorrencia_resolucao check ((resolvida_em is null) = (resolucao is null))
);

create index viagem_ocorrencia_viagem_id_idx on public.viagem_ocorrencia (viagem_id);

-- ---------------------------------------------------------------------------
-- arquivo: dono "viagem" e tipos de arquivo da viagem
-- ---------------------------------------------------------------------------
alter table public.arquivo add column viagem_id uuid references public.viagem (id) on delete cascade;
create index arquivo_viagem_id_idx on public.arquivo (viagem_id);

alter table public.arquivo drop constraint arquivo_um_dono;
alter table public.arquivo add constraint arquivo_um_dono check (num_nonnulls(pessoa_id, veiculo_id, viagem_id) = 1);

alter table public.tipo_arquivo add column aplica_viagem boolean not null default false;
alter table public.tipo_arquivo drop constraint tipo_arquivo_aplica_algum;
alter table public.tipo_arquivo add constraint tipo_arquivo_aplica_algum
  check (aplica_pessoa or aplica_veiculo or aplica_viagem);

update public.tipo_arquivo set aplica_viagem = true where id = 14; -- OUTROS
insert into public.tipo_arquivo (id, nome, aplica_pessoa, aplica_veiculo, aplica_viagem) overriding system value
values (15, 'CANHOTO', false, false, true);
select setval(pg_get_serial_sequence('public.tipo_arquivo', 'id'), (select max(id) from public.tipo_arquivo));

-- Views de cadastro: arquivos de viagem não são pendência nem vencimento de cadastro.
-- create or replace: mesmas colunas, ordem e tipos; reloptions, grants e comentários preservados.
-- Corpo igual ao da migration dia_brasilia, só com "a.viagem_id is null" na parte de arquivos.
create or replace view public.v_vencimentos
with (security_invoker = true) as
with cadastro as (
  select 'CNH'::text as tipo, m.pessoa_id, null::uuid as veiculo_id, null::uuid as arquivo_id, m.cnh_validade as data,
         (m.situacao_cadastro = 'cancelado') as cancelado
  from public.motorista m
  where m.cnh_validade is not null
  union all
  select 'Consulta de risco'::text, m.pessoa_id, null::uuid, null::uuid, m.gr_validade,
         (m.situacao_cadastro = 'cancelado')
  from public.motorista m
  where m.gr_validade is not null
  union all
  select 'RNTRC'::text, p.pessoa_id, null::uuid, null::uuid, p.rntrc_validade, false
  from public.proprietario p
  where p.rntrc_validade is not null
  union all
  select 'Seguro'::text, null::uuid, v.id, null::uuid, v.seguro_validade, false
  from public.veiculo v
  where v.seguro_validade is not null
  union all
  select 'IPVA'::text, null::uuid, v.id, null::uuid, v.venc_ipva, false
  from public.veiculo v
  where v.venc_ipva is not null
)
select c.tipo, c.pessoa_id, c.veiculo_id, c.arquivo_id, c.data, (c.data - (now() at time zone 'America/Sao_Paulo')::date)::int as dias
from cadastro c
where not c.cancelado
union all
select t.nome, a.pessoa_id, a.veiculo_id, a.id, a.validade, (a.validade - (now() at time zone 'America/Sao_Paulo')::date)::int
from public.arquivo a
join public.tipo_arquivo t on t.id = a.tipo_arquivo_id
where a.validade is not null
  and a.viagem_id is null
  and not exists (
    select 1
    from cadastro c
    where c.tipo = case t.nome when 'ANTT' then 'RNTRC' else t.nome end
      and c.pessoa_id is not distinct from a.pessoa_id
      and c.veiculo_id is not distinct from a.veiculo_id);

create or replace view public.v_pendencias_documentos
with (security_invoker = true) as
select
  'veiculo_arrendado_sem_contrato'::text as tipo_pendencia,
  null::uuid as pessoa_id,
  v.id as veiculo_id,
  null::uuid as arquivo_id,
  'Veículo arrendado ' || v.placa || ' sem contrato' as descricao
from public.veiculo v
where v.arrendado
  and not public.existe_arquivo_enviado(null, v.id, 'CONTRATO')
union all
select
  'arquivo_vencido'::text,
  a.pessoa_id,
  a.veiculo_id,
  a.id,
  'Arquivo ' || t.nome || ' vencido em ' || to_char(a.validade, 'DD/MM/YYYY')
from public.arquivo a
join public.tipo_arquivo t on t.id = a.tipo_arquivo_id
where a.validade < (now() at time zone 'America/Sao_Paulo')::date
  and a.viagem_id is null
union all
select
  'motorista_sem_cnh'::text,
  m.pessoa_id,
  null::uuid,
  null::uuid,
  'Motorista ' || p.nome || ' sem CNH'
from public.motorista m
join public.pessoa p on p.id = m.pessoa_id
where not public.existe_arquivo_enviado(m.pessoa_id, null, 'CNH')
union all
select
  'motorista_sem_comprovante'::text,
  m.pessoa_id,
  null::uuid,
  null::uuid,
  'Motorista ' || p.nome || ' sem comprovante de residência'
from public.motorista m
join public.pessoa p on p.id = m.pessoa_id
where not public.existe_arquivo_enviado(m.pessoa_id, null, 'COMP. RESIDÊNCIA');

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS governa as linhas)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.pedido from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.pedido from anon;

-- viagem: pela API só se cria e se edita o planejamento; status, pesos, chaves, pagamento, divergência,
-- finalização e cancelamento só mudam pelas RPCs (security definer) das Tasks 3 e 4. O insert também é
-- por coluna, para ninguém criar uma viagem já "em rota" ou finalizada.
revoke truncate, references, trigger on public.viagem from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.viagem from anon;
revoke insert, update on public.viagem from authenticated;
grant insert (id, pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, frete_motorista_valor,
              frete_motorista_tipo, observacao) on public.viagem to authenticated;
grant update (conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, frete_motorista_valor, frete_motorista_tipo,
              observacao) on public.viagem to authenticated;

-- viagem_evento e viagem_pausa: só leitura pela API.
revoke insert, update, delete, truncate, references, trigger on public.viagem_evento from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.viagem_evento from anon;
revoke insert, update, delete, truncate, references, trigger on public.viagem_pausa from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.viagem_pausa from anon;

revoke truncate, references, trigger on public.viagem_ocorrencia from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.viagem_ocorrencia from anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pedido enable row level security;
alter table public.viagem enable row level security;
alter table public.viagem_evento enable row level security;
alter table public.viagem_pausa enable row level security;
alter table public.viagem_ocorrencia enable row level security;

create policy pedido_select on public.pedido
  for select to authenticated using ((select public.pode_ler()));
create policy pedido_insert on public.pedido
  for insert to authenticated with check ((select public.pode_editar()));
create policy pedido_update on public.pedido
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy pedido_delete on public.pedido
  for delete to authenticated using ((select public.eh_admin()));

create policy viagem_select on public.viagem
  for select to authenticated using ((select public.pode_ler()));
create policy viagem_insert on public.viagem
  for insert to authenticated with check ((select public.pode_editar()));
create policy viagem_update on public.viagem
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy viagem_delete on public.viagem
  for delete to authenticated using ((select public.eh_admin()));

create policy viagem_evento_select on public.viagem_evento
  for select to authenticated using ((select public.pode_ler()));

create policy viagem_pausa_select on public.viagem_pausa
  for select to authenticated using ((select public.pode_ler()));

create policy viagem_ocorrencia_select on public.viagem_ocorrencia
  for select to authenticated using ((select public.pode_ler()));
create policy viagem_ocorrencia_insert on public.viagem_ocorrencia
  for insert to authenticated with check ((select public.pode_editar()));
create policy viagem_ocorrencia_update on public.viagem_ocorrencia
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy viagem_ocorrencia_delete on public.viagem_ocorrencia
  for delete to authenticated using ((select public.eh_admin()));

-- ---------------------------------------------------------------------------
-- Auditoria (viagem_evento já é o próprio registro histórico)
-- ---------------------------------------------------------------------------
select public.auditar('public.pedido');
select public.auditar('public.viagem');
select public.auditar('public.viagem_pausa');
select public.auditar('public.viagem_ocorrencia');
