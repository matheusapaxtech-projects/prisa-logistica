-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Parcelas 70/30 do frete do motorista e a viagem paga pelo financeiro (migration 20261101000300).
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….

create sequence tests.seq_placa;

create function tests.novo_veiculo(p_tipo int, p_prop uuid, p_unidade smallint default null) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.proprietario (pessoa_id) values (p_prop) on conflict do nothing;
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id,
                              situacao_cadastro, exercicio_doc, unidade_operacional_id)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal',
          extract(year from tests.hoje())::int, p_unidade)
  returning id into v_id;
  return v_id;
end $$;

-- Cliente, motorista PF dono do cavalo, conjunto e pedido. p_unidade = unidade operacional do cavalo (2 = frota própria);
-- p_ligado = interruptor das parcelas do frete (fin_config), ligado por padrão nos testes.
create function tests.cenario(p_unidade smallint default null, p_ligado boolean default true)
returns table (cliente uuid, motorista uuid, cavalo uuid, conjunto uuid, pedido uuid)
language plpgsql as $$
declare
  v_coleta uuid;
  v_descarga uuid;
begin
  update public.fin_config set parcelas_frete_ativas = p_ligado where id = 1;
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into cliente;
  insert into public.cliente (pessoa_id) values (cliente);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Curitiba', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Campo Grande', 'MS') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade)
  values (motorista, 'e', tests.hoje() + 365, 'normal', 'habilitado', tests.hoje() + 180);

  cavalo := tests.novo_veiculo(7, motorista, p_unidade);
  insert into public.conjunto (cavalo_id, motorista_id, inicio, aprovado_em)
  values (cavalo, motorista, now() - interval '1 day', now()) returning id into conjunto;

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  return next;
end $$;

-- Viagem contratada por p_uid (como o despacho faz); devolve o id.
create function tests.contratar(p_uid uuid, r record, p_frete numeric, p_tipo text default 'total',
                                p_pedagio numeric default null, p_peso numeric default 37000)
returns uuid language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$
    with i as (
      insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                                 frete_motorista_valor, frete_motorista_tipo, pedagio_valor)
      values (%L, %L, %L, %L, %s, %s, %L, %s)
      returning id)
    select set_config('tests.id', id::text, true) from i$q$,
    r.pedido, r.conjunto, r.cavalo, r.motorista, p_peso, coalesce(p_frete::text, 'null'),
    case when p_frete is null then null else p_tipo end, coalesce(p_pedagio::text, 'null')));
  return current_setting('tests.id')::uuid;
end $$;

create function tests.parcela(p_viagem uuid, p_origem text) returns public.fin_pagar language sql as $$
  select * from public.fin_pagar where viagem_id = p_viagem and origem = p_origem
$$;

create function tests.chamar(p_uid uuid, p_sql text) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid, p_sql)
$$;

create function tests.test_nascem_duas() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
  a public.fin_pagar;
  s public.fin_pagar;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000, 'total', 500);
  a := tests.parcela(v, 'frete_adiantamento');
  s := tests.parcela(v, 'frete_saldo');
  return next is(a.valor, 7500.00, 'adiantamento = 70% do frete + pedágio');
  return next is(a.parte_pedagio, 500.00, 'o pedágio fica marcado no adiantamento');
  return next is(s.valor, 2730.00, 'saldo = 30% do frete menos as retenções do autônomo PF');
  return next is(s.parte_retencao, 270.00, 'retenções: INSS 220 + SEST 30 + SENAT 20 (sobre 20% do frete)');
  return next is(a.lancado_por, op, 'lançada em nome de quem contratou');
  return next is((a.forma::text, a.plano_id, (select codigo from public.centro_custo where id = a.centro_custo_id)),
    ('cartao_frete'::text, 20, '03.08'::text), 'cartão-frete, frete de motoristas, centro 03.08');
  return next is(a.favorecido_id, r.motorista, 'favorecido = proprietário do cavalo');
  return next is((a.vencimento, s.vencimento), (tests.hoje(), tests.hoje() + 3), 'vencem na contratação e 3 dias depois');
  return next is(a.aprovado_em, null::timestamptz, 'nasce sem aprovação');
end $$;

create function tests.test_por_tonelada_centavos() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 95, 'por_tonelada', null, 37033);
  return next is((tests.parcela(v, 'frete_adiantamento')).valor, 2462.70, '70% de 3.518,14 arredondado');
  return next is((tests.parcela(v, 'frete_saldo')).valor, 960.45, 'saldo fecha a soma no centavo (1.055,44 − 94,99 de retenções)');
