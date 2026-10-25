-- Migration 20261027000100: piso mínimo da ANTT e resultado do CT-e.
--
-- Regras do "Motor de despacho PRISA" (prisa-motor-despacho.zip, src/antt.ts e src/frete.ts), conferidas
-- ao centavo pelos casos de test/casos.json (ver tests/frete_antt_cte.test.sql). Resumo das regras em
-- docs/motor-despacho-regras.md.
--
-- tipo_carga_antt         = colunas da Tabela A da ANTT; o pedido escolhe uma (padrão granel sólido).
-- viagem.km_viagem        = km da viagem carregada, conferidos no Qualp (digitados pela operação).
-- viagem.pedagio_valor    = pedágio da viagem em R$ (vale-pedágio). Não entra no piso; entra no CT-e.
-- antt_coeficiente        = Tabela A com a data de vigência. Vale a vigência mais recente até o dia da
--                           viagem. A ANTT atualiza em janeiro, julho e quando o diesel varia 5% ou mais:
--                           cada portaria nova é uma nova vigência (as antigas ficam para o histórico).
-- parametro_fiscal        = alíquotas do Lucro Presumido, Pan Card, duplicata e seguro, também com
--                           vigência. Valores de partida do motor: confirmar com o contador e a apólice.
-- antt_coeficiente_para   = coeficientes de um tipo e número de eixos. Sem coluna exata (8 eixos), usa a
--                           coluna inferior mais próxima com valor; se não houver, a superior.
-- piso_antt               = km × CCD + CC (+ 0,92 × km × CCD com retorno vazio). Nulo = não dá para
--                           calcular (sem km ou tipo sem coeficiente para os eixos).
-- aliquota_icms           = 7% de S/SE (menos ES) para N/NE/CO/ES; 12% nos demais interestaduais; 0 dentro
--                           do PR; 12% dentro de outra UF (a conferir caso a caso).
-- calcular_cte            = resultado do CT-e (só admin e financeiro: margem é dado da operação).
-- frete_da_viagem         = dados da viagem para o piso: fretes em R$ totais, eixos, UFs, piso e se o
--                           frete do motorista está abaixo dele. Todos que leem viagens veem.
-- resultado_cte_da_viagem = frete_da_viagem + calcular_cte (só admin e financeiro).
-- aptidao_da_viagem       = ganha as linhas do frete: abaixo do piso é trava legal (Lei 15.485/2026: a
--                           ANTT bloqueia o CIOT e multa); sem frete do motorista ou sem km é trava (o
--                           administrador libera com justificativa); tipo sem coeficiente é aviso.
--                           Frota própria (unidade operacional do cavalo) não tem CIOT: não confere.
-- fn_frete_so_planejada   = frete do motorista, km e pedágio só mudam com a viagem Planejada, para a
--                           conferência do início não ser contornada depois.
--
-- Decisões (ver docs/motor-despacho-regras.md):
-- * Peso da viagem = peso de saída, se já pesada; senão o previsto.
-- * Frete empresa da viagem: por tonelada = valor × peso; total = valor rateado pelo peso da viagem sobre o
--   peso total do pedido. Como no motor, o pedágio está dentro do frete empresa (base do ICMS = frete −
--   pedágio).
-- * Contratado PF (INSS patronal e retenções) = proprietário na ANTT do cavalo é pessoa física.
-- * Dia de vigência = início da viagem; antes de iniciar, hoje (Brasília).
-- * Seguro, duplicata, repasse de INSS, complemento e outros custos existem em calcular_cte, mas a viagem
--   ainda não tem esses dados: entram como zero / falso.

-- ---------------------------------------------------------------------------
-- Tipos e colunas
-- ---------------------------------------------------------------------------
create type public.tipo_carga_antt as enum (
  'granel_solido', 'carga_geral', 'granel_liquido', 'frigorificada', 'conteinerizada', 'neogranel',
  'perigosa_granel_solido', 'perigosa_granel_liquido', 'perigosa_frigorificada', 'perigosa_conteinerizada',
  'perigosa_carga_geral', 'granel_pressurizada');

alter table public.pedido
  add column tipo_carga_antt public.tipo_carga_antt not null default 'granel_solido';

alter table public.viagem
  add column km_viagem integer,
  add column pedagio_valor numeric(12, 2),
  add constraint viagem_km_positivo check (km_viagem > 0),
  add constraint viagem_pedagio_nao_negativo check (pedagio_valor >= 0);

