-- Migration 20261101000300: parcelas 70/30 do frete do motorista e a viagem paga pelo financeiro.
--
-- Regra do sistema do sócio: ao contratar o motorista nascem duas contas a pagar —
--   adiantamento: 70% do frete + o pedágio (vale-pedágio), pago com o embarque conferido (peso de saída);
--   saldo: os 30% restantes, vence 3 dias depois do embarque e só é pago com a entrega conferida (viagem em
--          "Aguardando saldo (30%)"), ou antes se o admin liberar a antecipação;
-- e o pagamento marca a viagem como paga (pagamento_saida_em / saldo_pago_em, que o Quadro exige).
--
-- viagem.pagamento_pelo_financeiro  corte: só as viagens contratadas depois desta migration (padrão true nas novas).
-- fin_sincronizar_parcelas  cria/atualiza as duas parcelas a partir da viagem (gatilho trg_viagem_parcelas):
--                           frete = frete_da_viagem (por tonelada × peso de saída ou previsto); favorecido =
--                           proprietário (documento) do cavalo, ou o motorista; cartão-frete; centro 03.08; conta 20.
--                           Antes do embarque vencem na contratação e 3 dias depois; no embarque, hoje e hoje + 3.
--                           Valor mudou: parcela aprovada perde a aprovação; paga não muda. Sem frete, frota própria
--                           ou viagem cancelada: as não pagas são canceladas sozinhas (cancelado_automatico) e voltam
--                           se o frete voltar. A que o admin cancelou à mão não volta.
-- fin_pagar_conta / fin_desfazer_pagamento  (substituídas) marcam e desmarcam a viagem.
-- confirmar_pagamento_saida / confirmar_saldo  (substituídas) recusam quando a parcela está no financeiro.
-- parcelas_no_financeiro / viagem_parcelas    o que o Quadro e a ficha da viagem mostram a quem lê viagens.
-- v_quadro                  ganha adiantamento_no_financeiro e saldo_no_financeiro no fim.

alter table public.fin_pagar add column cancelado_automatico boolean not null default false;

-- Corte: só as viagens contratadas daqui em diante têm o pagamento pelo financeiro. As que já existiam ficam com a
-- confirmação manual no Quadro (sem parcelas retroativas, que encheriam o contas a pagar de viagens antigas).
alter table public.viagem add column pagamento_pelo_financeiro boolean not null default false;
alter table public.viagem alter column pagamento_pelo_financeiro set default true;

comment on column public.viagem.pagamento_pelo_financeiro is
  'Viagem contratada depois do contas a pagar (migration 20261101000300): o adiantamento e o saldo são contas a pagar.';

comment on column public.fin_pagar.cancelado_automatico is
  'Parcela do frete cancelada pelo NILT (viagem cancelada, sem frete, frota própria): volta se a causa sumir.';