end $$;

create function tests.test_sem_retencao_pj() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  insert into public.proprietario (pessoa_id) values (r.cliente) on conflict do nothing;
  update public.veiculo set proprietario_documento_id = r.cliente where id = r.cavalo;
  v := tests.contratar(op, r, 10000);
  return next is(((tests.parcela(v, 'frete_saldo')).valor, (tests.parcela(v, 'frete_saldo')).parte_retencao), (3000.00, 0.00),
    'contratado pessoa jurídica: saldo cheio, sem retenção');
  return next is((tests.parcela(v, 'frete_adiantamento')).favorecido_id, r.cliente, 'favorecido = a empresa dona do cavalo');
end $$;

create function tests.test_sem_frete_ou_frota_propria() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, null);
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v), 0, 'sem frete do motorista, sem parcelas');
  update public.veiculo set unidade_operacional_id = 2 where id = r.cavalo;
  update public.viagem set frete_motorista_valor = 5000, frete_motorista_tipo = 'total' where id = v;
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v), 0, 'frota própria não gera parcelas');
end $$;

create function tests.test_interruptor() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v1 uuid;
  v2 uuid;
  v3 uuid;
begin
  select * into r from tests.cenario(null, false);
  v1 := tests.contratar(op, r, 10000, 'total', null, 20000);
  return next is((select (pagamento_pelo_financeiro, (select count(*)::int from public.fin_pagar where viagem_id = v1))
                  from public.viagem where id = v1)::text, (false, 0)::text,
    'interruptor desligado: viagem nova sem parcelas (confirmação manual no Quadro)');
  return next throws_ok(tests.chamar(fin, 'select public.fin_definir_parcelas_frete(true)'), '42501', null,
    'só o administrador liga o interruptor');
  perform tests.executar_como(adm, 'select public.fin_definir_parcelas_frete(true)');
  return next is((select (parcelas_frete_ativas, parcelas_frete_mudado_por) from public.fin_config)::text, (true, adm)::text,
    'o administrador liga (e fica quem ligou)');

  v2 := tests.contratar(op, r, 10000, 'total', null, 20000);
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v2), 2, 'ligado: a viagem nova ganha as duas parcelas');
  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 11000 where id = %L', v1));
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v1), 0,
    'a viagem contratada antes de ligar continua sem parcelas');

  perform tests.executar_como(adm, 'select public.fin_definir_parcelas_frete(false)');
  v3 := tests.contratar(op, r, 10000, 'total', null, 20000);
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v3), 0, 'desligado de novo: viagem nova sem parcelas');
  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 12000 where id = %L', v2));
  return next is((tests.parcela(v2, 'frete_adiantamento')).valor, 8400.00,
    'a viagem contratada com ele ligado continua no financeiro');
end $$;

create function tests.test_frete_muda() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 12000 where id = %L', v));
  return next is(((tests.parcela(v, 'frete_adiantamento')).valor, (tests.parcela(v, 'frete_saldo')).valor),
    (8400.00, 3276.00), 'frete mudou antes de aprovar: parcelas atualizadas (saldo sem 324 de retenções)');

  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', (tests.parcela(v, 'frete_adiantamento')).id));
  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 13000 where id = %L', v));
  return next is((tests.parcela(v, 'frete_adiantamento')).valor, 9100.00, 'aprovada: valor atualizado');
  return next is((tests.parcela(v, 'frete_adiantamento')).aprovado_em, null::timestamptz, 'e perde a aprovação');
  return next is((tests.parcela(v, 'frete_adiantamento')).editado_por, op, 'quem mudou o frete não aprova');

  update public.fin_pagar set aprovado_em = now(), pago_em = tests.hoje() where viagem_id = v and origem = 'frete_saldo';
  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 15000 where id = %L', v));
  return next is((tests.parcela(v, 'frete_saldo')).valor, 3549.00, 'saldo já pago não muda');
  return next is((tests.parcela(v, 'frete_adiantamento')).valor, 11046.00,
    'o adiantamento fecha a conta: 15.000 − 405 de retenções − 3.549 já pagos');
end $$;

