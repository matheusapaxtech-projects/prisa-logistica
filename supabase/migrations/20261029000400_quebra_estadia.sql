-- Migration 20261029000400: quebra de peso e estadia (motor de despacho, rotina 8).
--
-- cliente.tolerancia_quebra_pct = quanto o peso de chegada pode ficar abaixo (ou acima) do de saída sem ser
--   divergência, pelo contrato do cliente (tomador). Em grãos é comum 0,25% a 0,5%; partida 0,30%.
-- parametro_operacional = estadia (Lei 11.442/2007, art. 11): horas grátis de carga ou descarga, R$ por
--   tonelada/hora acima delas e o repasse ao motorista (regra comercial da Prisa), com data de vigência como
--   parametro_fiscal. Valores de partida do motor: 5 h, R$ 1,38/t/h, repasse de 100%.
-- quebra_e_estadia(p_viagem) = a quebra entre o peso de saída e o de chegada (verificarQuebra do motor) e a
--   estadia na carga (Aguardando carregamento + Em carregamento) e na descarga (Aguardando descarga +
--   Descarregando), com as horas tiradas da linha do tempo (viagem_evento). Quem lê a viagem lê o resultado.
-- v_quadro: as colunas de antes, mais peso de saída, peso de chegada e a tolerância do cliente no fim (o
--   diálogo da contagem mostra a quebra).

alter table public.cliente
  add column tolerancia_quebra_pct numeric(5, 3) not null default 0.300,
  add constraint cliente_tolerancia_quebra check (tolerancia_quebra_pct >= 0 and tolerancia_quebra_pct <= 5);

-- ---------------------------------------------------------------------------
-- parametro_operacional
-- ---------------------------------------------------------------------------
create table public.parametro_operacional (
  vigencia_inicio date primary key,
  espera_gratis_h numeric(5, 2) not null check (espera_gratis_h >= 0),
  estadia_por_th numeric(8, 4) not null check (estadia_por_th >= 0),
  repasse_estadia_pct numeric(5, 2) not null check (repasse_estadia_pct between 0 and 100),
  observacao text
);

insert into public.parametro_operacional (vigencia_inicio, espera_gratis_h, estadia_por_th, repasse_estadia_pct, observacao)
values (date '2026-01-01', 5, 1.38, 100,
        'Valores de partida do motor de despacho: 5 h grátis (Lei 11.442/2007, art. 11), R$ 1,38 por t/h (confira o '
        'valor legal corrigido) e repasse de 100% ao motorista (regra comercial a confirmar).');

revoke truncate, references, trigger on public.parametro_operacional from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.parametro_operacional from anon;
alter table public.parametro_operacional enable row level security;
create policy parametro_operacional_select on public.parametro_operacional
  for select to authenticated using ((select public.pode_ler()));
create policy parametro_operacional_insert on public.parametro_operacional
  for insert to authenticated with check ((select public.eh_admin()));
create policy parametro_operacional_update on public.parametro_operacional
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy parametro_operacional_delete on public.parametro_operacional
  for delete to authenticated using ((select public.eh_admin()));
select public.auditar('public.parametro_operacional');