-- ---------------------------------------------------------------------------
-- Sincronizar as parcelas com a viagem
-- ---------------------------------------------------------------------------
create function public.fin_sincronizar_parcelas(p_viagem uuid, p_embarcou_agora boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.viagem%rowtype;
  fr jsonb;
  v_total numeric;
  v_pedagio numeric;
  v_motivo text;
  v_hoje date := public.hoje_brasilia();
  v_fav uuid;
  v_fav_nome text;
  v_adiantamento numeric;
  c public.fin_pagar%rowtype;
  t text;
  v_valor numeric;
  v_ped numeric;
begin
  select * into v from public.viagem where id = p_viagem;
  if not found or not v.pagamento_pelo_financeiro then
    return;
  end if;
  fr := public.frete_da_viagem(p_viagem);
  v_total := coalesce((fr ->> 'frete_motorista')::numeric, 0);
  v_pedagio := coalesce(v.pedagio_valor, 0);
  v_motivo := case
    when v.cancelada_em is not null then 'Viagem cancelada.'
    when coalesce((fr ->> 'frota_propria')::boolean, false) then 'Frota própria: o frete não é pago a terceiro.'
    when v_total <= 0 then 'A viagem ficou sem frete do motorista.'
  end;

  if v_motivo is not null then
    update public.fin_pagar
       set cancelado_em = now(), cancelado_por = auth.uid(), cancelamento_motivo = v_motivo, cancelado_automatico = true
     where viagem_id = p_viagem and pago_em is null and cancelado_em is null;
    return;
  end if;

  select coalesce(cav.proprietario_documento_id, v.motorista_id) into v_fav from public.veiculo cav where cav.id = v.cavalo_id;
  select p.nome into v_fav_nome from public.pessoa p where p.id = v_fav;
  v_adiantamento := round(v_total * 0.70, 2);

  foreach t in array array['frete_adiantamento', 'frete_saldo'] loop
    v_valor := case when t = 'frete_adiantamento' then v_adiantamento + v_pedagio else v_total - v_adiantamento end;
    v_ped := case when t = 'frete_adiantamento' then v_pedagio else 0 end;
    select * into c from public.fin_pagar where viagem_id = p_viagem and origem = t for update;

    if not found then
      insert into public.fin_pagar (origem, viagem_id, descricao, favorecido_id, favorecido_nome, plano_id, centro_custo_id,
                                    forma, vencimento, valor, parte_pedagio, lancado_por)
      values (t, p_viagem,
              case when t = 'frete_adiantamento' then format('Adiantamento (70%% + pedágio) da viagem %s', v.numero)
                   else format('Saldo (30%%) da viagem %s', v.numero) end,
              v_fav, coalesce(v_fav_nome, format('Motorista da viagem %s', v.numero)), 20,
              (select id from public.centro_custo where codigo = '03.08'), 'cartao_frete',
              case when t = 'frete_adiantamento' then v_hoje else v_hoje + 3 end,
              v_valor, v_ped, auth.uid());
    elsif c.pago_em is null and (c.cancelado_em is null or c.cancelado_automatico) then
      if c.cancelado_em is not null
         or (c.valor, c.parte_pedagio, c.favorecido_id) is distinct from (v_valor, v_ped, v_fav) then
        -- reaberta ou com valor/favorecido novo: precisa de aprovação de novo, e quem mudou a viagem não aprova
        update public.fin_pagar
           set valor = v_valor, parte_pedagio = v_ped, favorecido_id = v_fav,
               favorecido_nome = coalesce(v_fav_nome, favorecido_nome),
               cancelado_em = null, cancelado_por = null, cancelamento_motivo = null, cancelado_automatico = false,
               aprovado_em = null, aprovado_por = null, editado_por = auth.uid()
         where id = c.id;
      end if;
      if p_embarcou_agora then
        update public.fin_pagar
           set vencimento = case when t = 'frete_adiantamento' then v_hoje else v_hoje + 3 end
         where id = c.id;
      end if;
    end if;
  end loop;
end $$;

revoke execute on function public.fin_sincronizar_parcelas(uuid, boolean) from public, anon, authenticated;

create function public.fn_viagem_parcelas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fin_sincronizar_parcelas(
    new.id,
    tg_op = 'UPDATE' and old.peso_saida_kg is null and new.peso_saida_kg is not null);
  return null;
end $$;

revoke execute on function public.fn_viagem_parcelas() from public, anon, authenticated;

create trigger trg_viagem_parcelas
  after insert or update of frete_motorista_valor, frete_motorista_tipo, pedagio_valor, peso_previsto_kg, peso_saida_kg,
                            cavalo_id, cancelada_em
  on public.viagem
  for each row execute function public.fn_viagem_parcelas();

-- ---------------------------------------------------------------------------
-- Pagar e desfazer (substituem as da migration 0200, com a parte da viagem)
-- ---------------------------------------------------------------------------
create or replace function public.fin_pagar_conta(p_id uuid, p_data date, p_conta uuid default null, p_forma public.fin_forma default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
  v public.viagem%rowtype;
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

  if c.viagem_id is not null then
    select * into v from public.viagem where id = c.viagem_id for update;
    if v.cancelada_em is not null then
      raise exception 'A viagem % foi cancelada: cancele esta conta em vez de pagar.', v.numero;
    end if;
    if c.origem = 'frete_adiantamento' and v.peso_saida_kg is null then
      raise exception 'O adiantamento só é pago com o embarque conferido: a viagem % ainda não tem o peso de saída.', v.numero;
    end if;
    if c.origem = 'frete_saldo' and c.antecipacao_liberada_em is null
       and v.status_campo is distinct from 'aguardando_saldo' and v.finalizada_em is null then
      raise exception 'O saldo só é pago com a entrega conferida (viagem % em "Aguardando saldo (30%%)"). Para pagar antes, o administrador libera a antecipação.', v.numero;
    end if;
  end if;

  update public.fin_pagar
     set pago_em = p_data, pago_por = auth.uid(), pago_registrado_em = now(), conta_id = p_conta,
         forma = coalesce(p_forma, forma)
   where id = p_id;

  if c.origem = 'frete_adiantamento' and v.pagamento_saida_em is null then
    update public.viagem set pagamento_saida_em = now(), pagamento_saida_por = auth.uid() where id = v.id;
    insert into public.viagem_evento (viagem_id, de, para, dados)
    values (v.id, v.status_campo, v.status_campo, jsonb_build_object('tipo', 'pagamento_saida', 'conta_pagar', c.numero));
  elsif c.origem = 'frete_saldo' and v.saldo_pago_em is null then
    update public.viagem set saldo_pago_em = now(), saldo_pago_por = auth.uid() where id = v.id;
    insert into public.viagem_evento (viagem_id, de, para, dados)
    values (v.id, v.status_campo, v.status_campo, jsonb_build_object('tipo', 'saldo_pago', 'conta_pagar', c.numero));
  end if;
end $$;

create or replace function public.fin_desfazer_pagamento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fin_pagar%rowtype;
  v public.viagem%rowtype;
  v_origem_pausa public.status_campo;
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

  if c.viagem_id is not null then
    select * into v from public.viagem where id = c.viagem_id for update;
    if c.origem = 'frete_adiantamento' then
      select pa.coluna_origem into v_origem_pausa
      from public.viagem_pausa pa where pa.viagem_id = v.id and pa.fim is null;
      if not (v.status_campo is null
              or v.status_campo in ('transito', 'aguardando_carregamento', 'em_carregamento', 'aguardando_nf_pagamento')
              or (v.status_campo = 'pausa' and v_origem_pausa = 'transito')) then
        raise exception 'A viagem % já saiu em rota com este adiantamento: o pagamento não pode ser desfeito.', v.numero;
      end if;
      if v.pagamento_saida_em is not null then
        update public.viagem set pagamento_saida_em = null, pagamento_saida_por = null where id = v.id;
        insert into public.viagem_evento (viagem_id, de, para, dados)
        values (v.id, v.status_campo, v.status_campo, jsonb_build_object('tipo', 'pagamento_saida_desfeito', 'conta_pagar', c.numero));
      end if;
    else
      if v.finalizada_em is not null then
        raise exception 'A viagem % já foi finalizada com este saldo: o pagamento não pode ser desfeito.', v.numero;
      end if;
      if v.saldo_pago_em is not null then
        update public.viagem set saldo_pago_em = null, saldo_pago_por = null where id = v.id;
        insert into public.viagem_evento (viagem_id, de, para, dados)
        values (v.id, v.status_campo, v.status_campo, jsonb_build_object('tipo', 'saldo_pago_desfeito', 'conta_pagar', c.numero));
      end if;
    end if;
  end if;

  update public.fin_pagar
     set pago_em = null, pago_por = null, pago_registrado_em = null, conta_id = null
   where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- O que o Quadro e a viagem mostram (sem abrir o financeiro inteiro)
-- ---------------------------------------------------------------------------
create function public.parcelas_no_financeiro(p_viagem uuid)
returns table (adiantamento boolean, saldo boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.fin_pagar p
            where p.viagem_id = p_viagem and p.origem = 'frete_adiantamento' and p.cancelado_em is null),
    exists (select 1 from public.fin_pagar p
            where p.viagem_id = p_viagem and p.origem = 'frete_saldo' and p.cancelado_em is null)
$$;

revoke execute on function public.parcelas_no_financeiro(uuid) from public, anon;
grant execute on function public.parcelas_no_financeiro(uuid) to authenticated;

create function public.viagem_parcelas(p_viagem uuid)
returns table (
  origem text,
  numero bigint,
  valor numeric,
  parte_pedagio numeric,
  vencimento date,
  situacao text,
  pago_em date,
  antecipacao_liberada boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.origem, p.numero, p.valor, p.parte_pedagio, p.vencimento, p.situacao, p.pago_em,
         p.antecipacao_liberada_em is not null
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
-- Confirmação manual no Quadro: recusada quando a parcela está no financeiro
-- (corpos das migrations 20261025000400 e 20261029000300 + a conferência nova)
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_pagamento_saida(p_viagem uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
  v_origem_pausa public.status_campo;
begin
  if not public.tem_papel('admin', 'operacao', 'financeiro') then
    raise exception 'sem permissão para confirmar o pagamento de saída' using errcode = '42501';
  end if;

  select * into v_viagem from public.viagem v where v.id = p_viagem for update;
  if not found then
    raise exception 'viagem não encontrada' using errcode = 'P0002';
  end if;
  if v_viagem.cancelada_em is not null then
    raise exception 'a viagem está cancelada';
  end if;
  if v_viagem.pagamento_saida_em is not null then
    raise exception 'o adiantamento e o vale-pedágio já foram confirmados';
  end if;
  if exists (select 1 from public.fin_pagar p
             where p.viagem_id = p_viagem and p.origem = 'frete_adiantamento' and p.cancelado_em is null) then
    raise exception 'O adiantamento da viagem % é pago pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar.',
      v_viagem.numero;
  end if;

  select pa.coluna_origem into v_origem_pausa
  from public.viagem_pausa pa where pa.viagem_id = p_viagem and pa.fim is null;

  -- antes de Em rota: Planejada, Trânsito…Aguardando NF e pagamento, ou Pausa aberta a partir de Trânsito
  if not (v_viagem.status_campo is null
          or v_viagem.status_campo between 'transito' and 'aguardando_nf_pagamento'
          or (v_viagem.status_campo = 'pausa' and v_origem_pausa = 'transito')) then
    raise exception 'a viagem está em "%"; o pagamento de saída só é confirmado antes de "Em rota"',
      public.rotulo_status_campo(v_viagem.status_campo);
  end if;

  update public.viagem v
     set pagamento_saida_em = now(),
         pagamento_saida_por = (select auth.uid())
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, dados)
  values (p_viagem, v_viagem.status_campo, v_viagem.status_campo, '{"tipo": "pagamento_saida"}'::jsonb);
end $$;

create or replace function public.confirmar_saldo(p_viagem uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
begin
  if not public.tem_papel('admin', 'operacao', 'financeiro') then
    raise exception 'sem permissão para confirmar o saldo' using errcode = '42501';
  end if;
  select * into v_viagem from public.viagem v where v.id = p_viagem for update;
  if not found then
    raise exception 'viagem não encontrada' using errcode = 'P0002';
  end if;
  if v_viagem.cancelada_em is not null then
    raise exception 'a viagem está cancelada';
  end if;
  if v_viagem.status_campo is distinct from 'aguardando_saldo' then
    raise exception 'a viagem está em "%"; o saldo só é confirmado em "Aguardando saldo (30%%)"',
      public.rotulo_status_campo(v_viagem.status_campo);
  end if;
  if v_viagem.saldo_pago_em is not null then
    raise exception 'o saldo já foi confirmado';
  end if;
  if exists (select 1 from public.fin_pagar p
             where p.viagem_id = p_viagem and p.origem = 'frete_saldo' and p.cancelado_em is null) then
    raise exception 'O saldo da viagem % é pago pelo financeiro (Contas a pagar): a viagem fica paga sozinha quando ele pagar.',
      v_viagem.numero;
  end if;

  update public.viagem v
     set saldo_pago_em = now(),
         saldo_pago_por = (select auth.uid())
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, dados)
  values (p_viagem, v_viagem.status_campo, v_viagem.status_campo, '{"tipo": "saldo_pago"}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- v_quadro (colunas de antes, na mesma ordem; as duas novas no fim)
-- ---------------------------------------------------------------------------
create or replace view public.v_quadro
with (security_invoker = true) as
select
  v.id as viagem_id,
  v.numero,
  v.status_campo,
  v.status_desde,
  cav.placa as cavalo_placa,
  coalesce(nullif(btrim(pm.apelido), ''), split_part(btrim(pm.nome), ' ', 1)) as motorista_nome,
  coalesce(nullif(btrim(pt.apelido), ''), pt.nome) as cliente_nome,
  orig.cidade as origem_cidade,
  orig.uf as origem_uf,
  dest.cidade as destino_cidade,
  dest.uf as destino_uf,
  cav.unidade_operacional_id,
  v.iniciada_por,
  pa.tipo as pausa_tipo,
  pa.programada as pausa_programada,
  pa.inicio as pausa_inicio,
  (v.chave_cte is not null and v.chave_mdfe is not null) as tem_chaves,
  (v.pagamento_saida_em is not null) as pagamento_saida,
  public.canhoto_enviado(v.id) as tem_canhoto,
  v.divergencia,
  (select count(*)::integer from public.viagem_ocorrencia o
    where o.viagem_id = v.id and o.resolvida_em is null) as ocorrencias_abertas,
  (v.saldo_pago_em is not null) as saldo_pago,
  (v.ciot is not null and v.chave_nfe is not null and v.averbacao_seguro is not null) as tem_documentos_saida,
  v.peso_saida_kg,
  v.peso_chegada_kg,
  cl.tolerancia_quebra_pct,
  pf.adiantamento as adiantamento_no_financeiro,
  pf.saldo as saldo_no_financeiro
from public.viagem v
left join public.pedido pe on pe.id = v.pedido_id
left join public.pessoa pt on pt.id = pe.tomador_id
left join public.cliente cl on cl.pessoa_id = pe.tomador_id
left join public.pessoa_endereco orig on orig.id = pe.local_coleta_id
left join public.pessoa_endereco dest on dest.id = pe.local_descarga_id
left join public.veiculo cav on cav.id = v.cavalo_id
left join public.pessoa pm on pm.id = v.motorista_id
left join public.viagem_pausa pa on pa.viagem_id = v.id and pa.fim is null
left join lateral public.parcelas_no_financeiro(v.id) pf on true
where v.cancelada_em is null
  and v.status_campo is not null
  and (v.status_campo <> 'frete_finalizado'
       or (v.finalizada_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date);
