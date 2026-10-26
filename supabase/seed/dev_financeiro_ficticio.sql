-- =============================================================================================
-- SÓ PARA O SUPABASE LOCAL (`supabase start` / `supabase db reset`). NUNCA RODAR NA NUVEM.
-- =============================================================================================
-- Contas a pagar e a receber fictícias para desenvolver e tirar prints (fase 1 do sistema do sócio).
-- Carregado depois de local_usuarios.sql (ordem de `[db.seed]` em supabase/config.toml): usa os usuários de
-- teste como quem lançou/aprovou/pagou. Datas relativas a hoje (Brasília), para a semente não envelhecer.
--
-- Ids fixos (para a limpeza): conta bancária ...1501; contas a pagar manuais ...1601 a ...1610; contas a
-- receber ...1701 a ...1706. O interruptor das parcelas do frete fica ligado aqui (em produção nasce desligado e o
-- admin liga na tela); as parcelas nascem sozinhas quando o frete é gravado nas viagens da seed.
-- Favorecidos e clientes são fictícios.

do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_admin uuid := 'e2e00000-0000-4000-8000-000000000001';
  v_fin uuid := 'e2e00000-0000-4000-8000-000000000004';
  v_conta uuid := '00000000-0000-4000-8000-000000001501';
  cc_fin smallint := (select id from public.centro_custo where codigo = '01.01');
  cc_patr smallint := (select id from public.centro_custo where codigo = '01.06');
  cc_ti smallint := (select id from public.centro_custo where codigo = '01.08');
  cc_traf smallint := (select id from public.centro_custo where codigo = '03.03');
  cc_viag smallint := (select id from public.centro_custo where codigo = '03.08');
  cc_risco smallint := (select id from public.centro_custo where codigo = '03.09');
  cc_receber smallint := (select id from public.centro_custo where codigo = '01.03');
