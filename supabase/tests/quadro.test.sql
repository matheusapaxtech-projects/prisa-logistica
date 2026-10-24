-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 5 do quadro da operação: views do Quadro (v_quadro, v_pedido_saldo, v_viagem_planejada),
-- tempos-limite (quadro_limite) e tempo real (publicação supabase_realtime).
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….
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
                              situacao_cadastro, exercicio_doc, unidade_operacional_id)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal', tests.ano(), 3)
  returning id into v_id;
  return v_id;
end $$;

-- Fixtura (a mesma das Tasks 3 e 4): cliente sem exigências, motorista com CNH E válida, cavalo + carreta
-- normais, conjunto aberto, pedido aberto, viagem planejada. O cavalo é da unidade operacional 3.
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
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
  values (pedido, conjunto, cavalo, motorista, 37000)
  returning id into viagem;
  return next;
end $$;

-- Dígito verificador (módulo 11) e chaves fictícias, como na Task 4.
create function tests.com_dv(p43 text) returns text language sql immutable as $$
  select p43 || (case when r.dv >= 10 then 0 else r.dv end)::text
  from (select 11 - sum(substr(p43, 44 - k, 1)::int * (2 + (k - 1) % 8)) % 11 as dv
        from generate_series(1, 43) k) r;
$$;

create function tests.chave(p_modelo text) returns text language sql immutable as $$
  select tests.com_dv('41' || '2610' || '11222333000181' || p_modelo || '001' || '000001234' || '1' || '12345678');
$$;

create function tests.dados_chaves() returns jsonb language sql immutable as $$
  select jsonb_build_object('chave_cte', tests.chave('57'), 'chave_mdfe', tests.chave('58'));
$$;

create function tests.mover(p_uid uuid, p_viagem uuid, p_de text, p_para text, p_dados jsonb default '{}')
returns void language plpgsql as $$
begin
  perform tests.executar_como(p_uid,
    format('select public.mover_viagem(%L, %L, %L, %L)', p_viagem, p_de, p_para, p_dados));
end $$;

create function tests.iniciar(p_uid uuid, p_viagem uuid) returns void language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format('select public.iniciar_viagem(%L)', p_viagem));
end $$;

-- Leva uma viagem já iniciada pelo caminho feliz até p_alvo (só até Em rota é preciso aqui).
create function tests.levar_ate(p_uid uuid, p_viagem uuid, p_alvo public.status_campo) returns void language plpgsql as $$
declare
  v public.viagem%rowtype;
begin
  loop
    select * into v from public.viagem where id = p_viagem;
    exit when v.status_campo = p_alvo;
    case v.status_campo
      when 'transito' then perform tests.mover(p_uid, p_viagem, 'transito', 'aguardando_carregamento');
      when 'aguardando_carregamento' then perform tests.mover(p_uid, p_viagem, 'aguardando_carregamento', 'em_carregamento');
      when 'em_carregamento' then
        perform tests.mover(p_uid, p_viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 37000}');
      when 'aguardando_nf_pagamento' then
        perform tests.executar_como(p_uid, format('select public.confirmar_pagamento_saida(%L)', p_viagem));
        perform tests.mover(p_uid, p_viagem, 'aguardando_nf_pagamento', 'em_rota', tests.dados_chaves());
      else raise exception 'levar_ate: não sei sair de %', v.status_campo;
    end case;
  end loop;
end $$;

-- Linha de v_quadro da viagem vista pelo usuário (RLS de quem consulta: as views são security_invoker).
create function tests.quadro_como(p_uid uuid, p_viagem uuid) returns public.v_quadro language plpgsql as $$
declare
  r public.v_quadro;
begin
  perform tests.como(p_uid);
  select * into r from public.v_quadro q where q.viagem_id = p_viagem;
  perform tests.como_servico();
  return r;
end $$;

create function tests.no_quadro(p_uid uuid, p_viagem uuid) returns boolean language plpgsql as $$
declare
  v boolean;
