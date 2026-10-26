-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 4 do quadro da operação: mover viagem pelas colunas, chaves do CT-e/MDF-e e pagamento de saída.
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
                              situacao_cadastro, exercicio_doc)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, 'normal', tests.ano())
  returning id into v_id;
  return v_id;
end $$;

-- Fixtura (a mesma da Task 3): cliente sem exigências, motorista com CNH E válida, cavalo + carreta normais,
-- conjunto aberto, pedido aberto, viagem planejada.
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
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade)
  values (motorista, 'e', tests.hoje() + 365, 'normal', 'habilitado', tests.hoje() + 180);

  cavalo := tests.novo_veiculo(7, cliente);
  carreta := tests.novo_veiculo(11, cliente);
  insert into public.conjunto (cavalo_id, motorista_id, inicio, aprovado_em)
  values (cavalo, motorista, now() - interval '1 day', now()) returning id into conjunto;
  insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (conjunto, 1, carreta);

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  -- Frete do motorista (R$ 5.000) e km (400) acima do piso ANTT de 6 eixos (migration 20261027000100).
  -- Viagem de antes do contas a pagar (pagamento_pelo_financeiro = false): confirmação manual do pagamento no Quadro.
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                             frete_motorista_valor, frete_motorista_tipo, km_viagem, pagamento_pelo_financeiro)
  values (pedido, conjunto, cavalo, motorista, 37000, 5000, 'total', 400, false)
  returning id into viagem;
  return next;
end $$;

-- Acrescenta o dígito verificador (módulo 11) a 43 dígitos. Cálculo próprio do teste: k = posição a partir
-- da direita (1..43), peso 2..9 repetindo; resto 0 ou 1 → DV 0.
create function tests.com_dv(p43 text) returns text language sql immutable as $$
  select p43 || (case when r.dv >= 10 then 0 else r.dv end)::text
  from (select 11 - sum(substr(p43, 44 - k, 1)::int * (2 + (k - 1) % 8)) % 11 as dv
        from generate_series(1, 43) k) r;
$$;

-- Chave fictícia: cUF 41 (PR), AAMM 2610, CNPJ 11222333000181, modelo, série 001, número 000001234,
-- tpEmis 1, código 12345678, DV calculado.
create function tests.chave(p_modelo text) returns text language sql immutable as $$
  select tests.com_dv('41' || '2610' || '11222333000181' || p_modelo || '001' || '000001234' || '1' || '12345678');
$$;

create function tests.dados_chaves() returns jsonb language sql immutable as $$
  select jsonb_build_object('chave_cte', tests.chave('57'), 'chave_mdfe', tests.chave('58'), 'chave_nfe', tests.chave('55'),
                            'ciot', '123456789012', 'averbacao', 'AV-0001');
$$;

-- SQL que chama a RPC como o usuário (para lives_ok/throws_*).
create function tests.sql_mover(p_uid uuid, p_viagem uuid, p_de text, p_para text, p_dados jsonb default '{}')
returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid,
                format('select public.mover_viagem(%L, %L, %L, %L)', p_viagem, p_de, p_para, p_dados));
$$;

create function tests.sql_pagar(p_uid uuid, p_viagem uuid) returns text language sql as $$
  select format('select tests.executar_como(%L, %L)', p_uid, format('select public.confirmar_pagamento_saida(%L)', p_viagem));
$$;

create function tests.mover(p_uid uuid, p_viagem uuid, p_de text, p_para text, p_dados jsonb default '{}')
returns void language plpgsql as $$
begin
  execute tests.sql_mover(p_uid, p_viagem, p_de, p_para, p_dados);
end $$;

create function tests.iniciar(p_uid uuid, p_viagem uuid) returns void language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format('select public.iniciar_viagem(%L)', p_viagem));
end $$;

-- Canhoto (tipo 15) da viagem, gravado como serviço: a linha de arquivo e o objeto no Storage (Ruling R13).
create function tests.canhoto(p_viagem uuid) returns void language plpgsql as $$
declare
  v_arq uuid := gen_random_uuid();
  v_path text := format('viagem/%s/%s-canhoto.png', p_viagem, v_arq);