begin
  if exists (select 1 from public.fin_pagar where id = '00000000-0000-4000-8000-000000001601') then
    return;
  end if;

  insert into public.fin_conta (id, banco, agencia, numero, apelido)
  values (v_conta, '998', '0001', '55555-0', 'Conta movimento (fictícia)')
  on conflict do nothing;

  -- Contas manuais lançadas pelo administrador de teste (o financeiro de teste aprova).
  insert into public.fin_pagar (id, descricao, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor,
                                lancado_por, observacao) values
    ('00000000-0000-4000-8000-000000001601', 'Aluguel do escritório', 'Imobiliária Horizonte (fictícia)', 33, cc_fin, 'boleto', v_hoje + 5, 4800.00, v_admin, null),
    ('00000000-0000-4000-8000-000000001602', 'Honorários do contador', 'Contabilidade Exemplo (fictícia)', 36, cc_fin, 'boleto', v_hoje - 3, 1650.00, v_admin, null),
    ('00000000-0000-4000-8000-000000001603', 'Energia elétrica', 'Energia Sul (fictícia)', 34, cc_patr, 'debito_automatico', v_hoje + 2, 612.40, v_admin, null),
    ('00000000-0000-4000-8000-000000001604', 'Internet e telefonia', 'Telecom Exemplo (fictícia)', 35, cc_ti, 'boleto', v_hoje + 12, 389.90, v_admin, null),
    ('00000000-0000-4000-8000-000000001605', 'Rastreamento da frota', 'Rastreio Fácil (fictício)', 35, cc_traf, 'pix', v_hoje - 10, 1200.00, v_admin, null),
    ('00000000-0000-4000-8000-000000001606', 'Material de escritório', 'Papelaria Central (fictícia)', 37, cc_fin, 'cartao_credito', v_hoje - 20, 254.30, v_admin, null),
    ('00000000-0000-4000-8000-000000001607', 'Manutenção do ar-condicionado', 'Clima Serviços (fictícia)', 38, cc_patr, 'pix', v_hoje + 20, 780.00, v_admin, 'Visita trimestral'),
    ('00000000-0000-4000-8000-000000001608', 'Averbações do seguro da carga', 'Seguradora Exemplo (fictícia)', 22, cc_viag, 'boleto', v_hoje + 8, 2140.75, v_admin, null),
    ('00000000-0000-4000-8000-000000001609', 'Consultas na gerenciadora de risco', 'Rota Segura GR (fictícia)', 23, cc_risco, 'boleto', v_hoje + 15, 480.00, v_admin, null),
    ('00000000-0000-4000-8000-000000001610', 'Aluguel do escritório', 'Imobiliária Horizonte (fictícia)', 33, cc_fin, 'boleto', v_hoje + 5, 4800.00, v_admin, null);

  update public.fin_pagar set aprovado_por = v_fin, aprovado_em = now() - interval '1 day'
   where id in ('00000000-0000-4000-8000-000000001603', '00000000-0000-4000-8000-000000001604',
                '00000000-0000-4000-8000-000000001605', '00000000-0000-4000-8000-000000001606',
                '00000000-0000-4000-8000-000000001608');
  update public.fin_pagar set pago_em = vencimento, pago_por = v_fin, pago_registrado_em = now(), conta_id = v_conta
   where id in ('00000000-0000-4000-8000-000000001605', '00000000-0000-4000-8000-000000001606');
  update public.fin_pagar set cancelado_em = now(), cancelado_por = v_fin, cancelamento_motivo = 'Lançada em dobro.'
   where id = '00000000-0000-4000-8000-000000001610';

  -- Frete do motorista nas viagens da seed (já começadas). A trava "frete só muda na viagem planejada" fica
  -- desligada só durante esta carga; as parcelas 70/30 nascem pela mesma função do gatilho da viagem.
  update public.fin_config
     set parcelas_frete_ativas = true, parcelas_frete_mudado_em = now(), parcelas_frete_mudado_por = v_admin
   where id = 1;
  update public.viagem set pagamento_pelo_financeiro = true
   where id in ('00000000-0000-4000-8000-000000001204', '00000000-0000-4000-8000-000000001205',
                '00000000-0000-4000-8000-000000001207', '00000000-0000-4000-8000-000000001208',
                '00000000-0000-4000-8000-000000001209');
  alter table public.viagem disable trigger frete_so_planejada;
  update public.viagem set frete_motorista_valor = 96, frete_motorista_tipo = 'por_tonelada', pedagio_valor = 418.60
   where id in ('00000000-0000-4000-8000-000000001204', '00000000-0000-4000-8000-000000001205',
                '00000000-0000-4000-8000-000000001207', '00000000-0000-4000-8000-000000001208');
  update public.viagem set frete_motorista_valor = 3450, frete_motorista_tipo = 'total', pedagio_valor = 289.20
   where id = '00000000-0000-4000-8000-000000001209';
  alter table public.viagem enable trigger frete_so_planejada;

  -- Adiantamentos: aprovados; os que já saíram (em rota ou depois) estão pagos, com a data do pagamento de saída.
  update public.fin_pagar set aprovado_por = v_fin, aprovado_em = now() - interval '2 days'
   where origem = 'frete_adiantamento'
     and viagem_id in ('00000000-0000-4000-8000-000000001204', '00000000-0000-4000-8000-000000001205',
                       '00000000-0000-4000-8000-000000001207', '00000000-0000-4000-8000-000000001208',
                       '00000000-0000-4000-8000-000000001209');
  update public.fin_pagar p
     set pago_em = v_hoje - 2, pago_por = v_admin, pago_registrado_em = now(), vencimento = v_hoje - 2
   where p.origem = 'frete_adiantamento'
     and p.viagem_id in ('00000000-0000-4000-8000-000000001205', '00000000-0000-4000-8000-000000001207',
                         '00000000-0000-4000-8000-000000001208', '00000000-0000-4000-8000-000000001209');
  update public.viagem set pagamento_saida_em = coalesce(pagamento_saida_em, now() - interval '2 days'),
                           pagamento_saida_por = coalesce(pagamento_saida_por, v_admin)
   where id in ('00000000-0000-4000-8000-000000001205', '00000000-0000-4000-8000-000000001207',
                '00000000-0000-4000-8000-000000001208', '00000000-0000-4000-8000-000000001209');

  -- Saldos: um aprovado esperando a entrega conferida, um vencido sem aprovação.
  update public.fin_pagar set aprovado_por = v_fin, aprovado_em = now() - interval '1 day', vencimento = v_hoje + 1
   where origem = 'frete_saldo' and viagem_id = '00000000-0000-4000-8000-000000001208';
  update public.fin_pagar set vencimento = v_hoje - 1
   where origem = 'frete_saldo' and viagem_id = '00000000-0000-4000-8000-000000001209';

  -- Contas a receber dos clientes da seed.
  insert into public.fin_receber (id, cliente_id, titulo, plano_id, centro_custo_id, forma, vencimento, valor, lancado_por) values
    ('00000000-0000-4000-8000-000000001701', '00000000-0000-4000-8000-000000000113', 'CT-e 1001', 1, cc_receber, 'boleto', v_hoje + 12, 18450.00, v_admin),
    ('00000000-0000-4000-8000-000000001702', '00000000-0000-4000-8000-000000000113', 'CT-e 1002', 1, cc_receber, 'boleto', v_hoje + 25, 22300.00, v_admin),
    ('00000000-0000-4000-8000-000000001703', '00000000-0000-4000-8000-000000000114', 'CT-e 998', 1, cc_receber, 'pix', v_hoje - 4, 9870.50, v_admin),
    ('00000000-0000-4000-8000-000000001704', '00000000-0000-4000-8000-000000000114', 'CT-e 995', 1, cc_receber, 'boleto', v_hoje - 15, 12640.00, v_admin),
    ('00000000-0000-4000-8000-000000001705', '00000000-0000-4000-8000-000000000113', 'CT-e 1003', 1, cc_receber, 'boleto', v_hoje + 40, 15900.00, v_admin),
    ('00000000-0000-4000-8000-000000001706', '00000000-0000-4000-8000-000000000114', 'CT-e 1004', 1, cc_receber, 'transferencia', v_hoje + 6, 7425.80, v_admin);
  update public.fin_receber set recebido_em = v_hoje - 14, recebido_por = v_fin, recebido_registrado_em = now(), conta_id = v_conta
   where id = '00000000-0000-4000-8000-000000001704';
end $$;
