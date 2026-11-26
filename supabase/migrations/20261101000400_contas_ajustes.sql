-- Migration 20261101000400: ajustes do contas a pagar depois da revisão da fase 1 (migrations 0200 e 0300).
--
-- 1. Gatilho das parcelas do frete: só sincroniza quando o frete, o peso, o pedágio, o veículo, o motorista ou o
--    cancelamento mudaram de verdade. O gatilho antigo (`update of peso_saida_kg, …`) disparava em toda passagem
--    do Quadro, porque mover_viagem sempre põe peso_saida_kg no `set`, e podia recusar a passagem.
-- 2. Parcela do frete que o banco ainda não deixa pagar não conta como vencida: o adiantamento espera o embarque
--    (peso de saída) e o saldo espera a entrega conferida (ou a antecipação liberada). v_fin_pagar ganha a
--    coluna aguarda_viagem ('embarque', 'entrega' ou nulo) e viagem_parcelas devolve a mesma informação.
-- 3. Taxa do cartão-frete: a conta cancelada deixa de travar o mês (dá para lançar de novo).
-- 4. fin_desaprovar_pagar recusa a conta cancelada, como as outras funções.

-- ---------------------------------------------------------------------------
-- 1. Gatilho das parcelas: um para a viagem nova, outro para a viagem que mudou
-- ---------------------------------------------------------------------------
drop trigger trg_viagem_parcelas on public.viagem;

create trigger trg_viagem_parcelas_incluir
  after insert on public.viagem
  for each row execute function public.fn_viagem_parcelas();

create trigger trg_viagem_parcelas_alterar
  after update on public.viagem
  for each row
  when ((old.frete_motorista_valor, old.frete_motorista_tipo, old.pedagio_valor, old.peso_previsto_kg, old.peso_saida_kg,
         old.cavalo_id, old.motorista_id, old.cancelada_em, old.pagamento_pelo_financeiro)
        is distinct from
        (new.frete_motorista_valor, new.frete_motorista_tipo, new.pedagio_valor, new.peso_previsto_kg, new.peso_saida_kg,
         new.cavalo_id, new.motorista_id, new.cancelada_em, new.pagamento_pelo_financeiro))
  execute function public.fn_viagem_parcelas();

-- ---------------------------------------------------------------------------
-- 2. Vencida só a conta que já pode ser paga
-- ---------------------------------------------------------------------------
-- Mesmas condições de fin_pagar_conta (migration 0300). As colunas de antes ficam na mesma ordem; a nova, no fim.
create or replace view public.v_fin_pagar
with (security_invoker = true) as
select
  p.*,
  pl.nome as plano_nome,
  pl.grupo as plano_grupo,
  cc.codigo as centro_codigo,
  cc.nome as centro_nome,
  vi.numero as viagem_numero,
  (p.pago_em is null and p.cancelado_em is null) as aberta,
  (p.pago_em is null and p.cancelado_em is null and p.vencimento < public.hoje_brasilia() and esp.aguarda is null) as vencida,
  case
    when p.cancelado_em is not null then 'cancelada'
    when p.pago_em is not null then 'paga'
    when p.aprovado_em is null then 'falta_aprovar'
    when p.vencimento < public.hoje_brasilia() and esp.aguarda is null then 'vencida'
    else 'a_vencer'
  end as situacao,
  esp.aguarda as aguarda_viagem
from public.fin_pagar p
join public.fin_plano_conta pl on pl.id = p.plano_id
join public.centro_custo cc on cc.id = p.centro_custo_id
left join public.viagem vi on vi.id = p.viagem_id
cross join lateral (
  select case
    when p.pago_em is not null or p.cancelado_em is not null then null
    when p.origem = 'frete_adiantamento' and vi.peso_saida_kg is null then 'embarque'
    when p.origem = 'frete_saldo' and p.antecipacao_liberada_em is null
         and vi.status_campo is distinct from 'aguardando_saldo' and vi.finalizada_em is null then 'entrega'
  end as aguarda
) esp;

comment on column public.v_fin_pagar.aguarda_viagem is
  'Parcela do frete em aberto que o banco ainda não deixa pagar: embarque (adiantamento sem peso de saída) ou entrega (saldo sem a entrega conferida nem antecipação). Não conta como vencida.';

-- viagem_parcelas ganha a coluna (o tipo de retorno muda: recria).
drop function public.viagem_parcelas(uuid);