begin
  insert into public.arquivo (id, tipo_arquivo_id, viagem_id, storage_path, mime)
  values (v_arq, 15, p_viagem, v_path, 'image/png');
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);
end $$;

-- Leva uma viagem já iniciada pelo caminho feliz até p_alvo (sem pausa, sem divergência).
create function tests.levar_ate(p_uid uuid, p_viagem uuid, p_alvo public.status_campo) returns void language plpgsql as $$
declare
  v public.viagem%rowtype;
begin
  loop
    select * into v from public.viagem where id = p_viagem;
    exit when v.status_campo = p_alvo;
    case v.status_campo
      when 'transito' then perform tests.mover(p_uid, p_viagem, 'transito', 'aguardando_carregamento');
      when 'aguardando_carregamento' then
        perform tests.mover(p_uid, p_viagem, 'aguardando_carregamento', 'em_carregamento', '{"checklist_veiculo": true}');
      when 'em_carregamento' then
        perform tests.mover(p_uid, p_viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 37000}');
      when 'aguardando_nf_pagamento' then
        if v.pagamento_saida_em is null then
          execute tests.sql_pagar(p_uid, p_viagem);
        end if;
        perform tests.mover(p_uid, p_viagem, 'aguardando_nf_pagamento', 'em_rota', tests.dados_chaves());
      when 'em_rota' then perform tests.mover(p_uid, p_viagem, 'em_rota', 'aguardando_descarga');
      when 'aguardando_descarga' then perform tests.mover(p_uid, p_viagem, 'aguardando_descarga', 'descarregando');
      when 'descarregando' then
        perform tests.canhoto(p_viagem);
        perform tests.mover(p_uid, p_viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}');
      when 'aguardando_contagem' then
        perform tests.mover(p_uid, p_viagem, 'aguardando_contagem', 'aguardando_saldo', '{"divergencia": "sem_divergencia"}');
      else raise exception 'levar_ate: não sei sair de %', v.status_campo;
    end case;
  end loop;
end $$;

create function tests.status(p_viagem uuid) returns text language sql stable as $$
  select status_campo::text from public.viagem where id = p_viagem;
$$;

create function tests.n_eventos(p_viagem uuid) returns bigint language sql stable as $$
  select count(*) from public.viagem_evento where viagem_id = p_viagem;
$$;

-- ---------------------------------------------------------------------------
-- Os testes do plano
-- ---------------------------------------------------------------------------
create function tests.test_chave_dfe_valida() returns setof text language plpgsql as $$
declare
  k text := tests.chave('57');
begin
  return next is(length(k), 44, 'fixtura: chave de 44 dígitos');
  return next ok(public.chave_dfe_valida(k, '57'), 'chave modelo 57 com DV correto: válida');
  return next ok(public.chave_dfe_valida(regexp_replace(k, '([0-9]{4})', '\1 ', 'g'), '57'), 'com espaços: válida');
  return next ok(public.chave_dfe_valida(regexp_replace(k, '([0-9]{4})', '\1.', 'g'), '57'), 'com pontos: válida');
  return next ok(public.chave_dfe_valida(' ' || substr(k, 1, 20) || '.' || substr(k, 21, 10) || ' ' || substr(k, 31) || ' ', '57'),
    'com espaços e pontos misturados: válida');
  return next ok(not public.chave_dfe_valida(left(k, 43) || ((right(k, 1)::int + 1) % 10)::text, '57'),
    'último dígito trocado: inválida');
  return next ok(not public.chave_dfe_valida(tests.chave('55'), '57'), 'chave modelo 55 (NF-e) pedindo 57: inválida');
  return next ok(public.chave_dfe_valida(tests.chave('55'), '55'), 'a mesma chave modelo 55 é válida como 55 (DV certo)');
  return next ok(not public.chave_dfe_valida(left(k, 43), '57'), '43 dígitos: inválida');
  return next ok(not public.chave_dfe_valida(k || '0', '57'), '45 dígitos: inválida');
  return next ok(public.chave_dfe_valida(tests.chave('58'), '58'), 'chave modelo 58 (MDF-e) válida');
  return next is(public.chave_dfe_valida(null, '57'), false, 'nula: false (não null)');
  return next is(public.chave_dfe_valida('', '57'), false, 'vazia: false');
  -- resto 0 e resto 1 → DV 0 (procura chaves fictícias com esses restos variando o código numérico)
  return next ok((select bool_and(public.chave_dfe_valida(tests.com_dv(left(tests.chave('57'), 35) || lpad(n::text, 8, '0')), '57'))
                  from generate_series(1, 40) n), 'DV certo em 40 códigos diferentes (inclui restos 0 e 1)');
  return next ok((select count(*) > 0 from generate_series(1, 40) n
                  where right(tests.com_dv(left(tests.chave('57'), 35) || lpad(n::text, 8, '0')), 1) = '0'),
    'fixtura: algum desses códigos tem DV 0');
