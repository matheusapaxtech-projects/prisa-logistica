-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Migration 20261030000200: gerenciadora de risco e aprovação do conjunto na aptidão, contratar o lote,
-- negociações com o motorista (resultado só para admin e financeiro, CT-e congela) e v_frete_pago_rota.
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….

create sequence tests.seq_placa;

create function tests.novo_veiculo(p_tipo int, p_prop uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.proprietario (pessoa_id) values (p_prop) on conflict do nothing;
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id,
                              situacao_cadastro, exercicio_doc)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal',
          extract(year from tests.hoje())::int)
  returning id into v_id;
  return v_id;
end $$;

-- Cliente, motorista apto (CNH E, consulta de risco em dia), conjunto aprovado e pedido de 74 t aberto.
create function tests.cenario()
returns table (cliente uuid, motorista uuid, conjunto uuid, pedido uuid)
language plpgsql as $$
declare
  v_coleta uuid;
  v_descarga uuid;
  v_cavalo uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into cliente;
  insert into public.cliente (pessoa_id) values (cliente);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Mandaguari', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Bonito', 'MS') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade)
  values (motorista, 'e', tests.hoje() + 365, 'normal', 'habilitado', tests.hoje() + 180);

  v_cavalo := tests.novo_veiculo(7, cliente);
  insert into public.conjunto (cavalo_id, motorista_id, inicio, aprovado_em)
  values (v_cavalo, motorista, now() - interval '1 day', now()) returning id into conjunto;
  insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (conjunto, 1, tests.novo_veiculo(11, cliente));

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor, frete_empresa_tipo)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 290, 'por_tonelada')
  returning id into pedido;
  return next;
end $$;

create function tests.codigos(p_conjunto uuid) returns text[] language sql as $$
  select coalesce(array_agg(a.codigo || ':' || a.nivel order by a.codigo), '{}') from public.aptidao_viagem(p_conjunto) a;
$$;

create function tests.proposta(p_motorista uuid, p_pedido uuid, p_conjunto uuid) returns jsonb language sql as $$
  select jsonb_build_object('motorista_id', p_motorista, 'pedido_id', p_pedido, 'conjunto_id', p_conjunto,
                            'origem', 'Mandaguari/PR', 'destino', 'Bonito/MS', 'km', 755, 'eixos', 9, 'pedagio', 197.06,
                            'tipo_carga', 'granel_solido', 'peso_kg', 37000, 'frete_cliente_t', 290, 'piso', 8029.92,
                            'frete_motorista', 8432);
$$;

-- ---------------------------------------------------------------------------
-- Aptidão: gerenciadora de risco e aprovação do conjunto
-- ---------------------------------------------------------------------------
create function tests.test_aptidao_gr_e_aprovacao() returns setof text language plpgsql as $$
declare
  r record;
  v_op uuid := tests.criar_usuario('op.desp@exemplo.test', 'operacao');
begin
  select * into r from tests.cenario();
  return next is(tests.codigos(r.conjunto), '{}'::text[], 'motorista com consulta em dia e conjunto aprovado: apto');

  update public.motorista set situacao_gr = 'sem_consulta', gr_validade = null where pessoa_id = r.motorista;
  return next is(tests.codigos(r.conjunto), '{gr_sem_consulta:trava}'::text[], 'sem consulta na gerenciadora = trava');

  update public.motorista set situacao_gr = 'habilitado', gr_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  return next is(tests.codigos(r.conjunto), '{gr_vencida:trava}'::text[], 'consulta vencida = trava');

  update public.motorista set situacao_gr = 'habilitado', gr_validade = tests.hoje() + 3 where pessoa_id = r.motorista;
  return next is(tests.codigos(r.conjunto), '{gr_vencendo:aviso}'::text[], 'consulta vencendo em 7 dias = aviso');

  update public.motorista set situacao_gr = 'recusado' where pessoa_id = r.motorista;
  return next is(tests.codigos(r.conjunto), '{gr_recusado:trava_legal}'::text[], 'recusado pela gerenciadora = trava legal');

  update public.motorista set situacao_gr = 'habilitado', gr_validade = tests.hoje() + 180 where pessoa_id = r.motorista;
  update public.conjunto set aprovado_em = null where id = r.conjunto;
  return next is(tests.codigos(r.conjunto), '{conjunto_nao_aprovado:trava}'::text[], 'conjunto pendente = trava');

  perform tests.executar_como(v_op, format('select public.aprovar_conjunto(%L)', r.conjunto));
  return next is(tests.codigos(r.conjunto), '{}'::text[], 'operação aprova o conjunto e ele fica apto');

  return next is((select count(*)::int from public.aptidao_conjuntos(array[r.conjunto], r.cliente)), 0,
                 'aptidao_conjuntos devolve a lista de cada conjunto');
end $$;

-- ---------------------------------------------------------------------------
-- Contratar o lote
-- ---------------------------------------------------------------------------
create function tests.test_contratar_lote() returns setof text language plpgsql as $$
declare
  r record;
  v_op uuid := tests.criar_usuario('op.lote@exemplo.test', 'operacao');
  v_ids uuid[];
  v_item jsonb;
