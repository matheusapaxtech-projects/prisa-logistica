-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- App do motorista (migrations 20261107000100 e 20261107000200): papel motorista, oferta de frete,
-- check-in, fretes para o motorista, pendências e interesse.
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….

create sequence tests.seq_placa;

create function tests.novo_veiculo(p_tipo int, p_prop uuid, p_carroceria text default null) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.proprietario (pessoa_id) values (p_prop) on conflict do nothing;
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id,
                              situacao_cadastro, exercicio_doc, tipo_carroceria)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal',
          extract(year from tests.hoje())::int, p_carroceria::public.tipo_carroceria)
  returning id into v_id;
  return v_id;
end $$;

-- Cliente com coleta em Curitiba/PR e descarga em Santos/SP; motorista apto (cadastro normal, CNH E e
-- gerenciadora válidas) com cavalo + carreta graneleira; pedido aberto de 74 t; oferta publicada; usuário do
-- app ligado ao motorista; usuário de operação.
create function tests.cenario()
returns table (motorista uuid, conjunto uuid, carreta uuid, pedido uuid, oferta uuid, app uuid, op uuid)
language plpgsql as $$
declare
  v_cliente uuid;
  v_coleta uuid;
  v_descarga uuid;
  v_cavalo uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro)
  values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into v_cliente;
  insert into public.cliente (pessoa_id) values (v_cliente);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (v_cliente, 'coleta_descarga', 'Curitiba', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (v_cliente, 'coleta_descarga', 'Santos', 'SP') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade)
  values (motorista, 'e', tests.hoje() + 365, 'normal', 'habilitado', tests.hoje() + 180);

  v_cavalo := tests.novo_veiculo(7, v_cliente);
  carreta := tests.novo_veiculo(11, v_cliente, 'graneleiro');
  insert into public.conjunto (cavalo_id, motorista_id, inicio)
  values (v_cavalo, motorista, now() - interval '1 day') returning id into conjunto;
  insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (conjunto, 1, carreta);
  -- Aprovação do conjunto (migration do despacho, quando existir no banco).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'conjunto' and column_name = 'aprovado_em') then
    execute format('update public.conjunto set aprovado_em = now() where id = %L', conjunto);
  end if;

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (v_cliente, v_cliente, v_cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  insert into public.frete_oferta (pedido_id, frete_motorista_por_t, coleta_latitude, coleta_longitude, coleta_uf)
  values (pedido, 120, -25.43, -49.27, 'PR') returning id into oferta;

  app := tests.criar_usuario('motorista@exemplo.test', null);
  insert into public.perfil_usuario (user_id, nome, papel, motorista_id) values (app, 'Motorista', 'motorista', motorista);
  op := tests.criar_usuario('op@exemplo.test', 'operacao');
  return next;
end $$;

-- Check-in direto (como serviço), com a posição dada.
create function tests.checkin(p_motorista uuid, p_lat numeric, p_lon numeric) returns void language sql as $$
  -- clock_timestamp: na mesma transação now() não muda, e o check-in mais novo precisa ser o último.
  insert into public.motorista_disponibilidade (motorista_id, cidade, latitude, longitude, origem, created_at)
  values (p_motorista, 'Teste/PR', p_lat, p_lon, 'app', clock_timestamp());
$$;

create function tests.fretes(p_uid uuid) returns uuid[] language plpgsql as $$
declare
  v uuid[];
begin
  perform tests.como(p_uid);
  select coalesce(array_agg(f.oferta_id), '{}') into v from public.fretes_para_mim() f;
  perform tests.como_servico();
  return v;
end $$;

create function tests.pendencias(p_uid uuid) returns text[] language plpgsql as $$
declare
  v text[];
begin
  perform tests.como(p_uid);
  select coalesce(array_agg(p.codigo), '{}') into v from public.minhas_pendencias() p;
  perform tests.como_servico();
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Testes
-- ---------------------------------------------------------------------------
create function tests.test_km_estrada_estimado() returns setof text language plpgsql as $$
begin
  -- Ponta Grossa → Curitiba: ~97 km de linha reta × 1,25 (PR).
  return next ok(public.km_estrada_estimado(-25.09, -50.16, -25.43, -49.27, 'PR') between 110 and 130,
                 'Ponta Grossa a Curitiba fica entre 110 e 130 km por estrada');
  return next is(public.km_estrada_estimado(-25.43, -49.27, -25.43, -49.27, 'PR'), 0, 'mesmo ponto = 0 km');
end $$;

create function tests.test_papel_motorista_exige_cadastro() returns setof text language plpgsql as $$
declare
  v_u uuid := tests.criar_usuario('sem@exemplo.test', null);
begin
  return next throws_ok(
    format('insert into public.perfil_usuario (user_id, nome, papel) values (%L, %L, %L)', v_u, 'x', 'motorista'),
    '23514', null, 'papel motorista sem cadastro ligado é recusado');
  return next throws_ok(
    format('insert into public.perfil_usuario (user_id, nome, papel, motorista_id) select %L, %L, %L, pessoa_id from public.motorista limit 1',
           v_u, 'x', 'operacao'),
    '23514', null, 'só o papel motorista tem cadastro ligado');
end $$;

create function tests.test_so_motorista_usa_o_app() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.op, 'select * from public.fretes_para_mim()'),
                        '42501', 'só o motorista usa o app', 'operação não chama fretes_para_mim');
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.op, 'select public.registrar_interesse(gen_random_uuid())'),
                        '42501', 'só o motorista usa o app', 'operação não registra interesse');
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.app, 'select * from public.fretes_do_motorista(gen_random_uuid())'),
                        '42501', null, 'a função interna não é chamável pelo app');
