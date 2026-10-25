-- Migration 20261025000300: aptidão da viagem, iniciar e cancelar viagem.
--
-- rotulo_status_campo = nome exato da coluna do Quadro (null = Planejada); usado nas mensagens.
-- aptidao_viagem      = conferência da spec 4.4 (só cadastro nesta entrega; GR é aviso manual).
--                       Uma linha por problema, na ordem trava_legal, trava, aviso; nenhuma linha = Apto.
--                       security invoker: quem consulta vê o que o RLS deixa (pode_ler).
-- iniciar_viagem      = Planejada → Trânsito. trava_legal nunca libera; trava só com justificativa e admin.
-- cancelar_viagem     = só antes de Em rota (Planejada, Trânsito…Aguardando NF e pagamento, ou Pausa aberta
--                       a partir de Trânsito); fecha a pausa aberta.
--
-- Decisões desta migration (ver relatório da Task 3):
-- * motorista_cadastro olha motorista.situacao_cadastro (o "cadastro do motorista" que a ficha edita e que
--   o conjunto já exige normal), não pessoa.situacao_cadastro: as telas nunca mudam a situação da pessoa
--   de um motorista, então ela fica "pendente" para sempre e travaria toda viagem.
-- * pedido_cancelado (Ruling R4) é conferido em iniciar_viagem (aptidao_viagem não recebe o pedido) e entra
--   junto com as demais trava_legal.
-- * No início a viagem copia de novo cavalo e motorista do conjunto: a aptidão confere o conjunto atual,
--   e quem sai é quem está no conjunto agora (a cópia do planejamento pode ter ficado velha).
-- * Cavalo e motorista são travados (for no key update) antes da conferência "em outra viagem", para duas
--   liberações simultâneas do mesmo cavalo/motorista não passarem as duas.
-- * Cancelar deixa status_campo nulo (o evento é "status → null") e grava cancelada_*; "cancelada" é
--   cancelada_em não nulo.

-- ---------------------------------------------------------------------------
-- rotulo_status_campo
-- ---------------------------------------------------------------------------
create function public.rotulo_status_campo(p public.status_campo)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'transito' then 'Trânsito'
    when 'aguardando_carregamento' then 'Aguardando carregamento'
    when 'em_carregamento' then 'Em carregamento'
    when 'aguardando_nf_pagamento' then 'Aguardando NF e pagamento'
    when 'em_rota' then 'Em rota'
    when 'pausa' then 'Pausa'
    when 'aguardando_descarga' then 'Aguardando descarga'
    when 'aguardando_contagem' then 'Aguardando contagem de divergência'
    when 'resolucao_divergencia' then 'Resolução de divergência na carga'
    when 'frete_finalizado' then 'Frete finalizado'
    else 'Planejada'
  end
$$;

revoke execute on function public.rotulo_status_campo(public.status_campo) from public, anon;
grant execute on function public.rotulo_status_campo(public.status_campo) to authenticated;