-- ---------------------------------------------------------------------------
-- quebra_e_estadia
-- ---------------------------------------------------------------------------
create function public.quebra_e_estadia(p_viagem uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with v as (
    select vi.id, vi.status_campo, vi.peso_saida_kg, vi.peso_chegada_kg, vi.peso_previsto_kg,
           coalesce(cl.tolerancia_quebra_pct, 0.300) as tolerancia
    from public.viagem vi
    join public.pedido pe on pe.id = vi.pedido_id
    left join public.cliente cl on cl.pessoa_id = pe.tomador_id
    where vi.id = p_viagem
  ),
  par as (
    select po.* from public.parametro_operacional po
    where po.vigencia_inicio <= (now() at time zone 'America/Sao_Paulo')::date
    order by po.vigencia_inicio desc limit 1
  ),
  -- passagens da linha do tempo (pagamentos e saldo têm de = para e ficam de fora); a última fica aberta até agora
  passagens as (
    select e.para, e.em, lead(e.em) over (order by e.em, e.id) as fim
    from public.viagem_evento e
    where e.viagem_id = p_viagem and e.de is distinct from e.para
  ),
  horas as (
    select
      coalesce(sum(extract(epoch from (coalesce(p.fim, case when p.para = v.status_campo then now() end) - p.em)) / 3600)
               filter (where p.para in ('aguardando_carregamento', 'em_carregamento')), 0) as carga,
      coalesce(sum(extract(epoch from (coalesce(p.fim, case when p.para = v.status_campo then now() end) - p.em)) / 3600)
               filter (where p.para in ('aguardando_descarga', 'descarregando')), 0) as descarga
    from v left join passagens p on true
  ),
  calc as (
    select v.*, h.carga, h.descarga, par.espera_gratis_h, par.estadia_por_th, par.repasse_estadia_pct,
           coalesce(v.peso_saida_kg, v.peso_previsto_kg) / 1000.0 as peso_t,
           v.peso_saida_kg / 1000.0 as origem_t, v.peso_chegada_kg / 1000.0 as destino_t
    from v cross join horas h left join par on true
  ),
  valores as (
    select c.*,
           round(greatest(0, c.carga - coalesce(c.espera_gratis_h, 5)) * c.peso_t * coalesce(c.estadia_por_th, 0), 2) as valor_carga,
           round(greatest(0, c.descarga - coalesce(c.espera_gratis_h, 5)) * c.peso_t * coalesce(c.estadia_por_th, 0), 2) as valor_descarga
    from calc c
  )
  select jsonb_build_object(
    'peso_origem_t', round(x.origem_t, 3),
    'peso_destino_t', round(x.destino_t, 3),
    'quebra_t', case when x.origem_t is not null and x.destino_t is not null then round(x.origem_t - x.destino_t, 3) end,
    'quebra_pct', case when x.origem_t > 0 and x.destino_t is not null then round((x.origem_t - x.destino_t) / x.origem_t * 100, 3) end,
    'tolerancia_pct', x.tolerancia,
    'divergente', case when x.origem_t > 0 and x.destino_t is not null
                       then abs((x.origem_t - x.destino_t) / x.origem_t * 100) > x.tolerancia end,
    'excedente_t', case when x.origem_t > 0 and x.destino_t is not null
                        then round(greatest(0, abs(x.origem_t - x.destino_t) - x.origem_t * x.tolerancia / 100), 3) end,
    'horas_carga', round(x.carga, 2),
    'horas_descarga', round(x.descarga, 2),
    'espera_gratis_h', x.espera_gratis_h,
    'estadia_por_th', x.estadia_por_th,
    'peso_estadia_t', round(x.peso_t, 3),
    'estadia_carga', x.valor_carga,
    'estadia_descarga', x.valor_descarga,
    'cobrar_do_cliente', x.valor_carga + x.valor_descarga,
    'repasse_pct', x.repasse_estadia_pct,
    'repassar_ao_motorista', round((x.valor_carga + x.valor_descarga) * coalesce(x.repasse_estadia_pct, 0) / 100, 2))
  from valores x
$$;

revoke execute on function public.quebra_e_estadia(uuid) from public, anon;
grant execute on function public.quebra_e_estadia(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- v_quadro (colunas de antes, na mesma ordem; pesos e tolerância no fim)
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
  cl.tolerancia_quebra_pct
from public.viagem v
left join public.pedido pe on pe.id = v.pedido_id
left join public.pessoa pt on pt.id = pe.tomador_id
left join public.cliente cl on cl.pessoa_id = pe.tomador_id
left join public.pessoa_endereco orig on orig.id = pe.local_coleta_id
left join public.pessoa_endereco dest on dest.id = pe.local_descarga_id
left join public.veiculo cav on cav.id = v.cavalo_id
left join public.pessoa pm on pm.id = v.motorista_id
left join public.viagem_pausa pa on pa.viagem_id = v.id and pa.fim is null
where v.cancelada_em is null
  and v.status_campo is not null
  and (v.status_campo <> 'frete_finalizado'
       or (v.finalizada_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date);