end $$;

create function tests.test_motorista_nao_le_tabelas() returns setof text language plpgsql as $$
declare
  c record;
  v_n integer;
begin
  select * into c from tests.cenario();
  perform tests.checkin(c.motorista, -25.09, -50.16);
  perform tests.como(c.app);
  select (select count(*) from public.pedido) + (select count(*) from public.frete_oferta)
       + (select count(*) from public.motorista) + (select count(*) from public.pessoa)
       + (select count(*) from public.motorista_disponibilidade) into v_n;
  perform tests.como_servico();
  return next is(v_n, 0::integer, 'o motorista não lê pedido, oferta, motorista, pessoa nem disponibilidade direto');
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.app,
                               'insert into public.frete_interesse (oferta_id, motorista_id, conjunto_id, km_ate_embarque) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1)'),
                        '42501', null, 'o motorista não grava interesse direto na tabela');
end $$;

create function tests.test_frete_aparece_perto_e_some_longe() returns setof text language plpgsql as $$
declare
  c record;
  f record;
begin
  select * into c from tests.cenario();
  return next is(tests.fretes(c.app), '{}'::uuid[], 'sem check-in não aparece frete');
  return next ok('sem_checkin' = any (tests.pendencias(c.app)), 'pendência: avisar que está livre');

  perform tests.checkin(c.motorista, -25.09, -50.16);
  return next is(tests.fretes(c.app), array[c.oferta], 'com check-in em Ponta Grossa o frete de Curitiba aparece');
  perform tests.como(c.app);
  select * into f from public.fretes_para_mim();
  perform tests.como_servico();
  return next is(f.frete_motorista_por_t, 120.00, 'mostra o frete do motorista');
  return next is(f.saldo_t, 74.00, 'mostra o saldo em toneladas');
  return next is(f.coleta_cidade || '>' || f.descarga_cidade, 'Curitiba>Santos', 'mostra coleta e descarga');
  return next ok(not exists (select 1 from information_schema.routines r
                             join information_schema.parameters p on p.specific_name = r.specific_name
                             where r.routine_schema = 'public' and r.routine_name = 'fretes_para_mim'
                               and p.parameter_name ilike '%empresa%'),
                 'fretes_para_mim não devolve o frete da empresa');

  perform tests.checkin(c.motorista, -15.60, -56.10);
  return next is(tests.fretes(c.app), '{}'::uuid[], 'check-in mais novo em Cuiabá: fora do raio');
end $$;

