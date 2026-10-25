-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Financeiro: importação do extrato OFX (sem duplicar), regras de categoria, classificação e acesso
-- só de admin e financeiro. Banco fictício 999, conta TST-1.

create function tests.extrato_ficticio() returns jsonb language sql as $$
  select jsonb_build_object(
    'banco', '999', 'agencia', '0001', 'numero', 'TST-1', 'nome_arquivo', 'teste.ofx',
    'inicio', '2026-09-01', 'fim', '2026-09-30', 'saldo', 1500.25, 'saldo_em', '2026-09-30',
    'lancamentos', jsonb_build_array(
      jsonb_build_object('fitid', 'T1', 'data', '2026-09-02', 'valor', 5000.00,
        'descricao', 'TED RECEBIDA CLIENTE TESTE LTDA', 'chave', 'TED RECEBIDA CLIENTE TESTE LTDA'),
      jsonb_build_object('fitid', 'T2', 'data', '2026-09-03', 'valor', -3200.00,
        'descricao', 'ROADCARD PAGTO 123', 'chave', 'ROADCARD PAGTO'),
      jsonb_build_object('fitid', 'T3', 'data', '2026-09-10', 'valor', -299.75,
        'descricao', 'TARIFA PACOTE', 'chave', 'TARIFA PACOTE')
    ));
$$;

grant execute on function tests.extrato_ficticio() to authenticated;

-- Importa como o usuário e guarda o retorno em tests.r (o pgTAP não roda com o papel authenticated).
create function tests.importar_como(p_uid uuid, p jsonb) returns jsonb language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format(
    $q$select set_config('tests.r', public.fin_importar_extrato(%L::jsonb)::text, true)$q$, p));
  return current_setting('tests.r')::jsonb;
end $$;

create function tests.test_financeiro_importa_sem_duplicar() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
  v_r2 jsonb;
begin
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  return next is((v_r ->> 'total')::int, 3, 'importação conta os 3 lançamentos do arquivo');
  return next is((v_r ->> 'novos')::int, 3, 'os 3 são novos');
  return next is((select count(*)::int from public.fin_conta where banco = '999' and numero = 'TST-1'), 1,
    'a conta nasce sozinha pelo banco/agência/conta do OFX');
  return next is((select saldo from public.fin_importacao where id = (v_r ->> 'importacao_id')::uuid), 1500.25::numeric(14,2),
    'saldo do extrato gravado na importação');

  v_r2 := tests.importar_como(v_fin, tests.extrato_ficticio());
  return next is((v_r2 ->> 'novos')::int, 0, 'importar o mesmo arquivo de novo não traz nada novo');
  return next is((select count(*)::int from public.fin_lancamento l join public.fin_conta c on c.id = l.conta_id
                  where c.banco = '999'), 3, 'continua com 3 lançamentos (único por conta e FITID)');
  return next is((v_r2 ->> 'conta_id'), (v_r ->> 'conta_id'), 'a segunda importação usa a mesma conta');
  return next is((v_r2 ->> 'suspeitos')::int, 0, 'nada novo, nada suspeito');
  return next is((select count(*)::int from public.auditoria where tabela = 'fin_importacao' and registro_id = v_r ->> 'importacao_id'), 1,
    'a importação gera uma linha de auditoria (a contagem de novos não conta como alteração)');
end $$;

create function tests.test_financeiro_regra_aplica_na_importacao() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
begin
  insert into public.fin_regra (chave, categoria) values ('ROADCARD', 'pagamento_frete'), ('ROADCARD PAGTO', 'despesa');
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  return next is((v_r ->> 'classificados')::int, 1, 'um lançamento classificado pela regra');
  return next is((select categoria::text from public.fin_lancamento where fitid = 'T2'
                  and importacao_id = (v_r ->> 'importacao_id')::uuid), 'despesa',
    'vale a regra mais longa contida na descrição');
  return next is((select categoria from public.fin_lancamento where fitid = 'T3'
                  and importacao_id = (v_r ->> 'importacao_id')::uuid), null::public.fin_categoria,
    'sem regra, o lançamento fica sem categoria');
end $$;

create function tests.test_financeiro_classificar_e_lembrar() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
  v_id uuid;
  v_outro uuid;
  v_conta uuid;
