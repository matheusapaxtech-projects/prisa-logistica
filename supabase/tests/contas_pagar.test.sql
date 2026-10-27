-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Contas a pagar: dupla aprovação imposta no banco, pagamento, cancelamento e taxa do cartão-frete
-- (migration 20261101000200). Só dados fictícios.

-- Conta manual lançada por p_uid (como a tela faz); devolve o id.
create function tests.lancar(p_uid uuid, p_valor numeric default 1000, p_venc date default null,
                             p_forma text default 'boleto', p_centro text default '01.01', p_plano int default 33)
returns uuid language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$
    with i as (
      insert into public.fin_pagar (descricao, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor)
      values ('Aluguel de teste', 'Imobiliária Teste', %s, (select id from public.centro_custo where codigo = %L), %L, %L, %s)
      returning id)
    select set_config('tests.id', id::text, true) from i$q$,
    p_plano, p_centro, p_forma, coalesce(p_venc, tests.hoje() + 10), p_valor));
  return current_setting('tests.id')::uuid;
end $$;

create function tests.chamar(p_uid uuid, p_sql text) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid, p_sql)
$$;

create function tests.test_quem_lanca_nao_aprova() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  return next is((select lancado_por from public.fin_pagar where id = c), a, 'quem lançou fica gravado');
  return next throws_ok(tests.chamar(a, format('select public.fin_aprovar_pagar(%L)', c)), null,
    'Quem lançou a conta não pode aprová-la: peça a outra pessoa do financeiro ou ao administrador.', 'quem lança não aprova');
  return next lives_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L)', c)), 'outra pessoa aprova');
  return next is((select aprovado_por from public.fin_pagar where id = c), b, 'aprovação gravada com quem aprovou');
  return next throws_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L)', c)), null,
    'Esta conta já está aprovada.', 'não aprova duas vezes');
end $$;

create function tests.test_quem_edita_nao_aprova() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'financeiro');
  c3 uuid := tests.criar_usuario('c@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  perform tests.executar_como(b, format('update public.fin_pagar set valor = 1200 where id = %L', c));
  return next is((select editado_por from public.fin_pagar where id = c), b, 'quem alterou fica gravado');
  return next throws_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L)', c)), null,
    'Você alterou esta conta: outra pessoa precisa aprová-la.', 'quem alterou não aprova');
  return next lives_ok(tests.chamar(c3, format('select public.fin_aprovar_pagar(%L)', c)), 'uma terceira pessoa aprova');
end $$;

create function tests.test_pagar_sem_aprovacao() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  return next throws_ok(tests.chamar(b, format('select public.fin_pagar_conta(%L, %L)', c, tests.hoje())), null,
    'Sem aprovação o pagamento é recusado: outra pessoa precisa aprovar esta conta antes.', 'sem aprovação, o banco recusa');
  return next is((select pago_em from public.fin_pagar where id = c), null::date, 'nada foi pago');
end $$;

create function tests.test_colunas_protegidas() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  c uuid;
begin
  c := tests.lancar(a);
  return next throws_ok(tests.chamar(a, format('update public.fin_pagar set aprovado_em = now(), aprovado_por = %L where id = %L', a, c)),
    '42501', null, 'aprovação não se grava pela tabela');
  return next throws_ok(tests.chamar(a, format('update public.fin_pagar set pago_em = %L where id = %L', tests.hoje(), c)),
    '42501', null, 'pagamento não se grava pela tabela');
  return next throws_ok(tests.chamar(a,
    $q$insert into public.fin_pagar (descricao, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor, origem)
       values ('x', 'y', 33, 1, 'pix', '2026-01-01', 1, 'frete_saldo')$q$),
    '42501', null, 'parcela do frete não se lança pela tabela');
  return next throws_ok(tests.chamar(a, format('delete from public.fin_pagar where id = %L', c)),
    '42501', null, 'conta não se exclui: cancela');
end $$;

create function tests.test_aprovada_nao_edita() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c));
  return next throws_ok(tests.chamar(a, format('update public.fin_pagar set descricao = ''Outra'' where id = %L', c)), null,
    'Esta conta já foi aprovada. Para mudar, desfaça a aprovação primeiro.', 'aprovada não se edita');
  return next throws_ok(tests.chamar(a, format('select public.fin_desaprovar_pagar(%L)', c)), null,
    'Só quem aprovou (ou o administrador) desfaz a aprovação.', 'só quem aprovou desfaz');
  perform tests.executar_como(b, format('select public.fin_desaprovar_pagar(%L)', c));
  perform tests.executar_como(a, format('update public.fin_pagar set descricao = ''Aluguel corrigido'' where id = %L', c));
  return next is((select descricao from public.fin_pagar where id = c), 'Aluguel corrigido', 'sem aprovação volta a editar');
  return next is((select aprovado_em from public.fin_pagar where id = c), null::timestamptz, 'aprovação desfeita');
