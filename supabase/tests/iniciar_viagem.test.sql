-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 3 do quadro da operação: aptidão da viagem, iniciar e cancelar viagem.
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735 e 52998224725) e placas TST….
-- Nenhum DELETE: tudo some no rollback (de cada teste, pelo runtests, e no fim).

-- ---------------------------------------------------------------------------
-- Auxiliares (não rodam como teste: o nome não começa com test_)
-- ---------------------------------------------------------------------------
create sequence tests.seq_placa;

create function tests.ano() returns int language sql stable as $$
  select extract(year from tests.hoje())::int;
$$;

-- Veículo com cadastro normal e CRLV do exercício do ano; posse e documento = p_prop (não arrendado).
create function tests.novo_veiculo(p_tipo int, p_prop uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.proprietario (pessoa_id) values (p_prop) on conflict do nothing;
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id,
                              situacao_cadastro, exercicio_doc)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal', tests.ano())
  returning id into v_id;
  return v_id;
end $$;

create function tests.nova_viagem(p_pedido uuid, p_conjunto uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  -- Frete do motorista (R$ 5.000) e km (400) acima do piso ANTT de 6 eixos (migration 20261027000100).
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                             frete_motorista_valor, frete_motorista_tipo, km_viagem)
  select p_pedido, c.id, c.cavalo_id, c.motorista_id, 37000, 5000, 'total', 400 from public.conjunto c where c.id = p_conjunto
  returning id into v_id;
  return v_id;
end $$;

-- Fixtura: cliente sem exigências (tomador = remetente = destinatário) com locais; motorista com cadastro
-- normal e CNH E válida por um ano; cavalo + carreta normais com CRLV do ano; conjunto aberto; pedido
-- aberto; viagem planejada.
create function tests.cenario()
returns table (cliente uuid, motorista uuid, cavalo uuid, carreta uuid, conjunto uuid, pedido uuid, viagem uuid)
language plpgsql as $$
declare
  v_coleta uuid;
  v_descarga uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into cliente;
  insert into public.cliente (pessoa_id) values (cliente);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Curitiba', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (cliente, 'coleta_descarga', 'Santos', 'SP') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro)
  values (motorista, 'e', tests.hoje() + 365, 'normal');

  cavalo := tests.novo_veiculo(7, cliente);
  carreta := tests.novo_veiculo(11, cliente);
  insert into public.conjunto (cavalo_id, motorista_id, inicio)
  values (cavalo, motorista, now() - interval '1 day') returning id into conjunto;
  insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (conjunto, 1, carreta);

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  viagem := tests.nova_viagem(pedido, conjunto);
  return next;
end $$;

-- A aptidão como lista 'codigo:nivel' (para any()).
create function tests.aptidao(p_conjunto uuid, p_tomador uuid) returns text[] language plpgsql as $$
begin
  return (select coalesce(array_agg(a.codigo || ':' || a.nivel), '{}') from public.aptidao_viagem(p_conjunto, p_tomador) a);
end $$;

-- SQL que chama a RPC como o usuário (para lives_ok/throws_*).
create function tests.sql_iniciar(p_uid uuid, p_viagem uuid, p_just text default null) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid,
                format('select public.iniciar_viagem(%L, %L)', p_viagem, p_just));
$$;

create function tests.sql_cancelar(p_uid uuid, p_viagem uuid, p_motivo text) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid,
                format('select public.cancelar_viagem(%L, %L)', p_viagem, p_motivo));
$$;

-- ---------------------------------------------------------------------------
-- Os testes do plano
-- ---------------------------------------------------------------------------
create function tests.test_apto_inicia_em_transito() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  return next is(tests.aptidao(r.conjunto, r.cliente), '{}'::text[], 'fixtura apta: nenhuma linha de aptidão');
  return next lives_ok(tests.sql_iniciar(v_op, r.viagem), 'operação inicia viagem apta sem justificativa');
  return next is((select status_campo::text from public.viagem where id = r.viagem), 'transito', 'status_campo = transito');
  return next ok((select status_desde is not null and iniciada_em is not null from public.viagem where id = r.viagem),
    'status_desde e iniciada_em preenchidos');
  return next is((select iniciada_por from public.viagem where id = r.viagem), v_op, 'iniciada_por = quem iniciou');
  return next is((select liberacao_aptidao from public.viagem where id = r.viagem), '[]'::jsonb, 'liberacao_aptidao = []');
  return next is((select liberacao_justificativa from public.viagem where id = r.viagem), null, 'sem justificativa');
  return next is((select count(*) from public.viagem_evento where viagem_id = r.viagem), 1::bigint, 'um evento');
  return next ok((select de is null and para = 'transito' and por = v_op from public.viagem_evento where viagem_id = r.viagem),
    'evento null → transito, por quem iniciou');
  return next throws_ok(tests.sql_iniciar(v_op, r.viagem), 'P0001', 'a viagem já começou: está em "Trânsito"',
    'iniciar de novo é recusado');