begin
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  v_conta := (v_r ->> 'conta_id')::uuid;
  -- Um segundo lançamento parecido, ainda sem categoria.
  insert into public.fin_lancamento (conta_id, importacao_id, fitid, data, valor, descricao, chave)
  values (v_conta, (v_r ->> 'importacao_id')::uuid, 'T4', '2026-09-20', -1800, 'ROADCARD PAGTO 456', 'ROADCARD PAGTO')
  returning id into v_outro;
  select id into v_id from public.fin_lancamento where conta_id = v_conta and fitid = 'T2';

  perform tests.executar_como(v_fin, format(
    $q$select set_config('tests.n', public.fin_classificar_lancamento(%L, 'pagamento_frete', true)::text, true)$q$, v_id));
  return next is(current_setting('tests.n')::jsonb, '{"outros": 1, "regra": true}'::jsonb, 'lembrar classifica o outro lançamento parecido');
  return next is((select categoria::text from public.fin_lancamento where id = v_outro), 'pagamento_frete',
    'o parecido recebe a mesma categoria');
  return next is((select categoria::text from public.fin_regra where chave = 'ROADCARD PAGTO'), 'pagamento_frete',
    'a regra fica gravada');
  return next is((select classificado_por from public.fin_lancamento where id = v_id), v_fin, 'guarda quem classificou');

  return next is((select count(*)::int from public.auditoria where tabela = 'fin_lancamento' and registro_id = v_outro::text), 0,
    'o lote do lembrar não grava uma linha de auditoria por lançamento');
  perform tests.executar_como(v_fin, format($q$select public.fin_classificar_lancamento(%L, null)$q$, v_id));
  return next is((select categoria from public.fin_lancamento where id = v_id), null::public.fin_categoria,
    'categoria nula tira a classificação');
  return next ok(exists (select 1 from public.auditoria where tabela = 'fin_lancamento' and registro_id = v_id::text),
    'mudança de categoria fica na auditoria');
end $$;

create function tests.test_financeiro_regra_generica_e_palavra_inteira() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
  v_conta uuid;
  v_a uuid;
  v_b uuid;
begin
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  v_conta := (v_r ->> 'conta_id')::uuid;
  insert into public.fin_lancamento (conta_id, importacao_id, fitid, data, valor, descricao, chave)
  values (v_conta, (v_r ->> 'importacao_id')::uuid, 'G1', '2026-09-21', 100, 'PIX RECEBIDO 123', 'PIX RECEBIDO') returning id into v_a;
  insert into public.fin_lancamento (conta_id, importacao_id, fitid, data, valor, descricao, chave)
  values (v_conta, (v_r ->> 'importacao_id')::uuid, 'G2', '2026-09-22', 200, 'PIX RECEBIDO 456', 'PIX RECEBIDO') returning id into v_b;
  perform tests.executar_como(v_fin, format(
    $q$select set_config('tests.n', public.fin_classificar_lancamento(%L, 'receita_frete', true)::text, true)$q$, v_a));
  return next is(current_setting('tests.n')::jsonb, '{"outros": 0, "regra": false}'::jsonb, 'descrição genérica não vira regra');
  return next is((select categoria from public.fin_lancamento where id = v_b), null::public.fin_categoria, 'e não classifica os outros PIX');
  return next ok(not public.fin_chave_serve_para_regra('TED'), 'uma palavra só não serve');
  return next ok(public.fin_chave_serve_para_regra('PIX RECEBIDO AGRO EXEMPLO'), 'com quem pagou, serve');
  return next ok(public.fin_chave_contem('PAGTO TED FORNECEDOR', 'TED FORNECEDOR'), 'casa palavra inteira');
  return next ok(not public.fin_chave_contem('PAGTO TEDESCO FORNECEDOR', 'TED'), 'não casa pedaço de palavra');
end $$;

create function tests.test_financeiro_suspeitos_e_saldo() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
  v_p jsonb := tests.extrato_ficticio();
