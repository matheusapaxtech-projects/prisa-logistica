-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Piso ANTT e resultado do CT-e (migration 20261027000100). Os casos de calcular_cte, piso_antt e
-- aliquota_icms são os de test/casos.json do motor de despacho (prisa-motor-despacho.zip): a versão do
-- banco só está certa quando reproduz esses casos ao centavo.
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
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

-- Cliente PJ (tomador, remetente e destinatário) com coleta em Curitiba/PR e descarga em Campo Grande/MS;
-- motorista PF apto; cavalo 3 eixos (tipo 7) + carreta 3 eixos (tipo 11) do próprio cliente (contratado PJ);
-- pedido de 74 t a R$ 150/t, granel sólido; viagem planejada de 37 t sem frete do motorista e sem km.
create function tests.cenario()
returns table (cliente uuid, motorista uuid, cavalo uuid, conjunto uuid, pedido uuid, viagem uuid)
language plpgsql as $$
declare
  v_coleta uuid;
  v_descarga uuid;
  v_carreta uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into cliente;
  insert into public.cliente (pessoa_id) values (cliente);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Curitiba', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Campo Grande', 'MS') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro)
  values (motorista, 'e', tests.hoje() + 365, 'normal');

  cavalo := tests.novo_veiculo(7, cliente);
  v_carreta := tests.novo_veiculo(11, cliente);
  insert into public.conjunto (cavalo_id, motorista_id, inicio)
  values (cavalo, motorista, now() - interval '1 day') returning id into conjunto;
  insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (conjunto, 1, v_carreta);

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
  values (pedido, conjunto, cavalo, motorista, 37000)
  returning id into viagem;
  return next;
end $$;

-- Roda p_sql (que devolve jsonb) como o usuário e devolve o resultado.
create function tests.jsonb_como(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$select set_config('tests.r', (%s)::text, true)$q$, p_sql));
  return nullif(current_setting('tests.r'), '')::jsonb;
end $$;

create function tests.codigos(p_viagem uuid) returns text[] language sql as $$
  select coalesce(array_agg((e ->> 'codigo') || ':' || (e ->> 'nivel')), '{}')
  from jsonb_array_elements(public.aptidao_da_viagem(p_viagem)) e;
$$;

-- ---------------------------------------------------------------------------
-- calcular_cte: casos de referência do motor
-- ---------------------------------------------------------------------------
create function tests.test_cte_casos_do_motor() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  c record;
  r jsonb;
  k text;
begin
  for c in
    select * from (values
      ('CT-e 130 (PJ, PR → MS)',
       '{"frete_empresa":8928,"frete_motorista":6844.4,"pedagio":155.6,"uf_origem":"PR","uf_destino":"MS","motorista_pf":false}'::jsonb,
       '{"icms":614.07,"imposto_federal":297.78,"inss_patronal":0,"retencoes_motorista":0,"frete_motorista_devido":6844.4,"taxa_pan_card":71,"seguro_carga":0,"desconto_duplicata":0,"resultado":945.15,"margem":0.1059,"irpj_csll":200.01,"resultado_liquido":745.14,"margem_liquida":0.0835,"faixa":"Abaixo do mínimo"}'::jsonb),
      ('seguro sobre a mercadoria',
       '{"frete_empresa":8928,"frete_motorista":6844.4,"pedagio":155.6,"uf_origem":"PR","uf_destino":"MS","motorista_pf":false,"valor_mercadoria":60000}',
       '{"icms":614.07,"imposto_federal":297.78,"inss_patronal":0,"retencoes_motorista":0,"frete_motorista_devido":6844.4,"taxa_pan_card":71,"seguro_carga":48,"desconto_duplicata":0,"resultado":897.15,"margem":0.1005,"irpj_csll":200.01,"resultado_liquido":697.14,"margem_liquida":0.0781,"faixa":"Abaixo do mínimo"}'),
      ('motorista PF, PR → SP',
       '{"frete_empresa":9980,"frete_motorista":7200,"pedagio":202.5,"uf_origem":"PR","uf_destino":"SP","motorista_pf":true}',
       '{"icms":1173.3,"imposto_federal":314.05,"inss_patronal":288,"retencoes_motorista":194.4,"frete_motorista_devido":7005.6,"taxa_pan_card":73.08,"seguro_carga":0,"desconto_duplicata":0,"resultado":729.07,"margem":0.0731,"irpj_csll":222.93,"resultado_liquido":506.14,"margem_liquida":0.0507,"faixa":"Abaixo do mínimo"}'),
      ('PF dentro do PR, repasse de INSS e duplicata',
       '{"frete_empresa":5300,"frete_motorista":3900,"pedagio":280.44,"uf_origem":"PR","uf_destino":"PR","motorista_pf":true,"repassar_inss":true,"descontar_duplicata":true}',
       '{"icms":0,"imposto_federal":183.21,"inss_patronal":156,"retencoes_motorista":105.3,"frete_motorista_devido":3638.7,"taxa_pan_card":40.19,"seguro_carga":0,"desconto_duplicata":280.9,"resultado":615.25,"margem":0.1161,"irpj_csll":114.45,"resultado_liquido":500.81,"margem_liquida":0.0945,"faixa":"Mínimo aceitável"}')
    ) as t(nome, entrada, saida)
  loop
    r := tests.jsonb_como(v_fin, format('public.calcular_cte(%L::jsonb)', c.entrada));
    for k in select jsonb_object_keys(c.saida) loop
      if k = 'faixa' then
        return next is(r ->> k, c.saida ->> k, format('%s: %s', c.nome, k));
      else
        return next is((r ->> k)::numeric, (c.saida ->> k)::numeric, format('%s: %s', c.nome, k));
      end if;
    end loop;
  end loop;
