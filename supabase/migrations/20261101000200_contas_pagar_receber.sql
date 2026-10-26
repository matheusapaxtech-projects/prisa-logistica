-- Migration 20261101000200: contas a pagar e a receber (fase 1 do sistema do sócio).
--
-- fin_pagar    conta a pagar. Regras do sócio, impostas aqui e não só na tela:
--              * quem lança não aprova (nem quem alterou a conta por último): fin_aprovar_pagar;
--              * sem aprovação o banco recusa o pagamento: fin_pagar_conta;
--              * aprovação, pagamento e cancelamento só mudam pelas funções (sem grant nessas colunas);
--              * conta aprovada, paga ou cancelada não se edita (para corrigir, desfaz a aprovação);
--              * sem exclusão: cancela com motivo. Desfazer pagamento é só do admin.
--              origem: manual (tela), frete_adiantamento e frete_saldo (parcelas da viagem, migration 0300) e
--              taxa_cartao (taxa mensal do cartão-frete). As geradas pelo NILT só mudam forma, centro e observação.
-- fin_receber  conta a receber (título). Lançar, receber, desfazer e cancelar; a fase 2 traz a antecipação no
--              fomento e a fase 5 o título gerado pelo CT-e.
-- v_fin_pagar / v_fin_receber  as contas com a situação do dia (Brasília) e os nomes para a tela.
-- fin_taxa_cartao / fin_lancar_taxa_cartao  taxa do cartão-frete (Pan Card) do mês: pan_card_pct sobre o pago com
--              a forma cartão-frete + pan_card_transferencia por pagamento (parametro_fiscal vigente).
-- fin_indicadores_contas  números do topo das telas (e do painel da tesouraria na fase 2).
--
-- Acesso: admin e financeiro (pode_financeiro()). A operação não vê.
-- Quem chama pela API é o papel authenticated; as funções security definer gravam como postgres. Os gatilhos de
-- proteção usam isso para saber se a mudança veio da tela (current_user = authenticated) ou de uma função.

-- ---------------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------------
create function public.hoje_brasilia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

revoke execute on function public.hoje_brasilia() from public, anon;
grant execute on function public.hoje_brasilia() to authenticated;

-- "outubro de 2026"
create function public.nome_mes(p date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
                'novembro', 'dezembro'])[extract(month from p)::int] || ' de ' || extract(year from p)::int
$$;

revoke execute on function public.nome_mes(date) from public, anon;
grant execute on function public.nome_mes(date) to authenticated;

create type public.fin_forma as enum (
  'pix',
  'boleto',
  'transferencia',
  'cartao_frete',
  'cartao_credito',
  'debito_automatico',
  'dinheiro',
  'outro'
);

create function public.rotulo_forma(p public.fin_forma)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'pix' then 'Pix'
    when 'boleto' then 'Boleto'
    when 'transferencia' then 'Transferência'
    when 'cartao_frete' then 'Cartão-frete'
    when 'cartao_credito' then 'Cartão de crédito'
    when 'debito_automatico' then 'Débito automático'
    when 'dinheiro' then 'Dinheiro'
    else 'Outro'
  end
$$;

revoke execute on function public.rotulo_forma(public.fin_forma) from public, anon;
grant execute on function public.rotulo_forma(public.fin_forma) to authenticated;

-- Tipo (plano de contas) ativo e da natureza certa; centro de custo ativo. Usado pelos gatilhos no que vem da tela.
create function public.fin_conferir_classificacao(p_plano integer, p_centro smallint, p_saida boolean)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (select 1 from public.fin_plano_conta pl
                 where pl.id = p_plano and pl.ativo and (case when p_saida then pl.saida else pl.entrada end)) then
    raise exception 'Escolha um tipo de % ativo.', case when p_saida then 'despesa' else 'receita' end;
  end if;
  if not exists (select 1 from public.centro_custo c where c.id = p_centro and c.ativo) then
    raise exception 'O centro de custo escolhido está desativado. Escolha outro.';
  end if;
end $$;

