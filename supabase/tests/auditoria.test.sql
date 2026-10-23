-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Nenhum teste executa remoções: a declaração do gatilho para delete é verificada em pg_trigger.

create function tests.test_auditoria_grava_update() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.aud@exemplo.test', 'operacao');
  v_id uuid := gen_random_uuid();
  v_qtd bigint;
  v_depois text;
  v_antes text;
  v_reg text;
  v_usuario uuid;
begin
  create table tests.t (id uuid primary key default gen_random_uuid(), x int);
  grant select, insert, update on tests.t to authenticated;
  perform public.auditar('tests.t');

  perform tests.executar_como(v_op, format('insert into tests.t (id, x) values (%L, 1)', v_id));
  perform tests.executar_como(v_op, format('update tests.t set x = 2 where id = %L', v_id));

  select count(*) into v_qtd from public.auditoria where tabela = 't';
  select dados_depois ->> 'x', dados_antes ->> 'x', registro_id, usuario_id
    into v_depois, v_antes, v_reg, v_usuario
  from public.auditoria where tabela = 't' and acao = 'update';

  return next is(v_qtd, 2::bigint, 'insert e update geram 2 linhas de auditoria');
  return next is(v_depois, '2', 'update grava dados_depois');
  return next is(v_antes, '1', 'update grava dados_antes');
  return next is(v_reg, v_id::text, 'registro_id é o id da linha');
  return next is(v_usuario, v_op, 'usuario_id é o auth.uid() de quem alterou');
end $$;

create function tests.test_auditoria_insert_sem_antes() returns setof text language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_antes jsonb;
  v_depois jsonb;
begin
  create table tests.t (id uuid primary key default gen_random_uuid(), x int);
  perform public.auditar('tests.t');
  insert into tests.t (id, x) values (v_id, 7);
  select dados_antes, dados_depois into v_antes, v_depois
  from public.auditoria where tabela = 't' and acao = 'insert';
  return next is(v_antes, null, 'insert não tem dados_antes');
  return next is(v_depois ->> 'x', '7', 'insert grava dados_depois');
end $$;

create function tests.test_auditoria_chave_composta() returns setof text language plpgsql as $$
declare
  v_reg text;
begin
  create table tests.t2 (a int, b int, x int, primary key (a, b));
  perform public.auditar('tests.t2');
  insert into tests.t2 (a, b, x) values (3, 9, 1);
  select registro_id into v_reg from public.auditoria where tabela = 't2' and acao = 'insert';
  return next is(v_reg, '3:9', 'chave composta vira valores unidos por dois-pontos');
end $$;

create function tests.test_auditoria_pk_pessoa_id() returns setof text language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_reg text;
begin
  create table tests.t3 (pessoa_id uuid primary key, x int);
  perform public.auditar('tests.t3');
  insert into tests.t3 (pessoa_id, x) values (v_id, 1);
  select registro_id into v_reg from public.auditoria where tabela = 't3';
  return next is(v_reg, v_id::text, 'PK pessoa_id vira o registro_id');
end $$;

create function tests.test_auditoria_sem_pk_falha() returns setof text language plpgsql as $$
begin
  create table tests.sempk (x int);
  return next throws_ok($q$select public.auditar('tests.sempk')$q$, 'P0001', null,
    'auditar recusa tabela sem chave primária');
end $$;

create function tests.test_auditoria_idempotente() returns setof text language plpgsql as $$
declare
  v_gatilhos bigint;
  v_qtd bigint;
begin
  create table tests.t4 (id int primary key, x int);
  perform public.auditar('tests.t4');
  perform public.auditar('tests.t4');
  insert into tests.t4 (id, x) values (1, 1);
  select count(*) into v_gatilhos from pg_trigger
  where tgrelid = 'tests.t4'::regclass and not tgisinternal;
  select count(*) into v_qtd from public.auditoria where tabela = 't4';
  return next is(v_gatilhos, 1::bigint, 'chamar auditar duas vezes mantém um só gatilho');
  return next is(v_qtd, 1::bigint, 'um insert gera uma única linha de auditoria');
end $$;

create function tests.test_auditoria_gatilho_declarado() returns setof text language plpgsql as $$
declare
  v_tipo int;
