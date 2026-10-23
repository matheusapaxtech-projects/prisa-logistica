-- Migration dia_brasilia: "hoje" das views de vencimento é o dia de Brasília, não o do servidor.
--
-- O TimeZone do banco é UTC e o app conta os dias em America/Sao_Paulo (lib/datas.ts). Com `current_date`,
-- das 21h à meia-noite (BRT) o banco já estava no dia seguinte: um documento que vence hoje aparecia como
-- "vencido" no selo, no Início e em Pendências, mas "vence hoje" na ficha. Agora as duas views que as telas
-- leem usam (now() at time zone 'America/Sao_Paulo')::date.
--
-- create or replace view: mesmas colunas, ordem e tipos; reloptions e grants preservados
-- (security_invoker = true repetido de propósito). As migrations 0101 e 0300 não foram editadas.
--
-- Fora daqui (não é lida por nenhuma tela): public.v_motorista_situacao (migration 0500) ainda usa
-- current_date.

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