begin
  perform tests.como(p_uid);
  v := exists (select 1 from public.v_quadro q where q.viagem_id = p_viagem);
  perform tests.como_servico();
  return v;
end $$;

create function tests.planejada_como(p_uid uuid, p_viagem uuid) returns public.v_viagem_planejada language plpgsql as $$
declare
  r public.v_viagem_planejada;
begin
  perform tests.como(p_uid);
  select * into r from public.v_viagem_planejada q where q.viagem_id = p_viagem;
  perform tests.como_servico();
  return r;
end $$;

create function tests.saldo_como(p_uid uuid, p_pedido uuid) returns public.v_pedido_saldo language plpgsql as $$
declare
  r public.v_pedido_saldo;
begin
  perform tests.como(p_uid);
  select * into r from public.v_pedido_saldo q where q.pedido_id = p_pedido;
  perform tests.como_servico();
  return r;
end $$;

create function tests.limite(p_chave text) returns public.quadro_limite language sql stable as $$
  select * from public.quadro_limite where chave = p_chave;
$$;

-- ---------------------------------------------------------------------------
-- Os testes do plano
-- ---------------------------------------------------------------------------
create function tests.test_quadro_mostra_viagem_em_rota() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  r record;
  q public.v_quadro;
  v_placa text;
begin
  select * into r from tests.cenario();
  select placa into v_placa from public.veiculo where id = r.cavalo;
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'em_rota');

  q := tests.quadro_como(v_lei, r.viagem);
  return next ok(q.viagem_id = r.viagem, 'leitura vê a viagem Em rota no quadro');
  return next is(q.status_campo::text, 'em_rota', 'status_campo = em_rota');
  return next is(q.numero, (select numero from public.viagem where id = r.viagem), 'numero da viagem');
  return next is(q.status_desde, (select status_desde from public.viagem where id = r.viagem), 'status_desde da viagem');
  return next is(q.cavalo_placa, v_placa, 'placa do cavalo');
  return next is(q.motorista_nome, 'Motorista', 'motorista sem apelido: primeiro nome');
  return next is(q.cliente_nome, 'Cliente Teste', 'tomador sem apelido: nome');
  return next ok(q.origem_cidade = 'Curitiba' and q.origem_uf::text = 'PR', 'origem = local de coleta do pedido');
  return next ok(q.destino_cidade = 'Santos' and q.destino_uf::text = 'SP', 'destino = local de descarga do pedido');
  return next is(q.unidade_operacional_id, 3::smallint,'unidade operacional do cavalo');
  return next is(q.iniciada_por, v_op, 'iniciada_por = quem iniciou');
  return next ok(q.pausa_tipo is null and q.pausa_programada is null and q.pausa_inicio is null, 'sem pausa aberta');
  return next ok(q.tem_chaves and q.pagamento_saida, 'tem_chaves e pagamento_saida');
  return next ok(not q.tem_canhoto, 'ainda sem canhoto');
  return next ok(q.divergencia is null, 'sem divergência');
  return next is(q.ocorrencias_abertas, 0, 'nenhuma ocorrência aberta');

  -- apelidos, canhoto e ocorrências
  update public.pessoa set apelido = 'Teco' where id = r.motorista;
  update public.pessoa set apelido = 'Cliente T' where id = r.cliente;
  insert into public.arquivo (tipo_arquivo_id, viagem_id, storage_path)
  values (15, r.viagem, format('viagem/%s/canhoto.png', r.viagem));
  -- Ruling R13: a linha sem o objeto no Storage (envio falhou) não conta
  q := tests.quadro_como(v_lei, r.viagem);
  return next ok(not q.tem_canhoto, 'linha sem objeto não conta como canhoto');
  insert into storage.objects (bucket_id, name) values ('documentos', format('viagem/%s/canhoto.png', r.viagem));
  insert into public.viagem_ocorrencia (viagem_id, tipo, descricao) values (r.viagem, 'atraso', 'trânsito na serra');
  insert into public.viagem_ocorrencia (viagem_id, tipo, descricao) values (r.viagem, 'avaria', 'lona rasgada');
  insert into public.viagem_ocorrencia (viagem_id, tipo, descricao, resolvida_em, resolucao)
  values (r.viagem, 'outro', 'já resolvida', now(), 'ok');
  q := tests.quadro_como(v_lei, r.viagem);
  return next is(q.motorista_nome, 'Teco', 'motorista com apelido: apelido');
  return next is(q.cliente_nome, 'Cliente T', 'tomador com apelido: apelido');
  return next ok(q.tem_canhoto, 'canhoto (tipo 15) anexado, com o objeto no Storage');
  return next is(q.ocorrencias_abertas, 2, 'duas ocorrências abertas (a resolvida não conta)');

  return next ok(not tests.no_quadro(v_sem, r.viagem), 'sem perfil não vê a viagem');
