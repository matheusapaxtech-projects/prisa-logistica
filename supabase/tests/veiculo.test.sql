-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 7: veículo, tipos, marcas, operadoras de TAG, unidades, centros de custo e capacidade de carga.
-- Só documentos fictícios (CPF 52998224725 / 11144477735, CNPJ 11222333000181) e placas óbvias de teste.

-- Auxiliar (não roda como teste: o nome não começa com test_). Cria pessoa + proprietário e devolve o id.
create function tests.prop_teste(p_doc text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  if length(p_doc) = 14 then
    insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Proprietario ' || p_doc, p_doc) returning id into v_id;
  else
    insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Proprietario ' || p_doc, p_doc) returning id into v_id;
  end if;
  insert into public.proprietario (pessoa_id) values (v_id);
  return v_id;
end $$;

create function tests.test_placa_normalizada() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_placa text;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('abc-1234', 11, v_p, v_p);
  select placa into v_placa from public.veiculo where placa = 'ABC1234';
  return next is(v_placa, 'ABC1234', 'insert com ''abc-1234'' grava ABC1234');

  return next lives_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('ABC1D23', 11, %L, %L)$f$, v_p, v_p),
    'placa Mercosul ABC1D23 é aceita');
  return next throws_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('AB-12345', 11, %L, %L)$f$, v_p, v_p),
    '23514', null, 'placa AB-12345 é recusada');
  return next throws_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('abc 1234', 11, %L, %L)$f$, v_p, v_p),
    '23505', null, 'mesma placa com outra máscara viola unique');

  update public.veiculo set placa = 'tst-1a23' where placa = 'ABC1D23';
  select placa into v_placa from public.veiculo where placa = 'TST1A23';
  return next is(v_placa, 'TST1A23', 'update também normaliza a placa');
  return next throws_ok(
    $f$update public.veiculo set placa = 'XX-99' where placa = 'TST1A23'$f$,
    '23514', null, 'update para placa inválida é recusado');
end $$;

create function tests.test_placa_e_text() returns setof text language plpgsql as $$
begin
  return next is(
    (select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'veiculo' and column_name = 'placa'),
    'text', 'placa é text (char(7) estouraria 22001 antes do trigger)');
end $$;

create function tests.test_arrendado() returns setof text language plpgsql as $$
declare
  v_a uuid := tests.prop_teste('52998224725');
  v_b uuid := tests.prop_teste('11222333000181');
  v_igual boolean;
  v_dif boolean;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST1A01', 7, v_a, v_a);
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST1A02', 7, v_a, v_b);
  select arrendado into v_igual from public.veiculo where placa = 'TST1A01';
  select arrendado into v_dif from public.veiculo where placa = 'TST1A02';
  return next is(v_igual, false, 'posse = documento -> arrendado = false');
  return next is(v_dif, true, 'posse <> documento -> arrendado = true');
  update public.veiculo set proprietario_documento_id = v_a where placa = 'TST1A02';
  return next is((select arrendado from public.veiculo where placa = 'TST1A02'), false,
    'igualar documento à posse recalcula arrendado');
  return next throws_ok(
    $f$update public.veiculo set arrendado = true where placa = 'TST1A01'$f$,
    '428C9', null, 'arrendado é coluna gerada: não aceita gravação');
end $$;

create function tests.test_capacidade() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_nula numeric;
  v_inf numeric;
  v_sem numeric;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, pbt_t, tara_t, capacidade_carga_t)
  values ('TST1A03', 11, v_p, v_p, 45, 15, null);
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, pbt_t, tara_t, capacidade_carga_t)
  values ('TST1A04', 11, v_p, v_p, 45, 15, 28);
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST1A05', 11, v_p, v_p);
  select public.capacidade_carga(v) into v_nula from public.veiculo v where v.placa = 'TST1A03';
  select public.capacidade_carga(v) into v_inf from public.veiculo v where v.placa = 'TST1A04';
  select public.capacidade_carga(v) into v_sem from public.veiculo v where v.placa = 'TST1A05';
  return next is(v_nula, 30::numeric, 'capacidade nula: pbt - tara = 30');
  return next is(v_inf, 28::numeric, 'capacidade informada (28) prevalece');
  return next is(v_sem, null::numeric, 'sem capacidade, pbt e tara: null');
