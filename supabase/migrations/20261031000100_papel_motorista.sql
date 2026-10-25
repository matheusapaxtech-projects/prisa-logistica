-- Migration 20261031000100: papel "motorista" para o login do app do motorista e do agregado.
--
-- O valor novo fica sozinho nesta migration: o Postgres não deixa usar um valor de enum na mesma transação que
-- o criou, e a 20261031000200 usa 'motorista'. pode_ler(), pode_editar() e eh_admin() listam os papéis um a
-- um, então o motorista não lê nem grava nenhuma tabela do sistema: tudo do app passa pelas funções da
-- 20261031000200, que filtram pelo próprio motorista.

alter type public.app_papel add value if not exists 'motorista';