begin
  v_r := tests.importar_como(v_fin, v_p);
  -- O mesmo extrato com outro FITID (banco que numera por arquivo) e saldo mais novo.
  v_p := jsonb_set(v_p, '{lancamentos,0,fitid}', '"OUTRO-T1"');
  v_p := jsonb_set(jsonb_set(v_p, '{saldo}', '2000'), '{saldo_em}', '"2026-10-05"');
  v_r := tests.importar_como(v_fin, v_p);
  return next is((v_r ->> 'novos')::int, 1, 'só o FITID diferente entra como novo');
  return next is((v_r ->> 'suspeitos')::int, 1, 'e é contado como provável repetido');
  perform tests.executar_como(v_fin, $q$select set_config('tests.r', (select json_agg(s)::text from public.fin_saldos_ate('2026-09-30') s where s.banco = '999'), true)$q$);
  return next is((current_setting('tests.r')::jsonb -> 0 ->> 'saldo')::numeric, 1500.25, 'saldo até setembro é o do extrato de setembro');
  perform tests.executar_como(v_fin, $q$select set_config('tests.r', (select json_agg(s)::text from public.fin_saldos_ate('2026-10-31') s where s.banco = '999'), true)$q$);
  return next is((current_setting('tests.r')::jsonb -> 0 ->> 'saldo')::numeric, 2000::numeric, 'saldo até outubro é o mais novo');
end $$;

create function tests.test_financeiro_resumo_mensal() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
begin
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  -- A view soma o banco inteiro (pode haver dados reais no mês); a conferência exata é pela conta fictícia.
  return next is((select sum(valor) from public.fin_lancamento where conta_id = (v_r ->> 'conta_id')::uuid),
    1500.25::numeric(14,2), 'soma dos lançamentos do extrato fictício');
  return next ok(exists (select 1 from public.fin_resumo_mensal where mes = '2026-09'), 'resumo tem o mês do extrato');
end $$;

create function tests.test_financeiro_operacao_nao_ve() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  perform tests.importar_como(v_fin, tests.extrato_ficticio());
  perform tests.executar_como(v_op, $q$select set_config('tests.n', (select count(*) from public.fin_lancamento)::text, true)$q$);
  return next is(current_setting('tests.n')::int, 0, 'operação não enxerga lançamentos');
  perform tests.executar_como(v_op, $q$select set_config('tests.n', (select count(*) from public.fin_resumo_mensal)::text, true)$q$);
  return next is(current_setting('tests.n')::int, 0, 'operação não enxerga o resumo (view com security_invoker)');
  perform tests.executar_como(v_op, $q$select set_config('tests.n', (select count(*) from public.fin_saldos_ate('2100-01-01'))::text, true)$q$);
  return next is(current_setting('tests.n')::int, 0, 'operação não enxerga os saldos');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.fin_classificar(gen_random_uuid(), 'despesa')$q$)$f$, v_fin),
    '42501', null, 'a fin_classificar antiga (substituída por fin_classificar_lancamento) não é mais chamada');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.fin_importar_extrato(tests.extrato_ficticio())$q$)$f$, v_op),
    '42501', null, 'operação não importa extrato');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.fin_regra (chave, categoria) values ('XYZW', 'despesa')$q$)$f$, v_op),
    '42501', null, 'operação não cria regra');
end $$;

create function tests.test_financeiro_admin_desfaz_importacao() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_r jsonb;
begin
  v_r := tests.importar_como(v_adm, tests.extrato_ficticio());
  perform tests.executar_como(v_adm, format($q$delete from public.fin_importacao where id = %L$q$, v_r ->> 'importacao_id'));
  return next is((select count(*)::int from public.fin_lancamento where importacao_id = (v_r ->> 'importacao_id')::uuid), 0,
    'desfazer a importação apaga os lançamentos dela');
end $$;

create function tests.test_financeiro_extrato_vazio() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
begin
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.fin_importar_extrato('{"banco":"999","numero":"TST-1","lancamentos":[]}'::jsonb)$q$)$f$, v_fin),
    'P0001', 'O extrato não tem lançamentos. Confira o período escolhido no banco.', 'extrato sem lançamento é recusado');
end $$;

