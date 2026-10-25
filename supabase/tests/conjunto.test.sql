-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 8: conjunto (cavalo + carretas/dollies em ordem de engate), validação, capacidade.
-- Só documentos fictícios (CPF 52998224725, CNPJ 11222333000181) e placas óbvias de teste (TST0001...).
-- Cada teste monta o conjunto com as validações adiadas (constraint triggers deferred) e força a
-- validação com `set constraints all immediate`. Nenhum DELETE: encerrar conjunto = UPDATE com WHERE.

-- Auxiliares (não rodam como teste: o nome não começa com test_).
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

create sequence tests.seq_placa;

-- Cria um veículo (placa TST0001, TST0002...) do tipo informado e devolve o id.
create function tests.novo_veiculo(
  p_tipo integer, p_prop uuid, p_cmt numeric default null, p_pbt numeric default null, p_tara numeric default null)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, cmt_t, pbt_t, tara_t)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, p_cmt, p_pbt, p_tara)
  returning id into v_id;
  return v_id;
end $$;

-- Cria conjunto aberto (início há 1 dia, para permitir fechar com fim = now()) e os itens.
-- Posições: 1..n na ordem do array, ou as informadas em p_posicoes.
create function tests.novo_conjunto(p_cavalo uuid, p_itens uuid[] default '{}', p_posicoes int[] default null)
returns uuid language plpgsql as $$
declare
  v_id uuid;
  i int;
begin
  -- `set constraints all immediate` de um teste anterior vaza para os seguintes (o savepoint do
  -- runner não desfaz um SET CONSTRAINTS bem-sucedido): cada montagem começa com validação adiada.
  set constraints all deferred;
  insert into public.conjunto (cavalo_id, inicio) values (p_cavalo, now() - interval '1 day') returning id into v_id;
  for i in 1 .. coalesce(cardinality(p_itens), 0) loop
    insert into public.conjunto_item (conjunto_id, posicao, veiculo_id)
    values (v_id, coalesce(p_posicoes[i], i), p_itens[i]);
  end loop;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Os 7 testes do plano
-- ---------------------------------------------------------------------------
create function tests.test_rodotrem_valido() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_cav uuid := tests.novo_veiculo(7, v_p);
  v_c1 uuid := tests.novo_veiculo(11, v_p);
  v_d uuid := tests.novo_veiculo(18, v_p);
  v_c2 uuid := tests.novo_veiculo(11, v_p);
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(v_cav, array[v_c1, v_d, v_c2]);
  return next lives_ok('set constraints all immediate', 'cavalo + carreta + dolly + carreta é válido');
  -- a chamada direta não depende do estado deferred/immediate das constraints
  return next lives_ok(format('select public.validar_conjunto(%L)', v_conj), 'validar_conjunto direto aceita o rodotrem');
end $$;

create function tests.test_dolly_primeiro() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(18, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'dolly não pode ser a primeira nem a última peça', 'dolly na posição 1 é recusado');
end $$;

create function tests.test_dolly_ultimo() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(11, v_p), tests.novo_veiculo(18, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'dolly não pode ser a primeira nem a última peça', 'dolly na última posição é recusado');
end $$;

create function tests.test_buraco_posicao() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p),
    array[tests.novo_veiculo(11, v_p), tests.novo_veiculo(11, v_p)], array[1, 3]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'posições do conjunto precisam começar em 1 e não ter buracos', 'posições 1 e 3 são recusadas');
end $$;

create function tests.test_base_nao_cavalo() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(11, v_p));
  return next throws_ok('set constraints all immediate', 'P0001',
    'a base do conjunto precisa ser um cavalo ou um truck', 'base do tipo carreta é recusada');
end $$;

create function tests.test_truck_sozinho_ok() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  -- tipo 4 = TRUCK CARROCERIA (caminhão): roda sem peças
  v_conj := tests.novo_conjunto(tests.novo_veiculo(4, v_p));
  return next lives_ok('set constraints all immediate', 'truck sem peças é um conjunto válido');
end $$;