create function tests.test_soma_depois_de_pagar() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  r record;
  v uuid;
  a uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  a := (tests.parcela(v, 'frete_adiantamento')).id;
  update public.viagem set peso_saida_kg = 37000 where id = v;
  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', a));
  perform tests.executar_como(fin, format('select public.fin_pagar_conta(%L, %L)', a, tests.hoje()));

  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 8000 where id = %L', v));
  return next is(((tests.parcela(v, 'frete_adiantamento')).valor, (tests.parcela(v, 'frete_saldo')).valor), (7000.00, 784.00),
    'adiantamento pago: o saldo vira o que falta (8.000 − 216 de retenções − 7.000 pagos)');

  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 7194.24 where id = %L', v));
  return next is(((tests.parcela(v, 'frete_saldo')).cancelado_automatico, (tests.parcela(v, 'frete_saldo')).cancelamento_motivo),
    (true, 'O que já foi pago ao motorista cobre o frete.'::text), 'o já pago cobre o frete: o saldo é cancelado sozinho');

  return next throws_like(tests.chamar(op, format('update public.viagem set frete_motorista_valor = 7000 where id = %L', v)),
    '%ficou menor que o já pago ao motorista (R$ 7.000,00)%', 'frete menor que o já pago é recusado');

  perform tests.executar_como(op, format('update public.viagem set frete_motorista_valor = 8000 where id = %L', v));
  return next is(((tests.parcela(v, 'frete_saldo')).cancelado_em, (tests.parcela(v, 'frete_saldo')).valor), (null::timestamptz, 784.00),
    'o frete voltou a subir: o saldo volta');
end $$;

create function tests.test_cancelar_viagem() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  update public.viagem set cancelada_em = now(), cancelada_por = op, cancelamento_motivo = 'Cliente desistiu' where id = v;
  return next is((select count(*)::int from public.fin_pagar where viagem_id = v and cancelado_em is not null), 2,
    'viagem cancelada: as duas parcelas canceladas');
  return next is((tests.parcela(v, 'frete_saldo')).cancelamento_motivo, 'Viagem cancelada.', 'com o motivo');
end $$;

create function tests.test_adiantamento_exige_embarque() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  r record;
  v uuid;
  a uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  a := (tests.parcela(v, 'frete_adiantamento')).id;
  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', a));
  return next throws_ok(tests.chamar(fin, format('select public.fin_pagar_conta(%L, %L)', a, tests.hoje())), null,
    format('O adiantamento só é pago com o embarque conferido: a viagem %s ainda não tem o peso de saída.',
           (select numero from public.viagem where id = v)),
    'sem peso de saída, o adiantamento não é pago');

  update public.fin_pagar set vencimento = tests.hoje() - 10 where viagem_id = v;
  update public.viagem set status_campo = 'aguardando_nf_pagamento', status_desde = now(), peso_saida_kg = 37000 where id = v;
  return next is(((tests.parcela(v, 'frete_adiantamento')).vencimento, (tests.parcela(v, 'frete_saldo')).vencimento),
    (tests.hoje(), tests.hoje() + 3), 'no embarque: adiantamento vence hoje e o saldo em 3 dias');
  return next ok((tests.parcela(v, 'frete_adiantamento')).aprovado_em is not null, 'frete total: embarque não tira a aprovação');

  return next lives_ok(tests.chamar(fin, format('select public.fin_pagar_conta(%L, %L)', a, tests.hoje())), 'com embarque, paga');
  return next ok((select pagamento_saida_em is not null from public.viagem where id = v), 'pagar marca a viagem (pagamento de saída)');
  return next ok(exists (select 1 from public.viagem_evento where viagem_id = v and dados ->> 'tipo' = 'pagamento_saida'),
    'e entra na linha do tempo');
end $$;

create function tests.test_saldo_exige_entrega() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v uuid;
  s uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  s := (tests.parcela(v, 'frete_saldo')).id;
  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', s));
  return next throws_ok(tests.chamar(fin, format('select public.fin_pagar_conta(%L, %L)', s, tests.hoje())), null, null,
    'saldo antes da entrega conferida é recusado');
  return next throws_ok(tests.chamar(fin, format('select public.fin_liberar_antecipacao(%L, ''Motorista pediu'')', s)),
    '42501', null, 'só o admin libera a antecipação');
  perform tests.executar_como(adm, format('select public.fin_liberar_antecipacao(%L, ''Motorista pediu'')', s));
  return next lives_ok(tests.chamar(fin, format('select public.fin_pagar_conta(%L, %L)', s, tests.hoje())),
    'com a antecipação liberada, paga antes');
  return next ok((select saldo_pago_em is not null from public.viagem where id = v), 'pagar marca o saldo da viagem');
