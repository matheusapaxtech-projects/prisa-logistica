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
  select count(*) into v_vistos from public.perfil_usuario where user_id in (v_admin, v_op);
  update public.perfil_usuario set nome = 'Operação Teste' where user_id = v_op;
  get diagnostics v_n_admin = row_count;
  perform tests.como_servico();
  select updated_by into v_by from public.perfil_usuario where user_id = v_op;
  return next is(v_vistos, 2::bigint, 'admin enxerga os perfis de outros usuários (os dois do teste)');
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

-- Task 10 (migration ajustes_advisors): privilégios de todas as tabelas/views de public.
create function tests.test_privilegios_gerais_public() returns setof text language plpgsql as $$
declare
  r record;
  v_ruins text;
begin
  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger', 'maintain']) p
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('anon', c.oid, p);
  return next is(v_ruins, null, 'anon sem nenhum privilégio em tabelas e views de public');

  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(array['truncate', 'references', 'trigger', 'maintain']) p
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('authenticated', c.oid, p);
  return next is(v_ruins, null, 'authenticated sem truncate/references/trigger/maintain em public');

  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not has_table_privilege('authenticated', c.oid, 'select');
  return next is(v_ruins, null, 'authenticated mantém select em todas as tabelas (RLS decide as linhas)');

  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  return next is(v_ruins, null, 'todas as tabelas de public têm RLS ligado');

  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_policies pp where pp.schemaname = 'public' and pp.tablename = c.relname);
  return next is(v_ruins, null, 'nenhuma tabela de public sem política');

  select string_agg(c.relname, ', ') into v_ruins
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce(c.reloptions::text[] @> array['security_invoker=true'], false);
  return next is(v_ruins, null, 'toda view de public é security_invoker');

  return next ok(not has_function_privilege('anon', 'public.fn_set_updated_at()', 'execute'),
    'fn_set_updated_at: anon sem execute');
  return next ok(not has_function_privilege('authenticated', 'public.fn_set_updated_at()', 'execute'),
    'fn_set_updated_at: authenticated sem execute');
  return next ok(not has_function_privilege('public', 'public.fn_set_updated_at()', 'execute'),
    'fn_set_updated_at: public sem execute');
end $$;

-- Migration 0901 (privilegios_padrao): default privileges do postgres em public.
-- Parte 1 lê pg_default_acl; parte 2 cria objetos descartáveis (desfeitos pelo rollback do teste)
-- e confere os privilégios que eles realmente recebem.
create function tests.test_privilegios_padrao() returns setof text language plpgsql as $$
declare
  v_anon oid := (select oid from pg_roles where rolname = 'anon');
  v_auth oid := (select oid from pg_roles where rolname = 'authenticated');
  v_ruins text;
begin
  select string_agg(d.defaclobjtype::text || ':' || p.privilege_type, ', ') into v_ruins
  from pg_default_acl d
  join pg_roles r on r.oid = d.defaclrole and r.rolname = 'postgres'
  join pg_namespace n on n.oid = d.defaclnamespace and n.nspname = 'public'
  cross join lateral aclexplode(d.defaclacl) p
  where p.grantee = v_anon;
  return next is(v_ruins, null, 'default privileges (postgres, public): anon sem nada em tabelas, funções e sequências');

  select string_agg(d.defaclobjtype::text || ':' || p.privilege_type, ', ') into v_ruins
  from pg_default_acl d
  join pg_roles r on r.oid = d.defaclrole and r.rolname = 'postgres'
  join pg_namespace n on n.oid = d.defaclnamespace and n.nspname = 'public'
  cross join lateral aclexplode(d.defaclacl) p
  where p.grantee = v_auth and d.defaclobjtype = 'r'
    and p.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');
  return next is(v_ruins, null, 'default privileges (postgres, public): authenticated sem truncate/references/trigger/maintain em tabelas');

  select string_agg(d.defaclobjtype::text || ':' || p.privilege_type, ', ') into v_ruins
  from pg_default_acl d
  join pg_roles r on r.oid = d.defaclrole and r.rolname = 'postgres'
  cross join lateral aclexplode(d.defaclacl) p
  where p.grantee = 0 and d.defaclobjtype = 'f';
  return next is(v_ruins, null, 'default privileges (postgres): PUBLIC sem execute em funções futuras');

  -- Comportamento: objetos novos criados pelo postgres em public.
  create table public.tests_tmp_priv (id int primary key, x int);
  create sequence public.tests_tmp_seq;
  create function public.tests_tmp_fn() returns int language sql set search_path = '' as 'select 1';

  return next ok(not has_table_privilege('anon', 'public.tests_tmp_priv', 'select'), 'tabela nova: anon sem select');
  return next ok(not has_table_privilege('anon', 'public.tests_tmp_priv', 'insert'), 'tabela nova: anon sem insert');
  return next ok(not has_table_privilege('authenticated', 'public.tests_tmp_priv', 'truncate'), 'tabela nova: authenticated sem truncate');
  return next ok(not has_table_privilege('authenticated', 'public.tests_tmp_priv', 'trigger'), 'tabela nova: authenticated sem trigger');
  return next ok(has_table_privilege('authenticated', 'public.tests_tmp_priv', 'select'), 'tabela nova: authenticated mantém select (RLS decide)');
  return next ok(not has_sequence_privilege('anon', 'public.tests_tmp_seq', 'usage'), 'sequência nova: anon sem usage');
  return next ok(not has_function_privilege('anon', 'public.tests_tmp_fn()', 'execute'), 'função nova: anon sem execute');
  return next ok(not has_function_privilege('public', 'public.tests_tmp_fn()', 'execute'), 'função nova: PUBLIC sem execute');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