end $$;

create function tests.test_quadro_esconde_planejada_e_cancelada() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  return next ok(not tests.no_quadro(v_op, r.viagem), 'planejada não aparece no quadro');
  return next ok((tests.planejada_como(v_op, r.viagem)).viagem_id = r.viagem, 'planejada aparece em v_viagem_planejada');
  perform tests.iniciar(v_op, r.viagem);
  return next ok(tests.no_quadro(v_op, r.viagem), 'iniciada: aparece no quadro (Trânsito)');
  return next ok((tests.planejada_como(v_op, r.viagem)).viagem_id is null, 'iniciada: sai de v_viagem_planejada');
  perform tests.executar_como(v_op, format('select public.cancelar_viagem(%L, %L)', r.viagem, 'cliente desistiu'));
  return next ok(not tests.no_quadro(v_op, r.viagem), 'cancelada não aparece no quadro');
  return next ok((tests.planejada_como(v_op, r.viagem)).viagem_id is null, 'cancelada não aparece em v_viagem_planejada');
  -- cancelada ainda planejada (status_campo nulo) também não é "planejada"
  update public.viagem set cancelada_em = null, status_campo = null where id = r.viagem;
  return next ok((tests.planejada_como(v_op, r.viagem)).viagem_id = r.viagem, 'fixtura: de novo planejada');
  update public.viagem set cancelada_em = now() where id = r.viagem;
  return next ok((tests.planejada_como(v_op, r.viagem)).viagem_id is null, 'planejada cancelada não aparece');
end $$;

create function tests.test_quadro_finalizado_some_no_dia_seguinte_brasilia() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  update public.viagem
     set status_campo = 'frete_finalizado', status_desde = now(), iniciada_em = now(), divergencia = 'sem_divergencia',
         finalizada_em = ((tests.hoje() - 1) + time '23:30') at time zone 'America/Sao_Paulo'
   where id = r.viagem;
  return next ok(not tests.no_quadro(v_op, r.viagem), 'finalizada ontem às 23:30 (Brasília) não aparece');
  update public.viagem set finalizada_em = (tests.hoje() + time '00:10') at time zone 'America/Sao_Paulo' where id = r.viagem;
  return next ok(tests.no_quadro(v_op, r.viagem), 'finalizada hoje às 00:10 (Brasília) aparece');
  update public.viagem set finalizada_em = (tests.hoje() + time '23:50') at time zone 'America/Sao_Paulo' where id = r.viagem;
  return next ok(tests.no_quadro(v_op, r.viagem), 'finalizada hoje às 23:50 (Brasília, já amanhã em UTC) aparece');
  update public.viagem set finalizada_em = ((tests.hoje() + 1) + time '00:10') at time zone 'America/Sao_Paulo' where id = r.viagem;
  return next ok(not tests.no_quadro(v_op, r.viagem), 'finalizada amanhã (Brasília) não aparece');
  -- as outras colunas não dependem do dia
  update public.viagem set status_campo = 'aguardando_contagem', status_desde = now() - interval '3 days',
                           finalizada_em = null where id = r.viagem;
  return next ok(tests.no_quadro(v_op, r.viagem), 'Aguardando contagem há 3 dias continua no quadro');