revoke execute on function public.fin_conferir_classificacao(integer, smallint, boolean) from public, anon;
grant execute on function public.fin_conferir_classificacao(integer, smallint, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Contas a pagar
-- ---------------------------------------------------------------------------
create table public.fin_pagar (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  origem text not null default 'manual',
  descricao text not null,
  favorecido_id uuid references public.pessoa (id) on delete set null,
  favorecido_nome text not null,
  plano_id integer not null references public.fin_plano_conta (id),
  centro_custo_id smallint not null references public.centro_custo (id),
  forma public.fin_forma not null,
  vencimento date not null,
  valor numeric(14, 2) not null,
  parte_pedagio numeric(14, 2) not null default 0,
  observacao text,
  viagem_id uuid references public.viagem (id) on delete restrict,
  competencia date,
  lancado_por uuid default auth.uid(),
  editado_por uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  pago_em date,
  pago_por uuid,
  pago_registrado_em timestamptz,
  conta_id uuid references public.fin_conta (id) on delete restrict,
  antecipacao_liberada_por uuid,
  antecipacao_liberada_em timestamptz,
  antecipacao_motivo text,
  cancelado_em timestamptz,
  cancelado_por uuid,
  cancelamento_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint fin_pagar_origem check (origem in ('manual', 'frete_adiantamento', 'frete_saldo', 'taxa_cartao')),
  constraint fin_pagar_descricao check (length(btrim(descricao)) between 1 and 200),
  constraint fin_pagar_favorecido check (length(btrim(favorecido_nome)) between 1 and 160),
  constraint fin_pagar_valor check (valor > 0 and valor < 1000000000),
  constraint fin_pagar_pedagio check (parte_pedagio >= 0 and parte_pedagio <= valor),
  constraint fin_pagar_observacao check (observacao is null or length(observacao) <= 500),
  constraint fin_pagar_viagem check ((origem in ('frete_adiantamento', 'frete_saldo')) = (viagem_id is not null)),
  constraint fin_pagar_competencia check ((origem = 'taxa_cartao') = (competencia is not null)),
  constraint fin_pagar_competencia_mes check (competencia is null or competencia = date_trunc('month', competencia)::date),
  constraint fin_pagar_pago_aprovado check (pago_em is null or aprovado_em is not null),
  constraint fin_pagar_pago_cancelado check (pago_em is null or cancelado_em is null),
  constraint fin_pagar_cancelamento check ((cancelado_em is null) = (cancelamento_motivo is null)),
  constraint fin_pagar_antecipacao check (antecipacao_liberada_em is null or origem = 'frete_saldo'),
  constraint fin_pagar_antecipacao_motivo check ((antecipacao_liberada_em is null) = (antecipacao_motivo is null))
);

comment on table public.fin_pagar is
  'Contas a pagar. Quem lança não aprova; sem aprovação o pagamento é recusado; sem exclusão (cancela).';

create unique index fin_pagar_viagem_origem_uq on public.fin_pagar (viagem_id, origem) where viagem_id is not null;
create unique index fin_pagar_taxa_uq on public.fin_pagar (competencia) where origem = 'taxa_cartao';
create index fin_pagar_aberta_vencimento_idx on public.fin_pagar (vencimento) where pago_em is null and cancelado_em is null;
create index fin_pagar_pago_em_idx on public.fin_pagar (pago_em) where pago_em is not null;
create index fin_pagar_favorecido_idx on public.fin_pagar (favorecido_id);
create index fin_pagar_plano_idx on public.fin_pagar (plano_id);
create index fin_pagar_centro_idx on public.fin_pagar (centro_custo_id);
create index fin_pagar_conta_idx on public.fin_pagar (conta_id);

-- Da tela (papel authenticated): só a conta manual nasce, com tipo e centro ativos, em nome de quem lançou; aprovada,
-- paga ou cancelada não muda; a gerada pelo NILT só muda forma, centro e observação. Das funções: livre.
create function public.fn_fin_pagar_protege()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tela boolean := current_user in ('authenticated', 'anon');
begin
  new.descricao := btrim(new.descricao);
  new.favorecido_nome := btrim(new.favorecido_nome);
  new.observacao := nullif(btrim(new.observacao), '');
  if not v_tela then
    return new;
  end if;

  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro lançam contas a pagar.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.lancado_por := auth.uid();
    perform public.fin_conferir_classificacao(new.plano_id, new.centro_custo_id, true);
    return new;
  end if;

  if old.cancelado_em is not null then
    raise exception 'Esta conta foi cancelada e não muda mais.';
  end if;
  if old.pago_em is not null then
    raise exception 'Esta conta já foi paga e não muda mais.';
  end if;
  if old.aprovado_em is not null then
    raise exception 'Esta conta já foi aprovada. Para mudar, desfaça a aprovação primeiro.';
  end if;
  if old.origem <> 'manual'
     and (new.descricao, new.favorecido_id, new.favorecido_nome, new.plano_id, new.vencimento, new.valor)
         is distinct from (old.descricao, old.favorecido_id, old.favorecido_nome, old.plano_id, old.vencimento, old.valor) then
    raise exception 'Esta conta é gerada pelo NILT: só a forma de pagamento, o centro de custo e a observação mudam.';
  end if;
  if (new.plano_id, new.centro_custo_id) is distinct from (old.plano_id, old.centro_custo_id) then
    perform public.fin_conferir_classificacao(new.plano_id, new.centro_custo_id, true);
  end if;
  new.editado_por := auth.uid();
  return new;
end $$;

revoke execute on function public.fn_fin_pagar_protege() from public, anon, authenticated;

create trigger fin_pagar_protege
  before insert or update on public.fin_pagar
  for each row execute function public.fn_fin_pagar_protege();

create trigger fin_pagar_set_updated_at
  before update on public.fin_pagar
  for each row execute function public.fn_set_updated_at();

-- Privilégios: a tela grava só as colunas do formulário; o resto, pelas funções.
revoke insert, update, delete, truncate, references, trigger on public.fin_pagar from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.fin_pagar from anon;
grant select on public.fin_pagar to authenticated;
grant insert (descricao, favorecido_id, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor, observacao)
  on public.fin_pagar to authenticated;
grant update (descricao, favorecido_id, favorecido_nome, plano_id, centro_custo_id, forma, vencimento, valor, observacao)
  on public.fin_pagar to authenticated;

alter table public.fin_pagar enable row level security;

create policy fin_pagar_ver on public.fin_pagar
  for select to authenticated using ((select public.pode_financeiro()));
create policy fin_pagar_incluir on public.fin_pagar
  for insert to authenticated
  with check ((select public.pode_financeiro()) and origem = 'manual' and lancado_por = (select auth.uid()));
create policy fin_pagar_alterar on public.fin_pagar
  for update to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));