-- As colunas novas entram nas permissões por coluna da viagem (0200).
grant insert (km_viagem, pedagio_valor) on public.viagem to authenticated;
grant update (km_viagem, pedagio_valor) on public.viagem to authenticated;

create function public.rotulo_tipo_carga_antt(p public.tipo_carga_antt)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'granel_solido' then 'Granel sólido'
    when 'carga_geral' then 'Carga geral'
    when 'granel_liquido' then 'Granel líquido'
    when 'frigorificada' then 'Frigorificada ou aquecida'
    when 'conteinerizada' then 'Conteinerizada'
    when 'neogranel' then 'Neogranel'
    when 'perigosa_granel_solido' then 'Perigosa (granel sólido)'
    when 'perigosa_granel_liquido' then 'Perigosa (granel líquido)'
    when 'perigosa_frigorificada' then 'Perigosa (frigorificada ou aquecida)'
    when 'perigosa_conteinerizada' then 'Perigosa (conteinerizada)'
    when 'perigosa_carga_geral' then 'Perigosa (carga geral)'
    when 'granel_pressurizada' then 'Granel pressurizada'
  end
$$;

revoke execute on function public.rotulo_tipo_carga_antt(public.tipo_carga_antt) from public, anon;
grant execute on function public.rotulo_tipo_carga_antt(public.tipo_carga_antt) to authenticated;

-- "R$ 1.234,56" sem depender do lc_numeric do servidor (mensagens da aptidão).
create function public.reais_texto(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(round(p, 2), 'FM999,999,999,990.00'), ',.', '.,')
$$;