create function tests.test_carroceria_e_eixos() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  perform tests.checkin(c.motorista, -25.09, -50.16);
  update public.frete_oferta set carrocerias = '{basculante}' where id = c.oferta;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'oferta só para basculante não aparece para graneleiro');
  update public.frete_oferta set carrocerias = '{basculante,graneleiro}' where id = c.oferta;
  return next is(tests.fretes(c.app), array[c.oferta], 'graneleiro entre as aceitas aparece');
  update public.frete_oferta set eixos_minimos = 12 where id = c.oferta;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'eixos abaixo do mínimo não aparece');
end $$;

create function tests.test_cadastro_e_aptidao_barram() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  perform tests.checkin(c.motorista, -25.09, -50.16);
  update public.motorista set situacao_cadastro = 'pendente' where pessoa_id = c.motorista;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'cadastro pendente não vê frete');
  return next ok('cadastro_em_analise' = any (tests.pendencias(c.app)), 'pendência: cadastro em análise');
  update public.motorista set situacao_cadastro = 'normal', cnh_validade = tests.hoje() - 1 where pessoa_id = c.motorista;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'CNH vencida (trava da aptidão) não vê frete');
  update public.motorista set cnh_validade = tests.hoje() + 365 where pessoa_id = c.motorista;
  update public.frete_oferta set encerrada_em = now() where id = c.oferta;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'oferta encerrada some do app');
end $$;

create function tests.test_checkin_pelo_app() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.app,
                               'select public.registrar_checkin(''Ponta Grossa/PR'', -25.09, -50.16, now() + interval ''10 days'')'),
                        '22023', null, 'livre por mais de 7 dias é recusado');
  perform tests.como(c.app);
  perform public.registrar_checkin('Ponta Grossa/PR', -25.09, -50.16);
  perform tests.como_servico();
  return next is((select origem from public.motorista_disponibilidade where motorista_id = c.motorista), 'app',
                 'check-in gravado com origem app');
  return next is(tests.fretes(c.app), array[c.oferta], 'depois do check-in o frete aparece');
  perform tests.como(c.app);
  perform public.encerrar_checkin();
  perform tests.como_servico();
  return next is(tests.fretes(c.app), '{}'::uuid[], '"não estou mais livre" tira o frete');
end $$;

create function tests.test_interesse() returns setof text language plpgsql as $$
declare
  c record;
  v_tem boolean;
begin
  select * into c from tests.cenario();
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.app, format('select public.registrar_interesse(%L)', c.oferta)),
                        'P0001', 'este frete não está disponível para você', 'sem check-in não registra interesse');
  perform tests.checkin(c.motorista, -25.09, -50.16);
  perform tests.como(c.app);
  perform public.registrar_interesse(c.oferta);
  select f.tenho_interesse into v_tem from public.fretes_para_mim() f;
  perform tests.como_servico();
  return next ok(v_tem, 'o app mostra que ele já tem interesse');

  perform tests.como(c.op);
  return next is((select motorista_nome from public.v_frete_interesse where oferta_id = c.oferta), 'Motorista Teste',
                 'a operação vê o interessado');
  perform tests.como_servico();

  perform tests.como(c.app);
  perform public.desistir_interesse(c.oferta);
  perform tests.como_servico();
  return next is((select count(*)::integer from public.v_frete_interesse where oferta_id = c.oferta), 0,
                 'desistiu: sai da lista da operação');
  perform tests.como(c.app);
  perform public.registrar_interesse(c.oferta);
  perform tests.como_servico();
  return next is((select count(*)::integer from public.v_frete_interesse where oferta_id = c.oferta), 1,
                 'registrar de novo reativa o interesse');
end $$;

create function tests.test_posicao_do_gps() returns setof text language plpgsql as $$
declare
  c record;
  f record;