end $$;

create function tests.test_cte_faixas() returns setof text language plpgsql as $$
begin
  return next is(public.faixa_margem(-0.01), 'Prejuízo', 'margem negativa = prejuízo');
  return next is(public.faixa_margem(0.0849), 'Abaixo do mínimo', 'abaixo de 8,5%');
  return next is(public.faixa_margem(0.085), 'Mínimo aceitável', '8,5% já é o mínimo aceitável');
  return next is(public.faixa_margem(0.11), 'Esperado', '11% é o esperado');
  return next is(public.faixa_margem(0.12), 'Ideal', '12% é o ideal');
  return next is(public.faixa_margem(0.15), 'Excelente', '15% em diante é excelente');
end $$;

create function tests.test_cte_so_admin_e_financeiro() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_ent text := '{"frete_empresa":8928,"frete_motorista":6844.4,"pedagio":155.6,"uf_origem":"PR","uf_destino":"MS","motorista_pf":false}';
begin
  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op, format('select public.calcular_cte(%L::jsonb)', v_ent)),
    '42501', 'sem permissão para ver o resultado do CT-e', 'operação não calcula o resultado do CT-e');
  return next is((tests.jsonb_como(v_adm, format('public.calcular_cte(%L::jsonb)', v_ent)) ->> 'resultado')::numeric,
    945.15::numeric, 'admin calcula');
  return next is((tests.jsonb_como(v_op, '(select to_jsonb(count(*)) from public.parametro_fiscal)'))::int, 0,
    'operação não vê os parâmetros fiscais');
  return next ok((tests.jsonb_como(v_op, '(select to_jsonb(count(*)) from public.antt_coeficiente)'))::int > 0,
    'operação vê a tabela da ANTT');
end $$;

-- ---------------------------------------------------------------------------
-- piso_antt e aliquota_icms
-- ---------------------------------------------------------------------------
create function tests.test_piso_antt() returns setof text language plpgsql as $$
begin
  return next is(public.piso_antt('granel_solido', 7, 755, date '2026-10-24'), 7035.20, 'granel sólido, 7 eixos, 755 km');
  return next is(public.piso_antt('granel_solido', 8, 755, date '2026-10-24'), 7035.20, '8 eixos usa a coluna de 7');
  return next is(public.piso_antt('carga_geral', 5, 413, date '2026-10-24'), 3477.69, 'carga geral, 5 eixos, 413 km');
  return next is(public.piso_antt('granel_pressurizada', 7, 300, date '2026-10-24'), 3168.38,
    'granel pressurizada sem coluna de 7 eixos usa a de 6');
  return next is(public.piso_antt('conteinerizada', 2, 100, date '2026-10-24'), round(100 * 5.2282 + 544.75, 2),
    'conteinerizada sem coluna de 2 eixos usa a superior (3)');
  return next is(public.piso_antt('granel_solido', 7, 755, date '2026-10-24', true), round(755 * 8.2316 * 1.92 + 820.34, 2),
    'retorno vazio soma 0,92 × km × CCD');
  return next ok(public.piso_antt('granel_solido', 7, 0, date '2026-10-24') is null, 'sem km, sem piso');
  return next ok(public.piso_antt('granel_solido', 7, 755, date '2026-01-01') is null, 'antes da primeira vigência, sem piso');
  return next is((select count(*)::int from public.antt_coeficiente where vigencia_inicio = date '2026-09-30'), 78,
    'Portaria 22/2026: 12 tipos × 7 colunas menos as 6 que a ANTT não tem');
end $$;