begin
  create table tests.t5 (id int primary key);
  perform public.auditar('tests.t5');
  select tgtype::int into v_tipo from pg_trigger
  where tgrelid = 'tests.t5'::regclass and not tgisinternal;
  -- bits: 1 = por linha, 2 = before, 4 = insert, 8 = delete, 16 = update
  return next ok((v_tipo & 1) = 1, 'gatilho é por linha');
  return next ok((v_tipo & 2) = 0, 'gatilho é after');
  return next ok((v_tipo & 4) = 4, 'gatilho cobre insert');
  return next ok((v_tipo & 8) = 8, 'gatilho cobre delete');
  return next ok((v_tipo & 16) = 16, 'gatilho cobre update');
end $$;

create function tests.test_auditoria_so_admin_le() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.le@exemplo.test', 'operacao');
  v_admin uuid := tests.criar_usuario('adm.le@exemplo.test', 'admin');
  v_qtd_op bigint;
  v_qtd_admin bigint;
begin
  create table tests.t (id uuid primary key default gen_random_uuid(), x int);
  perform public.auditar('tests.t');
  insert into tests.t (x) values (1);

  perform tests.como(v_op);
  select count(*) into v_qtd_op from public.auditoria;
  perform tests.como_servico();

  perform tests.como(v_admin);
  select count(*) into v_qtd_admin from public.auditoria where tabela = 't';
  perform tests.como_servico();

  return next is(v_qtd_op, 0::bigint, 'operacao não enxerga auditoria');
  return next ok(v_qtd_admin >= 1, 'admin enxerga a auditoria gerada pelo teste');
end $$;

create function tests.test_auditoria_perfil_usuario_auditado() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('adm.perf@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op.perf@exemplo.test', 'operacao');
  v_ins bigint;
  v_upd bigint;
  v_papel_antes text;
  v_papel_depois text;
  v_usuario uuid;
begin
  perform tests.executar_como(v_admin,
    format($q$update public.perfil_usuario set papel = 'financeiro' where user_id = %L$q$, v_op));

  select count(*) into v_ins from public.auditoria
  where tabela = 'perfil_usuario' and acao = 'insert' and registro_id = v_op::text;
  select count(*), max(dados_antes ->> 'papel'), max(dados_depois ->> 'papel'), max(usuario_id::text)::uuid
    into v_upd, v_papel_antes, v_papel_depois, v_usuario
  from public.auditoria
  where tabela = 'perfil_usuario' and acao = 'update' and registro_id = v_op::text;

  return next is(v_ins, 1::bigint, 'criação de perfil é auditada');
  return next is(v_upd, 1::bigint, 'mudança de papel é auditada');
  return next is(v_papel_antes, 'operacao', 'auditoria guarda papel anterior');
  return next is(v_papel_depois, 'financeiro', 'auditoria guarda papel novo');
  return next is(v_usuario, v_admin, 'auditoria registra quem mudou o papel');
end $$;

create function tests.test_auditoria_somente_gatilho_grava() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('adm.w@exemplo.test', 'admin');
  v_pol bigint;
  v_cmd text;
begin
  select count(*), max(cmd) into v_pol, v_cmd
  from pg_policies where schemaname = 'public' and tablename = 'auditoria';
  return next is(v_pol, 1::bigint, 'auditoria tem uma única política');
  return next is(v_cmd, 'SELECT', 'a única política é de select');
  return next ok((select relrowsecurity from pg_class where oid = 'public.auditoria'::regclass),
    'RLS ligado em auditoria');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.auditoria (tabela, registro_id, acao) values ('x', '1', 'insert')$q$)$f$, v_admin),
    '42501', null, 'nem admin insere direto em auditoria');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.auditoria set acao = 'update' where tabela = 'perfil_usuario'$q$)$f$, v_admin),
    '42501', null, 'nem admin altera auditoria');
end $$;

create function tests.test_auditoria_funcoes_sem_acesso() returns setof text language plpgsql as $$
begin
  return next ok(not has_function_privilege('anon', 'public.auditar(regclass)', 'execute'), 'anon sem execute em auditar');
  return next ok(not has_function_privilege('authenticated', 'public.auditar(regclass)', 'execute'), 'authenticated sem execute em auditar');
  return next ok(not has_function_privilege('anon', 'public.fn_auditoria()', 'execute'), 'anon sem execute em fn_auditoria');
  return next ok(not has_function_privilege('authenticated', 'public.fn_auditoria()', 'execute'), 'authenticated sem execute em fn_auditoria');
  return next ok((select prosecdef from pg_proc where oid = 'public.fn_auditoria()'::regprocedure), 'fn_auditoria é security definer');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