-- ---------------------------------------------------------------------------
-- aptidao_viagem
-- ---------------------------------------------------------------------------
create function public.aptidao_viagem(p_conjunto uuid, p_tomador uuid default null)
returns table (codigo text, nivel text, mensagem text)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as dia
  ),
  cj as (
    select c.id, c.cavalo_id, c.motorista_id, c.fim,
           exists (select 1 from public.conjunto_item ci where ci.conjunto_id = c.id) as tem_itens
    from public.conjunto c
    where c.id = p_conjunto
  ),
  mot as (
    select m.cnh_categoria, m.cnh_validade, m.situacao_cadastro, p.nome, cj.tem_itens
    from cj
    join public.motorista m on m.pessoa_id = cj.motorista_id
    join public.pessoa p on p.id = m.pessoa_id
  ),
  placas as (
    select 0 as posicao, v.id, v.placa, v.situacao_cadastro, v.exercicio_doc
    from cj join public.veiculo v on v.id = cj.cavalo_id
    union all
    select ci.posicao, v.id, v.placa, v.situacao_cadastro, v.exercicio_doc
    from cj
    join public.conjunto_item ci on ci.conjunto_id = cj.id
    join public.veiculo v on v.id = ci.veiculo_id
  ),
  linhas (ordem, codigo, nivel, mensagem) as (
    -- trava legal
    select 1, 'conjunto_nao_encontrado', 'trava_legal', 'Conjunto não encontrado'
    where not exists (select 1 from cj)
    union all
    select 2, 'conjunto_encerrado', 'trava_legal', 'O conjunto está encerrado'
    from cj where cj.fim is not null
    union all
    select 3, 'sem_motorista', 'trava_legal', 'O conjunto não tem motorista'
    from cj where cj.motorista_id is null
    union all
    select 4, 'cavalo_em_viagem', 'trava_legal',
           format('O cavalo %s já está na viagem #%s, em "%s"', cav.placa, o.numero, public.rotulo_status_campo(o.status_campo))
    from cj
    join public.veiculo cav on cav.id = cj.cavalo_id
    join public.viagem o on o.cavalo_id = cj.cavalo_id
    where o.cancelada_em is null and o.status_campo is not null and o.status_campo <> 'frete_finalizado'
    union all
    select 5, 'motorista_em_viagem', 'trava_legal',
           format('O motorista %s já está na viagem #%s, em "%s"', p.nome, o.numero, public.rotulo_status_campo(o.status_campo))
    from cj
    join public.pessoa p on p.id = cj.motorista_id
    join public.viagem o on o.motorista_id = cj.motorista_id
    where o.cancelada_em is null and o.status_campo is not null and o.status_campo <> 'frete_finalizado'
    -- trava
    union all
    select 10, 'motorista_cadastro', 'trava', format('O cadastro do motorista %s não está normal', mot.nome)
    from mot where mot.situacao_cadastro <> 'normal'
    union all
    select 11, 'cnh_ausente', 'trava', 'CNH do motorista sem validade informada'
    from mot where mot.cnh_validade is null
    union all
    select 12, 'cnh_vencida', 'trava', format('CNH do motorista vencida em %s', to_char(mot.cnh_validade, 'DD/MM/YYYY'))
    from mot, hoje where mot.cnh_validade < hoje.dia
    union all
    select 13, 'cnh_categoria', 'trava',
           case
             when mot.cnh_categoria is null then 'CNH do motorista sem categoria informada'
             when mot.tem_itens then format('CNH categoria %s não serve para conjunto com carreta (precisa ser E)',
                                            upper(mot.cnh_categoria::text))
             else format('CNH categoria %s não serve para este veículo (precisa ser C, D ou E)', upper(mot.cnh_categoria::text))
           end
    from mot
    where mot.cnh_categoria is null
       or (mot.tem_itens and mot.cnh_categoria not in ('e', 'ae'))
       or (not mot.tem_itens and mot.cnh_categoria not in ('c', 'd', 'e', 'ac', 'ad', 'ae'))
    union all
    select 20 + pl.posicao, 'veiculo_cadastro', 'trava', format('O cadastro da placa %s não está normal', pl.placa)
    from placas pl where pl.situacao_cadastro <> 'normal'
    union all
    select 30 + pl.posicao, 'crlv_exercicio', 'trava',
           case when pl.exercicio_doc is null then format('CRLV da placa %s sem exercício informado', pl.placa)
                else format('CRLV da placa %s é do exercício %s', pl.placa, pl.exercicio_doc) end
    from placas pl, hoje
    where pl.exercicio_doc is null or pl.exercicio_doc < extract(year from hoje.dia)::int - 1
    union all
    select 40 + pl.posicao, 'arrendado_sem_contrato', 'trava',
           format('A placa %s é arrendada e não tem contrato anexado', pl.placa)
    from placas pl
    where exists (select 1 from public.v_pendencias_documentos pd
                  where pd.tipo_pendencia = 'veiculo_arrendado_sem_contrato' and pd.veiculo_id = pl.id)
    -- aviso
    union all
    select 50, 'cnh_vencendo', 'aviso', format('CNH do motorista vence em %s', to_char(mot.cnh_validade, 'DD/MM/YYYY'))
    from mot, hoje where mot.cnh_validade >= hoje.dia and mot.cnh_validade <= hoje.dia + 30
    union all
    select 60 + pl.posicao, 'crlv_exercicio', 'aviso',
           format('CRLV da placa %s ainda é do exercício %s', pl.placa, pl.exercicio_doc)
    from placas pl, hoje
    where pl.exercicio_doc = extract(year from hoje.dia)::int - 1
    union all
    select 70, 'acima_cmt', 'aviso', 'O conjunto passa do CMT do cavalo'
    from public.v_conjunto_capacidade vc where vc.conjunto_id = p_conjunto and vc.excede_cmt
    union all
    select 80, 'cliente_exige_gr', 'aviso',
           format('O cliente exige GR%s: confira a consulta antes de sair',
                  case when nullif(btrim(cl.gerenciadora), '') is not null then ' (' || btrim(cl.gerenciadora) || ')' else '' end)
    from public.cliente cl where cl.pessoa_id = p_tomador and cl.exige_gr
    union all
    select 81, 'cliente_exige_sm', 'aviso', 'O cliente exige SM: abra o monitoramento antes de sair'
    from public.cliente cl where cl.pessoa_id = p_tomador and cl.exige_sm
  )
  select l.codigo, l.nivel, l.mensagem
  from linhas l
  order by l.ordem, l.mensagem
