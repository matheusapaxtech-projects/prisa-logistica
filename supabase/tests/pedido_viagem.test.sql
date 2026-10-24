-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 2 do quadro da operação: pedido, viagem, eventos, pausas, ocorrências e canhoto (arquivo da viagem).
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735 e 52998224725) e placas TST….
-- Nenhum DELETE: "só admin apaga" é verificado por pg_policies e as regras de exclusão das FKs pelo catálogo.

-- ---------------------------------------------------------------------------
-- Auxiliares (não rodam como teste: o nome não começa com test_)
-- ---------------------------------------------------------------------------
create sequence tests.seq_placa;

-- Pessoa (PJ se 14 dígitos, PF se 11) que vira cliente.
create function tests.novo_cliente(p_doc text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  if length(p_doc) = 14 then
    insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Cliente ' || p_doc, p_doc) returning id into v_id;
  else
    insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Cliente ' || p_doc, p_doc) returning id into v_id;
  end if;
  insert into public.cliente (pessoa_id) values (v_id);
  return v_id;
end $$;

create function tests.novo_local(p_pessoa uuid, p_tipo text default 'coleta_descarga') returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf)
  values (p_pessoa, p_tipo::public.tipo_endereco, 'Curitiba', 'PR') returning id into v_id;
  return v_id;
end $$;

-- Motorista numa pessoa nova (CPF) ou numa pessoa que já existe (p_pessoa).
create function tests.novo_motorista(p_cpf text, p_pessoa uuid default null) returns uuid language plpgsql as $$
declare
  v_id uuid := p_pessoa;
begin
  if v_id is null then
    insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista ' || p_cpf, p_cpf) returning id into v_id;
  end if;
  insert into public.motorista (pessoa_id) values (v_id);
  return v_id;
end $$;

-- Cavalo (tipo 7) com placa TST0001, TST0002...; o proprietário é a pessoa informada.
create function tests.novo_cavalo(p_prop uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.proprietario (pessoa_id) values (p_prop) on conflict do nothing;
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), 7, p_prop, p_prop)
  returning id into v_id;
  return v_id;
end $$;

create function tests.novo_conjunto(p_cavalo uuid, p_motorista uuid, p_fim timestamptz default null)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.conjunto (cavalo_id, motorista_id, inicio, fim)
  values (p_cavalo, p_motorista, now() - interval '1 day', p_fim) returning id into v_id;
  return v_id;
end $$;

-- Cenário base: um cliente (tomador = remetente = destinatário) com local de coleta e de descarga,
-- um motorista, um cavalo, um conjunto aberto, um pedido e uma viagem planejada.
create function tests.cenario()
returns table (cliente uuid, coleta uuid, descarga uuid, motorista uuid, cavalo uuid, conjunto uuid, pedido uuid, viagem uuid)
language plpgsql as $$
begin
  cliente := tests.novo_cliente('11222333000181');
  coleta := tests.novo_local(cliente);
  descarga := tests.novo_local(cliente);
  motorista := tests.novo_motorista('11144477735');
  cavalo := tests.novo_cavalo(cliente);
  conjunto := tests.novo_conjunto(cavalo, motorista);
  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, coleta, descarga, 'Soja', 37000, 150)
  returning id into pedido;
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
  values (pedido, conjunto, cavalo, motorista, 37000)
  returning id into viagem;
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- Os 8 testes do plano
-- ---------------------------------------------------------------------------
create function tests.test_pedido_local_de_outro_cliente() returns setof text language plpgsql as $$
declare
  r record;
  v_outro uuid;
  v_local_outro uuid;
  v_comercial uuid;
