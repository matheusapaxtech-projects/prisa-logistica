-- Migration 20261030000100: a gerenciadora de risco também recusa motorista.
--
-- situacao_gr tinha sem_consulta, habilitado e vencido. O despacho do sistema do sócio
-- (prisa-sistema.vercel.app/despacho) trata "recusado pela gerenciadora de risco" como impedimento para
-- contratar. O valor novo fica sozinho nesta migration: o Postgres não deixa usar um valor de enum na mesma
-- transação que o criou, e a 20261030000200 usa 'recusado' em aptidao_viagem.

alter type public.situacao_gr add value if not exists 'recusado';
