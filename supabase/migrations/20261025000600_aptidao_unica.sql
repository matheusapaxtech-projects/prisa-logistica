-- Migration 20261025000600: aptidão da viagem num lugar só.
--
-- aptidao_da_viagem(p_viagem) = a aptidão completa da viagem em jsonb, na ordem de exibição:
--   pedido cancelado (Ruling R4) primeiro, como trava_legal, e depois as linhas de
--   aptidao_viagem(conjunto da viagem, tomador do pedido). Lista vazia = Apta; viagem inexistente = null.
--   security invoker: quem consulta vê o que o RLS deixa (pode_ler), como aptidao_viagem; chamada de
--   dentro de iniciar_viagem (security definer) roda com o dono, como antes.
--
-- Antes desta migration a regra do pedido cancelado estava escrita duas vezes (iniciar_viagem, 0300, e
-- v_viagem_planejada, 0500). Agora as duas usam aptidao_da_viagem:
-- * v_viagem_planejada: create or replace, mesmas colunas, mesma ordem e tipos.
-- * iniciar_viagem: create or replace, mesma assinatura, mesmas mensagens e o mesmo comportamento
--   (travas de cavalo/motorista antes da conferência, trava_legal nunca libera, trava só com
--   justificativa e admin, liberacao_aptidao e evento com a aptidão).

-- ---------------------------------------------------------------------------
-- aptidao_da_viagem
-- ---------------------------------------------------------------------------
create function public.aptidao_da_viagem(p_viagem uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (case when pe.situacao = 'cancelado'
          then jsonb_build_array(jsonb_build_object(
                 'codigo', 'pedido_cancelado', 'nivel', 'trava_legal',
                 'mensagem', format('O pedido #%s está cancelado', pe.numero)))
          else '[]'::jsonb end)
    || coalesce((select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem)
                                  order by a.n)
                 from public.aptidao_viagem(v.conjunto_id, pe.tomador_id) with ordinality as a(codigo, nivel, mensagem, n)),
                '[]'::jsonb)
  from public.viagem v
  left join public.pedido pe on pe.id = v.pedido_id
  where v.id = p_viagem
$$;

revoke execute on function public.aptidao_da_viagem(uuid) from public, anon;
grant execute on function public.aptidao_da_viagem(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- v_viagem_planejada (mesmas colunas da 0500)
-- ---------------------------------------------------------------------------
create or replace view public.v_viagem_planejada
with (security_invoker = true) as
select
  v.id as viagem_id,
  v.numero,
  v.pedido_id,
  pe.numero as pedido_numero,
  cav.placa as cavalo_placa,
  coalesce(nullif(btrim(pm.apelido), ''), split_part(btrim(pm.nome), ' ', 1)) as motorista_nome,
  coalesce(nullif(btrim(pt.apelido), ''), pt.nome) as cliente_nome,
  cnt.travas,
  cnt.avisos,
  apt.aptidao
from public.viagem v
left join public.pedido pe on pe.id = v.pedido_id
left join public.pessoa pt on pt.id = pe.tomador_id
left join public.veiculo cav on cav.id = v.cavalo_id
left join public.pessoa pm on pm.id = v.motorista_id
cross join lateral (
  select coalesce(public.aptidao_da_viagem(v.id), '[]'::jsonb) as aptidao
) apt
cross join lateral (
  select count(*) filter (where e ->> 'nivel' in ('trava', 'trava_legal'))::integer as travas,
         count(*) filter (where e ->> 'nivel' = 'aviso')::integer as avisos
  from jsonb_array_elements(apt.aptidao) as e
) cnt
where v.cancelada_em is null
  and v.status_campo is null;

-- ---------------------------------------------------------------------------
-- iniciar_viagem (mesma assinatura e comportamento da 0300; a aptidão vem de aptidao_da_viagem)
-- ---------------------------------------------------------------------------
create or replace function public.iniciar_viagem(p_viagem uuid, p_justificativa text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
  v_cavalo uuid;
  v_motorista uuid;
  v_just text := nullif(btrim(p_justificativa), '');
  v_apt jsonb;
  v_legal text;
  v_trava text;
begin
  if not public.pode_editar() then
    raise exception 'sem permissão para iniciar viagem' using errcode = '42501';
  end if;

  select * into v_viagem from public.viagem v where v.id = p_viagem for update;
  if not found then
    raise exception 'viagem não encontrada' using errcode = 'P0002';
  end if;
  if v_viagem.cancelada_em is not null then
    raise exception 'a viagem está cancelada';
  end if;
  if v_viagem.status_campo is not null then
    raise exception 'a viagem já começou: está em "%"', public.rotulo_status_campo(v_viagem.status_campo);
  end if;

  -- Trava cavalo e motorista do conjunto: a conferência "em outra viagem" abaixo vê o que outra
  -- liberação concorrente do mesmo cavalo/motorista gravou.
  select c.cavalo_id, c.motorista_id into v_cavalo, v_motorista
  from public.conjunto c where c.id = v_viagem.conjunto_id;
  perform 1 from public.veiculo ve where ve.id = v_cavalo for no key update;
  perform 1 from public.motorista m where m.pessoa_id = v_motorista for no key update;

  -- Aptidão completa (pedido cancelado primeiro, como trava_legal; Ruling R4).
  v_apt := coalesce(public.aptidao_da_viagem(p_viagem), '[]'::jsonb);

  select string_agg(e ->> 'mensagem', '; ' order by t.n) filter (where e ->> 'nivel' = 'trava_legal'),
         string_agg(e ->> 'mensagem', '; ' order by t.n) filter (where e ->> 'nivel' = 'trava')
  into v_legal, v_trava
  from jsonb_array_elements(v_apt) with ordinality as t(e, n);

  if v_legal is not null then
    raise exception 'viagem não pode iniciar: %', v_legal;
  end if;
  if v_trava is not null then
    if v_just is null then
      raise exception 'viagem não apta: %', v_trava;
    end if;
    if not public.eh_admin() then
      raise exception 'Só o administrador pode liberar com exceção.';
    end if;
  end if;

  update public.viagem v
     set status_campo = 'transito',
         status_desde = now(),
         iniciada_em = now(),
         iniciada_por = (select auth.uid()),
         liberacao_justificativa = v_just,
         liberacao_aptidao = v_apt,
         cavalo_id = v_cavalo,
         motorista_id = v_motorista
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, motivo, dados)
  values (p_viagem, null, 'transito', v_just, jsonb_build_object('aptidao', v_apt));
end $$;

revoke execute on function public.iniciar_viagem(uuid, text) from public, anon;
grant execute on function public.iniciar_viagem(uuid, text) to authenticated;