begin
  select * into r from tests.cenario();
  v_outro := tests.novo_cliente('52998224725');
  v_local_outro := tests.novo_local(v_outro);
  v_comercial := tests.novo_local(r.cliente, 'comercial');
  return next throws_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Soja', 1000, 0)$q$,
      r.cliente, r.cliente, r.cliente, v_local_outro, r.descarga),
    'P0001', 'o local de coleta precisa ser um local de coleta/descarga do remetente',
    'local de coleta de outro cliente é recusado');
  return next throws_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Soja', 1000, 0)$q$,
      r.cliente, r.cliente, r.cliente, r.coleta, v_local_outro),
    'P0001', 'o local de descarga precisa ser um local de coleta/descarga do destinatário',
    'local de descarga de outro cliente é recusado');
  return next throws_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Soja', 1000, 0)$q$,
      r.cliente, r.cliente, r.cliente, v_comercial, r.descarga),
    'P0001', 'o local de coleta precisa ser um local de coleta/descarga do remetente',
    'endereço do remetente que não é de coleta/descarga é recusado');
  return next lives_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Milho', 1000, 0)$q$,
      r.cliente, r.cliente, v_outro, r.coleta, v_local_outro),
    'coleta do remetente e descarga do destinatário (outro cliente) são aceitas');
  return next throws_ok(
    format('update public.pedido set local_coleta_id = %L where id = %L', v_local_outro, r.pedido),
    'P0001', 'o local de coleta precisa ser um local de coleta/descarga do remetente',
    'trocar o local de coleta para o de outro cliente é recusado');
end $$;

create function tests.test_viagem_copia_do_conjunto() returns setof text language plpgsql as $$
declare
  r record;
  v_outro_mot uuid;
  v_outro_cav uuid;
begin
  select * into r from tests.cenario();
  v_outro_mot := tests.novo_motorista('52998224725');
  v_outro_cav := tests.novo_cavalo(r.cliente);
  return next throws_ok(
    format($q$insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
              values (%L, %L, %L, %L, 1000)$q$, r.pedido, r.conjunto, r.cavalo, v_outro_mot),
    'P0001', 'o motorista da viagem precisa ser o do conjunto',
    'viagem com motorista diferente do conjunto é recusada');
  return next throws_ok(
    format($q$insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
              values (%L, %L, %L, %L, 1000)$q$, r.pedido, r.conjunto, v_outro_cav, r.motorista),
    'P0001', 'o cavalo da viagem precisa ser o do conjunto',
    'viagem com cavalo diferente do conjunto é recusada');
  return next throws_ok(
    format('update public.viagem set motorista_id = %L where id = %L', v_outro_mot, r.viagem),
    'P0001', 'o motorista da viagem precisa ser o do conjunto',
    'trocar só o motorista da viagem (sem trocar o conjunto) é recusado');
end $$;

create function tests.test_viagem_conjunto_encerrado() returns setof text language plpgsql as $$
declare
  r record;
  v_cav2 uuid;
  v_conj_fechado uuid;
begin
  select * into r from tests.cenario();
  v_cav2 := tests.novo_cavalo(r.cliente);
  v_conj_fechado := tests.novo_conjunto(v_cav2, r.motorista, now());
  return next throws_ok(
    format($q$insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
              values (%L, %L, %L, %L, 1000)$q$, r.pedido, v_conj_fechado, v_cav2, r.motorista),
    'P0001', 'o conjunto está encerrado; escolha um conjunto aberto',
    'viagem com conjunto encerrado é recusada');
  return next throws_ok(
    format('update public.viagem set conjunto_id = %L, cavalo_id = %L where id = %L', v_conj_fechado, v_cav2, r.viagem),
    'P0001', 'o conjunto está encerrado; escolha um conjunto aberto',
    'trocar para um conjunto encerrado é recusado');
end $$;

create function tests.test_operacao_nao_muda_status_direto() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem set status_campo = 'em_rota' where id = %L$q$)$f$,
      v_op, r.viagem),
    '42501', null, 'operação não muda status_campo direto (privilégio de coluna)');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem set finalizada_em = now() where id = %L$q$)$f$,
      v_op, r.viagem),
    '42501', null, 'operação não grava finalizada_em direto');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem
       (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, status_campo)
       values (%L, %L, %L, %L, 1000, 'em_rota')$q$)$f$, v_op, r.pedido, r.conjunto, r.cavalo, r.motorista),
    '42501', null, 'operação não cria viagem já com status_campo');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem set observacao = 'carga frágil', peso_previsto_kg = 36000
       where id = %L$q$)$f$, v_op, r.viagem),
    'operação edita observação e peso previsto');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem
       (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, frete_motorista_valor, frete_motorista_tipo)
       values (%L, %L, %L, %L, 1000, 120, 'por_tonelada')$q$)$f$, v_op, r.pedido, r.conjunto, r.cavalo, r.motorista),
    'operação cria viagem planejada');
  return next is((select status_campo from public.viagem where id = r.viagem), null::public.status_campo,
    'status_campo continua nulo (Planejada)');