end $$;

create function tests.test_operacao_nao_ve() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  perform tests.lancar(a);
  perform tests.executar_como(op, $q$select set_config('tests.r', (select count(*) from public.fin_pagar)::text, true)$q$);
  return next is(current_setting('tests.r'), '0', 'operação não vê contas a pagar');
  return next throws_ok(tests.chamar(op,
    $q$insert into public.fin_pagar (descricao, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor)
       values ('x', 'y', 33, 1, 'pix', '2026-01-01', 1)$q$),
    '42501', null, 'operação não lança conta a pagar');
end $$;

create function tests.test_pagamento() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c));
  return next throws_ok(tests.chamar(a, format('select public.fin_pagar_conta(%L, null)', c)), null,
    'Informe a data do pagamento.', 'data é obrigatória');
  return next throws_ok(tests.chamar(a, format('select public.fin_pagar_conta(%L, %L)', c, tests.hoje() + 1)), null,
    'A data do pagamento não pode ser depois de hoje.', 'data no futuro é recusada');
  return next lives_ok(tests.chamar(a, format('select public.fin_pagar_conta(%L, %L, null, ''pix'')', c, tests.hoje())),
    'aprovada, quem lançou pode registrar o pagamento');
  return next is((select (pago_em, forma::text, pago_por) from public.fin_pagar where id = c)::text,
    (tests.hoje(), 'pix', a)::text, 'data, forma e quem pagou gravados');
  return next throws_ok(tests.chamar(a, format('select public.fin_pagar_conta(%L, %L)', c, tests.hoje())), null,
    'Esta conta já foi paga.', 'não paga duas vezes');
  return next is((select situacao from public.v_fin_pagar where id = c), 'paga', 'situação paga');
end $$;

create function tests.test_situacoes() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c1 uuid;
  c2 uuid;
  c3 uuid;
  c4 uuid;
begin
  c1 := tests.lancar(a, 100, tests.hoje() - 1);
  c2 := tests.lancar(a, 100, tests.hoje() + 5);
  c3 := tests.lancar(a, 100, tests.hoje() + 5);
  c4 := tests.lancar(a, 100, tests.hoje() - 1);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c3));
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c4));
  return next is((select situacao from public.v_fin_pagar where id = c1), 'falta_aprovar', 'vencida sem aprovação: falta aprovar primeiro');
  return next is((select situacao from public.v_fin_pagar where id = c2), 'falta_aprovar', 'a vencer sem aprovação');
  return next is((select situacao from public.v_fin_pagar where id = c3), 'a_vencer', 'aprovada a vencer');
  return next is((select situacao from public.v_fin_pagar where id = c4), 'vencida', 'aprovada com vencimento ontem = vencida');
  return next ok((select vencida and aberta from public.v_fin_pagar where id = c1), 'vencida e aberta');
end $$;

create function tests.test_aprovar_com_versao() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  return next throws_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L, %L)', c, now() - interval '1 minute')), null,
    'A conta mudou desde que você abriu a página. Atualize e confira o valor antes de aprovar.',
    'a conta mudou depois que a tela abriu: recusa');
  return next lives_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L, %L)', c,
    (select updated_at from public.fin_pagar where id = c))), 'com a versão que a tela mostrou, aprova');
end $$;

create function tests.test_cancelar() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
  d uuid;
begin
  c := tests.lancar(a);
  return next throws_ok(tests.chamar(a, format('select public.fin_cancelar_pagar(%L, ''  '')', c)), null,
    'Diga o motivo do cancelamento.', 'cancelar exige motivo');
  perform tests.executar_como(a, format('select public.fin_cancelar_pagar(%L, ''Lançada em dobro'')', c));
  return next is((select situacao from public.v_fin_pagar where id = c), 'cancelada', 'cancelada');
  return next throws_ok(tests.chamar(b, format('select public.fin_aprovar_pagar(%L)', c)), null,
    'Esta conta foi cancelada.', 'cancelada não se aprova');
  d := tests.lancar(a);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', d));
  perform tests.executar_como(b, format('select public.fin_pagar_conta(%L, %L)', d, tests.hoje()));
  return next throws_ok(tests.chamar(a, format('select public.fin_cancelar_pagar(%L, ''Errada'')', d)), null,
    'Esta conta já foi paga: desfaça o pagamento antes de cancelar.', 'paga não se cancela');
end $$;