end $$;

create function tests.test_caminho_completo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v public.viagem%rowtype;
  v_pausa public.viagem_pausa%rowtype;
  v_ev public.viagem_evento%rowtype;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'aguardando_carregamento'), 'Trânsito → Aguardando carregamento');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_carregamento', 'em_carregamento'),
    'P0001', 'confira o checklist do veículo (carroceria limpa, lona, CRLV, CNH e tacógrafo)', 'sem checklist do veículo não carrega');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_carregamento', 'em_carregamento', '{"checklist_veiculo": true}'),
    'Aguardando carregamento → Em carregamento (com checklist)');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 37020.5}'),
    'Em carregamento → Aguardando NF e pagamento (com peso de saída)');
  return next lives_ok(tests.sql_pagar(v_op, r.viagem), 'operação confirma o pagamento de saída');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota',
      tests.dados_chaves() || jsonb_build_object('chave_cte', regexp_replace(tests.chave('57'), '([0-9]{4})', '\1 ', 'g'),
                         'chave_mdfe', regexp_replace(tests.chave('58'), '([0-9]{4})', '\1.', 'g'))),
    'Aguardando NF e pagamento → Em rota (chaves com espaços e pontos)');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'em_rota', 'pausa', '{"pausa_tipo": "almoco", "pausa_programada": true}'),
    'Em rota → Pausa');
  select * into v_pausa from public.viagem_pausa where viagem_id = r.viagem;
  return next ok(v_pausa.tipo = 'almoco' and v_pausa.programada and v_pausa.coluna_origem = 'em_rota' and v_pausa.fim is null,
    'pausa aberta: almoço, programada, origem Em rota');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'pausa', 'em_rota'), 'Pausa → Em rota');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'em_rota', 'aguardando_descarga'), 'Em rota → Aguardando descarga');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_descarga', 'descarregando'), 'Aguardando descarga → Descarregando');
  perform tests.canhoto(r.viagem);
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": "36990,4"}'),
    'Descarregando → Aguardando contagem (peso de chegada com vírgula)');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'aguardando_saldo', '{"divergencia": "sem_divergencia"}'),
    'Aguardando contagem → Aguardando saldo (sem divergência)');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_saldo', 'frete_finalizado', '{"mdfe_encerrado": true, "ciot_encerrado": true}'),
    'P0001', 'falta confirmar o pagamento do saldo de 30%', 'sem o saldo pago não finaliza');
  return next lives_ok(format('select tests.executar_como(%L, %L)', v_op, format('select public.confirmar_saldo(%L)', r.viagem)),
    'operação confirma o saldo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_saldo', 'frete_finalizado', '{"ciot_encerrado": true}'),
    'P0001', 'encerre o MDF-e antes de finalizar', 'sem o MDF-e encerrado não finaliza');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_saldo', 'frete_finalizado', '{"mdfe_encerrado": true, "ciot_encerrado": true}'),
    'Aguardando saldo → Frete finalizado');

  select * into v from public.viagem where id = r.viagem;
  return next is(v.status_campo::text, 'frete_finalizado', 'status_campo = frete_finalizado');
  return next is(tests.n_eventos(r.viagem), 14::bigint, '14 eventos: início + pagamento + saldo + 11 passagens');
  return next ok(v.chave_nfe = tests.chave('55') and v.ciot = '123456789012' and v.averbacao_seguro = 'AV-0001',
    'NF-e, CIOT e averbação gravados');
  return next ok(v.checklist_veiculo_em is not null and v.saldo_pago_por = v_op and v.mdfe_encerrado_em is not null
                 and v.ciot_encerrado_em is not null, 'checklist, saldo e encerramentos gravados');
  return next is(v.peso_saida_kg, 37020.5, 'peso_saida_kg gravado');
  return next is(v.chave_cte::text, tests.chave('57'), 'chave_cte só com dígitos');
  return next is(v.chave_mdfe::text, tests.chave('58'), 'chave_mdfe só com dígitos');
  return next ok(v.pagamento_saida_em is not null and v.pagamento_saida_por = v_op, 'pagamento_saida_em/por gravados');
  return next is(v.peso_chegada_kg, 36990.4, 'peso_chegada_kg gravado');
  return next is(v.divergencia::text, 'sem_divergencia', 'divergencia = sem_divergencia');
  return next ok(v.finalizada_em is not null and v.status_desde is not null, 'finalizada_em e status_desde preenchidos');
  return next ok((select fim is not null and fim > inicio from public.viagem_pausa where viagem_id = r.viagem), 'pausa fechada (fim > inicio)');
  select * into v_ev from public.viagem_evento where viagem_id = r.viagem and dados ->> 'tipo' = 'pagamento_saida';
  return next ok(v_ev.de = 'aguardando_nf_pagamento' and v_ev.para = 'aguardando_nf_pagamento' and v_ev.por = v_op,
    'evento do pagamento: de = para = coluna atual, por quem confirmou');
  return next is(v_ev.dados, '{"tipo": "pagamento_saida"}'::jsonb, 'evento do pagamento: dados = {"tipo":"pagamento_saida"}');
  return next is(array(select de::text || '>' || para::text from public.viagem_evento
                       where viagem_id = r.viagem and de is distinct from para and de is not null order by id),
    array['transito>aguardando_carregamento', 'aguardando_carregamento>em_carregamento',
          'em_carregamento>aguardando_nf_pagamento', 'aguardando_nf_pagamento>em_rota', 'em_rota>pausa', 'pausa>em_rota',
          'em_rota>aguardando_descarga', 'aguardando_descarga>descarregando', 'descarregando>aguardando_contagem',
          'aguardando_contagem>aguardando_saldo', 'aguardando_saldo>frete_finalizado'],
    'eventos das 11 passagens, na ordem');
  return next ok((select dados = '{"peso_saida_kg": 37020.5}'::jsonb and por = v_op from public.viagem_evento
                  where viagem_id = r.viagem and para = 'aguardando_nf_pagamento' and de = 'em_carregamento'),
    'evento guarda p_dados e quem moveu');