$$;

revoke execute on function public.aptidao_viagem(uuid, uuid) from public, anon;
grant execute on function public.aptidao_viagem(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- iniciar_viagem
-- ---------------------------------------------------------------------------
create function public.iniciar_viagem(p_viagem uuid, p_justificativa text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
  v_cavalo uuid;
  v_motorista uuid;
  v_tomador uuid;
  v_pedido_numero bigint;
  v_pedido_situacao public.situacao_pedido;
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

  select p.tomador_id, p.numero, p.situacao into v_tomador, v_pedido_numero, v_pedido_situacao
  from public.pedido p where p.id = v_viagem.pedido_id;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n),
                  '[]'::jsonb)
  into v_apt
  from public.aptidao_viagem(v_viagem.conjunto_id, v_tomador) with ordinality as a(codigo, nivel, mensagem, n);

  -- Ruling R4: pedido cancelado é trava legal (a aptidão não recebe o pedido).
  if v_pedido_situacao = 'cancelado' then
    v_apt := jsonb_build_array(jsonb_build_object(
      'codigo', 'pedido_cancelado', 'nivel', 'trava_legal',
      'mensagem', format('O pedido #%s está cancelado', v_pedido_numero))) || v_apt;
  end if;

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

-- ---------------------------------------------------------------------------
-- cancelar_viagem
-- ---------------------------------------------------------------------------
create function public.cancelar_viagem(p_viagem uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_origem_pausa public.status_campo;
begin
  if not public.pode_editar() then
    raise exception 'sem permissão para cancelar viagem' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'informe o motivo do cancelamento';
  end if;

  select * into v_viagem from public.viagem v where v.id = p_viagem for update;
  if not found then
    raise exception 'viagem não encontrada' using errcode = 'P0002';
  end if;
  if v_viagem.cancelada_em is not null then
    raise exception 'a viagem já está cancelada';
  end if;

  select pa.coluna_origem into v_origem_pausa
  from public.viagem_pausa pa where pa.viagem_id = p_viagem and pa.fim is null;

  if not (v_viagem.status_campo is null
          or v_viagem.status_campo between 'transito' and 'aguardando_nf_pagamento'
          or (v_viagem.status_campo = 'pausa' and v_origem_pausa = 'transito')) then
    raise exception 'a viagem está em "%"; só dá para cancelar antes de "Em rota"',
      public.rotulo_status_campo(v_viagem.status_campo);
  end if;

  -- clock_timestamp: a pausa pode ter sido aberta nesta mesma transação (fim > inicio).
  update public.viagem_pausa pa set fim = clock_timestamp()
   where pa.viagem_id = p_viagem and pa.fim is null;

  update public.viagem v
     set status_campo = null,
         status_desde = now(),
         cancelada_em = now(),
         cancelada_por = (select auth.uid()),
         cancelamento_motivo = v_motivo
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, motivo)
  values (p_viagem, v_viagem.status_campo, null, v_motivo);
end $$;

revoke execute on function public.cancelar_viagem(uuid, text) from public, anon;
grant execute on function public.cancelar_viagem(uuid, text) to authenticated;