create function tests.test_aliquota_icms() returns setof text language plpgsql as $$
begin
  return next is(public.aliquota_icms('PR', 'MS'), 0.07, 'PR → MS: 7%');
  return next is(public.aliquota_icms('PR', 'SP'), 0.12, 'PR → SP: 12%');
  return next is(public.aliquota_icms('PR', 'PR'), 0::numeric, 'dentro do PR: 0');
  return next is(public.aliquota_icms('SP', 'GO'), 0.07, 'SP → GO: 7%');
  return next is(public.aliquota_icms('GO', 'PR'), 0.12, 'GO → PR: 12%');
  return next is(public.aliquota_icms('SP', 'ES'), 0.07, 'SP → ES: 7% (ES conta como fora de S/SE)');
end $$;

-- ---------------------------------------------------------------------------
-- frete_da_viagem, aptidão e trava do início
-- ---------------------------------------------------------------------------
create function tests.test_frete_da_viagem() returns setof text language plpgsql as $$
declare
  r record;
  f jsonb;
begin
  select * into r from tests.cenario();
  f := public.frete_da_viagem(r.viagem);
  return next is((f ->> 'eixos')::int, 6, 'eixos = cavalo 3 + carreta 3');
  return next is((f ->> 'frete_empresa')::numeric, 5550.00, 'frete empresa por tonelada: 37 t × R$ 150');
  return next is(f ->> 'uf_origem', 'PR', 'UF de origem = local de coleta');
  return next is(f ->> 'uf_destino', 'MS', 'UF de destino = local de descarga');
  return next is((f ->> 'contratado_pf')::boolean, false, 'contratado = proprietário ANTT do cavalo (PJ)');
  return next ok(f ->> 'piso' is null, 'sem km, sem piso');

  update public.viagem set km_viagem = 990, pedagio_valor = 180.40, frete_motorista_valor = 140,
                           frete_motorista_tipo = 'por_tonelada' where id = r.viagem;
  f := public.frete_da_viagem(r.viagem);
  return next is((f ->> 'frete_motorista')::numeric, 5180.00, 'frete do motorista por tonelada: 37 t × R$ 140');
  return next is((f ->> 'piso')::numeric, round(990 * 7.5641 + 680.01, 2), 'piso de 6 eixos, granel sólido, 990 km');
  return next is((f ->> 'abaixo_do_piso')::boolean, true, '5.180,00 está abaixo do piso de 8.168,47');

  update public.pedido set frete_empresa_tipo = 'total', frete_empresa_valor = 20000 where id = r.pedido;
  update public.viagem set peso_saida_kg = 37500 where id = r.viagem;
  f := public.frete_da_viagem(r.viagem);
  return next is((f ->> 'frete_empresa')::numeric, round(20000 * 37500 / 74000.0, 2),
    'frete empresa total é rateado pelo peso (de saída, quando há) sobre o peso do pedido');
end $$;

create function tests.test_aptidao_do_frete() returns setof text language plpgsql as $$
declare
  r record;
begin
  select * into r from tests.cenario();
  return next ok(tests.codigos(r.viagem) @> array['frete_motorista_ausente:trava', 'km_ausente:trava'],
    'sem frete do motorista e sem km: duas travas');

  update public.viagem set km_viagem = 990, frete_motorista_valor = 3000, frete_motorista_tipo = 'total' where id = r.viagem;
  return next is(tests.codigos(r.viagem), array['abaixo_piso_antt:trava_legal'], 'abaixo do piso é trava legal');
  return next ok((select e ->> 'mensagem' from jsonb_array_elements(public.aptidao_da_viagem(r.viagem)) e)
                   = 'Frete do motorista (R$ 3.000,00) abaixo do piso da ANTT (R$ 8.168,47 para 6 eixos, 990 km, granel sólido)',
    'a mensagem mostra o frete, o piso, os eixos, os km e o tipo de carga');

  update public.viagem set frete_motorista_valor = 8200 where id = r.viagem;
  return next is(public.aptidao_da_viagem(r.viagem), '[]'::jsonb, 'acima do piso e com cadastro em dia: apta');

  update public.viagem set frete_motorista_valor = null, frete_motorista_tipo = null where id = r.viagem;
  update public.veiculo set unidade_operacional_id = 2 where id = r.cavalo;
  return next is(public.aptidao_da_viagem(r.viagem), '[]'::jsonb, 'frota própria não confere frete nem piso');
end $$;

create function tests.test_piso_sem_tabela_e_aviso() returns setof text language plpgsql as $$
declare
  r record;