end $$;

create function tests.test_mover_com_origem_desatualizada() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_desde timestamptz;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.mover(v_op, r.viagem, 'transito', 'aguardando_carregamento');
  select status_desde into v_desde from public.viagem where id = r.viagem;
  return next throws_like(tests.sql_mover(v_op, r.viagem, 'transito', 'aguardando_carregamento'),
    '%já está em "Aguardando carregamento"%', 'origem desatualizada: recusa dizendo a coluna atual');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "almoco", "pausa_programada": true}'),
    'P0001', 'a viagem já está em "Aguardando carregamento"; o quadro foi atualizado', 'mensagem exata');
  return next is(tests.status(r.viagem), 'aguardando_carregamento', 'nada muda: status');
  return next is((select status_desde from public.viagem where id = r.viagem), v_desde, 'nada muda: status_desde');
  return next is(tests.n_eventos(r.viagem), 2::bigint, 'nada muda: eventos');
  return next is((select count(*) from public.viagem_pausa where viagem_id = r.viagem), 0::bigint, 'nada muda: nenhuma pausa');
  -- viagem planejada (o quadro achava que estava em Trânsito)
  update public.viagem set status_campo = null, status_desde = null where id = r.viagem;
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'aguardando_carregamento'),
    'P0001', 'a viagem já está em "Planejada"; o quadro foi atualizado', 'planejada: também recusa');