revoke execute on function public.reais_texto(numeric) from public, anon;
grant execute on function public.reais_texto(numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- antt_coeficiente (Tabela A, carga lotação)
-- ---------------------------------------------------------------------------
create table public.antt_coeficiente (
  vigencia_inicio date not null,
  portaria text not null,
  tipo_carga public.tipo_carga_antt not null,
  eixos smallint not null check (eixos in (2, 3, 4, 5, 6, 7, 9)),
  ccd numeric(8, 4) not null check (ccd > 0),   -- R$ por km
  cc numeric(10, 2) not null check (cc >= 0),   -- R$ de carga e descarga
  primary key (vigencia_inicio, tipo_carga, eixos)
);

-- Portaria SUROC/ANTT nº 22/2026, vigente desde 30/09/2026 (src/antt.ts do motor). Cada linha traz os
-- pares [CCD, CC] das colunas 2, 3, 4, 5, 6, 7 e 9 eixos; null = a ANTT não tem a coluna.
insert into public.antt_coeficiente (vigencia_inicio, portaria, tipo_carga, eixos, ccd, cc)
select date '2026-09-30', 'Portaria SUROC/ANTT nº 22/2026', t.tipo::public.tipo_carga_antt, e.eixos,
       (t.c -> e.i ->> 0)::numeric, (t.c -> e.i ->> 1)::numeric
from (values
  ('granel_solido', '[[4.1056,460.59],[5.2555,552.24],[5.9476,597.00],[6.8548,664.83],[7.5641,680.01],[8.2316,820.34],[9.4318,908.91]]'::jsonb),
  ('carga_geral', '[[4.0738,451.84],[5.2177,541.86],[5.9180,588.86],[6.8284,657.56],[7.5347,671.93],[8.2727,831.66],[9.4114,903.32]]'),
  ('granel_liquido', '[[4.1796,471.98],[5.3511,569.57],[6.1019,621.52],[7.0226,693.08],[7.7372,709.72],[8.3700,840.50],[9.5909,934.76]]'),
  ('frigorificada', '[[4.8234,520.07],[6.1659,623.27],[7.0345,686.63],[8.0623,757.98],[8.8911,772.35],[9.8134,982.76],[11.1479,1067.06]]'),
  ('conteinerizada', '[null,[5.2282,544.75],[5.8755,577.15],[6.7910,647.29],[7.4986,662.01],[8.2292,819.69],[9.3486,886.05]]'),
  ('neogranel', '[[3.6743,451.84],[5.2162,541.44],[5.9453,596.35],[6.8284,657.56],[7.5347,671.93],[8.2727,831.66],[9.4114,903.32]]'),
  ('perigosa_granel_solido', '[[4.8756,608.79],[6.0354,703.16],[6.7644,753.03],[7.6715,820.86],[8.3808,836.04],[9.0666,981.39],[10.2747,1072.15]]'),
  ('perigosa_granel_liquido', '[[4.9621,632.58],[6.1436,732.90],[6.8986,789.96],[7.8193,861.51],[8.5339,878.16],[9.1849,1013.95],[10.4138,1110.41]]'),
  ('perigosa_frigorificada', '[[5.4315,630.88],[6.7869,737.63],[7.6718,807.63],[8.6996,878.98],[9.5284,893.35],[10.4745,1110.28],[11.8192,1197.43]]'),
  ('perigosa_conteinerizada', '[null,[5.6126,645.45],[6.2966,682.95],[7.2121,753.10],[7.9198,767.81],[8.6686,930.51],[9.7960,999.06]]'),
  ('perigosa_carga_geral', '[[4.4482,549.81],[5.6021,642.55],[6.3392,694.66],[7.2495,763.36],[7.9558,777.73],[8.7121,942.48],[9.8588,1016.33]]'),
  ('granel_pressurizada', '[null,null,null,[7.1929,757.81],[7.9452,784.82],null,[9.9531,1052.26]]')
) as t(tipo, c)
cross join (values (0, 2), (1, 3), (2, 4), (3, 5), (4, 6), (5, 7), (6, 9)) as e(i, eixos)
where jsonb_typeof(t.c -> e.i) = 'array';

-- ---------------------------------------------------------------------------
-- parametro_fiscal
-- ---------------------------------------------------------------------------
create table public.parametro_fiscal (
  vigencia_inicio date primary key,
  pis_cofins numeric(7, 5) not null check (pis_cofins >= 0),                 -- sobre (frete − pedágio − ICMS)
  irpj_csll numeric(7, 5) not null check (irpj_csll >= 0),                   -- sobre (frete − pedágio)
  pan_card_pct numeric(7, 5) not null check (pan_card_pct >= 0),             -- sobre (frete devido + pedágio)
  pan_card_transferencia numeric(8, 2) not null check (pan_card_transferencia >= 0), -- R$ por transferência
  pan_card_transferencias smallint not null check (pan_card_transferencias >= 0),   -- adiantamento + saldo
  desconto_duplicata numeric(7, 5) not null check (desconto_duplicata >= 0), -- sobre o frete empresa
  seguro_rctrc numeric(8, 6) not null check (seguro_rctrc >= 0),             -- sobre o valor da mercadoria
  seguro_rcdc numeric(8, 6) not null check (seguro_rcdc >= 0),               -- sobre o valor da mercadoria
  observacao text
);

insert into public.parametro_fiscal (vigencia_inicio, pis_cofins, irpj_csll, pan_card_pct, pan_card_transferencia,
                                     pan_card_transferencias, desconto_duplicata, seguro_rctrc, seguro_rcdc, observacao)
values (date '2026-01-01', 0.0365, 0.0228, 0.01, 0.50, 2, 0.053, 0.0003, 0.0005,
        'Valores de partida do motor de despacho (Lucro Presumido, conferidos com CT-e reais). Confirmar com o '
        'contador; as taxas de seguro são referência: usar as da apólice.');

-- ---------------------------------------------------------------------------
-- Privilégios, RLS e auditoria
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.antt_coeficiente from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.antt_coeficiente from anon;
revoke truncate, references, trigger on public.parametro_fiscal from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.parametro_fiscal from anon;

alter table public.antt_coeficiente enable row level security;
alter table public.parametro_fiscal enable row level security;

-- A tabela da ANTT é pública por natureza: todo mundo que lê viagens vê o piso.
create policy antt_coeficiente_select on public.antt_coeficiente
  for select to authenticated using ((select public.pode_ler()));
create policy antt_coeficiente_insert on public.antt_coeficiente
  for insert to authenticated with check ((select public.eh_admin()));
create policy antt_coeficiente_update on public.antt_coeficiente
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy antt_coeficiente_delete on public.antt_coeficiente
  for delete to authenticated using ((select public.eh_admin()));

-- Parâmetros fiscais: só quem vê o resultado do CT-e lê; só admin muda.
create policy parametro_fiscal_select on public.parametro_fiscal
  for select to authenticated using ((select public.pode_financeiro()));
create policy parametro_fiscal_insert on public.parametro_fiscal
  for insert to authenticated with check ((select public.eh_admin()));
create policy parametro_fiscal_update on public.parametro_fiscal
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy parametro_fiscal_delete on public.parametro_fiscal
  for delete to authenticated using ((select public.eh_admin()));

select public.auditar('public.antt_coeficiente');
select public.auditar('public.parametro_fiscal');

-- ---------------------------------------------------------------------------
-- Piso ANTT
-- ---------------------------------------------------------------------------
create function public.antt_coeficiente_para(p_tipo public.tipo_carga_antt, p_eixos integer, p_dia date)
returns table (ccd numeric, cc numeric, eixos_tabela smallint, portaria text, vigencia_inicio date)
language sql
stable
security invoker
set search_path = ''
as $$
  with vig as (
    select max(a.vigencia_inicio) as dia from public.antt_coeficiente a where a.vigencia_inicio <= p_dia
  )
  select a.ccd, a.cc, a.eixos, a.portaria, a.vigencia_inicio
  from public.antt_coeficiente a
  join vig on a.vigencia_inicio = vig.dia
  where a.tipo_carga = p_tipo
  -- primeiro a coluna inferior (ou igual) mais próxima; sem ela, a superior mais próxima
  order by (a.eixos > p_eixos), abs(a.eixos - p_eixos)
  limit 1
$$;

revoke execute on function public.antt_coeficiente_para(public.tipo_carga_antt, integer, date) from public, anon;
grant execute on function public.antt_coeficiente_para(public.tipo_carga_antt, integer, date) to authenticated;

create function public.piso_antt(p_tipo public.tipo_carga_antt, p_eixos integer, p_km numeric,
                                 p_dia date default null, p_retorno_vazio boolean default false)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select round(p_km * c.ccd + c.cc + case when p_retorno_vazio then 0.92 * p_km * c.ccd else 0 end, 2)
  from public.antt_coeficiente_para(p_tipo, p_eixos,
                                    coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date)) c
  where p_km > 0