end $$;

create function tests.test_operacao_nao_grava_evento() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  r record;
  v_ev bigint;
  v_n_ev bigint;
  v_n_pa bigint;
begin
  select * into r from tests.cenario();
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem_evento (viagem_id, para) values (%L, 'transito')$q$)$f$,
      v_op, r.viagem),
    '42501', null, 'operação não grava evento');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem)
       values (%L, 'almoco', true, 'transito')$q$)$f$, v_op, r.viagem),
    '42501', null, 'operação não grava pausa');
  -- como serviço (as RPCs gravam): evento e pausa
  insert into public.viagem_evento (viagem_id, de, para, motivo) values (r.viagem, null, 'transito', 'teste') returning id into v_ev;
  insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (r.viagem, 'almoco', true, 'transito');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_evento set motivo = 'x' where id = %L$q$)$f$, v_op, v_ev),
    '42501', null, 'operação não altera evento');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_pausa set fim = now() + interval '1 hour' where viagem_id = %L$q$)$f$,
      v_op, r.viagem),
    '42501', null, 'operação não fecha pausa direto');
  perform tests.como(v_lei);
  select count(*) into v_n_ev from public.viagem_evento where viagem_id = r.viagem;
  select count(*) into v_n_pa from public.viagem_pausa where viagem_id = r.viagem;
  perform tests.como_servico();
  return next is(v_n_ev, 1::bigint, 'leitura vê os eventos da viagem');
  return next is(v_n_pa, 1::bigint, 'leitura vê as pausas da viagem');
  return next is((select dados from public.viagem_evento where id = v_ev), '{}'::jsonb, 'evento: dados padrão {}');
end $$;

create function tests.test_canhoto_na_viagem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_arq uuid := gen_random_uuid();
  v_path text;
  v_n_obj bigint;
begin
  select * into r from tests.cenario();
  v_path := format('viagem/%s/%s-canhoto.png', r.viagem, v_arq);
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.arquivo (id, tipo_arquivo_id, viagem_id, storage_path, mime)
       values (%L, 15, %L, %L, 'image/png')$q$)$f$, v_op, v_arq, r.viagem, v_path),
    'operação grava o canhoto (tipo 15) da viagem');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.arquivo (tipo_arquivo_id, viagem_id, pessoa_id, storage_path)
       values (15, %L, %L, 'viagem/x/dois-donos.png')$q$)$f$, v_op, r.viagem, r.motorista),
    '23514', null, 'arquivo com viagem_id e pessoa_id juntos é recusado');
  -- Storage: o objeto no prefixo viagem/<id>/ é gravado pela operação e fica visível porque a linha existe
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into storage.objects (bucket_id, name) values ('documentos', %L)$q$)$f$,
      v_op, v_path),
    'operação envia o objeto do canhoto em viagem/<viagem_id>/');
  perform tests.como(v_op);
  select count(*) into v_n_obj from storage.objects where bucket_id = 'documentos' and name = v_path;
  perform tests.como_servico();
  return next is(v_n_obj, 1::bigint, 'operação vê o objeto do canhoto');
  return next is((select viagem_id from public.arquivo where id = v_arq), r.viagem, 'canhoto ligado à viagem');
end $$;

create function tests.test_ocorrencia_resolvida_exige_texto() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  r record;
  v_oc uuid;