end $$;

create function tests.test_quadro_pausa_aberta() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  q public.v_quadro;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "problema", "pausa_programada": false}');
  q := tests.quadro_como(v_op, r.viagem);
  return next is(q.status_campo::text, 'pausa', 'status_campo = pausa');
  return next is(q.pausa_tipo::text, 'problema', 'pausa_tipo da pausa aberta');
  return next is(q.pausa_programada, false, 'pausa_programada da pausa aberta');
  return next is(q.pausa_inicio, (select inicio from public.viagem_pausa where viagem_id = r.viagem and fim is null),
    'pausa_inicio = início da pausa aberta');
  perform tests.mover(v_op, r.viagem, 'pausa', 'transito');
  perform tests.mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "almoco", "pausa_programada": true}');
  q := tests.quadro_como(v_op, r.viagem);
  return next ok(q.pausa_tipo = 'almoco' and q.pausa_programada, 'depois de fechar a primeira: mostra só a pausa aberta');
  return next is((select count(*) from public.v_quadro where viagem_id = r.viagem), 1::bigint, 'uma linha por viagem');
  perform tests.mover(v_op, r.viagem, 'pausa', 'transito');
  q := tests.quadro_como(v_op, r.viagem);
  return next ok(q.pausa_tipo is null and q.pausa_programada is null and q.pausa_inicio is null, 'pausa fechada: campos nulos');
end $$;

create function tests.test_saldo_do_pedido() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  r record;
  v_saida uuid;
  v_cancelada uuid;
  s public.v_pedido_saldo;
begin
  select * into r from tests.cenario();
  update public.pedido set peso_total_kg = 30000 where id = r.pedido;
  update public.viagem set peso_previsto_kg = 12000 where id = r.viagem;
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
  values (r.pedido, r.conjunto, r.cavalo, r.motorista, 12000) returning id into v_saida;
  update public.viagem set status_campo = 'aguardando_nf_pagamento', status_desde = now(), peso_saida_kg = 11800
   where id = v_saida;
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg)
  values (r.pedido, r.conjunto, r.cavalo, r.motorista, 12000) returning id into v_cancelada;
  update public.viagem set cancelada_em = now(), cancelamento_motivo = 'teste' where id = v_cancelada;

  s := tests.saldo_como(v_lei, r.pedido);
  return next is(s.pedido_id, r.pedido, 'leitura vê o saldo do pedido');
  return next is(s.peso_total_kg, 30000.0, 'peso_total_kg');
  return next is(s.peso_alocado_kg, 23800.0, 'alocado = 12000 (prevista) + 11800 (saída); a cancelada não conta');
  return next is(s.saldo_kg, 6200.0, 'saldo_kg = 6200');
  return next is(s.viagens, 2, 'duas viagens não canceladas');
  return next is(s.situacao::text, 'aberto', 'situacao do pedido');
  return next is(s.tomador_id, r.cliente, 'tomador_id');
  return next is(s.numero, (select numero from public.pedido where id = r.pedido), 'numero do pedido');

  -- pedido sem viagens: alocado 0 e saldo = total
  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  select tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id, produto, 5000, 10
  from public.pedido where id = r.pedido
  returning id into v_saida;
  s := tests.saldo_como(v_lei, v_saida);
  return next ok(s.peso_alocado_kg = 0 and s.saldo_kg = 5000 and s.viagens = 0, 'pedido sem viagens: alocado 0, saldo = total');
end $$;

create function tests.test_planejada_conta_travas() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  p public.v_viagem_planejada;
  v_placa text;
