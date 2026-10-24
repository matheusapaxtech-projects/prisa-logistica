-- Migration 20261027000200: vigência da tabela da ANTT escolhida por tipo de carga.
--
-- Na 0100, antt_coeficiente_para pegava a vigência mais recente da tabela inteira: uma portaria nova
-- cadastrada só para um tipo deixaria os outros tipos sem piso. Agora cada tipo usa a sua vigência mais
-- recente até o dia da viagem. Mesma assinatura e mesmo desempate de colunas.

create or replace function public.antt_coeficiente_para(p_tipo public.tipo_carga_antt, p_eixos integer, p_dia date)
returns table (ccd numeric, cc numeric, eixos_tabela smallint, portaria text, vigencia_inicio date)
language sql
stable
security invoker
set search_path = ''
as $$
  with vig as (
    select max(a.vigencia_inicio) as dia
    from public.antt_coeficiente a
    where a.tipo_carga = p_tipo and a.vigencia_inicio <= p_dia
  )
  select a.ccd, a.cc, a.eixos, a.portaria, a.vigencia_inicio
  from public.antt_coeficiente a
  join vig on a.vigencia_inicio = vig.dia
  where a.tipo_carga = p_tipo
  -- primeiro a coluna inferior (ou igual) mais próxima; sem ela, a superior mais próxima
  order by (a.eixos > p_eixos), abs(a.eixos - p_eixos)
  limit 1
$$;