begin
  select * into r from tests.cenario();
  return next throws_ok(
    format($q$insert into public.viagem_ocorrencia (viagem_id, tipo, descricao, resolvida_em) values (%L, 'atraso', 'chuva', now())$q$,
      r.viagem),
    '23514', null, 'ocorrência resolvida sem texto de resolução é recusada');
  return next throws_ok(
    format($q$insert into public.viagem_ocorrencia (viagem_id, tipo, descricao, resolucao) values (%L, 'atraso', 'chuva', 'ok')$q$,
      r.viagem),
    '23514', null, 'resolução sem resolvida_em é recusada');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem_ocorrencia (viagem_id, tipo, descricao)
       values (%L, 'avaria', 'lona rasgada')$q$)$f$, v_op, r.viagem),
    'operação registra ocorrência');
  -- o id não é coluna liberada no insert (migration realtime_sinais): acha a ocorrência pela viagem
  select id into v_oc from public.viagem_ocorrencia where viagem_id = r.viagem and descricao = 'lona rasgada';
  return next is((select aberta_por from public.viagem_ocorrencia where id = v_oc), v_op, 'aberta_por = auth.uid()');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_ocorrencia set resolvida_em = now(), resolvida_por = %L,
       resolucao = 'lona trocada' where id = %L$q$)$f$, v_op, v_op, v_oc),
    'operação resolve a ocorrência com texto');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem_ocorrencia (viagem_id, tipo, descricao)
       values (%L, 'atraso', 'x')$q$)$f$, v_lei, r.viagem),
    '42501', null, 'leitura não registra ocorrência');
  return next ok(exists (select 1 from public.auditoria where tabela = 'viagem_ocorrencia' and registro_id = v_oc::text),
    'ocorrência auditada');
end $$;

-- Migration realtime_sinais: authenticated só escreve as colunas da tela; quem resolve é o usuário da sessão.
create function tests.test_ocorrencia_colunas_e_quem_resolve() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_outro uuid := tests.criar_usuario('outro@exemplo.test', 'operacao');
  r record;
  v_oc uuid := gen_random_uuid();
  c text;
begin
  select * into r from tests.cenario();
  foreach c in array array['viagem_id', 'tipo', 'descricao'] loop
    return next ok(has_column_privilege('authenticated', 'public.viagem_ocorrencia', c, 'insert'),
      format('viagem_ocorrencia.%s: insert liberado', c));
  end loop;
  foreach c in array array['id', 'aberta_em', 'aberta_por', 'resolvida_em', 'resolvida_por', 'resolucao'] loop
    return next ok(not has_column_privilege('authenticated', 'public.viagem_ocorrencia', c, 'insert'),
      format('viagem_ocorrencia.%s: insert negado', c));
  end loop;
  foreach c in array array['resolvida_em', 'resolvida_por', 'resolucao', 'descricao'] loop
    return next ok(has_column_privilege('authenticated', 'public.viagem_ocorrencia', c, 'update'),
      format('viagem_ocorrencia.%s: update liberado', c));
  end loop;
  foreach c in array array['id', 'viagem_id', 'tipo', 'aberta_em', 'aberta_por'] loop
    return next ok(not has_column_privilege('authenticated', 'public.viagem_ocorrencia', c, 'update'),
      format('viagem_ocorrencia.%s: update negado', c));
  end loop;

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.viagem_ocorrencia (viagem_id, tipo, descricao, aberta_por)
       values (%L, 'atraso', 'chuva', %L)$q$)$f$, v_op, r.viagem, v_outro),
    '42501', null, 'operação não escolhe aberta_por ao registrar');

  insert into public.viagem_ocorrencia (id, viagem_id, tipo, descricao) values (v_oc, r.viagem, 'avaria', 'lona rasgada');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_ocorrencia set viagem_id = %L where id = %L$q$)$f$,
      v_op, r.viagem, v_oc),
    '42501', null, 'operação não muda a viagem da ocorrência');

  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_ocorrencia set resolvida_em = now(), resolvida_por = %L,
       resolucao = 'lona trocada' where id = %L$q$)$f$, v_op, v_outro, v_oc),
    'operação resolve mandando outro usuário em resolvida_por');
  return next is((select resolvida_por from public.viagem_ocorrencia where id = v_oc), v_op,
    'resolvida_por = quem resolveu (auth.uid()), não o valor mandado');

  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem_ocorrencia set resolvida_por = %L,
       descricao = 'lona rasgada na carreta 2' where id = %L$q$)$f$, v_outro, v_outro, v_oc),
    'outro usuário edita a descrição da ocorrência já resolvida');
  return next is((select resolvida_por from public.viagem_ocorrencia where id = v_oc), v_op,
    'quem resolveu não muda depois');
end $$;

create function tests.test_uma_pausa_aberta() returns setof text language plpgsql as $$
declare
  r record;