create function public.viagem_parcelas(p_viagem uuid)
returns table (
  origem text,
  numero bigint,
  valor numeric,
  parte_pedagio numeric,
  parte_retencao numeric,
  vencimento date,
  situacao text,
  pago_em date,
  antecipacao_liberada boolean,
  aguarda_viagem text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.origem, p.numero, p.valor, p.parte_pedagio, p.parte_retencao, p.vencimento, p.situacao, p.pago_em,
         p.antecipacao_liberada_em is not null, p.aguarda_viagem
  from public.v_fin_pagar p
  where p.viagem_id = p_viagem
    and (select public.pode_ler())
  order by p.origem
$$;

comment on function public.viagem_parcelas(uuid) is
  'Parcelas do frete da viagem (adiantamento e saldo) para quem lê viagens. security definer: passa por cima do RLS do financeiro só para estas duas linhas.';

revoke execute on function public.viagem_parcelas(uuid) from public, anon;
grant execute on function public.viagem_parcelas(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Taxa do cartão-frete: a conta cancelada não trava o mês
-- ---------------------------------------------------------------------------
drop index public.fin_pagar_taxa_uq;
create unique index fin_pagar_taxa_uq on public.fin_pagar (competencia) where origem = 'taxa_cartao' and cancelado_em is null;

-- Corpo da migration 0200; a conta do mês é a que não foi cancelada.
create or replace function public.fin_taxa_cartao(p_mes date)
returns table (
  total_pago numeric,
  pagamentos integer,
  pct numeric,
  por_transferencia numeric,
  valor_pct numeric,
  valor_transferencias numeric,
  taxa numeric,
  conta_id uuid,
  conta_numero bigint,
  conta_valor numeric,
  conta_situacao text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro veem a taxa do cartão-frete.' using errcode = '42501';
  end if;
  return query
  with pg as (
    select coalesce(sum(p.valor), 0)::numeric as total, count(*)::integer as qtd
    from public.fin_pagar p
    where p.forma = 'cartao_frete' and p.origem <> 'taxa_cartao' and p.cancelado_em is null
      and p.pago_em >= v_ini and p.pago_em < v_fim
  ),
  par as (
    select pf.pan_card_pct, pf.pan_card_transferencia
    from public.parametro_fiscal pf
    where pf.vigencia_inicio < v_fim
    order by pf.vigencia_inicio desc
    limit 1
  ),
  cta as (
    select v.id, v.numero, v.valor, v.situacao
    from public.v_fin_pagar v
    where v.origem = 'taxa_cartao' and v.competencia = v_ini and v.cancelado_em is null
  )
  select pg.total, pg.qtd, par.pan_card_pct, par.pan_card_transferencia,
         round(pg.total * par.pan_card_pct, 2),
         round(pg.qtd * par.pan_card_transferencia, 2),
         round(pg.total * par.pan_card_pct, 2) + round(pg.qtd * par.pan_card_transferencia, 2),
         cta.id, cta.numero, cta.valor, cta.situacao
  from pg
  left join par on true
  left join cta on true;
end $$;

-- Corpo da migration 0200; a conta cancelada não conta: nasce outra.
create or replace function public.fin_lancar_taxa_cartao(p_mes date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  t record;
  c public.fin_pagar%rowtype;
  v_id uuid;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro lançam a taxa do cartão-frete.' using errcode = '42501';
  end if;
  if p_mes is null or v_ini > date_trunc('month', public.hoje_brasilia())::date then
    raise exception 'Escolha um mês que já começou.';
  end if;
  select * into t from public.fin_taxa_cartao(v_ini);
  if t.taxa is null or t.total_pago = 0 then
    raise exception 'Nada foi pago pelo cartão-frete em %.', public.nome_mes(v_ini);
  end if;

  select * into c from public.fin_pagar
   where origem = 'taxa_cartao' and competencia = v_ini and cancelado_em is null for update;
  if found then
    if c.pago_em is not null then
      raise exception 'A taxa de % já foi paga (conta %).', public.nome_mes(v_ini), c.numero;
    end if;
    if c.aprovado_em is not null then
      raise exception 'A taxa de % já foi aprovada (conta %): para mudar o valor, desfaça a aprovação.', public.nome_mes(v_ini), c.numero;
    end if;
    update public.fin_pagar set valor = t.taxa, editado_por = auth.uid() where id = c.id;
    return c.id;
  end if;

  insert into public.fin_pagar (origem, competencia, descricao, favorecido_nome, plano_id, centro_custo_id, forma,
                                vencimento, valor, lancado_por)
  values ('taxa_cartao', v_ini, 'Taxa do cartão-frete de ' || public.nome_mes(v_ini), 'Pan Card (cartão-frete)', 51,
          (select id from public.centro_custo where codigo = '01.01'), 'boleto',
          (v_ini + interval '1 month' + interval '9 days')::date, t.taxa, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Desfazer a aprovação: conta cancelada não muda mais
-- ---------------------------------------------------------------------------
-- Corpo da migration 0200 + a conferência do cancelamento.
create or replace function public.fin_desaprovar_pagar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro mexem nas contas a pagar.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.cancelado_em is not null then
    raise exception 'Esta conta foi cancelada e não muda mais.';
  end if;
  if c.pago_em is not null then
    raise exception 'Esta conta já foi paga: desfaça o pagamento antes.';
  end if;
  if c.aprovado_em is null then
    raise exception 'Esta conta ainda não foi aprovada.';
  end if;
  if c.aprovado_por is distinct from auth.uid() and not public.eh_admin() then
    raise exception 'Só quem aprovou (ou o administrador) desfaz a aprovação.';
  end if;
  update public.fin_pagar set aprovado_por = null, aprovado_em = null where id = p_id;
end $$;