end $$;

create function tests.test_em_rota_sem_pagamento() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_nf_pagamento');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota', tests.dados_chaves()),
    'P0001', 'falta confirmar o adiantamento e o vale-pedágio', 'chaves válidas, sem pagamento: recusa');
  return next is(tests.status(r.viagem), 'aguardando_nf_pagamento', 'continua em Aguardando NF e pagamento');
  return next ok((select chave_cte is null and chave_mdfe is null from public.viagem where id = r.viagem), 'chaves não gravadas');
end $$;

create function tests.test_em_rota_com_chave_nfe() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  k text := tests.chave('57');
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_nf_pagamento');
  execute tests.sql_pagar(v_op, r.viagem);
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota',
      jsonb_build_object('chave_cte', tests.chave('55'), 'chave_mdfe', tests.chave('58'))),
    'P0001', 'chave do CT-e inválida', 'chave da NF-e (modelo 55) no lugar do CT-e: recusa');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota',
      jsonb_build_object('chave_cte', left(k, 43) || ((right(k, 1)::int + 1) % 10)::text, 'chave_mdfe', tests.chave('58'))),
    'P0001', 'chave do CT-e inválida', 'CT-e com dígito trocado: recusa');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota',
      jsonb_build_object('chave_cte', tests.chave('57'), 'chave_mdfe', tests.chave('57'))),
    'P0001', 'chave do MDF-e inválida', 'chave do CT-e no lugar do MDF-e: recusa');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_rota', jsonb_build_object('chave_cte', tests.chave('57'))),
    'P0001', 'chave do MDF-e inválida', 'sem MDF-e: recusa');
  return next is(tests.status(r.viagem), 'aguardando_nf_pagamento', 'continua em Aguardando NF e pagamento');
end $$;

create function tests.test_pausa_volta_para_origem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "problema", "pausa_programada": false}'),
    'Trânsito → Pausa');
  return next ok((select coluna_origem = 'transito' and tipo = 'problema' and not programada and fim is null
                  from public.viagem_pausa where viagem_id = r.viagem), 'pausa aberta com origem Trânsito');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'pausa', 'em_rota'),
    'P0001', 'não é possível passar de "Pausa" para "Em rota"', 'pausa vinda de Trânsito não vai para Em rota');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'pausa', 'aguardando_carregamento'),
    'P0001', 'não é possível passar de "Pausa" para "Aguardando carregamento"', 'nem para outra coluna');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'pausa', 'transito'), 'Pausa → Trânsito (a origem)');
  return next is(tests.status(r.viagem), 'transito', 'de volta em Trânsito');
  return next ok((select fim is not null and fim > inicio from public.viagem_pausa where viagem_id = r.viagem), 'pausa fechada');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "abastecimento", "pausa_programada": true}'),
    'nova pausa depois da primeira fechada');
  return next is((select count(*) from public.viagem_pausa where viagem_id = r.viagem), 2::bigint, 'duas pausas, uma aberta');
end $$;

create function tests.test_pausa_no_carregamento_recusa() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'em_carregamento');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'pausa', '{"pausa_tipo": "almoco", "pausa_programada": true}'),
    'P0001', 'não é possível passar de "Em carregamento" para "Pausa"', 'Em carregamento não pausa');
  return next is((select count(*) from public.viagem_pausa where viagem_id = r.viagem), 0::bigint, 'nenhuma pausa');
  return next is(tests.status(r.viagem), 'em_carregamento', 'continua em Em carregamento');
end $$;

create function tests.test_contagem_sem_canhoto() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'descarregando');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'P0001', 'falta o canhoto', 'sem canhoto: recusa');
  -- outro arquivo da viagem (tipo 14 OUTROS) não é canhoto
  insert into public.arquivo (tipo_arquivo_id, viagem_id, storage_path) values (14, r.viagem, format('viagem/%s/outro.png', r.viagem));
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'P0001', 'falta o canhoto', 'arquivo OUTROS não conta como canhoto');
  perform tests.canhoto(r.viagem);
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem'),
    'P0001', 'informe o peso de chegada', 'com canhoto e sem peso de chegada: recusa');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'com canhoto e peso: passa');