create function tests.test_truck_com_carreta_recusado() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(4, v_p), array[tests.novo_veiculo(11, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'truck não engata carreta nem dolly', 'truck com carreta é recusado');
end $$;

create function tests.test_veiculo_em_dois_conjuntos() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_x uuid := tests.novo_veiculo(11, v_p);
  v_c1 uuid;
  v_c2 uuid;
begin
  v_c1 := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[v_x]);
  v_c2 := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[v_x]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'veículo já está em outro conjunto aberto', 'mesma carreta em dois conjuntos abertos é recusada');
  update public.conjunto set fim = now() where id = v_c1;
  return next lives_ok('set constraints all immediate', 'depois de fechar o primeiro conjunto, o segundo é aceito');
  return next lives_ok(format('select public.validar_conjunto(%L)', v_c1), 'validar_conjunto direto: conjunto fechado');
  return next lives_ok(format('select public.validar_conjunto(%L)', v_c2), 'validar_conjunto direto: conjunto aberto restante');
end $$;

create function tests.test_capacidade_excede() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_cav uuid := tests.novo_veiculo(7, v_p, 74, null, 9);
  v_c1 uuid := tests.novo_veiculo(11, v_p, null, 45, 8);
  v_d uuid := tests.novo_veiculo(18, v_p, null, null, 3);
  v_c2 uuid := tests.novo_veiculo(11, v_p, null, 45, 8);
  v_conj uuid;
  v_v public.v_conjunto_capacidade;
begin
  v_conj := tests.novo_conjunto(v_cav, array[v_c1, v_d, v_c2]);
  select * into v_v from public.v_conjunto_capacidade where conjunto_id = v_conj;
  return next is(v_v.cavalo_id, v_cav, 'view traz o cavalo');
  return next is(v_v.cmt_t, 74::numeric, 'view traz o cmt do cavalo');
  return next is(v_v.capacidade_total_t, 74::numeric, 'capacidade_total_t = 37 + 37 (só carretas)');
  return next is(v_v.tara_total_t, 28::numeric, 'tara_total_t = 9 + 8 + 3 + 8');
  return next is(v_v.excede_cmt, true, '74 > 74 - 28: excede o CMT');
  return next lives_ok('set constraints all immediate', 'o conjunto da capacidade também é válido');
end $$;

-- ---------------------------------------------------------------------------
-- Regras restantes da validação
-- ---------------------------------------------------------------------------
create function tests.test_item_fora_de_carreta_ou_dolly() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  -- tipo 4 = TRUCK CARROCERIA (caminhão)
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(4, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'itens do conjunto precisam ser carreta ou dolly', 'caminhão como item é recusado');
end $$;

create function tests.test_maximo_3_carretas() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[
    tests.novo_veiculo(11, v_p), tests.novo_veiculo(11, v_p), tests.novo_veiculo(11, v_p), tests.novo_veiculo(11, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'conjunto aceita no máximo 3 carretas', '4 carretas são recusadas');
end $$;

create function tests.test_tres_carretas_ok() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[
    tests.novo_veiculo(11, v_p), tests.novo_veiculo(18, v_p), tests.novo_veiculo(11, v_p),
    tests.novo_veiculo(18, v_p), tests.novo_veiculo(11, v_p)]);
  return next lives_ok('set constraints all immediate', '3 carretas com 2 dollies entre elas (5 posições) é válido');
end $$;

create function tests.test_dollies_seguidos() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[
    tests.novo_veiculo(11, v_p), tests.novo_veiculo(18, v_p), tests.novo_veiculo(18, v_p), tests.novo_veiculo(11, v_p)]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'dois dollies não podem ficar seguidos', 'dois dollies seguidos são recusados');
end $$;

create function tests.test_conjunto_sem_itens_ok() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p));
  return next lives_ok('set constraints all immediate', 'cavalo sozinho (sem itens) é válido');
end $$;

create function tests.test_ordem_das_regras() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  -- cavalo errado + caminhão como item + buraco: vale a primeira regra da lista (cavalo).
  v_conj := tests.novo_conjunto(tests.novo_veiculo(11, v_p), array[tests.novo_veiculo(4, v_p)], array[2]);
  return next throws_ok('set constraints all immediate', 'P0001',
    'a base do conjunto precisa ser um cavalo ou um truck', 'categoria do cavalo vem antes das demais regras');
end $$;