begin
  select * into r from tests.cenario();
  select placa into v_placa from public.veiculo where id = r.cavalo;
  p := tests.planejada_como(v_op, r.viagem);
  return next ok(p.travas = 0 and p.avisos = 0 and p.aptidao = '[]'::jsonb, 'fixtura apta: 0 travas, 0 avisos, aptidao []');
  return next ok(p.numero = (select numero from public.viagem where id = r.viagem)
                 and p.pedido_id = r.pedido and p.pedido_numero = (select numero from public.pedido where id = r.pedido),
    'numero da viagem, pedido_id e pedido_numero');
  return next ok(p.cavalo_placa = v_placa and p.motorista_nome = 'Motorista' and p.cliente_nome = 'Cliente Teste',
    'placa, motorista e cliente');

  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  p := tests.planejada_como(v_op, r.viagem);
  return next ok(p.travas >= 1, 'CNH vencida: travas >= 1');
  return next ok(p.aptidao @> '[{"codigo": "cnh_vencida", "nivel": "trava"}]'::jsonb, 'aptidao traz cnh_vencida');

  -- aviso (cliente exige GR) conta em avisos, não em travas
  update public.motorista set cnh_validade = tests.hoje() + 365 where pessoa_id = r.motorista;
  update public.cliente set exige_gr = true where pessoa_id = r.cliente;
  p := tests.planejada_como(v_op, r.viagem);
  return next ok(p.travas = 0 and p.avisos = 1, 'cliente exige GR: 0 travas, 1 aviso');

  -- trava legal conta em travas (pedido cancelado, como em iniciar_viagem)
  update public.pedido set situacao = 'cancelado' where id = r.pedido;
  p := tests.planejada_como(v_op, r.viagem);
  return next ok(p.travas = 1 and p.aptidao -> 0 ->> 'codigo' = 'pedido_cancelado'
                 and p.aptidao -> 0 ->> 'nivel' = 'trava_legal', 'pedido cancelado: trava legal, primeira da lista');
end $$;

create function tests.test_operacao_nao_muda_limite() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_n bigint;
begin
  perform tests.como(v_lei);
  select count(*) into v_n from public.quadro_limite;
  perform tests.como_servico();
  return next ok(v_n >= 8, 'leitura lê os tempos-limite');
  perform tests.como(v_sem);
  select count(*) into v_n from public.quadro_limite;
  perform tests.como_servico();
  return next is(v_n, 0::bigint, 'sem perfil não lê os tempos-limite');

  perform tests.executar_como(v_op,
    'update public.quadro_limite set minutos_ambar = 1, minutos_vermelho = 2 where chave = ''aguardando_carregamento''');
  return next ok((tests.limite('aguardando_carregamento')).minutos_ambar = 120
                 and (tests.limite('aguardando_carregamento')).minutos_vermelho = 240, 'operação: update não muda nada');
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_op,
      'insert into public.quadro_limite (chave, minutos_ambar, minutos_vermelho) values (''em_rota'', 10, 20)'),
    '42501', null, 'operação não insere');
  -- apagar: conferido por privilégio (sem DELETE na suíte)
  return next ok(not has_table_privilege('authenticated', 'public.quadro_limite', 'delete'), 'authenticated sem delete');
end $$;

create function tests.test_admin_muda_limite() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
begin
  return next lives_ok(format('select tests.executar_como(%L, %L)', v_adm,
      'update public.quadro_limite set minutos_ambar = 90, minutos_vermelho = 180 where chave = ''aguardando_carregamento'''),
    'admin muda o tempo-limite');
  return next ok((tests.limite('aguardando_carregamento')).minutos_ambar = 90
                 and (tests.limite('aguardando_carregamento')).minutos_vermelho = 180, 'valores gravados');
  return next ok(exists (select 1 from public.auditoria where tabela = 'quadro_limite' and registro_id = 'aguardando_carregamento'
                         and acao = 'update' and usuario_id = v_adm), 'mudança auditada com o admin');
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_adm,
      'update public.quadro_limite set minutos_vermelho = 90 where chave = ''aguardando_carregamento'''),
    '23514', null, 'vermelho precisa ser maior que âmbar');
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_adm,
      'insert into public.quadro_limite (chave, minutos_ambar, minutos_vermelho) values (''em_rota'', 10, 20)'),
    '42501', null, 'nem admin insere (a lista de chaves é fixa)');
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_adm,
      'update public.quadro_limite set chave = ''outra'' where chave = ''aguardando_carregamento'''),
    '42501', null, 'a chave não muda');
