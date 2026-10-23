-- Migration 0401: corrige os checks de formato de CPF/CNPJ da migration 0400.
--
-- Em 0400 os checks eram `cpf ~ '^[0-9]{11}$' and public.cpf_valido(cpf)`. Com cpf null isso vira
-- `null and false` = false (cpf_valido(null) devolve false), então toda PJ (cpf null) e toda PF
-- (cnpj null) era recusada. Os checks precisam aceitar null explicitamente.

alter table public.pessoa drop constraint pessoa_cpf_formato;
alter table public.pessoa drop constraint pessoa_cnpj_formato;

alter table public.pessoa
  add constraint pessoa_cpf_formato
  check (cpf is null or (cpf ~ '^[0-9]{11}$' and public.cpf_valido(cpf)));

alter table public.pessoa
  add constraint pessoa_cnpj_formato
  check (cnpj is null or (cnpj ~ '^[0-9]{14}$' and public.cnpj_valido(cnpj)));
