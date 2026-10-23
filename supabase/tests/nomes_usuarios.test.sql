-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Migration nomes_usuarios: public.nomes_usuarios(uuid[]) devolve só user_id e nome, e só para
-- quem tem pode_ler(). Sem perfil / desativado: conjunto vazio (sem erro). anon: sem execute.
-- Nenhum DELETE; todo UPDATE tem WHERE.

create function tests.test_nomes_usuarios_operacao_ve_nome_do_admin() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm.nomes@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op.nomes@exemplo.test', 'operacao');
  v_outro uuid := tests.criar_usuario('outro.nomes@exemplo.test', 'leitura');
  v_nome text;
  v_n bigint;
  v_n_perfil bigint;
begin
  update public.perfil_usuario set nome = 'Admin Nomes' where user_id = v_adm;

  perform tests.como(v_op);
  select u.nome into v_nome from public.nomes_usuarios(array[v_adm]) u;
  select count(*) into v_n from public.nomes_usuarios(array[v_adm, v_op]) u;
  -- pelo RLS direto, a operação só enxerga o próprio perfil
  select count(*) into v_n_perfil from public.perfil_usuario p where p.user_id = v_adm;
  perform tests.como_servico();

  return next is(v_nome, 'Admin Nomes', 'operação vê o nome do admin pela função');
  return next is(v_n, 2::bigint, 'devolve só os ids pedidos (2 de 3 usuários criados)');
  return next is(v_n_perfil, 0::bigint, 'o RLS de perfil_usuario continua escondendo o admin da operação');
end $$;

create function tests.test_nomes_usuarios_leitura_tambem_ve() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm2.nomes@exemplo.test', 'admin');
  v_leit uuid := tests.criar_usuario('leit.nomes@exemplo.test', 'leitura');
  v_n bigint;
begin
  perform tests.como(v_leit);
  select count(*) into v_n from public.nomes_usuarios(array[v_adm]) u;
  perform tests.como_servico();
  return next is(v_n, 1::bigint, 'leitura (pode_ler) vê o nome');
end $$;

create function tests.test_nomes_usuarios_sem_perfil_nao_ve() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm3.nomes@exemplo.test', 'admin');
  v_sem uuid := tests.criar_usuario('sem.nomes@exemplo.test', null);
  v_inativo uuid := tests.criar_usuario('inativo.nomes@exemplo.test', 'operacao');
  v_n_sem bigint;
  v_n_inativo bigint;
begin
  update public.perfil_usuario set ativo = false where user_id = v_inativo;

  perform tests.como(v_sem);
  select count(*) into v_n_sem from public.nomes_usuarios(array[v_adm, v_sem, v_inativo]) u;
  perform tests.como_servico();
  perform tests.como(v_inativo);
  select count(*) into v_n_inativo from public.nomes_usuarios(array[v_adm, v_inativo]) u;
  perform tests.como_servico();

  return next is(v_n_sem, 0::bigint, 'usuário sem perfil não vê nenhum nome');
  return next is(v_n_inativo, 0::bigint, 'perfil desativado não vê nenhum nome');
end $$;

create function tests.test_nomes_usuarios_privilegios_e_colunas() returns setof text language plpgsql as $$
begin
  return next ok(not has_function_privilege('anon', 'public.nomes_usuarios(uuid[])', 'execute'),
    'anon não executa nomes_usuarios');
  return next ok(has_function_privilege('authenticated', 'public.nomes_usuarios(uuid[])', 'execute'),
    'authenticated executa nomes_usuarios');
  return next is(pg_get_function_result('public.nomes_usuarios(uuid[])'::regprocedure),
    'TABLE(user_id uuid, nome text)', 'devolve só user_id e nome (sem e-mail, papel ou situação)');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