create function tests.test_desfazer_pagamento_so_admin() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c));
  perform tests.executar_como(a, format('select public.fin_pagar_conta(%L, %L)', c, tests.hoje()));
  return next throws_ok(tests.chamar(a, format('select public.fin_desfazer_pagamento(%L)', c)), '42501', null,
    'financeiro não desfaz pagamento');
  return next lives_ok(tests.chamar(b, format('select public.fin_desfazer_pagamento(%L)', c)), 'admin desfaz');
  return next is((select (pago_em is null and aprovado_em is not null) from public.fin_pagar where id = c), true,
    'volta a aberta, ainda aprovada');
end $$;

create function tests.test_centro_e_tipo_validos() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
begin
  perform tests.executar_como(adm, $q$update public.centro_custo set ativo = false where codigo = '01.06'$q$);
  return next throws_ok(format('select tests.lancar(%L, 10, null, ''pix'', ''01.06'')', a), null,
    'O centro de custo escolhido está desativado. Escolha outro.', 'centro desativado não recebe conta nova');
  return next throws_ok(format('select tests.lancar(%L, 10, null, ''pix'', ''01.01'', 1)', a), null,
    'Escolha um tipo de despesa ativo.', 'tipo de receita não serve para conta a pagar');
end $$;

create function tests.test_taxa_cartao() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c1 uuid;
  c2 uuid;
  v_mes date := date_trunc('month', tests.hoje())::date;
  t record;
  v_taxa uuid;
begin
  delete from public.fin_pagar;
  return next throws_ok(tests.chamar(a, format('select public.fin_lancar_taxa_cartao(%L)', v_mes)), null, null,
    'mês sem nada pago pelo cartão-frete não gera taxa');
  c1 := tests.lancar(a, 1000, null, 'cartao_frete');
  c2 := tests.lancar(a, 500, null, 'cartao_frete');
  perform tests.lancar(a, 700, null, 'pix');
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c1));
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c2));
  perform tests.executar_como(a, format('select public.fin_pagar_conta(%L, %L)', c1, tests.hoje()));
  perform tests.executar_como(a, format('select public.fin_pagar_conta(%L, %L)', c2, tests.hoje()));

  perform tests.executar_como(a, format($q$select set_config('tests.t', (select row_to_json(x)::text from public.fin_taxa_cartao(%L) x), true)$q$, v_mes));
  select * into t from json_to_record(current_setting('tests.t')::json)
    as x(total_pago numeric, pagamentos int, valor_pct numeric, valor_transferencias numeric, taxa numeric, conta_id uuid);
  return next is(t.total_pago, 1500.00, 'soma só o pago pelo cartão-frete no mês');
  return next is(t.pagamentos, 2, 'duas transferências');
  return next is(t.valor_pct, 15.00, '1% do pago pelo cartão');
  return next is(t.valor_transferencias, 1.00, 'R$ 0,50 por transferência');
  return next is(t.taxa, 16.00, 'taxa = 1% + transferências');
  return next is(t.conta_id, null::uuid, 'taxa ainda não lançada');

  perform tests.executar_como(a, format($q$select set_config('tests.id', public.fin_lancar_taxa_cartao(%L)::text, true)$q$, v_mes));
  v_taxa := current_setting('tests.id')::uuid;
  return next is((select (valor, forma::text, favorecido_nome, origem, vencimento) from public.fin_pagar where id = v_taxa)::text,
    (16.00, 'boleto', 'Pan Card (cartão-frete)', 'taxa_cartao', (v_mes + interval '1 month' + interval '9 days')::date)::text,
    'conta da taxa: boleto da Pan Card, vence dia 10 do mês seguinte');
  perform tests.executar_como(a, format('select public.fin_lancar_taxa_cartao(%L)', v_mes));
  return next is((select count(*)::int from public.fin_pagar where origem = 'taxa_cartao'), 1, 'lançar de novo não duplica');
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', v_taxa));
  return next throws_ok(tests.chamar(a, format('select public.fin_lancar_taxa_cartao(%L)', v_mes)), null, null,
    'taxa aprovada não muda de valor');
end $$;

create function tests.test_auditoria() returns setof text language plpgsql as $$
declare
  a uuid := tests.criar_usuario('a@exemplo.test', 'financeiro');
  b uuid := tests.criar_usuario('b@exemplo.test', 'admin');
  c uuid;
begin
  c := tests.lancar(a);
  perform tests.executar_como(b, format('select public.fin_aprovar_pagar(%L)', c));
  return next is((select count(*)::int from public.auditoria where tabela = 'fin_pagar' and registro_id = c::text), 2,
    'inclusão e aprovação vão para a auditoria');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
