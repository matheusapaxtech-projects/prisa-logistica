-- Migration 20261029000300: travas de documento do kanban (motor de despacho, rotina 7).
--
-- O Quadro ganha as duas etapas do motor que faltavam (enum na migration 20261029000200):
--   aguardando_descarga → descarregando → aguardando_contagem   (o peso de chegada e o canhoto passam para a
--                                                                saída de "Descarregando")
--   contagem/resolução  → aguardando_saldo → frete_finalizado
-- e as travas de documento do motor (kanban.ts, podeMover):
--   aguardando_carregamento → em_carregamento : checklist do veículo conferido
--   aguardando_nf_pagamento → em_rota         : além de CT-e, MDF-e e pagamento de saída, NF-e do cliente
--                                               (chave modelo 55), CIOT e averbação do seguro
--   aguardando_saldo        → frete_finalizado: saldo de 30% confirmado (confirmar_saldo), MDF-e e CIOT
--                                               encerrados
-- confirmar_saldo = admin, operação ou financeiro, só em "Aguardando saldo (30%)"; como o pagamento de saída,
--   não muda a coluna, grava saldo_pago_em/por e um evento de = para.
-- quadro_limite ganha as duas colunas: Descarregando 2 h / 3 h; Aguardando saldo 48 h / 72 h (prazos do motor).
-- v_quadro: mesmas colunas e ordem, mais saldo_pago e tem_documentos_saida no fim.

-- ---------------------------------------------------------------------------
-- viagem: documentos e marcos do motor (só as RPCs gravam: sem grant de insert/update)
-- ---------------------------------------------------------------------------
alter table public.viagem
  add column checklist_veiculo_em timestamptz,
  add column chave_nfe char(44),
  add column ciot text,
  add column averbacao_seguro text,
  add column saldo_pago_em timestamptz,
  add column saldo_pago_por uuid,
  add column mdfe_encerrado_em timestamptz,
  add column ciot_encerrado_em timestamptz,
  add constraint viagem_ciot_digitos check (ciot ~ '^[0-9]{12,16}$');

-- ---------------------------------------------------------------------------
-- rotulo_status_campo (mesma assinatura; as duas etapas novas)
-- ---------------------------------------------------------------------------
create or replace function public.rotulo_status_campo(p public.status_campo)
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
    when 'descarregando' then 'Descarregando'
    when 'aguardando_contagem' then 'Aguardando contagem de divergência'
    when 'resolucao_divergencia' then 'Resolução de divergência na carga'
    when 'aguardando_saldo' then 'Aguardando saldo (30%)'
    when 'frete_finalizado' then 'Frete finalizado'
    else 'Planejada'
  end
$$;

-- ---------------------------------------------------------------------------
-- quadro_limite: as duas colunas novas
-- ---------------------------------------------------------------------------
insert into public.quadro_limite (chave, minutos_ambar, minutos_vermelho) values
  ('descarregando', 120, 180),
  ('aguardando_saldo', 2880, 4320);

-- ---------------------------------------------------------------------------
-- confirmar_saldo
-- ---------------------------------------------------------------------------
create function public.confirmar_saldo(p_viagem uuid)
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

  update public.viagem v
     set saldo_pago_em = now(),
         saldo_pago_por = (select auth.uid())
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, dados)
  values (p_viagem, v_viagem.status_campo, v_viagem.status_campo, '{"tipo": "saldo_pago"}'::jsonb);
end $$;

revoke execute on function public.confirmar_saldo(uuid) from public, anon;
grant execute on function public.confirmar_saldo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mover_viagem (mesma assinatura; etapas e travas do motor)
-- ---------------------------------------------------------------------------