begin
  select * into r from tests.cenario();
  -- Dia da viagem antes da primeira vigência cadastrada: sem coeficiente, só aviso.
  update public.viagem set km_viagem = 500, frete_motorista_valor = 1000, frete_motorista_tipo = 'total',
                           iniciada_em = timestamptz '2026-01-10 12:00-03' where id = r.viagem;
  return next is(tests.codigos(r.viagem), array['piso_sem_tabela:aviso'], 'sem coeficiente vigente: aviso, não trava');

  -- Portaria nova só para carga geral: granel sólido continua com a sua vigência.
  update public.viagem set iniciada_em = null where id = r.viagem;
  insert into public.antt_coeficiente (vigencia_inicio, portaria, tipo_carga, eixos, ccd, cc)
  values (tests.hoje(), 'Portaria de teste', 'carga_geral', 6, 9, 900);
  return next is(public.piso_antt('granel_solido', 6, 100), round(100 * 7.5641 + 680.01, 2),
    'a vigência é escolhida por tipo de carga');
  return next is(public.piso_antt('carga_geral', 6, 100), 1800.00, 'carga geral usa a portaria nova');
end $$;

create function tests.test_trava_legal_no_inicio() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
begin
  select * into r from tests.cenario();
  update public.viagem set km_viagem = 990, frete_motorista_valor = 3000, frete_motorista_tipo = 'total' where id = r.viagem;
  return next throws_like(
    format('select tests.executar_como(%L, %L)', v_adm, format('select public.iniciar_viagem(%L, %L)', r.viagem, 'cliente pediu')),
    'viagem não pode iniciar: Frete do motorista (R$ 3.000,00) abaixo do piso%',
    'abaixo do piso não inicia nem com justificativa do administrador');

  update public.viagem set frete_motorista_valor = 8200 where id = r.viagem;
  perform tests.executar_como(v_adm, format('select public.iniciar_viagem(%L)', r.viagem));
  return next is((select status_campo::text from public.viagem where id = r.viagem), 'transito', 'acima do piso inicia');

  return next throws_ok(format('update public.viagem set km_viagem = 100 where id = %L', r.viagem),
    'P0001', 'o frete do motorista, os km e o pedágio só mudam antes de a viagem começar',
    'depois de iniciar, os km não mudam');
  return next throws_ok(format('update public.viagem set frete_motorista_valor = 100 where id = %L', r.viagem),
    'P0001', 'o frete do motorista, os km e o pedágio só mudam antes de a viagem começar',
    'depois de iniciar, o frete do motorista não muda');
  return next lives_ok(format('update public.viagem set observacao = %L where id = %L', 'ok', r.viagem),
    'outras colunas continuam mudando');
end $$;

-- ---------------------------------------------------------------------------
-- resultado_cte_da_viagem
-- ---------------------------------------------------------------------------
create function tests.test_resultado_da_viagem() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  f jsonb;
begin
  select * into r from tests.cenario();
  update public.viagem set km_viagem = 990, pedagio_valor = 155.60, frete_motorista_valor = 8200,
                           frete_motorista_tipo = 'total' where id = r.viagem;
  f := tests.jsonb_como(v_fin, format('public.resultado_cte_da_viagem(%L)', r.viagem));
  return next is((f -> 'resultado' ->> 'icms')::numeric, round((5550 - 155.60) * 0.07, 2), 'ICMS de 7% (PR → MS) sem o pedágio');
  return next is((f -> 'resultado' ->> 'inss_patronal')::numeric, 0::numeric, 'contratado PJ: sem INSS patronal');
  return next is(f -> 'resultado' ->> 'faixa', 'Prejuízo', 'frete do motorista maior que o da empresa: prejuízo');
  return next is((f ->> 'piso')::numeric, 8168.47, 'devolve também os dados do piso');

  return next throws_ok(
    format('select tests.executar_como(%L, %L)', v_op, format('select public.resultado_cte_da_viagem(%L)', r.viagem)),
    '42501', 'sem permissão para ver o resultado do CT-e', 'operação não vê o resultado do CT-e');
  return next ok(tests.jsonb_como(v_op, format('public.frete_da_viagem(%L)', r.viagem)) ->> 'piso' is not null,
    'operação vê o piso');
end $$;

create function tests.test_acesso_e_auditoria() returns setof text language plpgsql as $$
declare
  t text;
begin
  foreach t in array array['antt_coeficiente', 'parametro_fiscal'] loop
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass), format('%s: RLS ligado', t));
    return next ok(exists (select 1 from pg_trigger where tgrelid = format('public.%I', t)::regclass and tgname = 'trg_auditoria'),
      format('%s: auditado', t));
    return next ok(not has_table_privilege('anon', format('public.%I', t), 'select'), format('%s: anon sem select', t));
  end loop;
  return next ok(has_column_privilege('authenticated', 'public.viagem', 'km_viagem', 'update'), 'viagem.km_viagem: update liberado');
  return next ok(has_column_privilege('authenticated', 'public.viagem', 'pedagio_valor', 'insert'), 'viagem.pedagio_valor: insert liberado');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