create function tests.test_conjunto_fechado_nao_conflita() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_x uuid := tests.novo_veiculo(11, v_p);
  v_c1 uuid;
  v_c2 uuid;
begin
  -- Os dois conjuntos são fechados antes da validação: não há "outro conjunto aberto".
  v_c1 := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[v_x]);
  v_c2 := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[v_x]);
  update public.conjunto set fim = now() where id = v_c1;
  update public.conjunto set fim = now() where id = v_c2;
  return next lives_ok('set constraints all immediate', 'a mesma carreta em conjuntos fechados é aceita');
  set constraints all deferred;
  -- Reabrir o segundo (o primeiro continua fechado) também é aceito.
  update public.conjunto set fim = null where id = v_c2;
  return next lives_ok(format('select public.validar_conjunto(%L)', v_c2), 'um aberto + um fechado com a mesma carreta é aceito');
  -- Reabrir os dois viola a regra.
  update public.conjunto set fim = null where id = v_c1;
  return next throws_ok(format('select public.validar_conjunto(%L)', v_c1), 'P0001',
    'veículo já está em outro conjunto aberto', 'reabrir o primeiro volta a conflitar');
end $$;

create function tests.test_cavalo_em_dois_conjuntos_abertos() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_cav uuid := tests.novo_veiculo(7, v_p);
begin
  perform tests.novo_conjunto(v_cav);
  return next throws_ok(
    format('insert into public.conjunto (cavalo_id) values (%L)', v_cav),
    '23505', null, 'índice único parcial: um cavalo só tem um conjunto aberto');
end $$;

create function tests.test_item_mover_valida_origem_e_destino() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_a uuid;
  v_b uuid;
begin
  v_a := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(11, v_p), tests.novo_veiculo(11, v_p)]);
  v_b := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(11, v_p)]);
  return next lives_ok('set constraints all immediate', 'estado inicial dos dois conjuntos é válido');
  set constraints all deferred;
  -- Mover a peça 1 de A para a posição 2 de B: A fica só com a posição 2 (buraco), B fica 1,2 (válido).
  update public.conjunto_item set conjunto_id = v_b, posicao = 2 where conjunto_id = v_a and posicao = 1;
  return next throws_ok('set constraints all immediate', 'P0001',
    'posições do conjunto precisam começar em 1 e não ter buracos', 'o conjunto de origem também é validado');
end $$;

create function tests.test_chaves_e_checks() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_x uuid := tests.novo_veiculo(11, v_p);
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[v_x]);
  return next throws_ok(
    format('insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 1, %L)', v_conj, tests.novo_veiculo(11, v_p)),
    '23505', null, 'PK (conjunto_id, posicao): posição repetida é recusada');
  return next throws_ok(
    format('insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 2, %L)', v_conj, v_x),
    '23505', null, 'unique (conjunto_id, veiculo_id): mesmo veículo duas vezes é recusado');
  return next throws_ok(
    format('insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 6, %L)', v_conj, tests.novo_veiculo(11, v_p)),
    '23514', null, 'posição 6 é recusada');
  return next throws_ok(
    format('insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 0, %L)', v_conj, tests.novo_veiculo(11, v_p)),
    '23514', null, 'posição 0 é recusada');
  return next throws_ok(
    format('update public.conjunto set fim = inicio where id = %L', v_conj),
    '23514', null, 'fim igual ao início é recusado');
  return next throws_ok(
    format('update public.conjunto set fim = inicio - interval ''1 hour'' where id = %L', v_conj),
    '23514', null, 'fim antes do início é recusado');
  return next lives_ok(
    format('update public.conjunto set fim = now() where id = %L', v_conj),
    'fim depois do início é aceito');
  return next throws_ok(
    $f$insert into public.conjunto (cavalo_id) values (null)$f$,
    '23502', null, 'cavalo_id é obrigatório');
end $$;

create function tests.test_conjunto_inexistente_ignorado() returns setof text language plpgsql as $$
begin
  return next lives_ok('select public.validar_conjunto(gen_random_uuid())',
    'validar_conjunto de conjunto inexistente retorna sem erro');
end $$;