$$;

revoke execute on function public.piso_antt(public.tipo_carga_antt, integer, numeric, date, boolean) from public, anon;
grant execute on function public.piso_antt(public.tipo_carga_antt, integer, numeric, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Resultado do CT-e
-- ---------------------------------------------------------------------------
create function public.aliquota_icms(p_origem public.uf, p_destino public.uf)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_origem = p_destino then case when p_origem = 'PR' then 0 else 0.12 end
    when p_origem in ('PR', 'SC', 'RS', 'SP', 'RJ', 'MG')
         and p_destino not in ('PR', 'SC', 'RS', 'SP', 'RJ', 'MG') then 0.07
    else 0.12
  end::numeric
$$;

revoke execute on function public.aliquota_icms(public.uf, public.uf) from public, anon;
grant execute on function public.aliquota_icms(public.uf, public.uf) to authenticated;

create function public.faixa_margem(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p < 0 then 'Prejuízo'
    when p < 0.085 then 'Abaixo do mínimo'
    when p < 0.11 then 'Mínimo aceitável'
    when p < 0.12 then 'Esperado'
    when p < 0.15 then 'Ideal'
    else 'Excelente'
  end
$$;

revoke execute on function public.faixa_margem(numeric) from public, anon;
grant execute on function public.faixa_margem(numeric) to authenticated;

-- Entrada (jsonb): frete_empresa, frete_motorista, pedagio, uf_origem, uf_destino, motorista_pf e, opcionais,
-- repassar_inss, descontar_duplicata, complemento_cobrado, outros_custos, valor_mercadoria.
-- Saída: as parcelas em R$ (2 casas), margem e margem_liquida (4 casas), faixa e a vigência dos parâmetros.
-- As contas correm sem arredondar; só a saída é arredondada (como o motor).
create function public.calcular_cte(p jsonb, p_dia date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  f public.parametro_fiscal%rowtype;
  v_dia date := coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date);
  fe numeric := coalesce((p ->> 'frete_empresa')::numeric, 0);
  fm numeric := coalesce((p ->> 'frete_motorista')::numeric, 0);
  pd numeric := coalesce((p ->> 'pedagio')::numeric, 0);
  v_pf boolean := coalesce((p ->> 'motorista_pf')::boolean, false);
  v_repassar boolean := coalesce((p ->> 'repassar_inss')::boolean, false);
  v_duplicata boolean := coalesce((p ->> 'descontar_duplicata')::boolean, false);
  v_icms numeric;
  v_federal numeric;
  v_inss numeric;
  v_retencoes numeric;
  v_repasse numeric;
  v_devido numeric;
  v_pan numeric;
  v_seguro numeric;
  v_dup numeric;
  v_resultado numeric;
  v_irpj numeric;
  v_liquido numeric;
  v_margem numeric;
  v_margem_liq numeric;
begin
  if not public.pode_financeiro() then
    raise exception 'sem permissão para ver o resultado do CT-e' using errcode = '42501';
  end if;
  if p ->> 'uf_origem' is null or p ->> 'uf_destino' is null then
    raise exception 'informe a UF de origem e a de destino';
  end if;

  select * into f from public.parametro_fiscal pf
  where pf.vigencia_inicio <= v_dia order by pf.vigencia_inicio desc limit 1;
  if not found then
    raise exception 'não há parâmetros fiscais vigentes em %', to_char(v_dia, 'DD/MM/YYYY');
  end if;

  v_icms := greatest(0, fe - pd) * public.aliquota_icms((p ->> 'uf_origem')::public.uf, (p ->> 'uf_destino')::public.uf);
  v_federal := greatest(0, fe - pd - v_icms) * f.pis_cofins;
  v_inss := case when v_pf then fm * 0.2 * 0.2 else 0 end;                  -- 20% sobre 20% do frete
  v_retencoes := case when v_pf then fm * 0.2 * (0.11 + 0.025) else 0 end;  -- INSS 11% + SEST/SENAT 2,5%
  v_repasse := case when v_pf and v_repassar then v_inss else 0 end;
  v_devido := fm - v_retencoes - v_repasse;
  v_pan := case when fm > 0
                then (v_devido + pd) * f.pan_card_pct + f.pan_card_transferencia * f.pan_card_transferencias
                else 0 end;
  v_seguro := coalesce((p ->> 'valor_mercadoria')::numeric, 0) * (f.seguro_rctrc + f.seguro_rcdc);
  v_dup := case when v_duplicata then fe * f.desconto_duplicata else 0 end;
  v_resultado := fe + coalesce((p ->> 'complemento_cobrado')::numeric, 0) - fm - pd - v_icms - v_federal - v_inss
                 - v_pan - v_seguro - coalesce((p ->> 'outros_custos')::numeric, 0) + v_repasse - v_dup;
  v_irpj := greatest(0, fe - pd) * f.irpj_csll;
  v_liquido := v_resultado - v_irpj;
  v_margem := case when fe <> 0 then v_resultado / fe else 0 end;
  v_margem_liq := case when fe <> 0 then v_liquido / fe else 0 end;

  return jsonb_build_object(
    'icms', round(v_icms, 2),
    'aliquota_icms', public.aliquota_icms((p ->> 'uf_origem')::public.uf, (p ->> 'uf_destino')::public.uf),
    'imposto_federal', round(v_federal, 2),
    'inss_patronal', round(v_inss, 2),
    'retencoes_motorista', round(v_retencoes, 2),
    'frete_motorista_devido', round(v_devido, 2),
    'taxa_pan_card', round(v_pan, 2),
    'seguro_carga', round(v_seguro, 2),
    'desconto_duplicata', round(v_dup, 2),
    'resultado', round(v_resultado, 2),
    'margem', round(v_margem, 4),
    'irpj_csll', round(v_irpj, 2),
    'resultado_liquido', round(v_liquido, 2),
    'margem_liquida', round(v_margem_liq, 4),
    'faixa', public.faixa_margem(v_margem_liq),
    'parametros_desde', f.vigencia_inicio);
end $$;

revoke execute on function public.calcular_cte(jsonb, date) from public, anon;
grant execute on function public.calcular_cte(jsonb, date) to authenticated;

-- ---------------------------------------------------------------------------
-- frete_da_viagem
-- ---------------------------------------------------------------------------
create function public.frete_da_viagem(p_viagem uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select v.id, v.km_viagem, v.pedagio_valor, v.frete_motorista_valor, v.frete_motorista_tipo,
           coalesce(v.peso_saida_kg, v.peso_previsto_kg) / 1000.0 as peso_t,
           pe.tipo_carga_antt, pe.frete_empresa_valor, pe.frete_empresa_tipo, pe.peso_total_kg,
           coalesce(v.peso_saida_kg, v.peso_previsto_kg) as peso_kg,
           eo.uf as uf_origem, ed.uf as uf_destino,
           (pd.tipo = 'pf') as contratado_pf,
           coalesce(uo.nome = 'FROTA PROPRIA', false) as frota_propria,
           ((coalesce(v.iniciada_em, now())) at time zone 'America/Sao_Paulo')::date as dia,
           tv.eixos + coalesce((select sum(ti.eixos) from public.conjunto_item ci
                                join public.veiculo vi on vi.id = ci.veiculo_id
                                join public.tipo_veiculo ti on ti.id = vi.tipo_veiculo_id
                                where ci.conjunto_id = v.conjunto_id), 0) as eixos
    from public.viagem v
    join public.pedido pe on pe.id = v.pedido_id
    join public.pessoa_endereco eo on eo.id = pe.local_coleta_id
    join public.pessoa_endereco ed on ed.id = pe.local_descarga_id
    join public.veiculo cav on cav.id = v.cavalo_id
    join public.tipo_veiculo tv on tv.id = cav.tipo_veiculo_id
    left join public.pessoa pd on pd.id = cav.proprietario_documento_id
    left join public.unidade_operacional uo on uo.id = cav.unidade_operacional_id
    where v.id = p_viagem
  ),
  calc as (
    select b.*,
           round(case b.frete_empresa_tipo
                   when 'por_tonelada' then b.frete_empresa_valor * b.peso_t
                   else b.frete_empresa_valor * b.peso_kg / b.peso_total_kg end, 2) as frete_empresa,
           round(case b.frete_motorista_tipo
                   when 'por_tonelada' then b.frete_motorista_valor * b.peso_t
                   else b.frete_motorista_valor end, 2) as frete_motorista,
           c.ccd, c.cc, c.eixos_tabela, c.portaria, c.vigencia_inicio
    from base b
    left join lateral public.antt_coeficiente_para(b.tipo_carga_antt, b.eixos::integer, b.dia) c on true
  )
  select jsonb_build_object(
    'peso_t', round(c.peso_t, 3),
    'frete_empresa', c.frete_empresa,
    'frete_motorista', c.frete_motorista,
    'km', c.km_viagem,
    'pedagio', c.pedagio_valor,
    'eixos', c.eixos,
    'tipo_carga', c.tipo_carga_antt,
    'tipo_carga_rotulo', public.rotulo_tipo_carga_antt(c.tipo_carga_antt),
    'uf_origem', c.uf_origem,
    'uf_destino', c.uf_destino,
    'contratado_pf', coalesce(c.contratado_pf, false),
    'frota_propria', c.frota_propria,
    'dia', c.dia,
    'piso', piso.valor,
    'piso_eixos_tabela', c.eixos_tabela,
    'piso_portaria', c.portaria,
    'piso_vigencia', c.vigencia_inicio,
    'abaixo_do_piso', coalesce(c.frete_motorista < piso.valor, false))
  from calc c
  cross join lateral (
    select case when c.km_viagem > 0 and c.ccd is not null then round(c.km_viagem * c.ccd + c.cc, 2) end as valor
  ) piso
$$;

revoke execute on function public.frete_da_viagem(uuid) from public, anon;
grant execute on function public.frete_da_viagem(uuid) to authenticated;

-- Resultado do CT-e da viagem: frete_da_viagem + "resultado" (nulo em frota própria ou sem frete do motorista).
create function public.resultado_cte_da_viagem(p_viagem uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_frete jsonb;
begin
  if not public.pode_financeiro() then
    raise exception 'sem permissão para ver o resultado do CT-e' using errcode = '42501';
  end if;
  v_frete := public.frete_da_viagem(p_viagem);
  if v_frete is null then
    return null;
  end if;
  if (v_frete ->> 'frota_propria')::boolean or v_frete ->> 'frete_motorista' is null then
    return v_frete || jsonb_build_object('resultado', null);
  end if;
  return v_frete || jsonb_build_object('resultado', public.calcular_cte(jsonb_build_object(
    'frete_empresa', v_frete -> 'frete_empresa',
    'frete_motorista', v_frete -> 'frete_motorista',
    'pedagio', coalesce((v_frete ->> 'pedagio')::numeric, 0),
    'uf_origem', v_frete -> 'uf_origem',
    'uf_destino', v_frete -> 'uf_destino',
    'motorista_pf', v_frete -> 'contratado_pf'), (v_frete ->> 'dia')::date));
end $$;

revoke execute on function public.resultado_cte_da_viagem(uuid) from public, anon;
grant execute on function public.resultado_cte_da_viagem(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- aptidao_da_viagem (mesma assinatura da 0600; ganha as linhas do frete)
-- ---------------------------------------------------------------------------
-- A lista sai ordenada por nível (trava_legal, trava, aviso), mantendo a ordem de cada fonte dentro do
-- nível: pedido cancelado, depois aptidao_viagem, depois o frete.
create or replace function public.aptidao_da_viagem(p_viagem uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with v as (
    select v.id, v.conjunto_id, pe.tomador_id, pe.situacao, pe.numero, public.frete_da_viagem(v.id) as fr
    from public.viagem v
    left join public.pedido pe on pe.id = v.pedido_id
    where v.id = p_viagem
  ),
  linhas (fonte, ordem, codigo, nivel, mensagem) as (
    select 1, 1::bigint, 'pedido_cancelado', 'trava_legal', format('O pedido #%s está cancelado', v.numero)
    from v where v.situacao = 'cancelado'
    union all
    select 2, a.n, a.codigo, a.nivel, a.mensagem
    from v cross join lateral public.aptidao_viagem(v.conjunto_id, v.tomador_id) with ordinality as a(codigo, nivel, mensagem, n)
    union all
    select 3, 1, 'abaixo_piso_antt', 'trava_legal',
           format('Frete do motorista (%s) abaixo do piso da ANTT (%s para %s eixos, %s km, %s)',
                  public.reais_texto((v.fr ->> 'frete_motorista')::numeric), public.reais_texto((v.fr ->> 'piso')::numeric),
                  v.fr ->> 'eixos', v.fr ->> 'km', lower(v.fr ->> 'tipo_carga_rotulo'))
    from v where not (v.fr ->> 'frota_propria')::boolean and (v.fr ->> 'abaixo_do_piso')::boolean
    union all
    select 3, 2, 'frete_motorista_ausente', 'trava', 'Frete do motorista não informado: ele é conferido com o piso da ANTT'
    from v where not (v.fr ->> 'frota_propria')::boolean and v.fr ->> 'frete_motorista' is null
    union all
    select 3, 3, 'km_ausente', 'trava', 'Km da viagem não informados: sem eles não dá para conferir o piso da ANTT'
    from v where not (v.fr ->> 'frota_propria')::boolean and v.fr ->> 'km' is null
    union all
    select 3, 4, 'piso_sem_tabela', 'aviso',
           format('A tabela da ANTT não tem piso para %s com %s eixos: confira o frete à mão',
                  lower(v.fr ->> 'tipo_carga_rotulo'), v.fr ->> 'eixos')
    from v where not (v.fr ->> 'frota_propria')::boolean and v.fr ->> 'km' is not null and v.fr ->> 'piso_eixos_tabela' is null
  )
  select coalesce((select jsonb_agg(jsonb_build_object('codigo', l.codigo, 'nivel', l.nivel, 'mensagem', l.mensagem)
                                    order by case l.nivel when 'trava_legal' then 1 when 'trava' then 2 else 3 end,
                                             l.fonte, l.ordem)
                   from linhas l), '[]'::jsonb)
  from v
$$;

-- ---------------------------------------------------------------------------
-- fn_frete_so_planejada
-- ---------------------------------------------------------------------------
create function public.fn_frete_so_planejada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.status_campo is not null or old.cancelada_em is not null)
     and (new.frete_motorista_valor, new.frete_motorista_tipo, new.km_viagem, new.pedagio_valor)
         is distinct from (old.frete_motorista_valor, old.frete_motorista_tipo, old.km_viagem, old.pedagio_valor) then
    raise exception 'o frete do motorista, os km e o pedágio só mudam antes de a viagem começar';
  end if;
  return new;
end $$;

revoke execute on function public.fn_frete_so_planejada() from public, anon, authenticated;

create trigger frete_so_planejada
  before update on public.viagem
  for each row execute function public.fn_frete_so_planejada();