begin
  select * into r from tests.cenario();
  v_item := jsonb_build_object('conjunto_id', r.conjunto, 'peso_kg', 37000, 'frete_motorista', 8432, 'km', 755, 'pedagio', 197.06);

  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op,
           format('select public.contratar_lote(%L, %L)', r.pedido, jsonb_build_array(v_item || '{"peso_kg": 80000}'))),
    'P0001', 'O lote tem 80000 kg e o pedido #' || (select numero from public.pedido where id = r.pedido) || ' só tem 74000 kg a planejar.',
    'não passa do saldo do pedido');

  update public.motorista set situacao_gr = 'sem_consulta' where pessoa_id = r.motorista;
  return next throws_like(
    format('select tests.executar_como(%L, %L)', v_op, format('select public.contratar_lote(%L, %L)', r.pedido, jsonb_build_array(v_item))),
    '%não pode ser contratado: Motorista Motorista Teste: sem consulta na gerenciadora de risco%',
    'conjunto com trava não entra no lote');
  update public.motorista set situacao_gr = 'habilitado' where pessoa_id = r.motorista;

  perform tests.como(v_op);
  v_ids := public.contratar_lote(r.pedido, jsonb_build_array(v_item));
  perform tests.como_servico();
  return next is(cardinality(v_ids), 1, 'cria uma viagem por caminhão');
  return next ok(exists (select 1 from public.viagem v where v.id = v_ids[1] and v.status_campo is null
                          and v.frete_motorista_valor = 8432 and v.km_viagem = 755 and v.peso_previsto_kg = 37000),
                 'a viagem nasce planejada, com frete, km e peso do lote');
  return next ok(exists (select 1 from public.v_frete_pago_rota f where f.id = v_ids[1] and f.origem = 'Mandaguari/PR'
                          and f.destino = 'Bonito/MS' and f.valor = 8432 and f.eixos > 0),
                 'a viagem entra no histórico do que foi pago na rota');
end $$;

-- ---------------------------------------------------------------------------
-- Negociações
-- ---------------------------------------------------------------------------
create function tests.test_negociacao() returns setof text language plpgsql as $$
declare
  r record;
  v_op uuid := tests.criar_usuario('op.neg@exemplo.test', 'operacao');
  v_fin uuid := tests.criar_usuario('fin.neg@exemplo.test', 'financeiro');
  v_aceita uuid;
  v_recusa uuid;
  v_viagem uuid;
  n int;
  p1 jsonb;
  p2 jsonb;
begin
  select * into r from tests.cenario();
  p1 := tests.proposta(r.motorista, r.pedido, r.conjunto);
  p2 := tests.proposta(r.motorista, null, null) || '{"frete_motorista": 7100}';
  perform tests.como(v_op);
  v_aceita := public.registrar_negociacao(p1, 4289.65, 0.288);
  v_recusa := public.registrar_negociacao(p2, 5000, 0.33);
  select count(*) into n from public.negociacao_resultado;
  perform tests.como_servico();
  return next is(n, 0, 'operação não lê o resultado do CT-e da negociação');

  perform tests.como(v_fin);
  select count(*) into n from public.negociacao_resultado where negociacao_id in (v_aceita, v_recusa);
  perform tests.como_servico();
  return next is(n, 2, 'financeiro lê o resultado do CT-e da negociação');

  perform tests.como(v_op);
  perform public.responder_negociacao(v_recusa, false, 7600, 'Quer retorno garantido');
  v_viagem := public.responder_negociacao(v_aceita, true);
  perform tests.como_servico();
  return next ok(exists (select 1 from public.negociacao_frete where id = v_recusa and situacao = 'recusada'
                          and valor_pedido = 7600 and motivo = 'Quer retorno garantido'),
                 'recusa guarda o valor que o motorista pediu e o motivo');
  return next ok(exists (select 1 from public.viagem where id = v_viagem and pedido_id = r.pedido and frete_motorista_valor = 8432),
                 'aceita com pedido e conjunto vira viagem planejada');
  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op, format('select public.responder_negociacao(%L, true)', v_aceita)),
    'P0001', 'Esta negociação já foi respondida.', 'não responde duas vezes');

  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op, format('select public.informar_cte_negociacao(%L, %L)', v_recusa, '130')),
    'P0001', 'Só negociação aceita recebe o número do CT-e.', 'recusada não recebe CT-e');
  perform tests.executar_como(v_op, format('select public.informar_cte_negociacao(%L, %L)', v_aceita, '131'));
  return next throws_ok(
    format('update public.negociacao_frete set frete_motorista = 1 where id = %L', v_aceita),
    'P0001', 'Negociação com CT-e emitido não muda: o registro está congelado.', 'CT-e emitido congela o registro');
  return next is((select count(*)::int from public.v_frete_pago_rota where id = v_aceita), 0,
                 'negociação que virou viagem aparece uma vez só no histórico (pela viagem)');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
