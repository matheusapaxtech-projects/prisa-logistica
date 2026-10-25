-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Rotas salvas da calculadora (migration 20261029000100).

create function tests.test_rota_salva_chave_e_upsert() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_id1 uuid;
  v_id2 uuid;
  v_km int;
  v_chave text;
begin
  perform tests.como(v_op);
  v_id1 := public.salvar_rota(' Mandaguari/PR ', 'Maracaju/MS', '{}', 583, 7, 155.08);
  v_id2 := public.salvar_rota('mandaguari/pr', 'MARACAJU/MS', '{}', 590, 7, 160);
  perform tests.como_servico();
  return next is(v_id2, v_id1, 'mesmo trajeto, sem acento e sem diferença de caixa, atualiza a mesma rota');
  select km, chave into v_km, v_chave from public.rota_salva where id = v_id1;
  return next is(v_km, 590, 'o km foi atualizado');
  return next is(v_chave, 'mandaguari/pr>maracaju/ms', 'chave normalizada');

  perform tests.como(v_op);
  v_id2 := public.salvar_rota('Mandaguari/PR', 'Maracaju/MS', array['Dourados/MS', ' '], 640, 7, null);
  perform tests.como_servico();
  return next isnt(v_id2, v_id1, 'com ponto de passagem é outra rota');
  return next is((select chave from public.rota_salva where id = v_id2), 'mandaguari/pr>maracaju/ms|dourados/ms', 'vias na chave, vazias fora');
  return next ok((select pedagio is null from public.rota_salva where id = v_id2), 'pedágio zero ou ausente fica nulo');
end $$;

create function tests.test_rota_salva_permissoes() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_id uuid;
begin
  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_fin, 'select public.salvar_rota(''A/PR'', ''B/PR'', ''{}'', 100, 5, 10)'),
    '42501', 'só administrador e operação salvam rotas', 'financeiro não salva');
  perform tests.como(v_op);
  v_id := public.salvar_rota('A/PR', 'B/PR', '{}', 100, 5, 10);
  delete from public.rota_salva where id = v_id;
  perform tests.como_servico();
  return next ok(exists (select 1 from public.rota_salva where id = v_id), 'operação não apaga');
  perform tests.executar_como(v_adm, format('delete from public.rota_salva where id = %L', v_id));
  return next ok(not exists (select 1 from public.rota_salva where id = v_id), 'admin apaga');
  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op, 'select public.salvar_rota(''A/PR'', ''B/PR'', ''{}'', 0, 5, 10)'),
    '23514', null, 'km precisa ser positivo');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
