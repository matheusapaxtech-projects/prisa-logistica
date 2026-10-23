-- Migration pendencias_arquivos: a pendência de documento só some quando o arquivo existe de verdade.
--
-- Dois defeitos de v_pendencias_documentos (migration 0800):
--   1. Um arquivo restrito (CONTRATO, CNH...) é invisível para quem não é admin pelo RLS, então para
--      a operação a pendência "sem contrato / sem CNH" aparecia mesmo com o arquivo anexado.
--   2. O fluxo de envio grava a linha em `arquivo` antes de enviar o objeto ao Storage; se o envio falha,
--      a linha fica e a pendência sumia sem o arquivo existir.
--
-- existe_arquivo_enviado(pessoa, veículo, tipo) responde só "existe?" (1 bit, restrito ou não) e só
-- conta a linha cujo objeto existe em storage.objects. security definer porque enxerga o que o RLS do
-- chamador esconde; só quem tem pode_ler() recebe true. Revela a existência, como arquivo_restrito
-- já revela, e nada além disso.

create function public.existe_arquivo_enviado(p_pessoa_id uuid, p_veiculo_id uuid, p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select public.pode_ler())
    and exists (
      select 1
      from public.arquivo a
      join public.tipo_arquivo t on t.id = a.tipo_arquivo_id
      join storage.objects o on o.bucket_id = 'documentos' and o.name = a.storage_path
      where t.nome = p_tipo
        and ((p_pessoa_id is not null and a.pessoa_id = p_pessoa_id)
          or (p_veiculo_id is not null and a.veiculo_id = p_veiculo_id)));
$$;

revoke execute on function public.existe_arquivo_enviado(uuid, uuid, text) from public, anon;
grant execute on function public.existe_arquivo_enviado(uuid, uuid, text) to authenticated;

-- Mesmas colunas, mesma ordem, security_invoker e grants da view original (create or replace os preserva).
-- arquivo_vencido continua olhando as linhas que o RLS do usuário deixa ver.
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
where a.validade < current_date
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