end $$;

create function tests.test_tipos_carregados() returns setof text language plpgsql as $$
declare
  v_ruins text;
begin
  -- A carga do ATUA ocupa os ids 1..38; tipos criados depois recebem ids maiores.
  return next is((select count(*) from public.tipo_veiculo where id <= 38), 33::bigint, '33 tipos de veículo');
  return next is((select categoria::text from public.tipo_veiculo where id = 18), 'dolly', 'id 18 é dolly');
  return next is((select configuracao_cavalo::text from public.tipo_veiculo where id = 7), 'trucado', 'id 7 é cavalo trucado');
  return next is((select configuracao_cavalo::text from public.tipo_veiculo where id = 6), 'toco', 'id 6 é cavalo toco');
  return next is((select configuracao_cavalo::text from public.tipo_veiculo where id = 27), 'trucado', 'id 27 (tração 3 eixos) é trucado');
  return next is((select configuracao_cavalo::text from public.tipo_veiculo where id = 29), 'toco', 'id 29 (tração 2 eixos) é toco');
  return next is((select count(*) from public.tipo_veiculo where id <= 38 and categoria = 'cavalo'), 4::bigint, '4 cavalos');
  return next is((select count(*) from public.tipo_veiculo where id <= 38 and categoria = 'carreta'), 17::bigint, '17 carretas');
  return next is((select count(*) from public.tipo_veiculo where id <= 38 and categoria = 'caminhao'), 8::bigint, '8 caminhões');
  return next is((select count(*) from public.tipo_veiculo where id <= 38 and categoria = 'outros'), 3::bigint, '3 outros');
  return next is((select count(*) from public.tipo_veiculo where id <= 38 and categoria = 'dolly'), 1::bigint, '1 dolly');
  return next is(
    (select array_agg(id order by id) from public.tipo_veiculo where id <= 38 and categoria = 'carreta'),
    array[8, 9, 10, 11, 12, 14, 16, 22, 23, 24, 25, 28, 30, 33, 35, 36, 38]::smallint[], 'ids das carretas');
  return next is(
    (select array_agg(id order by id) from public.tipo_veiculo where id <= 38 and categoria = 'caminhao'),
    array[2, 3, 4, 5, 17, 31, 34, 37]::smallint[], 'ids dos caminhões');
  return next is(
    (select array_agg(id order by id) from public.tipo_veiculo where id <= 38 and categoria = 'outros'),
    array[1, 26, 32]::smallint[], 'ids de outros');
  return next is((select eixos from public.tipo_veiculo where id = 32), 2::smallint, 'ESPECIAL CAMINHONETE tem 2 eixos');
  -- eixos = número do nome (ex.: "... - 3 EIXOS"), exceto o id 32 que não traz número.
  select string_agg(id::text, ',') into v_ruins
  from public.tipo_veiculo
  where id <= 38 and id <> 32 and eixos::text is distinct from substring(nome from '- ([0-9]+) EIXOS$');
  return next is(v_ruins, null::text, 'eixos confere com o número no nome em todos os tipos');
  return next is((select nome from public.tipo_veiculo where id = 11), 'CARRETA BAU - 3 EIXOS', 'nome ATUA preservado (id 11)');
end $$;