begin
  select * into r from tests.cenario();
  insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (r.viagem, 'almoco', true, 'transito');
  return next throws_ok(
    format($q$insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (%L, 'banheiro', false, 'transito')$q$,
      r.viagem),
    '23505', null, 'segunda pausa aberta na mesma viagem é recusada');
  update public.viagem_pausa set fim = now() + interval '1 minute' where viagem_id = r.viagem and fim is null;
  return next lives_ok(
    format($q$insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem) values (%L, 'banheiro', false, 'em_rota')$q$,
      r.viagem),
    'depois de fechar a pausa, outra pode abrir');
  return next throws_ok(
    format($q$insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem, fim) values (%L, 'outro', false, 'pausa', now() + interval '1 hour')$q$,
      r.viagem),
    '23514', null, 'pausa só nasce de Trânsito ou Em rota');
  return next throws_ok(
    format($q$insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem, inicio, fim) values (%L, 'outro', false, 'transito', now(), now() - interval '1 minute')$q$,
      r.viagem),
    '23514', null, 'fim da pausa depois do início');
end $$;

-- ---------------------------------------------------------------------------
-- Ruling R2: a validação do conjunto só roda no insert e quando conjunto/cavalo/motorista mudam
-- ---------------------------------------------------------------------------
create function tests.test_viagem_em_curso_sobrevive_troca_no_conjunto() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_mot2 uuid;
  v_cav2 uuid;
  v_conj2 uuid;
begin
  select * into r from tests.cenario();
  v_mot2 := tests.novo_motorista('52998224725');
  -- viagem em curso (como serviço, como as RPCs fariam)
  update public.viagem set status_campo = 'transito', status_desde = now(), iniciada_em = now() where id = r.viagem;
  -- o motorista do conjunto muda depois que a viagem começou
  update public.conjunto set motorista_id = v_mot2 where id = r.conjunto;
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem set observacao = 'motorista trocou no posto' where id = %L$q$)$f$,
      v_op, r.viagem),
    'update de observação da viagem em curso continua funcionando depois da troca de motorista no conjunto');
  return next is((select observacao from public.viagem where id = r.viagem), 'motorista trocou no posto', 'observação gravada');
  -- trocar de conjunto depois de começar é recusado
  v_cav2 := tests.novo_cavalo(r.cliente);
  v_conj2 := tests.novo_conjunto(v_cav2, r.motorista);
  return next throws_ok(
    format('update public.viagem set conjunto_id = %L, cavalo_id = %L where id = %L', v_conj2, v_cav2, r.viagem),
    'P0001', 'o conjunto só muda antes de a viagem começar',
    'trocar o conjunto de uma viagem que já começou é recusado');
end $$;

create function tests.test_troca_de_conjunto_planejada() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_mot2 uuid;
  v_cav2 uuid;
  v_conj2 uuid;
begin
  select * into r from tests.cenario();
  v_mot2 := tests.novo_motorista('52998224725');
  v_cav2 := tests.novo_cavalo(r.cliente);
  v_conj2 := tests.novo_conjunto(v_cav2, v_mot2);
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.viagem set conjunto_id = %L, cavalo_id = %L, motorista_id = %L
       where id = %L$q$)$f$, v_op, v_conj2, v_cav2, v_mot2, r.viagem),
    'operação troca o conjunto (com cavalo e motorista dele) da viagem planejada');
  return next is((select conjunto_id from public.viagem where id = r.viagem), v_conj2, 'conjunto trocado');
  return next throws_ok(
    format('update public.viagem set conjunto_id = %L where id = %L', r.conjunto, r.viagem),
    'P0001', 'o cavalo da viagem precisa ser o do conjunto',
    'trocar só o conjunto sem trazer o cavalo dele é recusado');
end $$;

create function tests.test_conjunto_sem_motorista() returns setof text language plpgsql as $$
declare
  r record;
  v_cav2 uuid;
  v_conj2 uuid;
begin
  select * into r from tests.cenario();
  v_cav2 := tests.novo_cavalo(r.cliente);
  v_conj2 := tests.novo_conjunto(v_cav2, null);
  return next throws_ok(
    format($q$insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
              values (%L, %L, %L, %L, 1000)$q$, r.pedido, v_conj2, v_cav2, r.motorista),
    'P0001', 'o conjunto não tem motorista',
    'conjunto sem motorista não recebe viagem');