-- ---------------------------------------------------------------------------
-- Lançamento feito à mão (migration 20261029000600)
-- ---------------------------------------------------------------------------
create function tests.test_financeiro_manual_inclui_altera_exclui() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_id uuid;
begin
  perform tests.executar_como(v_fin, $q$with x as (insert into public.fin_lancamento (data, valor, descricao, chave, categoria)
    values ('2001-03-15', -450.00, 'Frete pago em dinheiro', 'FRETE PAGO EM DINHEIRO', 'pagamento_frete') returning id)
    select set_config('tests.id', id::text, true) from x$q$);
  v_id := current_setting('tests.id')::uuid;
  return next ok(v_id is not null, 'financeiro lança à mão, sem conta e sem importação');
  return next is((select acao from public.auditoria where tabela = 'fin_lancamento' and registro_id = v_id::text order by id limit 1), 'insert',
    'a inclusão do lançamento à mão vai para a auditoria');
  return next is((select valor from public.fin_resumo_mensal where mes = '2001-03' and categoria = 'pagamento_frete'), -450.00::numeric(14,2),
    'o lançamento à mão entra no resumo do mês');

  perform tests.executar_como(v_fin, format($q$update public.fin_lancamento set valor = -500, descricao = 'Frete pago' where id = %L$q$, v_id));
  return next is((select valor from public.fin_lancamento where id = v_id), -500.00::numeric(14,2), 'o lançamento à mão muda valor e descrição');

  perform tests.executar_como(v_fin, format($q$delete from public.fin_lancamento where id = %L$q$, v_id));
  return next is((select count(*)::int from public.fin_lancamento where id = v_id), 0, 'o lançamento à mão é excluído');
  return next is((select count(*)::int from public.auditoria where tabela = 'fin_lancamento' and registro_id = v_id::text and acao = 'delete'), 1,
    'a exclusão vai para a auditoria');
end $$;

create function tests.test_financeiro_extrato_nao_muda_nem_sai_sozinho() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
  v_id uuid;
begin
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  v_id := (select id from public.fin_lancamento where fitid = 'T2' and importacao_id = (v_r ->> 'importacao_id')::uuid);
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.fin_lancamento set valor = -1 where id = %L$q$)$f$, v_fin, v_id),
    'P0001', null, 'o valor do lançamento do extrato não muda');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.fin_lancamento set importacao_id = null, fitid = null where id = %L$q$)$f$, v_fin, v_id),
    'P0001', null, 'o lançamento do extrato não vira lançamento à mão');
  perform tests.executar_como(v_fin, format($q$update public.fin_lancamento set categoria = 'despesa', observacao = 'ok' where id = %L$q$, v_id));
  return next is((select categoria::text from public.fin_lancamento where id = v_id), 'despesa', 'a categoria do extrato continua mudando');

  perform tests.executar_como(v_fin, format($q$delete from public.fin_lancamento where id = %L$q$, v_id));
  return next is((select count(*)::int from public.fin_lancamento where id = v_id), 1, 'o lançamento do extrato não sai sozinho (só desfazendo a importação)');

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.fin_lancamento (fitid, data, valor, descricao, chave) values ('X1', '2026-09-01', 10, 'x', 'X')$q$)$f$, v_fin),
    '23514', null, 'FITID sem importação é recusado');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.fin_lancamento (data, valor, descricao, chave) values ('2026-09-01', 0, 'zero', 'ZERO')$q$)$f$, v_fin),
    '23514', null, 'lançamento à mão com valor zero é recusado');
end $$;

create function tests.test_financeiro_importacao_avisa_manual_parecido() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_r jsonb;
begin
  -- À mão, sem conta: a TED de 5.000 do dia 2 (antes de o extrato chegar) e outro valor qualquer.
  insert into public.fin_lancamento (data, valor, descricao, chave, categoria) values
    ('2026-09-02', 5000.00, 'Frete cliente teste', 'FRETE CLIENTE TESTE', 'receita_frete'),
    ('2026-09-02', 77.00, 'Outro', 'OUTRO', 'despesa');
  v_r := tests.importar_como(v_fin, tests.extrato_ficticio());
  return next is((v_r ->> 'manuais')::int, 1, 'a importação conta o lançamento do extrato que bate com um feito à mão');
end $$;

create function tests.test_financeiro_operacao_nao_lanca_a_mao() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  insert into public.fin_lancamento (data, valor, descricao, chave, categoria) values ('2001-04-01', 10, 'Manual teste', 'MANUAL TESTE', 'despesa');
  perform tests.executar_como(v_op, $q$select set_config('tests.n', (select count(*) from public.fin_lancamento)::text, true)$q$);
  return next is(current_setting('tests.n')::int, 0, 'operação não enxerga os lançamentos à mão');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.fin_lancamento (data, valor, descricao, chave) values ('2001-04-02', 10, 'x', 'X')$q$)$f$, v_op),
    '42501', null, 'operação não lança à mão');
  perform tests.executar_como(v_op, $q$delete from public.fin_lancamento where descricao = 'Manual teste'$q$);
  return next is((select count(*)::int from public.fin_lancamento where descricao = 'Manual teste' and data = '2001-04-01'), 1, 'operação não exclui');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