end $$;

-- Ruling R13: a linha de arquivo CANHOTO sem o objeto no Storage (envio falhou) não conta.
create function tests.test_canhoto_sem_objeto_nao_conta() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v_path text;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'descarregando');
  v_path := format('viagem/%s/%s-canhoto.png', r.viagem, gen_random_uuid());
  insert into public.arquivo (tipo_arquivo_id, viagem_id, storage_path) values (15, r.viagem, v_path);
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'P0001', 'falta o canhoto', 'linha sem objeto não conta: recusa');
  -- objeto de outro bucket com o mesmo nome também não conta
  insert into storage.buckets (id, name) values ('tst-outro', 'tst-outro') on conflict do nothing;
  insert into storage.objects (bucket_id, name) values ('tst-outro', v_path);
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'P0001', 'falta o canhoto', 'objeto em outro bucket não conta');
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'descarregando', 'aguardando_contagem', '{"peso_chegada_kg": 36950}'),
    'com o objeto no bucket documentos: passa');
end $$;

create function tests.test_voltar_exige_motivo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_nf_pagamento');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_carregamento'),
    'P0001', 'informe o motivo para voltar a viagem', 'voltar sem motivo: recusa');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_carregamento', '{"motivo": "   "}'),
    'P0001', 'informe o motivo para voltar a viagem', 'motivo só com espaços: recusa');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'em_carregamento', '{"motivo": " peso errado "}'),
    'Aguardando NF e pagamento → Em carregamento com motivo');
  return next is((select motivo from public.viagem_evento where viagem_id = r.viagem order by id desc limit 1), 'peso errado',
    'evento com o motivo (sem espaços nas pontas)');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_carregamento', '{"motivo": "clique errado"}'),
    'Em carregamento → Aguardando carregamento com motivo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_carregamento', 'transito'),
    'P0001', 'informe o motivo para voltar a viagem', 'Aguardando carregamento → Trânsito sem motivo: recusa');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_carregamento', 'transito', '{"motivo": "clique errado"}'),
    'Aguardando carregamento → Trânsito com motivo');
  return next is(tests.status(r.viagem), 'transito', 'de volta em Trânsito');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'aguardando_nf_pagamento'),
    'P0001', 'não é possível passar de "Trânsito" para "Aguardando NF e pagamento"', 'não pula colunas');
end $$;

create function tests.test_voltar_depois_de_em_rota_recusa() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'em_rota');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_rota', 'aguardando_nf_pagamento', '{"motivo": "clique errado"}'),
    'P0001', 'não é possível passar de "Em rota" para "Aguardando NF e pagamento"', 'Em rota não volta, nem com motivo');
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_contagem');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'aguardando_descarga', '{"motivo": "clique errado"}'),
    'P0001', 'não é possível passar de "Aguardando contagem de divergência" para "Aguardando descarga"', 'depois de Em rota nada volta');
  return next is(tests.status(r.viagem), 'aguardando_contagem', 'continua em Aguardando contagem');
end $$;

create function tests.test_financeiro_confirma_pagamento_mas_nao_move() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_nf_pagamento');
  return next lives_ok(tests.sql_pagar(v_fin, r.viagem), 'financeiro confirma o pagamento de saída');
  return next is((select pagamento_saida_por from public.viagem where id = r.viagem), v_fin, 'pagamento_saida_por = financeiro');
  return next throws_ok(tests.sql_mover(v_fin, r.viagem, 'aguardando_nf_pagamento', 'em_rota', tests.dados_chaves()),
    '42501', 'sem permissão para mover viagem', 'financeiro não move');
  return next is(tests.status(r.viagem), 'aguardando_nf_pagamento', 'continua em Aguardando NF e pagamento');
end $$;