end $$;

-- ---------------------------------------------------------------------------
-- Arquivo da viagem fora das pendências e vencimentos de cadastro
-- ---------------------------------------------------------------------------
create function tests.test_arquivo_da_viagem_fora_das_pendencias() returns setof text language plpgsql as $$
declare
  r record;
  v_arq uuid := gen_random_uuid();
begin
  select * into r from tests.cenario();
  insert into public.arquivo (id, tipo_arquivo_id, viagem_id, storage_path, validade)
  values (v_arq, 14, r.viagem, format('viagem/%s/%s-outros.pdf', r.viagem, v_arq), tests.hoje() - 10);
  return next is((select count(*) from public.v_pendencias_documentos where arquivo_id = v_arq), 0::bigint,
    'arquivo vencido da viagem não vira pendência de cadastro');
  return next is((select count(*) from public.v_vencimentos where arquivo_id = v_arq), 0::bigint,
    'arquivo da viagem não entra nos vencimentos de cadastro');
end $$;

-- Regras de exclusão das FKs, conferidas no catálogo (sem DELETE): 'c' = cascade, 'r' = restrict.
create function tests.test_regras_de_exclusao() returns setof text language plpgsql as $$
declare
  f text[];
begin
  foreach f slice 1 in array array[
    ['viagem_evento', 'viagem_id', 'c'], ['viagem_pausa', 'viagem_id', 'c'], ['viagem_ocorrencia', 'viagem_id', 'c'],
    ['arquivo', 'viagem_id', 'c'], ['viagem', 'pedido_id', 'r'], ['viagem', 'conjunto_id', 'r'],
    ['pedido', 'tomador_id', 'r'], ['pedido', 'local_coleta_id', 'r']] loop
    return next is(
      (select k.confdeltype::text from pg_constraint k
       join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.conrelid = format('public.%I', f[1])::regclass and k.contype = 'f' and a.attname = f[2]),
      f[3], format('%s.%s: on delete %s', f[1], f[2], case f[3] when 'c' then 'cascade' else 'restrict' end));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Estrutura: enums, defaults, catálogo, RLS, privilégios, índices, auditoria
-- ---------------------------------------------------------------------------
create function tests.test_enums() returns setof text language plpgsql as $$
begin
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.tipo_tarifa'::regtype order by e.enumsortorder),
    array['total', 'por_tonelada'], 'enum tipo_tarifa');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.origem_frete'::regtype order by e.enumsortorder),
    array['manual', 'tabela'], 'enum origem_frete');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.situacao_pedido'::regtype order by e.enumsortorder),
    array['aberto', 'cancelado'], 'enum situacao_pedido');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.status_campo'::regtype order by e.enumsortorder),
    array['transito', 'aguardando_carregamento', 'em_carregamento', 'aguardando_nf_pagamento', 'em_rota', 'pausa',
          'aguardando_descarga', 'aguardando_contagem', 'resolucao_divergencia', 'frete_finalizado'],
    'enum status_campo na ordem das colunas do quadro');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.resultado_contagem'::regtype order by e.enumsortorder),
    array['sem_divergencia', 'falta', 'sobra', 'avaria'], 'enum resultado_contagem');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.tipo_pausa'::regtype order by e.enumsortorder),
    array['almoco', 'banheiro', 'descanso_pernoite', 'abastecimento', 'manutencao', 'problema', 'outro'], 'enum tipo_pausa');
  return next is(array(select e.enumlabel::text from pg_enum e where e.enumtypid = 'public.tipo_ocorrencia'::regtype order by e.enumsortorder),
    array['atraso', 'avaria', 'recusa', 'sinistro', 'parada_nao_prevista', 'outro'], 'enum tipo_ocorrencia');
end $$;

create function tests.test_pedido_padroes() returns setof text language plpgsql as $$
declare
  r record;
  v_n1 bigint;
  v_n2 bigint;
  v_p2 uuid;
