-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
create function tests.test_papel_atual() returns setof text language plpgsql as $$
declare
  v_uid uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_papel public.app_papel;
begin
  perform tests.como(v_uid);
  v_papel := public.papel_atual();
  perform tests.como_servico();
  return next is(v_papel, 'operacao'::public.app_papel, 'papel_atual devolve o papel do usuário');
end $$;

create function tests.test_sem_perfil_nao_le() returns setof text language plpgsql as $$
declare
  v_uid uuid := tests.criar_usuario('semperfil@exemplo.test', null);
  v_pode boolean;
  v_papel public.app_papel;
  v_qtd bigint;
begin
  perform tests.criar_usuario('outro@exemplo.test', 'leitura');
  perform tests.como(v_uid);
  v_pode := public.pode_ler();
  v_papel := public.papel_atual();
  select count(*) into v_qtd from public.perfil_usuario;
  perform tests.como_servico();
  return next ok(not v_pode, 'sem perfil não pode ler');
  return next is(v_papel, null, 'sem perfil papel_atual é null');
  return next is(v_qtd, 0::bigint, 'sem perfil não enxerga nenhum perfil');
end $$;

create function tests.test_inativo_sem_acesso() returns setof text language plpgsql as $$
declare
  v_uid uuid := tests.criar_usuario('inativo@exemplo.test', 'operacao');
  v_editar boolean;
  v_ler boolean;
  v_admin boolean;
begin
  update public.perfil_usuario set ativo = false where user_id = v_uid;
  perform tests.como(v_uid);
  v_editar := public.pode_editar();
  v_ler := public.pode_ler();
  v_admin := public.eh_admin();
  perform tests.como_servico();
  return next ok(not v_editar, 'inativo não pode editar');
  return next ok(not v_ler, 'inativo não pode ler');
  return next ok(not v_admin, 'inativo não é admin');
end $$;

create function tests.test_atalhos_por_papel() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op2@exemplo.test', 'operacao');
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_r boolean[];
begin
  perform tests.como(v_admin);
  v_r := array[public.pode_ler(), public.pode_editar(), public.eh_admin()];
  perform tests.como_servico();
  return next is(v_r, array[true, true, true], 'admin: ler, editar, admin');

  perform tests.como(v_op);
  v_r := array[public.pode_ler(), public.pode_editar(), public.eh_admin()];
  perform tests.como_servico();
  return next is(v_r, array[true, true, false], 'operacao: ler, editar, não admin');

  perform tests.como(v_fin);
  v_r := array[public.pode_ler(), public.pode_editar(), public.eh_admin()];
  perform tests.como_servico();
  return next is(v_r, array[true, false, false], 'financeiro: só ler');

  perform tests.como(v_lei);
  v_r := array[public.pode_ler(), public.pode_editar(), public.eh_admin()];
  perform tests.como_servico();
  return next is(v_r, array[true, false, false], 'leitura: só ler');
end $$;

create function tests.test_so_admin_altera_perfil() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('adm3@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op3@exemplo.test', 'operacao');
  v_n_op int;
  v_n_admin int;
  v_papel public.app_papel;
  v_vistos bigint;
  v_by uuid;
begin
  -- operacao: vê só o próprio perfil e não consegue alterar nada
  perform tests.como(v_op);
  select count(*) into v_vistos from public.perfil_usuario;
  update public.perfil_usuario set papel = 'admin' where user_id = v_op;
  get diagnostics v_n_op = row_count;
  perform tests.como_servico();
  select papel into v_papel from public.perfil_usuario where user_id = v_op;
  return next is(v_vistos, 1::bigint, 'operacao enxerga apenas o próprio perfil');
  return next is(v_n_op, 0, 'operacao altera 0 linhas');
  return next is(v_papel, 'operacao'::public.app_papel, 'papel de operacao permanece');

  -- operacao não insere
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.perfil_usuario (user_id, nome, papel) values (gen_random_uuid(), 'x', 'admin')$q$)$f$, v_op),
    '42501', null, 'operacao não insere perfil');

  -- admin: enxerga todos e altera 1 linha
  perform tests.como(v_admin);
  select count(*) into v_vistos from public.perfil_usuario;
  update public.perfil_usuario set nome = 'Operação Teste' where user_id = v_op;
  get diagnostics v_n_admin = row_count;
  perform tests.como_servico();
  select updated_by into v_by from public.perfil_usuario where user_id = v_op;
  return next is(v_vistos, 2::bigint, 'admin enxerga todos os perfis');
  return next is(v_n_admin, 1, 'admin altera 1 linha');
  return next is(v_by, v_admin, 'trigger carimba updated_by com o admin');
end $$;

-- "Só admin apaga" verificado pela estrutura da política (o teste não executa remoções).
create function tests.test_politica_exclusao_so_admin() returns setof text language plpgsql as $$
declare
  v_n int;
  v_qual text;
begin
  select count(*), max(qual) into v_n, v_qual
  from pg_policies
  where schemaname = 'public' and tablename = 'perfil_usuario' and cmd = 'DELETE';
  return next is(v_n, 1, 'existe exatamente uma política de exclusão em perfil_usuario');
  return next ok(v_qual like '%eh_admin%', 'política de exclusão exige eh_admin()');
end $$;

create function tests.test_funcoes_sem_acesso_anon() returns setof text language plpgsql as $$
begin
  return next ok(not has_function_privilege('anon', 'public.pode_ler()', 'execute'), 'anon sem execute em pode_ler');
  return next ok(not has_function_privilege('anon', 'public.papel_atual()', 'execute'), 'anon sem execute em papel_atual');
  return next ok(has_function_privilege('authenticated', 'public.eh_admin()', 'execute'), 'authenticated executa eh_admin');
  return next ok(has_function_privilege('authenticated', 'public.tem_papel(public.app_papel[])', 'execute'), 'authenticated executa tem_papel');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