end $$;

create function tests.test_cnh_vencida_trava_sem_justificativa() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
begin
  select * into r from tests.cenario();
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  return next ok('cnh_vencida:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'aptidão: cnh_vencida trava');
  return next ok(not ('cnh_vencendo:aviso' = any (tests.aptidao(r.conjunto, r.cliente))), 'vencida não é também "vencendo"');
  return next throws_like(tests.sql_iniciar(v_op, r.viagem), 'viagem não apta%CNH%', 'operação sem justificativa: não apta');
  return next throws_like(tests.sql_iniciar(v_adm, r.viagem), 'viagem não apta%CNH%', 'admin sem justificativa: não apta');
  return next throws_like(tests.sql_iniciar(v_adm, r.viagem, '   '), 'viagem não apta%CNH%',
    'justificativa só com espaços conta como sem justificativa');
  return next is((select status_campo from public.viagem where id = r.viagem), null::public.status_campo, 'continua Planejada');
  return next is((select count(*) from public.viagem_evento where viagem_id = r.viagem), 0::bigint, 'nenhum evento');
end $$;

create function tests.test_operacao_com_justificativa_nao_libera() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  return next throws_ok(tests.sql_iniciar(v_op, r.viagem, 'cliente autorizou'), 'P0001',
    'Só o administrador pode liberar com exceção.', 'operação com justificativa não libera trava');
  return next is((select status_campo from public.viagem where id = r.viagem), null::public.status_campo, 'continua Planejada');
end $$;

create function tests.test_admin_libera_com_justificativa() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
begin
  select * into r from tests.cenario();
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  return next lives_ok(tests.sql_iniciar(v_adm, r.viagem, '  CNH renovada, aguardando documento  '),
    'admin libera com justificativa');
  return next is((select status_campo::text from public.viagem where id = r.viagem), 'transito', 'em Trânsito');
  return next is((select liberacao_justificativa from public.viagem where id = r.viagem), 'CNH renovada, aguardando documento',
    'liberacao_justificativa gravada (sem espaços nas pontas)');
  return next ok((select liberacao_aptidao @> '[{"codigo": "cnh_vencida", "nivel": "trava"}]' from public.viagem where id = r.viagem),
    'liberacao_aptidao guarda a trava liberada');
  return next is((select motivo from public.viagem_evento where viagem_id = r.viagem), 'CNH renovada, aguardando documento',
    'evento com motivo = justificativa');
  return next ok((select dados -> 'aptidao' @> '[{"codigo": "cnh_vencida"}]' from public.viagem_evento where viagem_id = r.viagem),
    'evento com a aptidão nos dados');
end $$;

create function tests.test_iniciar_com_cavalo_em_outra_viagem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v_v2 uuid;
  v_num1 bigint;
begin
  select * into r from tests.cenario();
  select numero into v_num1 from public.viagem where id = r.viagem;
  perform tests.executar_como(v_op, format('select public.iniciar_viagem(%L)', r.viagem));
  v_v2 := tests.nova_viagem(r.pedido, r.conjunto);
  return next ok('cavalo_em_viagem:trava_legal' = any (tests.aptidao(r.conjunto, r.cliente)), 'aptidão: cavalo_em_viagem trava_legal');
  return next ok('motorista_em_viagem:trava_legal' = any (tests.aptidao(r.conjunto, r.cliente)), 'aptidão: motorista_em_viagem trava_legal');
  return next throws_like(tests.sql_iniciar(v_op, v_v2), format('%%#%s%%Trânsito%%', v_num1),
    'operação: recusa dizendo o número e a coluna da outra viagem');
  return next throws_like(tests.sql_iniciar(v_adm, v_v2, 'urgente'), format('%%#%s%%Trânsito%%', v_num1),
    'admin com justificativa também é recusado (trava legal)');
  return next ok(exists (select 1 from public.aptidao_viagem(r.conjunto, r.cliente) a
                         where a.codigo = 'motorista_em_viagem' and a.mensagem like format('%%#%s%%Trânsito%%', v_num1)),
    'mensagem do motorista também diz número e coluna');
  -- a primeira viagem finaliza: o cavalo fica livre
  -- a primeira viagem descarregou e só espera o saldo de 30%: o cavalo já está livre
  update public.viagem set status_campo = 'aguardando_saldo' where id = r.viagem;
  return next lives_ok(tests.sql_iniciar(v_op, v_v2), 'com a outra viagem esperando o saldo, inicia');
end $$;

create function tests.test_categoria_b_com_carreta() returns setof text language plpgsql as $$
declare
  r record;
  v_cav2 uuid;
  v_conj2 uuid;
begin
  select * into r from tests.cenario();
  update public.motorista set cnh_categoria = 'b' where pessoa_id = r.motorista;
  return next ok('cnh_categoria:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'categoria B com carreta: trava');
  update public.motorista set cnh_categoria = 'd' where pessoa_id = r.motorista;
  return next ok('cnh_categoria:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'categoria D com carreta: trava');
  update public.motorista set cnh_categoria = 'ae' where pessoa_id = r.motorista;
  return next ok(not ('cnh_categoria:trava' = any (tests.aptidao(r.conjunto, r.cliente))), 'categoria AE com carreta: ok');
  update public.motorista set cnh_categoria = null where pessoa_id = r.motorista;
  return next ok('cnh_categoria:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'categoria não informada: trava');
  -- conjunto sem itens (só o cavalo): C, D, E, AC, AD, AE servem
  v_cav2 := tests.novo_veiculo(7, r.cliente);
  insert into public.conjunto (cavalo_id, motorista_id, inicio) values (v_cav2, r.motorista, now() - interval '1 day')
  returning id into v_conj2;
  update public.motorista set cnh_categoria = 'c' where pessoa_id = r.motorista;
  return next ok(not ('cnh_categoria:trava' = any (tests.aptidao(v_conj2, r.cliente))), 'categoria C sem carreta: ok');
  update public.motorista set cnh_categoria = 'ab' where pessoa_id = r.motorista;
  return next ok('cnh_categoria:trava' = any (tests.aptidao(v_conj2, r.cliente)), 'categoria AB sem carreta: trava');
end $$;

create function tests.test_crlv_ano_anterior_aviso() returns setof text language plpgsql as $$
declare
  r record;
begin
  select * into r from tests.cenario();
  update public.veiculo set exercicio_doc = tests.ano() - 1 where id = r.carreta;
  return next ok('crlv_exercicio:aviso' = any (tests.aptidao(r.conjunto, r.cliente)), 'CRLV do ano anterior: aviso');
  return next ok(not ('crlv_exercicio:trava' = any (tests.aptidao(r.conjunto, r.cliente))), 'CRLV do ano anterior não trava');
  return next ok(exists (select 1 from public.aptidao_viagem(r.conjunto, r.cliente) a
                         where a.codigo = 'crlv_exercicio' and a.mensagem like '%' || (select placa from public.veiculo where id = r.carreta) || '%'),
    'mensagem diz a placa');
  update public.veiculo set exercicio_doc = tests.ano() - 2 where id = r.carreta;
  return next ok('crlv_exercicio:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'CRLV de dois anos atrás: trava');
  update public.veiculo set exercicio_doc = null where id = r.cavalo;
  return next is((select count(*) from public.aptidao_viagem(r.conjunto, r.cliente) a
                  where a.codigo = 'crlv_exercicio' and a.nivel = 'trava'), 2::bigint,
    'CRLV sem exercício: trava (uma linha por placa)');
end $$;

create function tests.test_cliente_exige_gr_aviso() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  update public.cliente set exige_gr = true, gerenciadora = 'GR Exemplo' where pessoa_id = r.cliente;
  return next ok('cliente_exige_gr:aviso' = any (tests.aptidao(r.conjunto, r.cliente)), 'tomador exige GR: aviso');
  return next ok(exists (select 1 from public.aptidao_viagem(r.conjunto, r.cliente) a
                         where a.codigo = 'cliente_exige_gr' and a.mensagem like '%GR Exemplo%'), 'mensagem cita a gerenciadora');
  return next ok(not ('cliente_exige_gr:aviso' = any (tests.aptidao(r.conjunto, null))), 'sem tomador: sem linha de cliente');
  update public.cliente set exige_sm = true where pessoa_id = r.cliente;
  return next ok('cliente_exige_sm:aviso' = any (tests.aptidao(r.conjunto, r.cliente)), 'tomador exige SM: aviso');
  return next lives_ok(tests.sql_iniciar(v_op, r.viagem), 'aviso não impede iniciar (sem justificativa, como operação)');
  return next ok((select liberacao_aptidao @> '[{"codigo": "cliente_exige_gr", "nivel": "aviso"}]' from public.viagem where id = r.viagem),
    'aviso guardado em liberacao_aptidao');
end $$;

create function tests.test_cancelar_em_rota_recusa() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  -- como serviço (o caminho até Em rota é da Task 4)
  update public.viagem set status_campo = 'em_rota', status_desde = now(), iniciada_em = now() where id = r.viagem;
  return next throws_ok(tests.sql_cancelar(v_op, r.viagem, 'cliente desistiu'), 'P0001',
    'a viagem está em "Em rota"; só dá para cancelar antes de "Em rota"', 'Em rota não cancela');
  -- pausa aberta a partir de Em rota também não
  update public.viagem set status_campo = 'pausa' where id = r.viagem;
  insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (r.viagem, 'almoco', true, 'em_rota');
  return next throws_ok(tests.sql_cancelar(v_op, r.viagem, 'cliente desistiu'), 'P0001',
    'a viagem está em "Pausa"; só dá para cancelar antes de "Em rota"', 'pausa depois de Em rota não cancela');
  return next is((select cancelada_em from public.viagem where id = r.viagem), null, 'nada gravado');
end $$;

create function tests.test_cancelar_exige_motivo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  return next throws_ok(tests.sql_cancelar(v_op, r.viagem, null), 'P0001', 'informe o motivo do cancelamento', 'motivo nulo');
  return next throws_ok(tests.sql_cancelar(v_op, r.viagem, '   '), 'P0001', 'informe o motivo do cancelamento', 'motivo só com espaços');
  return next is((select cancelada_em from public.viagem where id = r.viagem), null, 'continua não cancelada');
end $$;

-- Ruling R4: viagem de pedido cancelado não inicia (trava legal, sem exceção).
create function tests.test_iniciar_pedido_cancelado_recusa() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
  v_num bigint;
begin
  select * into r from tests.cenario();
  select numero into v_num from public.pedido where id = r.pedido;
  update public.pedido set situacao = 'cancelado' where id = r.pedido;
  return next throws_like(tests.sql_iniciar(v_adm, r.viagem, 'urgente'),
    format('viagem não pode iniciar:%%pedido #%s está cancelado%%', v_num),
    'pedido cancelado: recusa mesmo admin com justificativa');
  return next is((select status_campo from public.viagem where id = r.viagem), null::public.status_campo, 'continua Planejada');
end $$;

-- ---------------------------------------------------------------------------
-- Demais regras
-- ---------------------------------------------------------------------------
create function tests.test_regras_da_aptidao() returns setof text language plpgsql as $$
declare
  r record;
  v_placa text;
begin
  select * into r from tests.cenario();
  select placa into v_placa from public.veiculo where id = r.carreta;

  update public.motorista set situacao_cadastro = 'pendente' where pessoa_id = r.motorista;
  return next ok('motorista_cadastro:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'motorista com cadastro pendente: trava');
  update public.motorista set situacao_cadastro = 'normal', cnh_validade = null where pessoa_id = r.motorista;
  return next ok('cnh_ausente:trava' = any (tests.aptidao(r.conjunto, r.cliente)), 'CNH sem validade: trava');
  update public.motorista set cnh_validade = tests.hoje() + 30 where pessoa_id = r.motorista;
  return next is(tests.aptidao(r.conjunto, r.cliente), array['cnh_vencendo:aviso'], 'CNH vencendo em 30 dias: só aviso');
  update public.motorista set cnh_validade = tests.hoje() where pessoa_id = r.motorista;
  return next is(tests.aptidao(r.conjunto, r.cliente), array['cnh_vencendo:aviso'], 'CNH que vence hoje ainda vale: aviso');
  update public.motorista set cnh_validade = tests.hoje() + 365 where pessoa_id = r.motorista;

  update public.veiculo set situacao_cadastro = 'pendente' where id = r.carreta;
  return next ok(exists (select 1 from public.aptidao_viagem(r.conjunto, r.cliente) a
                         where a.codigo = 'veiculo_cadastro' and a.nivel = 'trava' and a.mensagem like '%' || v_placa || '%'),
    'placa com cadastro pendente: trava com a placa');
  update public.veiculo set situacao_cadastro = 'normal' where id = r.carreta;

  -- carreta arrendada (posse do motorista, documento do cliente) sem contrato
  insert into public.proprietario (pessoa_id) values (r.motorista);
  update public.veiculo set proprietario_posse_id = r.motorista where id = r.carreta;
  return next ok(exists (select 1 from public.aptidao_viagem(r.conjunto, r.cliente) a
                         where a.codigo = 'arrendado_sem_contrato' and a.nivel = 'trava' and a.mensagem like '%' || v_placa || '%'),
    'placa arrendada sem contrato: trava');
  update public.veiculo set proprietario_posse_id = r.cliente where id = r.carreta;

  update public.veiculo set cmt_t = 10 where id = r.cavalo;
  update public.veiculo set capacidade_carga_t = 30 where id = r.carreta;
  return next ok('acima_cmt:aviso' = any (tests.aptidao(r.conjunto, r.cliente)), 'acima do CMT: aviso');
  update public.veiculo set cmt_t = null where id = r.cavalo;

  update public.conjunto set fim = now() where id = r.conjunto;
  return next ok('conjunto_encerrado:trava_legal' = any (tests.aptidao(r.conjunto, r.cliente)), 'conjunto encerrado: trava legal');
  update public.conjunto set fim = null, motorista_id = null where id = r.conjunto;
  return next ok('sem_motorista:trava_legal' = any (tests.aptidao(r.conjunto, r.cliente)), 'conjunto sem motorista: trava legal');
  return next is(tests.aptidao(gen_random_uuid(), null), array['conjunto_nao_encontrado:trava_legal'],
    'conjunto inexistente não é "apto"');
  -- ordem: trava_legal, trava, aviso
  update public.conjunto set motorista_id = r.motorista where id = r.conjunto;
  update public.cliente set exige_sm = true where pessoa_id = r.cliente;
  update public.veiculo set exercicio_doc = null where id = r.carreta;
  update public.conjunto set fim = now() where id = r.conjunto;
  return next is(tests.aptidao(r.conjunto, r.cliente),
    array['conjunto_encerrado:trava_legal', 'crlv_exercicio:trava', 'cliente_exige_sm:aviso'], 'ordem: trava legal, trava, aviso');
end $$;

create function tests.test_trava_legal_vence_justificativa() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
begin
  select * into r from tests.cenario();
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  update public.conjunto set fim = now() where id = r.conjunto;
  return next throws_like(tests.sql_iniciar(v_adm, r.viagem, 'urgente'), 'viagem não pode iniciar:%conjunto%encerrado%',
    'conjunto encerrado: admin com justificativa é recusado');
end $$;

create function tests.test_cancelar_antes_de_em_rota() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_v2 uuid;
begin
  select * into r from tests.cenario();
  -- planejada
  return next lives_ok(tests.sql_cancelar(v_op, r.viagem, '  cliente desistiu  '), 'cancela viagem planejada');
  return next ok((select cancelada_em is not null and cancelada_por = v_op and cancelamento_motivo = 'cliente desistiu'
                    and status_campo is null from public.viagem where id = r.viagem), 'cancelada_* gravados');
  return next ok((select de is null and para is null and motivo = 'cliente desistiu' from public.viagem_evento where viagem_id = r.viagem),
    'evento (null → null, motivo)');
  return next throws_ok(tests.sql_cancelar(v_op, r.viagem, 'de novo'), 'P0001', 'a viagem já está cancelada', 'cancelar de novo');
  return next throws_ok(tests.sql_iniciar(v_op, r.viagem), 'P0001', 'a viagem está cancelada', 'cancelada não inicia');

  -- em pausa a partir de Trânsito: fecha a pausa
  v_v2 := tests.nova_viagem(r.pedido, r.conjunto);
  perform tests.executar_como(v_op, format('select public.iniciar_viagem(%L)', v_v2));
  update public.viagem set status_campo = 'pausa' where id = v_v2;
  insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (v_v2, 'problema', false, 'transito');
  return next lives_ok(tests.sql_cancelar(v_op, v_v2, 'quebrou'), 'cancela em pausa a partir de Trânsito');
  return next is((select count(*) from public.viagem_pausa where viagem_id = v_v2 and fim is null), 0::bigint, 'pausa fechada');
  return next ok((select de = 'pausa' and para is null from public.viagem_evento where viagem_id = v_v2 order by id desc limit 1),
    'evento pausa → null');
  -- o cavalo fica livre para outra viagem
  return next ok(not ('cavalo_em_viagem:trava_legal' = any (tests.aptidao(r.conjunto, r.cliente))),
    'viagem cancelada não prende o cavalo');
end $$;

create function tests.test_cancelar_em_aguardando_nf() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  update public.viagem set status_campo = 'aguardando_nf_pagamento', status_desde = now(), iniciada_em = now() where id = r.viagem;
  return next lives_ok(tests.sql_cancelar(v_op, r.viagem, 'sem nota'), 'cancela em Aguardando NF e pagamento');
  return next ok((select de = 'aguardando_nf_pagamento' and para is null from public.viagem_evento where viagem_id = r.viagem),
    'evento aguardando_nf_pagamento → null');
end $$;

create function tests.test_conjunto_trocou_motorista_antes_de_iniciar() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_mot2 uuid;
begin
  select * into r from tests.cenario();
  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro) values ('pf', 'Motorista Dois', '52998224725', 'normal')
  returning id into v_mot2;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro)
  values (v_mot2, 'e', tests.hoje() + 365, 'normal');
  update public.conjunto set motorista_id = v_mot2 where id = r.conjunto;
  return next lives_ok(tests.sql_iniciar(v_op, r.viagem), 'inicia com o conjunto atual');
  return next is((select motorista_id from public.viagem where id = r.viagem), v_mot2,
    'a viagem passa a ter o motorista do conjunto no início');
end $$;

create function tests.test_permissoes() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  r record;
  v_n bigint;
begin
  select * into r from tests.cenario();
  return next throws_ok(tests.sql_iniciar(v_lei, r.viagem), '42501', 'sem permissão para iniciar viagem', 'leitura não inicia');
  return next throws_ok(tests.sql_iniciar(v_fin, r.viagem), '42501', 'sem permissão para iniciar viagem', 'financeiro não inicia');
  return next throws_ok(tests.sql_iniciar(v_sem, r.viagem), '42501', 'sem permissão para iniciar viagem', 'sem perfil não inicia');
  return next throws_ok(tests.sql_cancelar(v_lei, r.viagem, 'x'), '42501', 'sem permissão para cancelar viagem', 'leitura não cancela');
  return next throws_ok(tests.sql_cancelar(v_fin, r.viagem, 'x'), '42501', 'sem permissão para cancelar viagem', 'financeiro não cancela');
  -- leitura vê a aptidão (security invoker, RLS pode_ler)
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  perform tests.como(v_lei);
  select count(*) into v_n from public.aptidao_viagem(r.conjunto, r.cliente) a where a.codigo = 'cnh_vencida';
  perform tests.como_servico();
  return next is(v_n, 1::bigint, 'leitura consulta a aptidão');
end $$;

create function tests.test_rotulo_status_campo() returns setof text language plpgsql as $$
begin
  return next is(
    array(select public.rotulo_status_campo(s) from unnest(enum_range(null::public.status_campo)) s),
    array['Trânsito', 'Aguardando carregamento', 'Em carregamento', 'Aguardando NF e pagamento', 'Em rota', 'Pausa',
          'Aguardando descarga', 'Descarregando', 'Aguardando contagem de divergência', 'Resolução de divergência na carga',
          'Aguardando saldo (30%)', 'Frete finalizado'],
    'rótulos exatos das colunas, na ordem');
  return next is(public.rotulo_status_campo(null), 'Planejada', 'null = Planejada');
end $$;

create function tests.test_estrutura() returns setof text language plpgsql as $$
declare
  f text;
begin
  return next ok((select not prosecdef and provolatile = 's' from pg_proc where oid = 'public.aptidao_viagem(uuid, uuid)'::regprocedure),
    'aptidao_viagem: security invoker e stable');
  return next ok((select provolatile = 'i' from pg_proc where oid = 'public.rotulo_status_campo(public.status_campo)'::regprocedure),
    'rotulo_status_campo: immutable');
  foreach f in array array['public.iniciar_viagem(uuid, text)', 'public.cancelar_viagem(uuid, text)'] loop
    return next ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f::regprocedure),
      format('%s: security definer com search_path vazio', f));
  end loop;
  foreach f in array array['public.aptidao_viagem(uuid, uuid)', 'public.iniciar_viagem(uuid, text)',
                           'public.cancelar_viagem(uuid, text)', 'public.rotulo_status_campo(public.status_campo)'] loop
    return next ok(has_function_privilege('authenticated', f, 'execute'), format('%s: execute para authenticated', f));
    return next ok(not has_function_privilege('anon', f, 'execute'), format('%s: sem execute para anon', f));
  end loop;
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