-- ---------------------------------------------------------------------------
-- Demais regras
-- ---------------------------------------------------------------------------
create function tests.test_divergencia_vai_para_resolucao() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  v public.viagem%rowtype;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  perform tests.levar_ate(v_op, r.viagem, 'aguardando_contagem');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'aguardando_saldo', '{"divergencia": "falta"}'),
    'P0001', 'com divergência, a viagem vai para "Resolução de divergência na carga"', 'com falta não vai direto para o saldo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'aguardando_saldo'),
    'P0001', 'informe o resultado da contagem', 'sem resultado da contagem não segue');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'frete_finalizado', '{"divergencia": "sem_divergencia"}'),
    'P0001', 'não é possível passar de "Aguardando contagem de divergência" para "Frete finalizado"', 'não finaliza sem passar pelo saldo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'resolucao_divergencia', '{"divergencia": "sem_divergencia"}'),
    'P0001', 'sem divergência, a viagem vai para "Aguardando saldo (30%)"', 'sem divergência não vai para resolução');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'resolucao_divergencia', '{"divergencia": "quebra"}'),
    'P0001', 'informe o resultado da contagem', 'resultado desconhecido: recusa');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'resolucao_divergencia',
      '{"divergencia": "avaria", "divergencia_descricao": "  "}'),
    'P0001', 'descreva a divergência', 'avaria sem descrição: recusa');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_contagem', 'resolucao_divergencia',
      '{"divergencia": "avaria", "divergencia_descricao": " 3 sacos rasgados "}'),
    'avaria com descrição → Resolução de divergência');
  select * into v from public.viagem where id = r.viagem;
  return next ok(v.divergencia = 'avaria' and v.divergencia_descricao = '3 sacos rasgados' and v.finalizada_em is null,
    'divergência e descrição gravadas; ainda não finalizada');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'resolucao_divergencia', 'aguardando_saldo', '{"resolucao": ""}'),
    'P0001', 'descreva a resolução', 'resolução vazia: recusa');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'resolucao_divergencia', 'aguardando_saldo',
      '{"resolucao": " descontado do saldo "}'), 'Resolução → Aguardando saldo');
  select * into v from public.viagem where id = r.viagem;
  return next ok(v.status_campo = 'aguardando_saldo' and v.resolucao = 'descontado do saldo' and v.finalizada_em is null
                 and v.divergencia = 'avaria', 'resolução gravada, divergência mantida, ainda não finalizada');
end $$;

create function tests.test_dados_obrigatorios() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_programada": true}'),
    'P0001', 'informe o tipo da pausa', 'pausa sem tipo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "cochilo", "pausa_programada": true}'),
    'P0001', 'informe o tipo da pausa', 'pausa com tipo desconhecido');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "almoco"}'),
    'P0001', 'informe se a pausa é programada', 'pausa sem dizer se é programada');
  perform tests.levar_ate(v_op, r.viagem, 'em_carregamento');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento'),
    'P0001', 'informe o peso de saída', 'sem peso de saída');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 0}'),
    'P0001', 'informe o peso de saída', 'peso de saída zero');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": -10}'),
    'P0001', 'informe o peso de saída', 'peso de saída negativo');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": "muito"}'),
    'P0001', 'informe o peso de saída', 'peso de saída que não é número');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 0.04}'),
    'P0001', 'informe o peso de saída', 'peso de saída que arredonda para zero');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": 1e12}'),
    'P0001', 'informe o peso de saída', 'peso de saída absurdo (não cabe na coluna)');
  return next lives_ok(tests.sql_mover(v_op, r.viagem, 'em_carregamento', 'aguardando_nf_pagamento', '{"peso_saida_kg": "37000"}'),
    'peso de saída como texto numérico');
  return next is((select peso_saida_kg from public.viagem where id = r.viagem), 37000.0, 'peso gravado');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', 'frete_finalizado'),
    'P0001', 'não é possível passar de "Aguardando NF e pagamento" para "Frete finalizado"', 'não pula para o fim');
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_nf_pagamento', null),
    'P0001', 'não é possível passar de "Aguardando NF e pagamento" para "Planejada"', 'não volta a Planejada');
end $$;