end $$;

create function tests.test_viagem_na_publicacao_realtime() returns setof text language plpgsql as $$
begin
  return next ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='viagem'),
    'viagem está na publicação supabase_realtime');
  -- Ruling R18: os sinais (ocorrência aberta, canhoto) também chegam em tempo real.
  return next ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
                        and tablename='viagem_ocorrencia'),
    'viagem_ocorrencia está na publicação supabase_realtime');
  return next ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
                        and tablename='arquivo'),
    'arquivo está na publicação supabase_realtime');
end $$;

-- ---------------------------------------------------------------------------
-- Demais regras
-- ---------------------------------------------------------------------------
create function tests.test_carga_dos_limites() returns setof text language plpgsql as $$
begin
  return next is(array(select chave || '=' || minutos_ambar || '/' || minutos_vermelho from public.quadro_limite order by chave),
    array['aguardando_carregamento=120/240', 'aguardando_contagem=240/1440', 'aguardando_descarga=120/240',
          'aguardando_nf_pagamento=120/240', 'em_carregamento=120/240', 'pausa_nao_programada=30/60',
          'pausa_programada=60/120', 'resolucao_divergencia=1440/2880'],
    'carga dos 8 tempos-limite');
end $$;

-- Fix round 1: a aptidão (com pedido cancelado) vem de um lugar só, usado pela view e por iniciar_viagem.
create function tests.test_aptidao_da_viagem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  r record;
  v_num bigint;
  v_apt jsonb;
begin
  select * into r from tests.cenario();
  select numero into v_num from public.pedido where id = r.pedido;
  return next is(public.aptidao_da_viagem(r.viagem), '[]'::jsonb, 'fixtura apta: []');
  return next is(public.aptidao_da_viagem(gen_random_uuid()), null::jsonb, 'viagem inexistente: null');

  update public.cliente set exige_gr = true where pessoa_id = r.cliente;
  update public.motorista set cnh_validade = tests.hoje() - 1 where pessoa_id = r.motorista;
  update public.pedido set situacao = 'cancelado' where id = r.pedido;
  v_apt := public.aptidao_da_viagem(r.viagem);
  return next is(array(select e ->> 'codigo' || ':' || (e ->> 'nivel') from jsonb_array_elements(v_apt) e),
    array['pedido_cancelado:trava_legal', 'cnh_vencida:trava', 'cliente_exige_gr:aviso'],
    'pedido cancelado primeiro, depois as linhas de aptidao_viagem na ordem');
  return next is(v_apt -> 0 ->> 'mensagem', format('O pedido #%s está cancelado', v_num), 'mensagem do pedido cancelado');

  perform tests.como(v_lei);
  v_apt := public.aptidao_da_viagem(r.viagem);
  perform tests.como_servico();
  return next ok(jsonb_array_length(v_apt) = 3, 'leitura consulta a aptidão da viagem');
  return next is((tests.planejada_como(v_op, r.viagem)).aptidao, public.aptidao_da_viagem(r.viagem),
    'v_viagem_planejada.aptidao = aptidao_da_viagem');
  return next throws_like(format('select tests.executar_como(%L, %L)', v_op, format('select public.iniciar_viagem(%L)', r.viagem)),
    format('viagem não pode iniciar: O pedido #%s está cancelado%%', v_num), 'iniciar_viagem usa a mesma aptidão (pedido cancelado)');

  -- liberação com exceção grava a mesma lista que a função devolve
  update public.pedido set situacao = 'aberto' where id = r.pedido;
  v_apt := public.aptidao_da_viagem(r.viagem);
  perform tests.executar_como(tests.criar_usuario('adm@exemplo.test', 'admin'),
    format('select public.iniciar_viagem(%L, %L)', r.viagem, 'CNH renovada'));
  return next is((select liberacao_aptidao from public.viagem where id = r.viagem), v_apt,
    'liberacao_aptidao = aptidao_da_viagem no momento do início');