create function tests.test_tipo_cavalo_exige_configuracao() returns setof text language plpgsql as $$
begin
  return next throws_ok(
    $f$insert into public.tipo_veiculo (nome, categoria, eixos) values ('CAVALO TESTE', 'cavalo', 2)$f$,
    '23514', null, 'cavalo sem configuração é recusado');
  return next throws_ok(
    $f$insert into public.tipo_veiculo (nome, categoria, eixos, configuracao_cavalo) values ('CARRETA TESTE', 'carreta', 3, 'toco')$f$,
    '23514', null, 'configuração de cavalo em carreta é recusada');
  return next lives_ok(
    $f$insert into public.tipo_veiculo (nome, categoria, eixos, configuracao_cavalo) values ('CAVALO TESTE', 'cavalo', 2, 'toco')$f$,
    'cavalo com configuração é aceito (id gerado)');
end $$;

create function tests.test_marcas_carregadas() returns setof text language plpgsql as $$
begin
  -- A carga do ATUA ocupa os ids 1..42; marcas criadas depois recebem ids maiores.
  return next is((select count(*) from public.marca_veiculo where id <= 42), 42::bigint, '42 marcas');
  return next is((select min(id) from public.marca_veiculo), 1::smallint, 'ids começam em 1');
  return next is((select max(id) from public.marca_veiculo where id <= 42), 42::smallint, 'ids da carga terminam em 42');
  return next is((select nome from public.marca_veiculo where id = 1), 'AGRALE', 'id 1 = AGRALE');
  return next is((select nome from public.marca_veiculo where id = 21), 'LAND ROVER', 'id 21 = LAND ROVER');
  return next is((select nome from public.marca_veiculo where id = 42), 'YAMAHA', 'id 42 = YAMAHA');
  return next is(
    (select array_agg(nome order by id) from public.marca_veiculo where id <= 42),
    (select array_agg(nome order by nome collate "C") from public.marca_veiculo where id <= 42),
    'ids seguem a ordem alfabética');
  return next lives_ok($f$insert into public.marca_veiculo (nome) values ('MARCA TESTE')$f$, 'nova marca recebe id automático');
  return next ok((select id from public.marca_veiculo where nome = 'MARCA TESTE') >= 43,
    'sequência continua depois do seed (>= 43)');
end $$;

create function tests.test_operadoras_unidades_centros() returns setof text language plpgsql as $$
begin
  return next is((select count(*) from public.operadora_tag where id between 120 and 124), 5::bigint, '5 operadoras de TAG');
  return next is((select nome from public.operadora_tag where id = 120), 'PAMCARD TAG CONECTCAR', '120 CONECTCAR');
  return next is((select nome from public.operadora_tag where id = 121), 'PAMCARD TAG MOVEMAIS', '121 MOVEMAIS');
  return next is((select nome from public.operadora_tag where id = 122), 'PAMCARD TAG SEM PARAR', '122 SEM PARAR');
  return next is((select nome from public.operadora_tag where id = 123), 'PAMCARD TAG VELOE', '123 VELOE');
  return next is((select nome from public.operadora_tag where id = 124), 'PAMCARD - TAGGY', '124 TAGGY');
  return next is((select count(*) from public.unidade_operacional where id between 1 and 3), 3::bigint, '3 unidades operacionais');
  return next is((select nome from public.unidade_operacional where id = 1), 'TERCEIRIZACAO', '1 TERCEIRIZACAO');
  return next is((select nome from public.unidade_operacional where id = 2), 'FROTA PROPRIA', '2 FROTA PROPRIA');
  return next is((select nome from public.unidade_operacional where id = 3), 'PRISA APUCARANA', '3 PRISA APUCARANA');
  -- Identity continua depois dos ids do ATUA.
  insert into public.operadora_tag (nome) values ('OPERADORA TESTE');
  insert into public.unidade_operacional (nome) values ('UNIDADE TESTE');
  insert into public.centro_custo (nome) values ('CENTRO TESTE');
  -- Sequências não são revertidas por rollback/erro (outros testes podem ter consumido valores): >= em vez de =.
  return next ok((select id from public.operadora_tag where nome = 'OPERADORA TESTE') >= 125, 'próxima operadora >= 125');
  return next ok((select id from public.unidade_operacional where nome = 'UNIDADE TESTE') >= 4, 'próxima unidade >= 4');
  return next ok((select id from public.centro_custo where nome = 'CENTRO TESTE') >= 1, 'centro de custo recebe id automático');