create function tests.test_view_outros_casos() returns setof text language plpgsql as $$
declare
  v_p uuid := tests.prop_teste('52998224725');
  v_sem_cmt uuid;
  v_sem_itens uuid;
  v_ok uuid;
  v_r public.v_conjunto_capacidade;
begin
  -- cmt nulo: excede_cmt = false (e tara/capacidade nulas contam 0).
  v_sem_cmt := tests.novo_conjunto(tests.novo_veiculo(7, v_p, null, null, 9), array[tests.novo_veiculo(11, v_p, null, 45, 8)]);
  select * into v_r from public.v_conjunto_capacidade where conjunto_id = v_sem_cmt;
  return next is(v_r.excede_cmt, false, 'cmt nulo: excede_cmt é falso');
  return next is(v_r.capacidade_total_t, 37::numeric, 'capacidade da carreta = pbt - tara');
  return next is(v_r.tara_total_t, 17::numeric, 'tara total = 9 + 8');
  -- cavalo sem itens e sem tara: totais zerados.
  v_sem_itens := tests.novo_conjunto(tests.novo_veiculo(7, v_p, 74, null, null));
  select * into v_r from public.v_conjunto_capacidade where conjunto_id = v_sem_itens;
  return next is(v_r.capacidade_total_t, 0::numeric, 'sem itens: capacidade 0');
  return next is(v_r.tara_total_t, 0::numeric, 'sem tara informada: tara total 0');
  return next is(v_r.excede_cmt, false, 'sem itens: não excede');
  -- Dentro do limite: capacidade 30 <= 74 - 20 = 54.
  v_ok := tests.novo_conjunto(tests.novo_veiculo(7, v_p, 74, null, 10), array[tests.novo_veiculo(11, v_p, null, 45, 15)]);
  select * into v_r from public.v_conjunto_capacidade where conjunto_id = v_ok;
  return next is(v_r.excede_cmt, false, 'capacidade dentro do limite não excede');
  -- Capacidade informada prevalece sobre pbt - tara; dolly não soma capacidade.
  v_ok := tests.novo_conjunto(tests.novo_veiculo(7, v_p, 74, null, 10), array[
    tests.novo_veiculo(11, v_p), tests.novo_veiculo(18, v_p, null, 99, 3)]);
  update public.veiculo set capacidade_carga_t = 28, pbt_t = 45, tara_t = 5 where id = (
    select veiculo_id from public.conjunto_item where conjunto_id = v_ok and posicao = 1);
  select * into v_r from public.v_conjunto_capacidade where conjunto_id = v_ok;
  return next is(v_r.capacidade_total_t, 28::numeric, 'capacidade informada (28) prevalece e dolly não soma');
  return next is(v_r.tara_total_t, 18::numeric, 'tara total = 10 + 5 + 3');
end $$;

-- ---------------------------------------------------------------------------
-- RLS e caminho security definer, como usuários reais
-- ---------------------------------------------------------------------------
create function tests.test_rls_operacao_monta_rodotrem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_p uuid := tests.prop_teste('52998224725');
  v_cav uuid := tests.novo_veiculo(7, v_p, 74, null, 9);
  v_c1 uuid := tests.novo_veiculo(11, v_p, null, 45, 8);
  v_d uuid := tests.novo_veiculo(18, v_p, null, null, 3);
  v_c2 uuid := tests.novo_veiculo(11, v_p, null, 45, 8);
  v_cav2 uuid := tests.novo_veiculo(7, v_p);
  v_cid uuid := gen_random_uuid();
  v_cid2 uuid := gen_random_uuid();
  v_n_lei bigint;
  v_n_sem bigint;
  v_n_view_lei bigint;
  v_n_view_sem bigint;
