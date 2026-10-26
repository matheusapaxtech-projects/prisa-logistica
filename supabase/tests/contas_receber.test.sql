-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Contas a receber e indicadores do contas a pagar/receber (migration 20261101000200). Só dados fictícios
-- (CNPJ 11222333000181).

create function tests.cliente() returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into v_id;
  insert into public.cliente (pessoa_id) values (v_id);
  return v_id;
end $$;

-- Título lançado por p_uid (como a tela faz); devolve o id.
create function tests.lancar_receber(p_uid uuid, p_cliente uuid, p_valor numeric default 5000, p_venc date default null,
                                     p_plano int default 1)
returns uuid language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$
    with i as (
      insert into public.fin_receber (cliente_id, titulo, plano_id, centro_custo_id, forma, vencimento, valor)
      values (%L, 'CT-e 1001', %s, (select id from public.centro_custo where codigo = '01.03'), 'boleto', %L, %s)
      returning id)
    select set_config('tests.id', id::text, true) from i$q$,
    p_cliente, p_plano, coalesce(p_venc, tests.hoje() + 10), p_valor));
  return current_setting('tests.id')::uuid;
end $$;

-- Conta a pagar manual (mesmo formato do teste do contas a pagar).
create function tests.lancar_pagar(p_uid uuid, p_valor numeric, p_venc date) returns uuid language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$
    with i as (
      insert into public.fin_pagar (descricao, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor)
      values ('Conta de teste', 'Favorecido Teste', 33, (select id from public.centro_custo where codigo = '01.01'), 'pix', %L, %s)
      returning id)
    select set_config('tests.id', id::text, true) from i$q$, p_venc, p_valor));
  return current_setting('tests.id')::uuid;
end $$;

create function tests.chamar(p_uid uuid, p_sql text) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid, p_sql)
$$;

create function tests.test_lanca_recebe_desfaz() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  cl uuid := tests.cliente();
  r uuid;
begin
  r := tests.lancar_receber(a, cl);
  return next is((select situacao from public.v_fin_receber where id = r), 'a_vencer', 'título a vencer');
  return next is((select cliente_nome from public.v_fin_receber where id = r), 'Cliente Teste', 'nome do cliente na view');
  return next throws_ok(tests.chamar(b, format('select public.fin_receber_conta(%L, %L)', r, tests.hoje() + 1)), null,
    'A data do recebimento não pode ser depois de hoje.', 'recebimento no futuro é recusado');
  return next lives_ok(tests.chamar(b, format('select public.fin_receber_conta(%L, %L)', r, tests.hoje())), 'recebe');
  return next is((select situacao from public.v_fin_receber where id = r), 'recebida', 'situação recebida');
  return next throws_ok(tests.chamar(b, format('select public.fin_receber_conta(%L, %L)', r, tests.hoje())), null,
    'Este título já foi recebido.', 'não recebe duas vezes');
  return next throws_ok(tests.chamar(a, format('update public.fin_receber set valor = 1 where id = %L', r)), null,
    'Este título já foi recebido e não muda mais.', 'recebido não se edita');
  perform tests.executar_como(a, format('select public.fin_desfazer_recebimento(%L)', r));
  return next is((select situacao from public.v_fin_receber where id = r), 'a_vencer', 'recebimento desfeito');
end $$;

create function tests.test_cancelar() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  cl uuid := tests.cliente();
  r uuid;
begin
  r := tests.lancar_receber(a, cl);
  return next throws_ok(tests.chamar(a, format('select public.fin_cancelar_receber(%L, null)', r)), null,
    'Diga o motivo do cancelamento.', 'cancelar exige motivo');
  perform tests.executar_como(a, format('select public.fin_cancelar_receber(%L, ''Título duplicado'')', r));
  return next is((select situacao from public.v_fin_receber where id = r), 'cancelada', 'cancelado');
  return next throws_ok(tests.chamar(a, format('select public.fin_receber_conta(%L, %L)', r, tests.hoje())), null,
    'Este título foi cancelado.', 'cancelado não se recebe');
end $$;

create function tests.test_operacao_nao_ve() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  cl uuid := tests.cliente();
begin
  perform tests.lancar_receber(a, cl);
  perform tests.executar_como(op, $q$select set_config('tests.r', (select count(*) from public.fin_receber)::text, true)$q$);
  return next is(current_setting('tests.r'), '0', 'operação não vê contas a receber');
  return next throws_ok(format('select tests.lancar_receber(%L, %L)', op, cl), '42501', null, 'operação não lança');
end $$;

create function tests.test_tipo_de_receita() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  cl uuid := tests.cliente();
begin
  return next throws_ok(format('select tests.lancar_receber(%L, %L, 10, null, 20)', a, cl), null,
    'Escolha um tipo de receita ativo.', 'tipo de despesa não serve para conta a receber');
end $$;

create function tests.test_indicadores() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  cl uuid := tests.cliente();
  p3 uuid;
  r3 uuid;
  j jsonb;
begin
  delete from public.fin_pagar;
  delete from public.fin_receber;
  perform tests.lancar_pagar(a, 1000, tests.hoje() + 5);
  perform tests.lancar_pagar(a, 200, tests.hoje() - 2);
  p3 := tests.lancar_pagar(a, 300, tests.hoje());
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', p3));
  perform tests.executar_como(b, format('select public.fin_pagar_conta(%L, %L)', p3, tests.hoje()));

  perform tests.lancar_receber(a, cl, 5000, tests.hoje() + 10);
  perform tests.lancar_receber(a, cl, 700, tests.hoje() - 1);
  perform tests.lancar_receber(a, cl, 100, tests.hoje() + 40);
  r3 := tests.lancar_receber(a, cl, 900, tests.hoje());
  perform tests.executar_como(b, format('select public.fin_receber_conta(%L, %L)', r3, tests.hoje()));

  perform tests.executar_como(a, format($q$select set_config('tests.j', public.fin_indicadores_contas(%L)::text, true)$q$,
    date_trunc('month', tests.hoje())::date));
  j := current_setting('tests.j')::jsonb;
  return next is((j -> 'pagar' ->> 'aberto_qtd')::int, 2, 'a pagar: 2 em aberto');
  return next is((j -> 'pagar' ->> 'aberto_valor')::numeric, 1200.00, 'a pagar: valor em aberto');
  return next is((j -> 'pagar' ->> 'vencidas_valor')::numeric, 200.00, 'a pagar: vencidas');
  return next is((j -> 'pagar' ->> 'aprovar_qtd')::int, 2, 'a pagar: falta aprovar');
  return next is((j -> 'pagar' ->> 'pago_mes_valor')::numeric, 300.00, 'a pagar: pago no mês');
  return next is((j -> 'receber' ->> 'aberto_valor')::numeric, 5800.00, 'a receber: em aberto');
  return next is((j -> 'receber' ->> 'vencidas_valor')::numeric, 700.00, 'a receber: vencidas');
  return next is((j -> 'receber' ->> 'em30_valor')::numeric, 5700.00, 'a receber em 30 dias (com as vencidas)');
  return next is((j -> 'receber' ->> 'recebido_mes_valor')::numeric, 900.00, 'recebido no mês');

  return next throws_ok(format($q$select tests.executar_como(%L, 'select public.fin_indicadores_contas(''2026-10-01'')')$q$,
    tests.criar_usuario('op@exemplo.test', 'operacao')), '42501', null, 'operação não vê os indicadores');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