end $$;

create function tests.test_checks_nao_negativos() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  c text;
begin
  foreach c in array array['pbt_t', 'tara_t', 'cmt_t', 'capacidade_carga_t', 'comprimento_m', 'largura_m', 'altura_m',
                           'litros_tanque', 'vl_compra', 'vl_mercado', 'km_inicial', 'hp',
                           'media_padrao_carregado', 'media_padrao_vazio'] loop
    return next throws_ok(
      format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, %I) values ('TST1A09', 11, %L, %L, -1)$f$, c, v_p, v_p),
      '23514', null, c || ' negativo é recusado');
  end loop;
  return next lives_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, pbt_t, tara_t, comprimento_m, km_inicial) values ('TST1A09', 11, %L, %L, 0, 0, 14.5, 0)$f$, v_p, v_p),
    'zeros e valores positivos são aceitos');
end $$;

create function tests.test_veiculo_obrigatorios() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_veic public.veiculo;
begin
  return next throws_ok(
    format($f$insert into public.veiculo (placa, proprietario_posse_id, proprietario_documento_id) values ('TST1A10', %L, %L)$f$, v_p, v_p),
    '23502', null, 'tipo_veiculo_id é obrigatório');
  return next throws_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_documento_id) values ('TST1A10', 11, %L)$f$, v_p),
    '23502', null, 'proprietario_posse_id é obrigatório');
  return next throws_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id) values ('TST1A10', 11, %L)$f$, v_p),
    '23502', null, 'proprietario_documento_id é obrigatório');
  return next throws_ok(
    format($f$insert into public.veiculo (tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values (11, %L, %L)$f$, v_p, v_p),
    '23502', null, 'placa é obrigatória');
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST1A10', 11, v_p, v_p) returning * into v_veic;
  return next is(v_veic.situacao_operacional::text, 'ativo', 'situacao_operacional padrão = ativo');
  return next is(v_veic.situacao_cadastro::text, 'pendente', 'situacao_cadastro padrão = pendente');
end $$;

create function tests.test_renavam_unico() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, renavam)
  values ('TST1A11', 11, v_p, v_p, '00000000001');
  return next throws_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, renavam) values ('TST1A12', 11, %L, %L, '00000000001')$f$, v_p, v_p),
    '23505', null, 'renavam repetido é recusado');
  return next lives_ok(
    format($f$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('TST1A13', 11, %L, %L), ('TST1A14', 11, %L, %L)$f$, v_p, v_p, v_p, v_p),
    'vários veículos sem renavam são aceitos');
end $$;

create function tests.test_proprietario_nao_apaga_com_veiculo() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
begin
  return next ok(
    (select bool_and(confdeltype = 'r') from pg_constraint
     where conrelid = 'public.veiculo'::regclass and contype = 'f'
       and confrelid = 'public.proprietario'::regclass),
    'FKs de posse e documento para proprietario são on delete restrict');
  return next is(
    (select count(*) from pg_constraint
     where conrelid = 'public.veiculo'::regclass and contype = 'f' and confrelid = 'public.proprietario'::regclass),
    2::bigint, 'duas FKs para proprietario');
  return next ok(
    exists (select 1 from pg_constraint
            where conrelid = 'public.veiculo'::regclass and contype = 'f'
              and confrelid = 'public.motorista'::regclass and confdeltype = 'r'),
    'ultimo_motorista_id -> motorista é on delete restrict');
end $$;

create function tests.test_veiculo_fks_indexadas() returns setof text language plpgsql as $$
declare
  c text;