select public.auditar('public.fin_pagar');

create view public.v_fin_pagar
with (security_invoker = true) as
select
  p.*,
  pl.nome as plano_nome,
  pl.grupo as plano_grupo,
  cc.codigo as centro_codigo,
  cc.nome as centro_nome,
  vi.numero as viagem_numero,
  (p.pago_em is null and p.cancelado_em is null) as aberta,
  (p.pago_em is null and p.cancelado_em is null and p.vencimento < public.hoje_brasilia()) as vencida,
  case
    when p.cancelado_em is not null then 'cancelada'
    when p.pago_em is not null then 'paga'
    when p.vencimento < public.hoje_brasilia() then 'vencida'
    when p.aprovado_em is null then 'falta_aprovar'
    else 'a_vencer'
  end as situacao
from public.fin_pagar p
join public.fin_plano_conta pl on pl.id = p.plano_id
join public.centro_custo cc on cc.id = p.centro_custo_id
left join public.viagem vi on vi.id = p.viagem_id;

revoke all on public.v_fin_pagar from anon;
grant select on public.v_fin_pagar to authenticated;

-- ---------------------------------------------------------------------------
-- Aprovar e desfazer a aprovação
-- ---------------------------------------------------------------------------
create function public.fin_aprovar_pagar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
  v_uid uuid := auth.uid();
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro aprovam contas a pagar.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.cancelado_em is not null then
    raise exception 'Esta conta foi cancelada.';
  end if;
  if c.pago_em is not null then
    raise exception 'Esta conta já foi paga.';
  end if;
  if c.aprovado_em is not null then
    raise exception 'Esta conta já está aprovada.';
  end if;
  if v_uid = c.lancado_por then
    raise exception 'Quem lançou a conta não pode aprová-la: peça a outra pessoa do financeiro ou ao administrador.';
  end if;
  if v_uid = c.editado_por then
    raise exception 'Você alterou esta conta: outra pessoa precisa aprová-la.';
  end if;
  update public.fin_pagar set aprovado_por = v_uid, aprovado_em = now() where id = p_id;