end $$;

create function tests.test_estrutura() returns setof text language plpgsql as $$
declare
  v text;
begin
  foreach v in array array['public.v_quadro', 'public.v_pedido_saldo', 'public.v_viagem_planejada'] loop
    return next ok((select coalesce(c.reloptions @> array['security_invoker=true'], false) from pg_class c where c.oid = v::regclass),
      format('%s: security_invoker', v));
    return next ok(has_table_privilege('authenticated', v, 'select'), format('%s: select para authenticated', v));
    return next ok(not has_table_privilege('anon', v, 'select'), format('%s: sem select para anon', v));
    return next ok(not has_table_privilege('authenticated', v, 'insert') and not has_table_privilege('authenticated', v, 'update')
                   and not has_table_privilege('authenticated', v, 'delete'), format('%s: sem escrita para authenticated', v));
  end loop;
  return next ok((select relrowsecurity from pg_class where oid = 'public.quadro_limite'::regclass), 'quadro_limite: RLS ligado');
  return next ok(not has_table_privilege('anon', 'public.quadro_limite', 'select'), 'quadro_limite: anon sem select');
  return next ok(not has_table_privilege('authenticated', 'public.quadro_limite', 'truncate'), 'quadro_limite: sem truncate');
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.quadro_limite'::regclass and tgname = 'trg_auditoria'),
    'quadro_limite: auditada');
  return next ok((select not prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
                  from pg_proc where oid = 'public.aptidao_da_viagem(uuid)'::regprocedure),
    'aptidao_da_viagem: security invoker, stable, search_path vazio');
  return next ok(has_function_privilege('authenticated', 'public.aptidao_da_viagem(uuid)', 'execute')
                 and not has_function_privilege('anon', 'public.aptidao_da_viagem(uuid)', 'execute'),
    'aptidao_da_viagem: execute para authenticated, não para anon');
  -- a regra do pedido cancelado está escrita só em aptidao_da_viagem
  return next ok(pg_get_functiondef('public.iniciar_viagem(uuid, text)'::regprocedure) !~ 'pedido_cancelado'
                 and pg_get_functiondef('public.iniciar_viagem(uuid, text)'::regprocedure) ~ 'aptidao_da_viagem',
    'iniciar_viagem usa aptidao_da_viagem (sem cópia da regra)');
  return next ok(pg_get_viewdef('public.v_viagem_planejada'::regclass) !~ 'pedido_cancelado'
                 and pg_get_viewdef('public.v_viagem_planejada'::regclass) ~ 'aptidao_da_viagem',
    'v_viagem_planejada usa aptidao_da_viagem (sem cópia da regra)');
  return next ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
                  where oid = 'public.iniciar_viagem(uuid, text)'::regprocedure)
                 and has_function_privilege('authenticated', 'public.iniciar_viagem(uuid, text)', 'execute')
                 and not has_function_privilege('anon', 'public.iniciar_viagem(uuid, text)', 'execute'),
    'iniciar_viagem: continua security definer, execute só para authenticated');
  -- Ruling R13: "tem canhoto" num lugar só (canhoto_enviado), com o objeto no Storage
  return next ok((select prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
                  from pg_proc where oid = 'public.canhoto_enviado(uuid)'::regprocedure)
                 and has_function_privilege('authenticated', 'public.canhoto_enviado(uuid)', 'execute')
                 and not has_function_privilege('anon', 'public.canhoto_enviado(uuid)', 'execute'),
    'canhoto_enviado: security definer, stable, search_path vazio, execute só para authenticated');
  return next ok(pg_get_viewdef('public.v_quadro'::regclass) ~ 'canhoto_enviado'
                 and pg_get_functiondef('public.mover_viagem(uuid, public.status_campo, public.status_campo, jsonb)'::regprocedure) ~ 'canhoto_enviado',
    'v_quadro e mover_viagem usam canhoto_enviado');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