begin
  foreach c in array array['tipo_veiculo_id', 'marca_id', 'proprietario_posse_id', 'proprietario_documento_id',
                           'tag_operadora_id', 'ultimo_motorista_id', 'unidade_operacional_id', 'centro_custo_id'] loop
    return next ok(
      exists (select 1 from pg_index i
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
              where i.indrelid = 'public.veiculo'::regclass and a.attname = c),
      'veiculo.' || c || ' indexado');
    return next ok(
      exists (select 1 from pg_constraint k
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
              where k.conrelid = 'public.veiculo'::regclass and k.contype = 'f' and a.attname = c),
      'veiculo.' || c || ' tem FK');
  end loop;
end $$;

create function tests.test_veiculo_rls_por_papel() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_p uuid := tests.prop_teste('52998224725');
  v_ve bigint;
  v_sem_n bigint;
begin
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('TST1A20', 11, %L, %L)$q$)$f$, v_op, v_p, v_p),
    'operação insere veículo');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id) values ('TST1A21', 11, %L, %L)$q$)$f$, v_lei, v_p, v_p),
    '42501', null, 'leitura não insere veículo');
  perform tests.como(v_lei);
  select count(*) into v_ve from public.veiculo where placa in ('TST1A20', 'TST1A21');
  perform tests.como(v_sem);
  select count(*) into v_sem_n from public.veiculo;
  perform tests.como_servico();
  return next is(v_ve, 1::bigint, 'leitura enxerga o veículo');
  return next is(v_sem_n, 0::bigint, 'sem perfil não enxerga veículo');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.veiculo set cor = 'BRANCA' where placa = 'TST1A20'$q$)$f$, v_op),
    'operação atualiza veículo');
  return next is((select cor from public.veiculo where placa = 'TST1A20'), 'BRANCA', 'atualização da operação valeu');
  return next is((select updated_by from public.veiculo where placa = 'TST1A20'), v_op, 'trigger carimba updated_by');
  return next is((select created_by from public.veiculo where placa = 'TST1A20'), v_op, 'created_by = auth.uid() do insert');
end $$;

create function tests.test_listas_rls_por_papel() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_n_lei bigint;
  v_n_sem bigint;
begin
  perform tests.como(v_lei);
  select count(*) into v_n_lei from public.marca_veiculo where id <= 42;
  perform tests.como(v_sem);
  select count(*) into v_n_sem from public.marca_veiculo;
  perform tests.como_servico();
  return next is(v_n_lei, 42::bigint, 'leitura lê as marcas');
  return next is(v_n_sem, 0::bigint, 'sem perfil não lê as marcas');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.unidade_operacional (nome) values ('UNIDADE DO ADMIN')$q$)$f$, v_adm),
    'admin insere em lista de apoio');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.unidade_operacional (nome) values ('UNIDADE DA OPERACAO')$q$)$f$, v_op),
    '42501', null, 'operação não insere em lista de apoio');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.tipo_veiculo (nome, categoria, eixos) values ('TIPO DA OPERACAO', 'outros', 2)$q$)$f$, v_op),
    '42501', null, 'operação não insere tipo de veículo');
end $$;

