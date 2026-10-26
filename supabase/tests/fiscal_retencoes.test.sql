-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Retenções do frete pago a autônomo PF e guias do mês (migration 20261031000100).
-- Só documentos fictícios (CNPJ 11222333000181, CPF 11144477735 e 52998224725) e placas TST….

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

-- Cliente PJ, motorista PF que é dono do cavalo (TAC PF) e um pedido; devolve o necessário para criar viagens.
create function tests.cenario()
returns table (cliente uuid, motorista uuid, cavalo uuid, conjunto uuid, pedido uuid)
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
  values (cliente, 'coleta_descarga', 'Campo Grande', 'MS') returning id into v_descarga;

  insert into public.pessoa (tipo, nome, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', '11144477735', 'normal') returning id into motorista;
  insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade)
  values (motorista, 'e', tests.hoje() + 365, 'normal', 'habilitado', tests.hoje() + 180);

  cavalo := tests.novo_veiculo(7, motorista);
  insert into public.conjunto (cavalo_id, motorista_id, inicio, aprovado_em)
  values (cavalo, motorista, now() - interval '1 day', now()) returning id into conjunto;

  insert into public.pedido (tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id,
                             produto, peso_total_kg, frete_empresa_valor)
  values (cliente, cliente, cliente, v_coleta, v_descarga, 'Soja', 74000, 150)
  returning id into pedido;
  return next;
end $$;

-- Viagem finalizada em p_quando com frete total p_frete.
create function tests.viagem_finalizada(r record, p_frete numeric, p_quando timestamptz, p_cte text default null)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                             frete_motorista_valor, frete_motorista_tipo)
  values (r.pedido, r.conjunto, r.cavalo, r.motorista, 37000, p_frete, 'total')
  returning id into v_id;
  update public.viagem set finalizada_em = p_quando, chave_cte = p_cte where id = v_id;
  return v_id;
end $$;

-- Retenções do mês vistas pelo usuário, como jsonb (o pgTAP não roda com o papel authenticated).
create function tests.retencoes_como(p_uid uuid, p_comp date) returns jsonb language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format(
    $q$select set_config('tests.r', coalesce((select jsonb_agg(to_jsonb(x)) from public.fiscal_retencoes(%L) x), '[]')::text, true)$q$,
    p_comp));
  return current_setting('tests.r')::jsonb;
end $$;

create function tests.test_vencimento() returns setof text language plpgsql as $$
begin
  return next is(public.fiscal_vencimento_guia('2026-10-01'), '2026-11-20'::date, 'outubro vence em 20/11 (sexta)');
  return next is(public.fiscal_vencimento_guia('2026-08-15'), '2026-09-18'::date, '20/09/2026 é domingo: antecipa para sexta 18');
  return next is(public.fiscal_vencimento_guia('2026-05-01'), '2026-06-19'::date, '20/06/2026 é sábado: antecipa para sexta 19');
end $$;

create function tests.test_retencoes_do_mes() returns setof text language plpgsql as $$
declare
  r record;
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_cancelada uuid;
  v_r jsonb;
  l record;
begin
  select * into r from tests.cenario();
  perform tests.viagem_finalizada(r, 8432, '2026-10-24 15:00-03',
    '41261011222333000181570010000001261000001268');
  perform tests.viagem_finalizada(r, 6390, '2026-10-01 01:00-03');
  perform tests.viagem_finalizada(r, 5000, '2026-09-30 23:30-03');           -- setembro (Brasília)
  v_cancelada := tests.viagem_finalizada(r, 9000, '2026-10-10 10:00-03');
  update public.viagem set cancelada_em = now() where id = v_cancelada;

  v_r := tests.retencoes_como(v_fin, '2026-10-15');
  return next is(jsonb_array_length(v_r), 2, 'só as finalizadas em outubro (Brasília) e não canceladas');
  select * into l from jsonb_to_recordset(v_r) as x(frete numeric, base numeric, inss numeric, sest numeric, senat numeric,
    patronal numeric, base_irrf numeric, cte_numero int, contratado_cpf text) where frete = 8432;
  return next is(l.base, 1686.40, 'base = 20% do frete');
  return next is(l.inss, 185.50, 'INSS 11% da base, arredondado');
  return next is(l.sest, 25.30, 'SEST 1,5%');
  return next is(l.senat, 16.86, 'SENAT 1,0%');
  return next is(l.patronal, 337.28, 'patronal 20% da base');
  return next is(l.base_irrf, 843.20, 'base do IRRF = 10% do frete');
  return next is(l.cte_numero, 126, 'número do CT-e sai da chave');
  return next is(l.contratado_cpf, '11144477735', 'contratado = proprietário do cavalo');
