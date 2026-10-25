-- Migration 20261028000100: alíquotas vigentes para a calculadora de frete.
--
-- A calculadora (tela /calculadora) decide a contratação no navegador: para a operação ver o veredito e os
-- limites em reais (decisão do usuário em 2026-10-24), ela precisa das alíquotas, que o RLS de
-- parametro_fiscal só mostra a admin e financeiro (migration 20261027000100). Esta função entrega só os
-- números da linha vigente, sem observação e sem nenhum dado de viagem, a quem lê o sistema. A margem das
-- viagens reais continua só em resultado_cte_da_viagem (admin e financeiro).

create function public.parametros_calculadora(p_dia date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.pode_ler() then (
    select jsonb_build_object(
      'vigencia_inicio', pf.vigencia_inicio,
      'pis_cofins', pf.pis_cofins,
      'irpj_csll', pf.irpj_csll,
      'pan_card_pct', pf.pan_card_pct,
      'pan_card_transferencia', pf.pan_card_transferencia,
      'pan_card_transferencias', pf.pan_card_transferencias,
      'desconto_duplicata', pf.desconto_duplicata,
      'seguro_rctrc', pf.seguro_rctrc,
      'seguro_rcdc', pf.seguro_rcdc)
    from public.parametro_fiscal pf
    where pf.vigencia_inicio <= coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date)
    order by pf.vigencia_inicio desc
    limit 1)
  end
$$;

revoke execute on function public.parametros_calculadora(date) from public, anon;
grant execute on function public.parametros_calculadora(date) to authenticated;