create or replace function public.mover_viagem(p_viagem uuid, p_de public.status_campo, p_para public.status_campo,
                                    p_dados jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagem%rowtype;
  v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
  v_motivo text := nullif(btrim(coalesce(p_dados, '{}'::jsonb) ->> 'motivo'), '');
  v_origem_pausa public.status_campo;
  v_texto text;
  v_peso numeric;
begin
  if not public.pode_editar() then
    raise exception 'sem permissão para mover viagem' using errcode = '42501';
  end if;

  select * into v_viagem from public.viagem v where v.id = p_viagem for update;
  if not found then
    raise exception 'viagem não encontrada' using errcode = 'P0002';
  end if;
  if v_viagem.cancelada_em is not null then
    raise exception 'a viagem foi cancelada; o quadro foi atualizado';
  end if;
  if v_viagem.status_campo is distinct from p_de then
    raise exception 'a viagem já está em "%"; o quadro foi atualizado', public.rotulo_status_campo(v_viagem.status_campo);
  end if;

  if p_de = 'pausa' then
    -- Pausa → a coluna de onde a pausa saiu (fecha a pausa)
    select pa.coluna_origem into v_origem_pausa
    from public.viagem_pausa pa where pa.viagem_id = p_viagem and pa.fim is null;
    if v_origem_pausa is null or p_para is distinct from v_origem_pausa then
      raise exception 'não é possível passar de "%" para "%"',
        public.rotulo_status_campo(p_de), public.rotulo_status_campo(p_para);
    end if;
    update public.viagem_pausa pa set fim = clock_timestamp()
     where pa.viagem_id = p_viagem and pa.fim is null;

  elsif p_de in ('transito', 'em_rota') and p_para = 'pausa' then
    v_texto := v_dados ->> 'pausa_tipo';
    if v_texto is null or not (v_texto = any (enum_range(null::public.tipo_pausa)::text[])) then
      raise exception 'informe o tipo da pausa';
    end if;
    if jsonb_typeof(v_dados -> 'pausa_programada') is distinct from 'boolean' then
      raise exception 'informe se a pausa é programada';
    end if;
    insert into public.viagem_pausa (viagem_id, tipo, programada, coluna_origem, inicio)
    values (p_viagem, v_texto::public.tipo_pausa, (v_dados ->> 'pausa_programada')::boolean, p_de, clock_timestamp());

  elsif (p_de = 'transito' and p_para = 'aguardando_carregamento')
     or (p_de = 'em_rota' and p_para = 'aguardando_descarga')
     or (p_de = 'aguardando_descarga' and p_para = 'descarregando') then
    null;

  elsif p_de = 'aguardando_carregamento' and p_para = 'em_carregamento' then
    -- motor de despacho: só entra para carregar com o checklist do veículo conferido
    if jsonb_typeof(v_dados -> 'checklist_veiculo') is distinct from 'boolean'
       or not (v_dados ->> 'checklist_veiculo')::boolean then
      raise exception 'confira o checklist do veículo (carroceria limpa, lona, CRLV, CNH e tacógrafo)';
    end if;
    v_viagem.checklist_veiculo_em := now();

  elsif p_de = 'em_carregamento' and p_para = 'aguardando_nf_pagamento' then
    v_texto := replace(btrim(v_dados ->> 'peso_saida_kg'), ',', '.');
    v_peso := case when v_texto ~ '^[0-9]+(\.[0-9]+)?$' then round(v_texto::numeric, 1) end;
    if v_peso is null or v_peso <= 0 or v_peso >= 100000000000 then
      raise exception 'informe o peso de saída';
    end if;
    v_viagem.peso_saida_kg := v_peso;

  elsif p_de = 'aguardando_nf_pagamento' and p_para = 'em_rota' then
    if not public.chave_dfe_valida(v_dados ->> 'chave_cte', '57') then
      raise exception 'chave do CT-e inválida';
    end if;
    if not public.chave_dfe_valida(v_dados ->> 'chave_mdfe', '58') then
      raise exception 'chave do MDF-e inválida';
    end if;
    if not public.chave_dfe_valida(v_dados ->> 'chave_nfe', '55') then
      raise exception 'chave da NF-e do cliente inválida';
    end if;
    if coalesce(regexp_replace(v_dados ->> 'ciot', '[^0-9]', '', 'g'), '') !~ '^[0-9]{12,16}$' then
      raise exception 'informe o número do CIOT';
    end if;
    if nullif(btrim(v_dados ->> 'averbacao'), '') is null then
      raise exception 'informe o número da averbação do seguro';
    end if;
    if v_viagem.pagamento_saida_em is null then
      raise exception 'falta confirmar o adiantamento e o vale-pedágio';
    end if;
    v_viagem.chave_cte := regexp_replace(v_dados ->> 'chave_cte', '[^0-9]', '', 'g');
    v_viagem.chave_mdfe := regexp_replace(v_dados ->> 'chave_mdfe', '[^0-9]', '', 'g');
    v_viagem.chave_nfe := regexp_replace(v_dados ->> 'chave_nfe', '[^0-9]', '', 'g');
    v_viagem.ciot := regexp_replace(v_dados ->> 'ciot', '[^0-9]', '', 'g');
    v_viagem.averbacao_seguro := left(btrim(v_dados ->> 'averbacao'), 60);

  elsif p_de = 'descarregando' and p_para = 'aguardando_contagem' then
    v_texto := replace(btrim(v_dados ->> 'peso_chegada_kg'), ',', '.');
    v_peso := case when v_texto ~ '^[0-9]+(\.[0-9]+)?$' then round(v_texto::numeric, 1) end;
    if v_peso is null or v_peso <= 0 or v_peso >= 100000000000 then
      raise exception 'informe o peso de chegada';
    end if;
    if not public.canhoto_enviado(p_viagem) then
      raise exception 'falta o canhoto';
    end if;
    v_viagem.peso_chegada_kg := v_peso;

  elsif p_de = 'aguardando_contagem' and p_para = 'aguardando_saldo' then
    v_texto := v_dados ->> 'divergencia';
    if v_texto in ('falta', 'sobra', 'avaria') then
      raise exception 'com divergência, a viagem vai para "Resolução de divergência na carga"';
    end if;
    if v_texto is distinct from 'sem_divergencia' then
      raise exception 'informe o resultado da contagem';
    end if;
    v_viagem.divergencia := 'sem_divergencia';

  elsif p_de = 'aguardando_contagem' and p_para = 'resolucao_divergencia' then
    v_texto := v_dados ->> 'divergencia';
    if v_texto = 'sem_divergencia' then
      raise exception 'sem divergência, a viagem vai para "Aguardando saldo (30%%)"';
    end if;
    if v_texto is null or v_texto not in ('falta', 'sobra', 'avaria') then
      raise exception 'informe o resultado da contagem';
    end if;
    if nullif(btrim(v_dados ->> 'divergencia_descricao'), '') is null then
      raise exception 'descreva a divergência';
    end if;
    v_viagem.divergencia := v_texto::public.resultado_contagem;
    v_viagem.divergencia_descricao := btrim(v_dados ->> 'divergencia_descricao');

  elsif p_de = 'resolucao_divergencia' and p_para = 'aguardando_saldo' then
    if nullif(btrim(v_dados ->> 'resolucao'), '') is null then
      raise exception 'descreva a resolução';
    end if;
    v_viagem.resolucao := btrim(v_dados ->> 'resolucao');

  elsif p_de = 'aguardando_saldo' and p_para = 'frete_finalizado' then
    -- Lei 15.485/2026: saldo pago (até 30 dias úteis), MDF-e e CIOT encerrados
    if v_viagem.saldo_pago_em is null then
      raise exception 'falta confirmar o pagamento do saldo de 30%%';
    end if;
    if jsonb_typeof(v_dados -> 'mdfe_encerrado') is distinct from 'boolean' or not (v_dados ->> 'mdfe_encerrado')::boolean then
      raise exception 'encerre o MDF-e antes de finalizar';
    end if;
    if jsonb_typeof(v_dados -> 'ciot_encerrado') is distinct from 'boolean' or not (v_dados ->> 'ciot_encerrado')::boolean then
      raise exception 'encerre o CIOT antes de finalizar';
    end if;
    v_viagem.mdfe_encerrado_em := now();
    v_viagem.ciot_encerrado_em := now();
    v_viagem.finalizada_em := now();

  elsif (p_de = 'aguardando_carregamento' and p_para = 'transito')
     or (p_de = 'em_carregamento' and p_para = 'aguardando_carregamento')
     or (p_de = 'aguardando_nf_pagamento' and p_para = 'em_carregamento')
     or (p_de = 'descarregando' and p_para = 'aguardando_descarga') then
    -- voltar uma coluna (clique errado): só com motivo e só antes de Em rota
    if v_motivo is null then
      raise exception 'informe o motivo para voltar a viagem';
    end if;

  else
    raise exception 'não é possível passar de "%" para "%"',
      public.rotulo_status_campo(p_de), public.rotulo_status_campo(p_para);
  end if;

  update public.viagem v
     set status_campo = p_para,
         status_desde = now(),
         peso_saida_kg = v_viagem.peso_saida_kg,
         chave_cte = v_viagem.chave_cte,
         chave_mdfe = v_viagem.chave_mdfe,
         chave_nfe = v_viagem.chave_nfe,
         ciot = v_viagem.ciot,
         averbacao_seguro = v_viagem.averbacao_seguro,
         checklist_veiculo_em = v_viagem.checklist_veiculo_em,
         mdfe_encerrado_em = v_viagem.mdfe_encerrado_em,
         ciot_encerrado_em = v_viagem.ciot_encerrado_em,
         peso_chegada_kg = v_viagem.peso_chegada_kg,
         divergencia = v_viagem.divergencia,
         divergencia_descricao = v_viagem.divergencia_descricao,
         resolucao = v_viagem.resolucao,
         finalizada_em = v_viagem.finalizada_em
   where v.id = p_viagem;

  insert into public.viagem_evento (viagem_id, de, para, motivo, dados)
  values (p_viagem, p_de, p_para, v_motivo, v_dados);
end $$;

revoke execute on function public.mover_viagem(uuid, public.status_campo, public.status_campo, jsonb) from public, anon;
grant execute on function public.mover_viagem(uuid, public.status_campo, public.status_campo, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- v_quadro (as colunas de antes, na mesma ordem, e duas novas no fim)
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
  (v.ciot is not null and v.chave_nfe is not null and v.averbacao_seguro is not null) as tem_documentos_saida
from public.viagem v
left join public.pedido pe on pe.id = v.pedido_id
left join public.pessoa pt on pt.id = pe.tomador_id
left join public.pessoa_endereco orig on orig.id = pe.local_coleta_id
left join public.pessoa_endereco dest on dest.id = pe.local_descarga_id
left join public.veiculo cav on cav.id = v.cavalo_id
left join public.pessoa pm on pm.id = v.motorista_id
left join public.viagem_pausa pa on pa.viagem_id = v.id and pa.fim is null
where v.cancelada_em is null
  and v.status_campo is not null
  and (v.status_campo <> 'frete_finalizado'
       or (v.finalizada_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date);


-- ---------------------------------------------------------------------------
-- aptidao_viagem (mesma assinatura): em "Aguardando saldo (30%)" o caminhão já descarregou e está livre;
-- só falta pagar o saldo (até 30 dias úteis). Não conta como "já está em viagem".
-- ---------------------------------------------------------------------------
create or replace function public.aptidao_viagem(p_conjunto uuid, p_tomador uuid default null)
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
    where o.cancelada_em is null and o.status_campo is not null and o.status_campo not in ('aguardando_saldo', 'frete_finalizado')
    union all
    select 5, 'motorista_em_viagem', 'trava_legal',
           format('O motorista %s já está na viagem #%s, em "%s"', p.nome, o.numero, public.rotulo_status_campo(o.status_campo))
    from cj
    join public.pessoa p on p.id = cj.motorista_id
    join public.viagem o on o.motorista_id = cj.motorista_id
    where o.cancelada_em is null and o.status_campo is not null and o.status_campo not in ('aguardando_saldo', 'frete_finalizado')
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
