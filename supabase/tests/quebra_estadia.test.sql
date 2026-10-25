-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Quebra de peso e estadia (migration 20261029000400). Caso de quebra do motor (test/casos.json):
-- 32 t → 31,74 t com 0,3% de tolerância = 0,26 t (0,813%), divergente, excedente 0,164 t.
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735) e placas TST….

create sequence tests.seq_placa;

create function tests.cenario(p_tolerancia numeric default 0.3)
returns table (cliente uuid, viagem uuid)
language plpgsql as $$
declare
  v_coleta uuid; v_descarga uuid; v_mot uuid; v_cav uuid; v_conj uuid; v_ped uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj, situacao_cadastro) values ('pj', 'Cliente Teste', '11222333000181', 'normal') returning id into cliente;
  insert into public.cliente (pessoa_id, tolerancia_quebra_pct) values (cliente, p_tolerancia);
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf) values (cliente, 'coleta_descarga', 'Curitiba', 'PR') returning id into v_coleta;
  insert into public.pessoa_endereco (pessoa_id, tipo, cidade, uf) values (cliente, 'coleta_descarga', 'Santos', 'SP') returning id into v_descarga;
  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro) values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into v_mot;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro) values (v_mot, 'e', tests.hoje() + 365, 'normal');
  insert into public.proprietario (pessoa_id) values (cliente);
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, situacao_cadastro, exercicio_doc)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), 7, cliente, cliente, 'normal', extract(year from tests.hoje())::int)
  returning id into v_cav;
  insert into public.conjunto (cavalo_id, motorista_id, inicio) values (v_cav, v_mot, now() - interval '3 days') returning id into v_conj;
  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id, produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 64000, 150) returning id into v_ped;
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, peso_saida_kg, peso_chegada_kg,
                             status_campo, status_desde, iniciada_em)
  values (v_ped, v_conj, v_cav, v_mot, 32000, 32000, 31740, 'aguardando_contagem', now() - interval '1 hour', now() - interval '28 hours')
  returning id into viagem;
  -- linha do tempo: carga de 7 h (1 h + 4 h esperando, 3 h carregando... 5 h + 2 h) e descarga de 6 h; pagamento (de = para) não conta
  insert into public.viagem_evento (viagem_id, de, para, em) values
    (viagem, null, 'transito', now() - interval '28 hours'),
    (viagem, 'transito', 'aguardando_carregamento', now() - interval '27 hours'),
    (viagem, 'aguardando_carregamento', 'em_carregamento', now() - interval '23 hours'),
    (viagem, 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '20 hours'),
    (viagem, 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '19 hours'),
    (viagem, 'aguardando_nf_pagamento', 'em_rota', now() - interval '18 hours'),
    (viagem, 'em_rota', 'aguardando_descarga', now() - interval '7 hours'),
    (viagem, 'aguardando_descarga', 'descarregando', now() - interval '3 hours'),
    (viagem, 'descarregando', 'aguardando_contagem', now() - interval '1 hour');
  return next;
end $$;

create function tests.test_quebra_do_motor() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  q jsonb;
begin
  select * into r from tests.cenario();
  perform tests.como(v_op);
  q := public.quebra_e_estadia(r.viagem);
  perform tests.como_servico();
  return next is((q ->> 'quebra_t')::numeric, 0.260, 'quebra de 0,26 t');
  return next is((q ->> 'quebra_pct')::numeric, 0.813, '0,813%');
  return next ok((q ->> 'divergente')::boolean, 'acima da tolerância de 0,3%: divergente');
  return next is((q ->> 'excedente_t')::numeric, 0.164, 'excedente de 0,164 t');
end $$;

create function tests.test_estadia_pela_linha_do_tempo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  r record;
  q jsonb;
begin
  select * into r from tests.cenario();
  q := public.quebra_e_estadia(r.viagem);
  return next is((q ->> 'horas_carga')::numeric, 7.00, 'carga: 4 h esperando + 3 h carregando');
  return next is((q ->> 'horas_descarga')::numeric, 6.00, 'descarga: 4 h esperando + 2 h descarregando');
  return next is((q ->> 'estadia_carga')::numeric, 88.32, 'carga: 2 h acima de 5 h × 32 t × R$ 1,38');
  return next is((q ->> 'estadia_descarga')::numeric, 44.16, 'descarga: 1 h acima × 32 t × R$ 1,38');
  return next is((q ->> 'cobrar_do_cliente')::numeric, 132.48, 'total a cobrar');
  return next is((q ->> 'repassar_ao_motorista')::numeric, 132.48, 'repasse de 100%');
end $$;

create function tests.test_dentro_da_tolerancia_e_sem_chegada() returns setof text language plpgsql as $$
declare
  r record;
  q jsonb;
begin
  select * into r from tests.cenario(1.0);
  q := public.quebra_e_estadia(r.viagem);
  return next ok(not (q ->> 'divergente')::boolean, 'com 1% de tolerância, 0,813% não é divergente');
  return next is((q ->> 'excedente_t')::numeric, 0.000, 'sem excedente');
  update public.viagem set peso_chegada_kg = null where id = r.viagem;
  q := public.quebra_e_estadia(r.viagem);
  return next ok(q -> 'quebra_t' = 'null'::jsonb and q -> 'divergente' = 'null'::jsonb, 'sem peso de chegada não há quebra');
end $$;

create function tests.test_quadro_traz_pesos_e_tolerancia() returns setof text language plpgsql as $$
declare
  r record;
begin
  select * into r from tests.cenario(0.25);
  return next ok((select peso_saida_kg = 32000 and peso_chegada_kg = 31740 and tolerancia_quebra_pct = 0.25
                  from public.v_quadro where viagem_id = r.viagem), 'v_quadro com os pesos e a tolerância do cliente');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