begin
  select * into c from tests.cenario();
  -- "Estou livre" em Cuiabá (fora do raio), mas o GPS diz Ponta Grossa: vale o GPS recente.
  perform tests.checkin(c.motorista, -15.60, -56.10);
  return next is(tests.fretes(c.app), '{}'::uuid[], 'só com o check-in em Cuiabá o frete não aparece');
  perform tests.como(c.app);
  perform public.registrar_posicao(-25.09, -50.16, 12, now() - interval '5 minutes');
  select * into f from public.fretes_para_mim();
  perform tests.como_servico();
  return next is(f.oferta_id, c.oferta, 'com o GPS em Ponta Grossa o frete aparece');
  return next ok(f.km_ate_embarque between 110 and 130, 'a distância sai do GPS');

  perform tests.como(c.app);
  perform public.registrar_posicao(-15.60, -56.10, 12, now() - interval '1 hour');
  perform tests.como_servico();
  return next is((select latitude from public.motorista_posicao where motorista_id = c.motorista), -25.090000,
                 'posição mais velha que a guardada é ignorada');

  update public.motorista_posicao set em = now() - interval '3 hours' where motorista_id = c.motorista;
  return next is(tests.fretes(c.app), '{}'::uuid[], 'GPS com mais de 2 h deixa de valer');

  perform tests.como(c.op);
  return next ok((select not posicao_gps from public.v_motorista_livre where motorista_id = c.motorista),
                 'para a operação, posição velha volta a ser a do check-in');
  perform tests.como_servico();
  update public.motorista_posicao set em = now() where motorista_id = c.motorista;
  perform tests.como(c.op);
  return next is((select latitude from public.v_motorista_livre where motorista_id = c.motorista), -25.090000,
                 'para a operação, o ranking usa o GPS recente');
  perform tests.como_servico();
end $$;

create function tests.test_posicao_permissoes() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.op, 'select public.registrar_posicao(-25.1, -50.1)'),
                        '42501', null, 'só o motorista manda posição');
  return next throws_ok(format('select tests.executar_como(%L, %L)', c.app, 'select public.registrar_posicao(40.7, -74.0)'),
                        'P0001', 'Posição fora do Brasil.', 'posição fora do Brasil é recusada');
  perform tests.como(c.app);
  perform public.registrar_posicao(-25.09, -50.16);
  return next is((select count(*)::integer from public.motorista_posicao), 0, 'o motorista não lê a tabela de posições');
  perform tests.como_servico();
end $$;

-- Excluir a conta pelo app (migration 20261107000500): some o login, a posição, o "estou livre", o interesse
-- no frete aberto e o acesso; o cadastro do motorista na Prisa fica.
create function tests.test_excluir_minha_conta() returns setof text language plpgsql as $$
declare
  c record;
begin
  select * into c from tests.cenario();
  insert into public.motorista_acesso_app (motorista_id, celular) values (c.motorista, '5543999998888');
  perform tests.checkin(c.motorista, -25.43, -49.27);
  perform tests.executar_como(c.app, 'select public.registrar_posicao(-25.43, -49.27)');
  perform tests.executar_como(c.app, format('select public.registrar_interesse(%L)', c.oferta));

  return next throws_ok(format('select tests.executar_como(%L, %L)', c.op, 'select public.excluir_minha_conta()'),
                        '42501', 'só o motorista exclui a conta pelo app', 'usuário do sistema não se exclui pelo app');
  perform tests.executar_como(c.app, 'select public.excluir_minha_conta()');

  return next is((select count(*)::integer from auth.users where id = c.app), 0, 'o login do app é apagado');
  return next is((select count(*)::integer from public.perfil_usuario where user_id = c.app), 0, 'o perfil some junto');
  return next is((select count(*)::integer from public.motorista_posicao where motorista_id = c.motorista), 0,
                 'a localização é apagada');
  return next is((select count(*)::integer from public.motorista_disponibilidade
                   where motorista_id = c.motorista and livre_ate > now()), 0, 'o "estou livre" é encerrado');
  return next ok((select desistiu_em is not null from public.frete_interesse
                   where oferta_id = c.oferta and motorista_id = c.motorista), 'o interesse no frete aberto é retirado');
  return next ok((select revogado_em is not null from public.motorista_acesso_app where motorista_id = c.motorista),
                 'o acesso ao app é revogado');
  return next is((select count(*)::integer from public.motorista where pessoa_id = c.motorista), 1,
                 'o cadastro do motorista na Prisa fica');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