create function tests.test_funcoes_veiculo() returns setof text language plpgsql as $$
begin
  return next ok((select provolatile = 'i' from pg_proc where oid = 'public.capacidade_carga(public.veiculo)'::regprocedure),
    'capacidade_carga é immutable');
  return next ok(
    exists (select 1 from pg_proc p where p.oid = 'public.capacidade_carga(public.veiculo)'::regprocedure
              and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
    'capacidade_carga declara search_path');
  return next ok(has_function_privilege('authenticated', 'public.capacidade_carga(public.veiculo)', 'execute'),
    'authenticated executa capacidade_carga');
  return next ok(not has_function_privilege('anon', 'public.capacidade_carga(public.veiculo)', 'execute'),
    'anon sem execute em capacidade_carga');
  return next ok(
    exists (select 1 from pg_proc p where p.oid = 'public.fn_veiculo_normalizar()'::regprocedure
              and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
    'fn_veiculo_normalizar declara search_path');
  return next ok(not has_function_privilege('anon', 'public.fn_veiculo_normalizar()', 'execute'),
    'fn_veiculo_normalizar: anon sem execute');
  return next ok(not has_function_privilege('authenticated', 'public.fn_veiculo_normalizar()', 'execute'),
    'fn_veiculo_normalizar: authenticated sem execute');
end $$;

-- "Só admin apaga" verificado pela estrutura das políticas (o teste não executa remoções).
create function tests.test_politicas_exclusao_so_admin() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
  v_qual text;
begin
  foreach t in array array['veiculo', 'tipo_veiculo', 'marca_veiculo', 'operadora_tag', 'unidade_operacional', 'centro_custo'] loop
    select count(*), max(qual) into v_n, v_qual
    from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE';
    return next is(v_n, 1, format('%s: exatamente uma política de exclusão', t));
    return next ok(v_qual like '%eh_admin%', format('%s: exclusão exige eh_admin()', t));
  end loop;
end $$;

create function tests.test_politicas_uma_por_comando() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
begin
  foreach t in array array['veiculo', 'tipo_veiculo', 'marca_veiculo', 'operadora_tag', 'unidade_operacional', 'centro_custo'] loop
    select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = t;
    return next is(v_n, 4, format('%s: quatro políticas (uma por comando)', t));
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass),
      format('%s: RLS ligada', t));
  end loop;
  -- veiculo: escrita pelos editores; listas: escrita só admin.
  return next ok((select qual like '%pode_ler%' from pg_policies where tablename = 'veiculo' and cmd = 'SELECT'),
    'veiculo: select exige pode_ler');
  return next ok((select with_check like '%pode_editar%' from pg_policies where tablename = 'veiculo' and cmd = 'INSERT'),
    'veiculo: insert exige pode_editar');
  return next ok((select qual like '%pode_editar%' and with_check like '%pode_editar%' from pg_policies
                  where tablename = 'veiculo' and cmd = 'UPDATE'),
    'veiculo: update com using e with check pode_editar');
  foreach t in array array['tipo_veiculo', 'marca_veiculo', 'operadora_tag', 'unidade_operacional', 'centro_custo'] loop
    return next ok((select with_check like '%eh_admin%' from pg_policies where tablename = t and cmd = 'INSERT'),
      format('%s: insert exige eh_admin', t));
    return next ok((select qual like '%eh_admin%' and with_check like '%eh_admin%' from pg_policies
                    where tablename = t and cmd = 'UPDATE'),
      format('%s: update exige eh_admin (using e with check)', t));
  end loop;
end $$;

create function tests.test_privilegios_revogados() returns setof text language plpgsql as $$
declare
  t text;
  p text;
begin
  foreach t in array array['veiculo', 'tipo_veiculo', 'marca_veiculo', 'operadora_tag', 'unidade_operacional', 'centro_custo'] loop
    foreach p in array array['truncate', 'references', 'trigger'] loop
      return next ok(not has_table_privilege('authenticated', format('public.%I', t), p),
        format('%s: authenticated sem %s', t, p));
    end loop;
    foreach p in array array['insert', 'update', 'delete', 'truncate'] loop
      return next ok(not has_table_privilege('anon', format('public.%I', t), p),
        format('%s: anon sem %s', t, p));
    end loop;
  end loop;
end $$;

create function tests.test_auditoria_ligada() returns setof text language plpgsql as $$
declare
  t text;
begin
  foreach t in array array['veiculo', 'tipo_veiculo', 'marca_veiculo', 'operadora_tag', 'unidade_operacional', 'centro_custo'] loop
    return next ok(exists (select 1 from pg_trigger
                           where tgrelid = format('public.%I', t)::regclass
                             and tgname = 'trg_auditoria' and not tgisinternal),
      format('%s: auditoria ligada', t));
  end loop;
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
