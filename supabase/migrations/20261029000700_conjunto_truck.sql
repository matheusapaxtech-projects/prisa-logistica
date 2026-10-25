-- Migration 20261029000700: viagem com truck (caminhão sem carreta).
--
-- Até aqui a viagem exigia um conjunto com cavalo. Parte da operação da Prisa roda com truck (caminhão
-- com carroceria própria, sem carreta): 9 dos 116 CT-es do ATUA. Agora a base do conjunto pode ser um
-- cavalo ou um truck (tipo_veiculo.categoria = 'caminhao'); o truck não engata carreta nem dolly.
-- O resto já servia: iniciar_viagem pede CNH C/D/E quando o conjunto não tem peças, e a capacidade e os
-- eixos do conjunto saem do próprio veículo.
--
-- Mensagens: "o cavalo do conjunto precisa ser da categoria cavalo" vira "a base do conjunto precisa ser
-- um cavalo ou um truck"; nova "truck não engata carreta nem dolly". lib/conjunto.ts espelha as duas.

create or replace function public.validar_conjunto(p_conjunto uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cavalo_id uuid;
  v_fim timestamptz;
  v_categoria public.categoria_veiculo;
  v_itens integer;
  v_min smallint;
  v_max smallint;
  v_invalidos integer;
  v_carretas integer;
  v_conflito boolean;
begin
  select c.cavalo_id, c.fim into v_cavalo_id, v_fim
  from public.conjunto c
  where c.id = p_conjunto;
  if not found then
    return;
  end if;

  -- 1. a base é um cavalo ou um truck (caminhão)
  select tv.categoria into v_categoria
  from public.veiculo v
  join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
  where v.id = v_cavalo_id;
  if v_categoria is null or v_categoria not in ('cavalo', 'caminhao') then
    raise exception 'a base do conjunto precisa ser um cavalo ou um truck';
  end if;

  select count(*),
         min(ci.posicao),
         max(ci.posicao),
         count(*) filter (where tv.categoria not in ('carreta', 'dolly')),
         count(*) filter (where tv.categoria = 'carreta')
    into v_itens, v_min, v_max, v_invalidos, v_carretas
  from public.conjunto_item ci
  join public.veiculo v on v.id = ci.veiculo_id
  join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
  where ci.conjunto_id = p_conjunto;

  -- 1b. truck roda sozinho: não engata carreta nem dolly
  if v_categoria = 'caminhao' and v_itens > 0 then
    raise exception 'truck não engata carreta nem dolly';
  end if;

  -- 2. itens só carreta ou dolly
  if v_invalidos > 0 then
    raise exception 'itens do conjunto precisam ser carreta ou dolly';
  end if;

  if v_itens > 0 then
    -- 3. posições 1..n sem buracos (a PK garante que não há repetidas)
    if v_min <> 1 or v_max <> v_itens then
      raise exception 'posições do conjunto precisam começar em 1 e não ter buracos';
    end if;

    -- 4. dolly nunca na primeira nem na última posição
    if exists (
      select 1
      from public.conjunto_item ci
      join public.veiculo v on v.id = ci.veiculo_id
      join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
      where ci.conjunto_id = p_conjunto
        and tv.categoria = 'dolly'
        and ci.posicao in (1, v_itens)
    ) then
      raise exception 'dolly não pode ser a primeira nem a última peça';
    end if;

    -- 5. dois dollies em posições consecutivas
    if exists (
      select 1
      from public.conjunto_item a
      join public.veiculo va on va.id = a.veiculo_id
      join public.tipo_veiculo ta on ta.id = va.tipo_veiculo_id
      join public.conjunto_item b on b.conjunto_id = a.conjunto_id and b.posicao = a.posicao + 1
      join public.veiculo vb on vb.id = b.veiculo_id
      join public.tipo_veiculo tb on tb.id = vb.tipo_veiculo_id
      where a.conjunto_id = p_conjunto
        and ta.categoria = 'dolly'
        and tb.categoria = 'dolly'
    ) then
      raise exception 'dois dollies não podem ficar seguidos';
    end if;
  end if;

  -- 6. no máximo 3 carretas
  if v_carretas > 3 then
    raise exception 'conjunto aceita no máximo 3 carretas';
  end if;

  -- 7. nenhum veículo (cavalo ou item) em outro conjunto aberto. Só vale para conjunto aberto;
  --    a comparação cruza cavalo e itens deste com cavalo e itens dos outros.
  if v_fim is null then
    with meus as (
      select v_cavalo_id as veiculo_id
      union
      select ci.veiculo_id from public.conjunto_item ci where ci.conjunto_id = p_conjunto
    )
    select exists (
             select 1
             from public.conjunto o
             join meus m on m.veiculo_id = o.cavalo_id
             where o.id <> p_conjunto and o.fim is null
           )
        or exists (
             select 1
             from public.conjunto_item oi
             join public.conjunto o on o.id = oi.conjunto_id
             join meus m on m.veiculo_id = oi.veiculo_id
             where o.id <> p_conjunto and o.fim is null
           )
      into v_conflito;
    if v_conflito then
      raise exception 'veículo já está em outro conjunto aberto';
    end if;
  end if;
end $function$;

revoke execute on function public.validar_conjunto(uuid) from public, anon, authenticated;