end $$;

create function tests.test_saldo_na_entrega() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  r record;
  v uuid;
  s uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  s := (tests.parcela(v, 'frete_saldo')).id;
  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', s));
  update public.viagem set status_campo = 'aguardando_saldo', status_desde = now(), peso_saida_kg = 37000 where id = v;
  return next lives_ok(tests.chamar(fin, format('select public.fin_pagar_conta(%L, %L)', s, tests.hoje())),
    'em "Aguardando saldo", paga');
  return next ok(exists (select 1 from public.viagem_evento where viagem_id = v and dados ->> 'tipo' = 'saldo_pago'),
    'evento do saldo na linha do tempo');
end $$;

create function tests.test_confirmacao_manual_recusada() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v uuid;
  v2 uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  return next throws_ok(tests.chamar(op, format('select public.confirmar_pagamento_saida(%L)', v)), null,
    format('O adiantamento da viagem %s é pago pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar.',
           (select numero from public.viagem where id = v)),
    'com parcela no financeiro, a confirmação manual é recusada');

  v2 := tests.contratar(op, r, null);
  return next lives_ok(tests.chamar(op, format('select public.confirmar_pagamento_saida(%L)', v2)),
    'viagem sem parcelas continua com a confirmação manual');

  perform tests.executar_como(adm, format('select public.fin_cancelar_pagar(%L, ''Pago fora do sistema'')',
                                          (tests.parcela(v, 'frete_adiantamento')).id));
  return next lives_ok(tests.chamar(op, format('select public.confirmar_pagamento_saida(%L)', v)),
    'parcela cancelada pelo admin: volta a confirmação manual');
  update public.viagem set pedagio_valor = 120 where id = v;
  return next ok((tests.parcela(v, 'frete_adiantamento')).cancelado_em is not null,
    'mudar a viagem não reabre a parcela que o admin cancelou');
end $$;

create function tests.test_confirmar_saldo_recusado() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  update public.viagem set status_campo = 'aguardando_saldo', status_desde = now(), peso_saida_kg = 37000 where id = v;
  return next throws_ok(tests.chamar(op, format('select public.confirmar_saldo(%L)', v)), null,
    format('O saldo da viagem %s é pago pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar.',
           (select numero from public.viagem where id = v)),
    'com o saldo no financeiro, a confirmação manual do saldo é recusada');
end $$;

create function tests.test_operacao_ve_as_parcelas() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  perform tests.executar_como(op, format($q$select set_config('tests.r', (select count(*) from public.viagem_parcelas(%L))::text, true)$q$, v));
  return next is(current_setting('tests.r'), '2', 'operação vê as duas parcelas da viagem');
  update public.viagem set status_campo = 'transito', status_desde = now() where id = v;
  perform tests.executar_como(op, format($q$select set_config('tests.r',
    (select (adiantamento_no_financeiro and saldo_no_financeiro)::text from public.v_quadro where viagem_id = %L), true)$q$, v));
  return next is(current_setting('tests.r'), 'true', 'o quadro sabe que o financeiro paga');
end $$;

create function tests.test_desfazer_pagamento_da_viagem() returns setof text language plpgsql as $$
declare
  op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v uuid;
  a uuid;
begin
  select * into r from tests.cenario();
  v := tests.contratar(op, r, 10000);
  a := (tests.parcela(v, 'frete_adiantamento')).id;
  update public.viagem set status_campo = 'aguardando_nf_pagamento', status_desde = now(), peso_saida_kg = 37000 where id = v;
  perform tests.executar_como(fin, format('select public.fin_aprovar_pagar(%L)', a));
  perform tests.executar_como(fin, format('select public.fin_pagar_conta(%L, %L)', a, tests.hoje()));
  perform tests.executar_como(adm, format('select public.fin_desfazer_pagamento(%L)', a));
  return next ok((select pagamento_saida_em is null from public.viagem where id = v), 'desfazer tira o pagamento da viagem');

  perform tests.executar_como(fin, format('select public.fin_pagar_conta(%L, %L)', a, tests.hoje()));
  update public.viagem set status_campo = 'em_rota', status_desde = now() where id = v;
  return next throws_ok(tests.chamar(adm, format('select public.fin_desfazer_pagamento(%L)', a)), null, null,
    'viagem já em rota: não desfaz o adiantamento');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
