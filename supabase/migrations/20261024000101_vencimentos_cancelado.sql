-- Migration vencimentos_cancelado: arquivo de motorista cancelado não vaza para v_vencimentos.
--
-- Na versão anterior o CTE `cadastro` já descartava as linhas de motorista com cadastro cancelado;
-- por isso o `not exists` da parte de arquivos não achava a linha de cadastro e o arquivo CNH vencido de
-- um motorista cancelado aparecia como vencimento. Agora o CTE mantém as linhas de motorista cancelado
-- com a flag `cancelado`: elas participam da deduplicação (o arquivo do mesmo documento some) e só são
-- filtradas no resultado final. Arquivos de outros documentos do mesmo motorista (ex.: CND) continuam.
--
-- create or replace view: mesmas colunas, ordem e tipos; reloptions e grants da view são preservados
-- (security_invoker = true repetido de propósito).

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
select c.tipo, c.pessoa_id, c.veiculo_id, c.arquivo_id, c.data, (c.data - current_date)::int as dias
from cadastro c
where not c.cancelado
union all
select t.nome, a.pessoa_id, a.veiculo_id, a.id, a.validade, (a.validade - current_date)::int
from public.arquivo a
join public.tipo_arquivo t on t.id = a.tipo_arquivo_id
where a.validade is not null
  and not exists (
    select 1
    from cadastro c
    where c.tipo = case t.nome when 'ANTT' then 'RNTRC' else t.nome end
      and c.pessoa_id is not distinct from a.pessoa_id
      and c.veiculo_id is not distinct from a.veiculo_id);

comment on view public.v_vencimentos is
  'Todos os vencimentos (cadastro + arquivos com validade), com dias = data - hoje (negativo = vencido). '
  'Deduplicação: um arquivo some quando há linha de cadastro do mesmo tipo e dono (CNH com CNH, ANTT com RNTRC), '
  'comparando só tipo e dono e ignorando a data; fica a linha do cadastro. Motorista com cadastro cancelado não '
  'gera vencimento de cadastro (CNH, consulta de risco) nem do arquivo do mesmo documento (CNH). '
  'security_invoker: vale o RLS de quem consulta (arquivo restrito só aparece para admin).';

comment on function public.salvar_conjunto(uuid, uuid, uuid, uuid[]) is
  'Salva um conjunto: encerra o informado e qualquer aberto do mesmo cavalo, insere o novo com os itens e valida. '
  'O `set constraints all immediate` do fim vale até o fim da transação (pensado para uma RPC por transação, como no '
  'PostgREST); quem a chamar dentro de uma transação maior fica com as validações de conjunto imediatas nas '
  'instruções seguintes.';