create function tests.test_pagamento_regras() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  r record;
begin
  select * into r from tests.cenario();
  return next throws_ok(tests.sql_pagar(v_lei, r.viagem), '42501', 'sem permissão para confirmar o pagamento de saída',
    'leitura não confirma');
  return next throws_ok(tests.sql_pagar(v_sem, r.viagem), '42501', 'sem permissão para confirmar o pagamento de saída',
    'sem perfil não confirma');
  return next throws_ok(tests.sql_pagar(v_op, gen_random_uuid()), 'P0002', 'viagem não encontrada', 'viagem inexistente');
  perform tests.iniciar(v_op, r.viagem);
  perform tests.mover(v_op, r.viagem, 'transito', 'pausa', '{"pausa_tipo": "almoco", "pausa_programada": true}');
  return next lives_ok(tests.sql_pagar(v_op, r.viagem), 'confirma em pausa a partir de Trânsito');
  return next ok((select de = 'pausa' and para = 'pausa' from public.viagem_evento where viagem_id = r.viagem order by id desc limit 1),
    'evento pausa → pausa');
  return next is(tests.status(r.viagem), 'pausa', 'o pagamento não muda a coluna');
  return next throws_ok(tests.sql_pagar(v_op, r.viagem), 'P0001', 'o adiantamento e o vale-pedágio já foram confirmados',
    'confirmar de novo: recusa');
  -- outra viagem já em Em rota
  update public.viagem set status_campo = 'em_rota', pagamento_saida_em = null, pagamento_saida_por = null where id = r.viagem;
  update public.viagem_pausa set fim = clock_timestamp() where viagem_id = r.viagem and fim is null;
  return next throws_ok(tests.sql_pagar(v_op, r.viagem), 'P0001',
    'a viagem está em "Em rota"; o pagamento de saída só é confirmado antes de "Em rota"', 'Em rota: recusa');
  update public.viagem set status_campo = 'transito', cancelada_em = now() where id = r.viagem;
  return next throws_ok(tests.sql_pagar(v_op, r.viagem), 'P0001', 'a viagem está cancelada', 'cancelada: recusa');
end $$;

create function tests.test_mover_regras_gerais() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  r record;
begin
  select * into r from tests.cenario();
  perform tests.iniciar(v_op, r.viagem);
  return next throws_ok(tests.sql_mover(v_lei, r.viagem, 'transito', 'aguardando_carregamento'),
    '42501', 'sem permissão para mover viagem', 'leitura não move');
  return next throws_ok(tests.sql_mover(v_op, gen_random_uuid(), 'transito', 'aguardando_carregamento'),
    'P0002', 'viagem não encontrada', 'viagem inexistente');
  return next lives_ok(tests.sql_mover(v_adm, r.viagem, 'transito', 'aguardando_carregamento', null), 'admin move; p_dados nulo vale {}');
  return next is((select dados from public.viagem_evento where viagem_id = r.viagem order by id desc limit 1), '{}'::jsonb,
    'evento com dados {}');
  perform tests.executar_como(v_op, format('select public.cancelar_viagem(%L, %L)', r.viagem, 'cliente desistiu'));
  return next throws_ok(tests.sql_mover(v_op, r.viagem, 'aguardando_carregamento', 'em_carregamento'),
    'P0001', 'a viagem foi cancelada; o quadro foi atualizado', 'cancelada não move');
end $$;

create function tests.test_estrutura() returns setof text language plpgsql as $$
declare
  f text;
begin
  return next ok((select provolatile = 'i' and not prosecdef and proconfig @> array['search_path=""']
                  from pg_proc where oid = 'public.chave_dfe_valida(text, text)'::regprocedure),
    'chave_dfe_valida: immutable, security invoker, search_path vazio');
  foreach f in array array['public.mover_viagem(uuid, public.status_campo, public.status_campo, jsonb)',
                           'public.confirmar_pagamento_saida(uuid)'] loop
    return next ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f::regprocedure),
      format('%s: security definer com search_path vazio', f));
  end loop;
  foreach f in array array['public.mover_viagem(uuid, public.status_campo, public.status_campo, jsonb)',
                           'public.confirmar_pagamento_saida(uuid)', 'public.chave_dfe_valida(text, text)'] loop
    return next ok(has_function_privilege('authenticated', f, 'execute'), format('%s: execute para authenticated', f));
    return next ok(not has_function_privilege('anon', f, 'execute'), format('%s: sem execute para anon', f));
  end loop;
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