begin
  set constraints all deferred;
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$
      insert into public.conjunto (id, cavalo_id) values (%L, %L);
      insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 1, %L), (%L, 2, %L), (%L, 3, %L);
      set constraints all immediate$q$)$f$,
      v_op, v_cid, v_cav, v_cid, v_c1, v_cid, v_d, v_cid, v_c2),
    'operação monta rodotrem válido (RLS + validação security definer)');
  return next is((select created_by from public.conjunto where id = v_cid), v_op, 'created_by = auth.uid() do insert');
  return next is((select count(*) from public.conjunto_item where conjunto_id = v_cid), 3::bigint, 'três itens gravados');

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$
      insert into public.conjunto (id, cavalo_id) values (%L, %L);
      insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 1, %L);
      set constraints all immediate$q$)$f$,
      v_op, v_cid2, v_cav2, v_cid2, v_d),
    'P0001', 'dolly não pode ser a primeira nem a última peça', 'operação também é barrada pela validação');

  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.conjunto set motorista_id = null where id = %L$q$)$f$, v_op, v_cid),
    'operação atualiza conjunto');
  return next is((select updated_by from public.conjunto where id = v_cid), v_op, 'trigger carimba updated_by');

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.conjunto (cavalo_id) values (%L)$q$)$f$, v_lei, v_cav2),
    '42501', null, 'leitura não insere conjunto');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (%L, 4, %L)$q$)$f$, v_lei, v_cid, v_cav2),
    '42501', null, 'leitura não insere item de conjunto');

  perform tests.como(v_lei);
  select count(*) into v_n_lei from public.conjunto where id = v_cid;
  select count(*) into v_n_view_lei from public.v_conjunto_capacidade where conjunto_id = v_cid;
  perform tests.como(v_sem);
  select count(*) into v_n_sem from public.conjunto where id = v_cid;
  select count(*) into v_n_view_sem from public.v_conjunto_capacidade where conjunto_id = v_cid;
  perform tests.como_servico();
  return next is(v_n_lei, 1::bigint, 'leitura enxerga o conjunto');
  return next is(v_n_view_lei, 1::bigint, 'leitura enxerga a view de capacidade');
  return next is(v_n_sem, 0::bigint, 'sem perfil não enxerga conjunto');
  return next is(v_n_view_sem, 0::bigint, 'sem perfil não enxerga a view (security_invoker)');
end $$;

-- ---------------------------------------------------------------------------
-- Estrutura: FKs indexadas, triggers, funções, privilégios, políticas, auditoria
-- ---------------------------------------------------------------------------
create function tests.test_conjunto_fks_indexadas() returns setof text language plpgsql as $$
declare
  r record;
begin
  for r in select * from (values
      ('conjunto', 'cavalo_id'), ('conjunto', 'motorista_id'),
      ('conjunto_item', 'conjunto_id'), ('conjunto_item', 'veiculo_id')) as t (tabela, coluna) loop
    return next ok(
      exists (select 1 from pg_index i
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
              where i.indrelid = format('public.%I', r.tabela)::regclass and a.attname = r.coluna
                and i.indpred is null),
      format('%s.%s tem índice não parcial', r.tabela, r.coluna));
    return next ok(
      exists (select 1 from pg_constraint k
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
              where k.conrelid = format('public.%I', r.tabela)::regclass and k.contype = 'f' and a.attname = r.coluna),
      format('%s.%s tem FK', r.tabela, r.coluna));
  end loop;
  return next ok(
    exists (select 1 from pg_index i
            where i.indrelid = 'public.conjunto'::regclass and i.indisunique and i.indpred is not null
              and pg_get_expr(i.indpred, i.indrelid) like '%fim IS NULL%'),
    'índice único parcial (cavalo_id) where fim is null');
  return next ok(
    (select confdeltype = 'c' from pg_constraint
     where conrelid = 'public.conjunto_item'::regclass and contype = 'f' and confrelid = 'public.conjunto'::regclass),
    'conjunto_item.conjunto_id é on delete cascade');
end $$;

create function tests.test_constraint_triggers() returns setof text language plpgsql as $$
declare
  t text;
begin
  foreach t in array array['conjunto', 'conjunto_item'] loop
    return next ok(
      exists (select 1 from pg_trigger
              where tgrelid = format('public.%I', t)::regclass and tgconstraint <> 0
                and tgdeferrable and tginitdeferred and not tgisinternal),
      format('%s: constraint trigger deferrable initially deferred', t));
  end loop;
end $$;

create function tests.test_funcoes_conjunto() returns setof text language plpgsql as $$
declare
  f text;