begin
  select * into r from tests.cenario();
  return next is((select frete_empresa_tipo::text from public.pedido where id = r.pedido), 'por_tonelada', 'frete da empresa padrão por tonelada');
  return next is((select frete_empresa_origem::text from public.pedido where id = r.pedido), 'manual', 'origem do frete padrão manual');
  return next is((select situacao::text from public.pedido where id = r.pedido), 'aberto', 'pedido nasce aberto');
  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (r.cliente, r.cliente, r.cliente, r.coleta, r.descarga, 'Milho', 1000, 0) returning id into v_p2;
  select numero into v_n1 from public.pedido where id = r.pedido;
  select numero into v_n2 from public.pedido where id = v_p2;
  return next ok(v_n2 > v_n1, 'pedido.numero sequencial');
  return next ok((select numero from public.viagem where id = r.viagem) is not null, 'viagem.numero preenchido');
  return next throws_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Soja', 0, 0)$q$,
      r.cliente, r.cliente, r.cliente, r.coleta, r.descarga),
    '23514', null, 'peso total precisa ser maior que zero');
  return next throws_ok(
    format($q$insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
              produto, peso_total_kg, frete_empresa_valor) values (%L, %L, %L, %L, %L, 'Soja', 10, -1)$q$,
      r.cliente, r.cliente, r.cliente, r.coleta, r.descarga),
    '23514', null, 'frete da empresa não pode ser negativo');
  return next throws_ok(
    format($q$insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
              values (%L, %L, %L, %L, 0)$q$, r.pedido, r.conjunto, r.cavalo, r.motorista),
    '23514', null, 'peso previsto precisa ser maior que zero');
  return next throws_ok(
    format('update public.pedido set numero = 999999 where id = %L', r.pedido),
    '428C9', null, 'pedido.numero é generated always');
end $$;

create function tests.test_tipos_de_arquivo_da_viagem() returns setof text language plpgsql as $$
begin
  return next ok((select nome = 'CANHOTO' and not aplica_pessoa and not aplica_veiculo and aplica_viagem
                    from public.tipo_arquivo where id = 15), 'tipo 15 = CANHOTO, só de viagem');
  return next ok((select aplica_pessoa and aplica_veiculo and aplica_viagem from public.tipo_arquivo where id = 14),
    'OUTROS vale também para viagem');
  return next is((select count(*) from public.tipo_arquivo where aplica_viagem and id not in (14, 15)), 0::bigint,
    'só OUTROS e CANHOTO se aplicam a viagem');
  return next throws_ok(
    $q$insert into public.tipo_arquivo (nome) values ('NENHUM')$q$, '23514', null,
    'tipo que não se aplica a nada é recusado (aplica_algum inclui viagem)');
  return next ok((select pg_get_constraintdef(oid) ~ 'viagem_id' from pg_constraint
                  where conrelid = 'public.arquivo'::regclass and conname = 'arquivo_um_dono'),
    'arquivo_um_dono inclui viagem_id');
end $$;

create function tests.test_rls_e_politicas() returns setof text language plpgsql as $$
declare
  t text;
  c text;
  p text;