end $$;

create function tests.test_contratado_pj_fica_fora() returns setof text language plpgsql as $$
declare
  r record;
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
begin
  select * into r from tests.cenario();
  insert into public.proprietario (pessoa_id) values (r.cliente) on conflict do nothing;
  update public.veiculo set proprietario_documento_id = r.cliente where id = r.cavalo;
  perform tests.viagem_finalizada(r, 8432, '2026-10-24 15:00-03');
  return next is(jsonb_array_length(tests.retencoes_como(v_fin, '2026-10-01')), 0, 'contratado PJ não tem retenção');
end $$;

create function tests.test_acesso() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  insert into public.fiscal_guia (competencia, tipo, valor, vencimento) values ('2026-10-01', 'inss', 10, '2026-11-20');
  return next throws_ok(format($q$select tests.retencoes_como(%L, '2026-10-01')$q$, v_op), '42501', null,
    'operação não vê as retenções');
  return next throws_ok(format($q$select tests.executar_como(%L, 'select public.fiscal_gerar_guias(''2026-10-01'')')$q$, v_op),
    '42501', null, 'operação não gera guias');
  perform tests.executar_como(v_op, $q$select set_config('tests.r', (select count(*) from public.fiscal_guia)::text, true)$q$);
  return next is(current_setting('tests.r'), '0', 'operação não lê guias');
end $$;

create function tests.test_gerar_guias() returns setof text language plpgsql as $$
declare
  r record;
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_guia uuid;
begin
  select * into r from tests.cenario();
  perform tests.viagem_finalizada(r, 8432, '2026-10-24 15:00-03');
  perform tests.viagem_finalizada(r, 6390, '2026-10-21 15:00-03');

  perform tests.executar_como(v_fin, $q$select public.fiscal_gerar_guias('2026-10-01')$q$);
  return next is((select valor from public.fiscal_guia where competencia = '2026-10-01' and tipo = 'inss'),
    185.50 + 337.28 + 140.58 + 255.60, 'guia do INSS = retido + patronal');
  return next is((select valor from public.fiscal_guia where competencia = '2026-10-01' and tipo = 'sest_senat'),
    25.30 + 16.86 + 19.17 + 12.78, 'guia do SEST/SENAT');
  return next is((select vencimento from public.fiscal_guia where tipo = 'inss'), '2026-11-20'::date, 'vence dia 20');

  perform tests.viagem_finalizada(r, 4610, '2026-10-18 15:00-03');
  perform tests.executar_como(v_fin, $q$select public.fiscal_gerar_guias('2026-10-01')$q$);
  return next is((select count(*)::int from public.fiscal_guia), 2, 'gerar de novo não duplica');
  return next is((select valor from public.fiscal_guia where tipo = 'inss'),
    185.50 + 337.28 + 140.58 + 255.60 + 101.42 + 184.40, 'gerar de novo atualiza o valor');

  select id into v_guia from public.fiscal_guia where tipo = 'inss';
  perform tests.executar_como(v_fin, format($q$select public.fiscal_marcar_guia(%L, '2026-11-19')$q$, v_guia));
  return next is((select paga_em from public.fiscal_guia where id = v_guia), '2026-11-19'::date, 'guia marcada como paga');
  return next throws_ok(format($q$select tests.executar_como(%L, 'select public.fiscal_gerar_guias(''2026-10-01'')')$q$, v_fin),
    null, null, 'com guia paga, não gera de novo');
  return next ok((select count(*) from public.auditoria where tabela = 'fiscal_guia') >= 2, 'guias vão para a auditoria');

  return next throws_ok(format($q$select tests.executar_como(%L, 'select public.fiscal_gerar_guias(''2026-09-01'')')$q$, v_fin),
    null, null, 'mês sem retenção não gera guia');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
