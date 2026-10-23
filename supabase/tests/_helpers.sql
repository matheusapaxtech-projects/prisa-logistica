begin;
-- Helpers de teste. Colado ANTES de cada arquivo *.test.sql (ver README.md).
-- Este arquivo abre a transação; cada arquivo de teste termina com `rollback;`.
create schema tests;

grant usage on schema tests to authenticated;

-- Cria um usuário em auth.users e, se p_papel não for nulo, o perfil em public.perfil_usuario
-- (a tabela perfil_usuario só existe a partir da Task 3; antes disso use p_papel => null).
create function tests.criar_usuario(p_email text, p_papel text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role)
  values (v_id, p_email, 'authenticated', 'authenticated');

  if p_papel is not null then
    insert into public.perfil_usuario (user_id, nome, papel)
    values (v_id, p_email, p_papel::public.app_papel);
  end if;

  return v_id;
end $$;

-- Passa a agir como o usuário p_uid (papel authenticated + claims JWT).
create function tests.como(p_uid uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- Volta ao papel de serviço (postgres).
create function tests.como_servico()
returns void
language plpgsql
set search_path = ''
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Executa p_sql como o usuário p_uid e SEMPRE volta ao papel de serviço.
-- Use para DML/consultas do usuário sem que o pgTAP (que grava em tabelas temporárias
-- do postgres) rode com o papel authenticated ativo. Falha em p_sql propaga o erro
-- (dentro de throws_ok o rollback da subtransação já restaura o papel).
create function tests.executar_como(p_uid uuid, p_sql text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform tests.como(p_uid);
  execute p_sql;
  perform tests.como_servico();
end $$;

grant execute on all functions in schema tests to authenticated;