begin
  foreach t in array array['pedido', 'viagem', 'viagem_evento', 'viagem_pausa', 'viagem_ocorrencia'] loop
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass), format('%s: RLS ligada', t));
    return next ok((select qual like '%pode_ler%' from pg_policies where schemaname = 'public' and tablename = t and cmd = 'SELECT'),
      format('%s: select exige pode_ler', t));
    return next is((select count(*) from pg_policies where schemaname = 'public' and tablename = t
                    and roles <> array['authenticated']::name[]), 0::bigint, format('%s: políticas só para authenticated', t));
    foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      return next ok(not has_table_privilege('anon', format('public.%I', t), p), format('%s: anon sem %s', t, p));
    end loop;
    foreach p in array array['truncate', 'references', 'trigger'] loop
      return next ok(not has_table_privilege('authenticated', format('public.%I', t), p), format('%s: authenticated sem %s', t, p));
    end loop;
  end loop;

  foreach t in array array['pedido', 'viagem', 'viagem_ocorrencia'] loop
    return next ok((select with_check like '%pode_editar%' from pg_policies where schemaname = 'public' and tablename = t and cmd = 'INSERT'),
      format('%s: insert exige pode_editar', t));
    return next ok((select qual like '%pode_editar%' and with_check like '%pode_editar%' from pg_policies
                    where schemaname = 'public' and tablename = t and cmd = 'UPDATE'),
      format('%s: update exige pode_editar', t));
    return next ok((select qual like '%eh_admin%' from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE'),
      format('%s: delete só admin', t));
  end loop;

  foreach t in array array['viagem_evento', 'viagem_pausa'] loop
    return next is((select count(*) from pg_policies where schemaname = 'public' and tablename = t), 1::bigint,
      format('%s: só a política de select', t));
    foreach p in array array['insert', 'update', 'delete'] loop
      return next ok(not has_table_privilege('authenticated', format('public.%I', t), p), format('%s: authenticated sem %s', t, p));
    end loop;
  end loop;

  -- viagem: só as colunas de planejamento são editáveis pela API
  return next ok(not has_table_privilege('authenticated', 'public.viagem', 'update'), 'viagem: sem update de tabela inteira');
  foreach c in array array['conjunto_id', 'cavalo_id', 'motorista_id', 'peso_previsto_kg', 'frete_motorista_valor',
                           'frete_motorista_tipo', 'observacao'] loop
    return next ok(has_column_privilege('authenticated', 'public.viagem', c, 'update'), format('viagem.%s: update liberado', c));
  end loop;
  foreach c in array array['status_campo', 'status_desde', 'iniciada_em', 'liberacao_justificativa', 'peso_saida_kg',
                           'chave_cte', 'chave_mdfe', 'pagamento_saida_em', 'peso_chegada_kg', 'divergencia', 'resolucao',
                           'finalizada_em', 'cancelada_em', 'pedido_id'] loop
    return next ok(not has_column_privilege('authenticated', 'public.viagem', c, 'update'), format('viagem.%s: update negado', c));
  end loop;
  foreach c in array array['status_campo', 'iniciada_em', 'finalizada_em', 'cancelada_em', 'pagamento_saida_em'] loop
    return next ok(not has_column_privilege('authenticated', 'public.viagem', c, 'insert'), format('viagem.%s: insert negado', c));
  end loop;
end $$;

create function tests.test_indices_e_triggers() returns setof text language plpgsql as $$
declare
  f text[];
  t text;
begin
  foreach f slice 1 in array array[
    ['pedido', 'tomador_id'], ['pedido', 'remetente_id'], ['pedido', 'destinatario_id'],
    ['pedido', 'local_coleta_id'], ['pedido', 'local_descarga_id'],
    ['viagem', 'pedido_id'], ['viagem', 'conjunto_id'], ['viagem', 'cavalo_id'], ['viagem', 'motorista_id'],
    ['viagem_evento', 'viagem_id'], ['viagem_pausa', 'viagem_id'], ['viagem_ocorrencia', 'viagem_id'],
    ['arquivo', 'viagem_id']] loop
    return next ok(exists (
      select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
      where i.indrelid = format('public.%I', f[1])::regclass and a.attname = f[2] and i.indpred is null),
      format('%s.%s: índice na FK', f[1], f[2]));
  end loop;
  return next ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'viagem_pausa'
                         and indexdef ~* 'unique' and indexdef ~* 'fim IS NULL'),
    'viagem_pausa: índice único parcial de pausa aberta');
  foreach t in array array['pedido', 'viagem', 'viagem_pausa', 'viagem_ocorrencia'] loop
    return next ok(exists (select 1 from pg_trigger where tgrelid = format('public.%I', t)::regclass
                           and tgname = 'trg_auditoria' and not tgisinternal), format('%s: auditoria ligada', t));
  end loop;
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.viagem'::regclass and tgname = 'validar_viagem' and not tgisinternal),
    'viagem: trigger validar_viagem');
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.pedido'::regclass and tgname = 'validar_pedido' and not tgisinternal),
    'pedido: trigger validar_pedido');
  foreach t in array array['pedido', 'viagem'] loop
    return next ok(exists (select 1 from pg_trigger where tgrelid = format('public.%I', t)::regclass
                           and tgname = t || '_set_updated_at' and not tgisinternal), format('%s: trigger de updated_at', t));
  end loop;
  return next ok(not has_function_privilege('authenticated', 'public.fn_validar_viagem()', 'execute')
             and not has_function_privilege('authenticated', 'public.fn_validar_pedido()', 'execute'),
    'funções de trigger sem execute para authenticated');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