end $$;

revoke execute on function public.fin_aprovar_pagar(uuid) from public, anon;
grant execute on function public.fin_aprovar_pagar(uuid) to authenticated;

create function public.fin_desaprovar_pagar(p_id uuid)
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

revoke execute on function public.fin_desaprovar_pagar(uuid) from public, anon;
grant execute on function public.fin_desaprovar_pagar(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pagar e desfazer o pagamento (as parcelas do frete marcam a viagem: ver a migration 0300, que substitui estas
-- duas funções com a parte da viagem)
-- ---------------------------------------------------------------------------
create function public.fin_pagar_conta(p_id uuid, p_data date, p_conta uuid default null, p_forma public.fin_forma default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro pagam contas.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.cancelado_em is not null then
    raise exception 'Esta conta foi cancelada.';
  end if;
  if c.pago_em is not null then
    raise exception 'Esta conta já foi paga.';
  end if;
  if c.aprovado_em is null then
    raise exception 'Sem aprovação o pagamento é recusado: outra pessoa precisa aprovar esta conta antes.';
  end if;
  if p_data is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if p_data > public.hoje_brasilia() then
    raise exception 'A data do pagamento não pode ser depois de hoje.';
  end if;
  if p_conta is not null and not exists (select 1 from public.fin_conta where id = p_conta) then
    raise exception 'Conta bancária não encontrada. Atualize a página.';
  end if;
  update public.fin_pagar
     set pago_em = p_data, pago_por = auth.uid(), pago_registrado_em = now(), conta_id = p_conta,
         forma = coalesce(p_forma, forma)
   where id = p_id;
end $$;

revoke execute on function public.fin_pagar_conta(uuid, date, uuid, public.fin_forma) from public, anon;
grant execute on function public.fin_pagar_conta(uuid, date, uuid, public.fin_forma) to authenticated;

create function public.fin_desfazer_pagamento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'Só o administrador desfaz um pagamento.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.pago_em is null then
    raise exception 'Esta conta não está paga.';
  end if;
  update public.fin_pagar
     set pago_em = null, pago_por = null, pago_registrado_em = null, conta_id = null
   where id = p_id;
end $$;

revoke execute on function public.fin_desfazer_pagamento(uuid) from public, anon;
grant execute on function public.fin_desfazer_pagamento(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelar e liberar a antecipação do saldo
-- ---------------------------------------------------------------------------
create function public.fin_cancelar_pagar(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro cancelam contas a pagar.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.cancelado_em is not null then
    raise exception 'Esta conta já foi cancelada.';
  end if;
  if c.pago_em is not null then
    raise exception 'Esta conta já foi paga: desfaça o pagamento antes de cancelar.';
  end if;
  if c.origem in ('frete_adiantamento', 'frete_saldo') and not public.eh_admin() then
    raise exception 'Só o administrador cancela uma parcela do frete do motorista.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Diga o motivo do cancelamento.';
  end if;
  update public.fin_pagar
     set cancelado_em = now(), cancelado_por = auth.uid(), cancelamento_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
end $$;

revoke execute on function public.fin_cancelar_pagar(uuid, text) from public, anon;
grant execute on function public.fin_cancelar_pagar(uuid, text) to authenticated;

create function public.fin_liberar_antecipacao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'Só o administrador libera a antecipação do saldo.' using errcode = '42501';
  end if;
  select * into c from public.fin_pagar where id = p_id for update;
  if not found then
    raise exception 'Conta não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if c.origem <> 'frete_saldo' then
    raise exception 'Só o saldo do frete (30%%) tem antecipação.';
  end if;
  if c.cancelado_em is not null or c.pago_em is not null then
    raise exception 'Este saldo já foi pago ou cancelado.';
  end if;
  if c.antecipacao_liberada_em is not null then
    raise exception 'A antecipação deste saldo já foi liberada.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Diga o motivo da antecipação.';
  end if;
  update public.fin_pagar
     set antecipacao_liberada_em = now(), antecipacao_liberada_por = auth.uid(),
         antecipacao_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
end $$;

revoke execute on function public.fin_liberar_antecipacao(uuid, text) from public, anon;
grant execute on function public.fin_liberar_antecipacao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Taxa do cartão-frete
-- ---------------------------------------------------------------------------
create function public.fin_taxa_cartao(p_mes date)
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
    where v.origem = 'taxa_cartao' and v.competencia = v_ini
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

revoke execute on function public.fin_taxa_cartao(date) from public, anon;
grant execute on function public.fin_taxa_cartao(date) to authenticated;

-- Cria (ou atualiza, enquanto não aprovada) a conta da taxa do mês: boleto da Pan Card, vence dia 10 do mês seguinte.
create function public.fin_lancar_taxa_cartao(p_mes date)
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

  select * into c from public.fin_pagar where origem = 'taxa_cartao' and competencia = v_ini for update;
  if found then
    if c.cancelado_em is not null then
      raise exception 'A taxa de % foi cancelada (conta %).', public.nome_mes(v_ini), c.numero;
    end if;
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

revoke execute on function public.fin_lancar_taxa_cartao(date) from public, anon;
grant execute on function public.fin_lancar_taxa_cartao(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Contas a receber
-- ---------------------------------------------------------------------------
create table public.fin_receber (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  origem text not null default 'manual',
  cliente_id uuid not null references public.cliente (pessoa_id) on delete restrict,
  titulo text not null,
  plano_id integer not null references public.fin_plano_conta (id),
  centro_custo_id smallint not null references public.centro_custo (id),
  forma public.fin_forma not null default 'boleto',
  vencimento date not null,
  valor numeric(14, 2) not null,
  observacao text,
  viagem_id uuid references public.viagem (id) on delete set null,
  lancado_por uuid default auth.uid(),
  editado_por uuid,
  recebido_em date,
  recebido_por uuid,
  recebido_registrado_em timestamptz,
  conta_id uuid references public.fin_conta (id) on delete restrict,
  cancelado_em timestamptz,
  cancelado_por uuid,
  cancelamento_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint fin_receber_origem check (origem in ('manual')),
  constraint fin_receber_titulo check (length(btrim(titulo)) between 1 and 120),
  constraint fin_receber_valor check (valor > 0 and valor < 1000000000),
  constraint fin_receber_observacao check (observacao is null or length(observacao) <= 500),
  constraint fin_receber_recebido_cancelado check (recebido_em is null or cancelado_em is null),
  constraint fin_receber_cancelamento check ((cancelado_em is null) = (cancelamento_motivo is null))
);

comment on table public.fin_receber is 'Contas a receber (títulos). Sem exclusão: cancela com motivo.';

create index fin_receber_aberta_vencimento_idx on public.fin_receber (vencimento) where recebido_em is null and cancelado_em is null;
create index fin_receber_recebido_em_idx on public.fin_receber (recebido_em) where recebido_em is not null;
create index fin_receber_cliente_idx on public.fin_receber (cliente_id);
create index fin_receber_plano_idx on public.fin_receber (plano_id);
create index fin_receber_centro_idx on public.fin_receber (centro_custo_id);
create index fin_receber_conta_idx on public.fin_receber (conta_id);
create index fin_receber_viagem_idx on public.fin_receber (viagem_id);

create function public.fn_fin_receber_protege()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tela boolean := current_user in ('authenticated', 'anon');
begin
  new.titulo := btrim(new.titulo);
  new.observacao := nullif(btrim(new.observacao), '');
  if not v_tela then
    return new;
  end if;

  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro lançam contas a receber.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.lancado_por := auth.uid();
    perform public.fin_conferir_classificacao(new.plano_id, new.centro_custo_id, false);
    return new;
  end if;

  if old.cancelado_em is not null then
    raise exception 'Este título foi cancelado e não muda mais.';
  end if;
  if old.recebido_em is not null then
    raise exception 'Este título já foi recebido e não muda mais.';
  end if;
  if old.origem <> 'manual'
     and (new.cliente_id, new.titulo, new.plano_id, new.vencimento, new.valor, new.viagem_id)
         is distinct from (old.cliente_id, old.titulo, old.plano_id, old.vencimento, old.valor, old.viagem_id) then
    raise exception 'Este título é gerado pelo NILT: só a forma, o centro de custo e a observação mudam.';
  end if;
  if (new.plano_id, new.centro_custo_id) is distinct from (old.plano_id, old.centro_custo_id) then
    perform public.fin_conferir_classificacao(new.plano_id, new.centro_custo_id, false);
  end if;
  new.editado_por := auth.uid();
  return new;
end $$;

revoke execute on function public.fn_fin_receber_protege() from public, anon, authenticated;

create trigger fin_receber_protege
  before insert or update on public.fin_receber
  for each row execute function public.fn_fin_receber_protege();

create trigger fin_receber_set_updated_at
  before update on public.fin_receber
  for each row execute function public.fn_set_updated_at();

revoke insert, update, delete, truncate, references, trigger on public.fin_receber from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.fin_receber from anon;
grant select on public.fin_receber to authenticated;
grant insert (cliente_id, titulo, plano_id, centro_custo_id, forma, vencimento, valor, observacao, viagem_id)
  on public.fin_receber to authenticated;
grant update (cliente_id, titulo, plano_id, centro_custo_id, forma, vencimento, valor, observacao, viagem_id)
  on public.fin_receber to authenticated;

alter table public.fin_receber enable row level security;

create policy fin_receber_ver on public.fin_receber
  for select to authenticated using ((select public.pode_financeiro()));
create policy fin_receber_incluir on public.fin_receber
  for insert to authenticated
  with check ((select public.pode_financeiro()) and origem = 'manual' and lancado_por = (select auth.uid()));
create policy fin_receber_alterar on public.fin_receber
  for update to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));

select public.auditar('public.fin_receber');

create view public.v_fin_receber
with (security_invoker = true) as
select
  r.*,
  pl.nome as plano_nome,
  cc.codigo as centro_codigo,
  cc.nome as centro_nome,
  coalesce(nullif(btrim(pe.apelido), ''), pe.nome) as cliente_nome,
  coalesce(pe.cnpj, pe.cpf) as cliente_documento,
  vi.numero as viagem_numero,
  (r.recebido_em is null and r.cancelado_em is null) as aberta,
  (r.recebido_em is null and r.cancelado_em is null and r.vencimento < public.hoje_brasilia()) as vencida,
  case
    when r.cancelado_em is not null then 'cancelada'
    when r.recebido_em is not null then 'recebida'
    when r.vencimento < public.hoje_brasilia() then 'vencida'
    else 'a_vencer'
  end as situacao
from public.fin_receber r
join public.fin_plano_conta pl on pl.id = r.plano_id
join public.centro_custo cc on cc.id = r.centro_custo_id
join public.pessoa pe on pe.id = r.cliente_id
left join public.viagem vi on vi.id = r.viagem_id;

revoke all on public.v_fin_receber from anon;
grant select on public.v_fin_receber to authenticated;

create function public.fin_receber_conta(p_id uuid, p_data date, p_conta uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.fin_receber%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro registram recebimentos.' using errcode = '42501';
  end if;
  select * into r from public.fin_receber where id = p_id for update;
  if not found then
    raise exception 'Título não encontrado. Atualize a página.' using errcode = 'P0002';
  end if;
  if r.cancelado_em is not null then
    raise exception 'Este título foi cancelado.';
  end if;
  if r.recebido_em is not null then
    raise exception 'Este título já foi recebido.';
  end if;
  if p_data is null then
    raise exception 'Informe a data do recebimento.';
  end if;
  if p_data > public.hoje_brasilia() then
    raise exception 'A data do recebimento não pode ser depois de hoje.';
  end if;
  if p_conta is not null and not exists (select 1 from public.fin_conta where id = p_conta) then
    raise exception 'Conta bancária não encontrada. Atualize a página.';
  end if;
  update public.fin_receber
     set recebido_em = p_data, recebido_por = auth.uid(), recebido_registrado_em = now(), conta_id = p_conta
   where id = p_id;
end $$;

revoke execute on function public.fin_receber_conta(uuid, date, uuid) from public, anon;
grant execute on function public.fin_receber_conta(uuid, date, uuid) to authenticated;

create function public.fin_desfazer_recebimento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.fin_receber%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro mexem nas contas a receber.' using errcode = '42501';
  end if;
  select * into r from public.fin_receber where id = p_id for update;
  if not found then
    raise exception 'Título não encontrado. Atualize a página.' using errcode = 'P0002';
  end if;
  if r.recebido_em is null then
    raise exception 'Este título não está recebido.';
  end if;
  update public.fin_receber
     set recebido_em = null, recebido_por = null, recebido_registrado_em = null, conta_id = null
   where id = p_id;
end $$;

revoke execute on function public.fin_desfazer_recebimento(uuid) from public, anon;
grant execute on function public.fin_desfazer_recebimento(uuid) to authenticated;

create function public.fin_cancelar_receber(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.fin_receber%rowtype;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro cancelam contas a receber.' using errcode = '42501';
  end if;
  select * into r from public.fin_receber where id = p_id for update;
  if not found then
    raise exception 'Título não encontrado. Atualize a página.' using errcode = 'P0002';
  end if;
  if r.cancelado_em is not null then
    raise exception 'Este título já foi cancelado.';
  end if;
  if r.recebido_em is not null then
    raise exception 'Este título já foi recebido: desfaça o recebimento antes de cancelar.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Diga o motivo do cancelamento.';
  end if;
  update public.fin_receber
     set cancelado_em = now(), cancelado_por = auth.uid(), cancelamento_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
end $$;

revoke execute on function public.fin_cancelar_receber(uuid, text) from public, anon;
grant execute on function public.fin_cancelar_receber(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Indicadores (topo das telas; painel da tesouraria na fase 2)
-- ---------------------------------------------------------------------------
create function public.fin_indicadores_contas(p_mes date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_hoje date := public.hoje_brasilia();
  v_pagar jsonb;
  v_receber jsonb;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro veem os números das contas.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'aberto_qtd', count(*) filter (where p.aberta),
    'aberto_valor', coalesce(sum(p.valor) filter (where p.aberta), 0),
    'vencidas_qtd', count(*) filter (where p.vencida),
    'vencidas_valor', coalesce(sum(p.valor) filter (where p.vencida), 0),
    'aprovar_qtd', count(*) filter (where p.aberta and p.aprovado_em is null),
    'aprovar_valor', coalesce(sum(p.valor) filter (where p.aberta and p.aprovado_em is null), 0),
    'pago_mes_qtd', count(*) filter (where p.pago_em >= v_ini and p.pago_em < v_fim),
    'pago_mes_valor', coalesce(sum(p.valor) filter (where p.pago_em >= v_ini and p.pago_em < v_fim), 0))
  into v_pagar
  from public.v_fin_pagar p;

  select jsonb_build_object(
    'aberto_qtd', count(*) filter (where r.aberta),
    'aberto_valor', coalesce(sum(r.valor) filter (where r.aberta), 0),
    'vencidas_qtd', count(*) filter (where r.vencida),
    'vencidas_valor', coalesce(sum(r.valor) filter (where r.vencida), 0),
    'em30_qtd', count(*) filter (where r.aberta and r.vencimento <= v_hoje + 30),
    'em30_valor', coalesce(sum(r.valor) filter (where r.aberta and r.vencimento <= v_hoje + 30), 0),
    'recebido_mes_qtd', count(*) filter (where r.recebido_em >= v_ini and r.recebido_em < v_fim),
    'recebido_mes_valor', coalesce(sum(r.valor) filter (where r.recebido_em >= v_ini and r.recebido_em < v_fim), 0))
  into v_receber
  from public.v_fin_receber r;

  return jsonb_build_object('pagar', v_pagar, 'receber', v_receber);
end $$;

revoke execute on function public.fin_indicadores_contas(date) from public, anon;
grant execute on function public.fin_indicadores_contas(date) to authenticated;