begin
  foreach f in array array['public.validar_conjunto(uuid)', 'public.fn_conjunto_validar()', 'public.fn_conjunto_item_validar()'] loop
    return next ok(
      exists (select 1 from pg_proc p where p.oid = f::regprocedure
                and exists (select 1 from unnest(p.proconfig) c where c = 'search_path=""')),
      f || ' declara search_path vazio');
    return next ok((select prosecdef from pg_proc where oid = f::regprocedure), f || ' é security definer');
    return next ok(not has_function_privilege('anon', f, 'execute'), f || ': anon sem execute');
    return next ok(not has_function_privilege('authenticated', f, 'execute'), f || ': authenticated sem execute');
  end loop;
end $$;

create function tests.test_view_privilegios() returns setof text language plpgsql as $$
begin
  return next ok(
    exists (select 1 from pg_class where oid = 'public.v_conjunto_capacidade'::regclass
              and 'security_invoker=true' = any (reloptions)),
    'v_conjunto_capacidade é security_invoker');
  return next ok(not has_table_privilege('anon', 'public.v_conjunto_capacidade', 'select'), 'view: anon sem select');
  return next ok(has_table_privilege('authenticated', 'public.v_conjunto_capacidade', 'select'), 'view: authenticated com select');
  return next ok(not has_table_privilege('authenticated', 'public.v_conjunto_capacidade', 'insert'), 'view: authenticated sem insert');
  return next ok(not has_table_privilege('authenticated', 'public.v_conjunto_capacidade', 'update'), 'view: authenticated sem update');
  return next ok(not has_table_privilege('authenticated', 'public.v_conjunto_capacidade', 'delete'), 'view: authenticated sem delete');
end $$;

-- "Só admin apaga" verificado pela estrutura das políticas (o teste não executa remoções).
create function tests.test_politicas_conjunto() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
begin
  foreach t in array array['conjunto', 'conjunto_item'] loop
    select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = t;
    return next is(v_n, 4, format('%s: quatro políticas (uma por comando)', t));
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass),
      format('%s: RLS ligada', t));
    return next is(
      (select count(*) from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE'),
      1::bigint, format('%s: exatamente uma política de exclusão', t));
    return next ok((select qual like '%eh_admin%' from pg_policies where tablename = t and cmd = 'DELETE'),
      format('%s: exclusão exige eh_admin()', t));
    return next ok((select qual like '%pode_ler%' from pg_policies where tablename = t and cmd = 'SELECT'),
      format('%s: select exige pode_ler', t));
    return next ok((select with_check like '%pode_editar%' from pg_policies where tablename = t and cmd = 'INSERT'),
      format('%s: insert exige pode_editar', t));
    return next ok((select qual like '%pode_editar%' and with_check like '%pode_editar%' from pg_policies
                    where tablename = t and cmd = 'UPDATE'),
      format('%s: update com using e with check pode_editar', t));
  end loop;
end $$;

create function tests.test_privilegios_tabelas_conjunto() returns setof text language plpgsql as $$
declare
  t text;
  p text;
begin
  foreach t in array array['conjunto', 'conjunto_item'] loop
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

create function tests.test_auditoria_conjunto() returns setof text language plpgsql as $$
declare
  t text;
  v_p uuid := tests.prop_teste('52998224725');
  v_conj uuid;
begin
  foreach t in array array['conjunto', 'conjunto_item'] loop
    return next ok(exists (select 1 from pg_trigger
                           where tgrelid = format('public.%I', t)::regclass
                             and tgname = 'trg_auditoria' and not tgisinternal),
      format('%s: auditoria ligada', t));
  end loop;
  v_conj := tests.novo_conjunto(tests.novo_veiculo(7, v_p), array[tests.novo_veiculo(11, v_p)]);
  return next is(
    (select count(*) from public.auditoria where tabela = 'conjunto_item' and registro_id = v_conj::text || ':1'),
    1::bigint, 'auditoria de conjunto_item: registro_id = conjunto_id:posicao');
  return next is(
    (select count(*) from public.auditoria where tabela = 'conjunto' and registro_id = v_conj::text),
    1::bigint, 'auditoria de conjunto: registro_id = id');
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.conjunto'::regclass
                         and tgname = 'conjunto_set_updated_at' and not tgisinternal),
    'conjunto: trigger de updated_at');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
