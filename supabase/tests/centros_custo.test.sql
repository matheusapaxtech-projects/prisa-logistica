-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Centros de custo e plano de contas (migration 20261101000100).

create function tests.test_carga_inicial() returns setof text language plpgsql as $$
begin
  return next ok(exists (select 1 from public.centro_custo where codigo = '01.01' and ativo), '01.01 existe e está ativo');
  return next ok(exists (select 1 from public.centro_custo where codigo = '03.08' and ativo), '03.08 existe e está ativo');
  return next ok(not exists (select 1 from public.centro_custo c where length(c.codigo) = 5
                                and not exists (select 1 from public.centro_custo d where d.codigo = left(c.codigo, 2))),
    'todo subdepartamento tem o seu departamento');
  return next is((select nome from public.fin_plano_conta where id = 20), 'Frete de motoristas', 'conta 20 = frete de motoristas');
  return next is((select grupo::text from public.fin_plano_conta where id = 51), 'financeiro', 'conta 51 = tarifa do cartão-frete');
  return next ok((select entrada and not saida from public.fin_plano_conta where id = 1), 'frete (CT-e) é entrada');
end $$;

create function tests.test_codigo_imutavel() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('admin@exemplo.test', 'admin');
begin
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'update public.centro_custo set codigo = ''01.99'' where codigo = ''01.08''')$q$, v_admin),
    null, 'O código do centro de custo não muda. Renomeie ou desative o centro.', 'código não muda');
  perform tests.executar_como(v_admin, $q$update public.centro_custo set nome = 'TI' where codigo = '01.08'$q$);
  return next is((select nome from public.centro_custo where codigo = '01.08'), 'TI', 'admin renomeia');
  perform tests.executar_como(v_admin, $q$update public.centro_custo set ativo = false where codigo = '01.08'$q$);
  return next is((select ativo from public.centro_custo where codigo = '01.08'), false, 'admin desativa');
end $$;

create function tests.test_sub_exige_departamento() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('admin@exemplo.test', 'admin');
begin
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'insert into public.centro_custo (codigo, nome) values (''98.01'', ''Teste'')')$q$, v_admin),
    null, 'Crie primeiro o departamento 98.', 'subdepartamento exige o departamento');
  perform tests.executar_como(v_admin, $q$insert into public.centro_custo (codigo, nome) values ('98', 'Teste')$q$);
  perform tests.executar_como(v_admin, $q$insert into public.centro_custo (codigo, nome) values ('98.01', '  Sub teste  ')$q$);
  return next is((select nome from public.centro_custo where codigo = '98.01'), 'Sub teste', 'cria o sub com o nome sem espaços nas pontas');
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'insert into public.centro_custo (codigo, nome) values (''9.1'', ''X'')')$q$, v_admin),
    '23514', null, 'código fora do formato 00 ou 00.00');
end $$;

create function tests.test_so_admin_altera() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'insert into public.centro_custo (codigo, nome) values (''97'', ''X'')')$q$, v_fin),
    '42501', null, 'financeiro não cria centro de custo');
  perform tests.executar_como(v_fin, $q$update public.centro_custo set nome = 'Mudou' where codigo = '01.01'$q$);
  return next isnt((select nome from public.centro_custo where codigo = '01.01'), 'Mudou', 'financeiro não renomeia');
  perform tests.executar_como(v_op, $q$select set_config('tests.r', (select count(*) from public.centro_custo)::text, true)$q$);
  return next ok(current_setting('tests.r')::int > 0, 'operação lê os centros de custo');
end $$;

create function tests.test_sem_exclusao() returns setof text language plpgsql as $$
declare
  v_admin uuid := tests.criar_usuario('admin@exemplo.test', 'admin');
begin
  perform tests.executar_como(v_admin, $q$delete from public.centro_custo where codigo = '04.05'$q$);
  return next ok(exists (select 1 from public.centro_custo where codigo = '04.05'), 'nem o admin exclui: desativa');
  perform tests.executar_como(v_admin, $q$update public.centro_custo set nome = 'Auditoria fiscal' where codigo = '04.05'$q$);
  return next ok(exists (select 1 from public.auditoria where tabela = 'centro_custo' and acao = 'update'
                   and registro_id = (select id::text from public.centro_custo where codigo = '04.05')),
    'mudanças vão para a auditoria');
end $$;

create function tests.test_plano_leitura() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_admin uuid := tests.criar_usuario('admin@exemplo.test', 'admin');
begin
  perform tests.executar_como(v_op, $q$select set_config('tests.r', (select count(*) from public.fin_plano_conta)::text, true)$q$);
  return next is(current_setting('tests.r'), '0', 'operação não vê o plano de contas');
  perform tests.executar_como(v_fin, $q$select set_config('tests.r', (select count(*) from public.fin_plano_conta)::text, true)$q$);
  return next ok(current_setting('tests.r')::int > 20, 'financeiro vê o plano de contas');
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'insert into public.fin_plano_conta (grupo, nome, saida) values (''despesa_operacional'', ''Nova'', true)')$q$, v_fin),
    '42501', null, 'financeiro não cria conta no plano');
  perform tests.executar_como(v_admin, $q$insert into public.fin_plano_conta (grupo, nome, saida) values ('despesa_operacional', 'Nova conta', true)$q$);
  return next ok((select id >= 1000 from public.fin_plano_conta where nome = 'Nova conta'), 'conta nova do admin ganha id a partir de 1000');
  return next throws_ok(
    format($q$select tests.executar_como(%L, 'insert into public.fin_plano_conta (grupo, nome) values (''despesa_operacional'', ''Sem natureza'')')$q$, v_admin),
    '23514', null, 'conta precisa ser de entrada, de saída ou das duas');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
