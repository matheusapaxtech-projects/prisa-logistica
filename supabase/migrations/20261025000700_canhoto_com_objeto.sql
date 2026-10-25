-- Migration 20261025000700: canhoto só conta com o arquivo de verdade (Ruling R13).
--
-- Antes, "tem canhoto" era só existir a linha de arquivo tipo 15 (CANHOTO) da viagem. No fluxo canônico
-- de upload a linha é gravada antes do objeto; se o envio do objeto falha, a linha fica sem arquivo no
-- Storage ("envio falhou" na tela) e mesmo assim liberava a passagem Aguardando descarga → contagem e
-- acendia o sinal de canhoto no Quadro.
--
-- canhoto_enviado(p_viagem) = existe arquivo tipo 15 da viagem cujo storage_path existe em
--   storage.objects no bucket 'documentos'. security definer: a regra não depende do RLS de quem
--   consulta (v_quadro é security_invoker e storage.objects esconde objetos de arquivo restrito de quem
--   não é admin; um canhoto restrito continua sendo canhoto). Só responde a quem pode_ler() (sem perfil:
--   false), para não servir de consulta a quem não vê a viagem.
-- mover_viagem: create or replace, mesma assinatura, mesmas mensagens; só a conferência do canhoto usa
--   canhoto_enviado.
-- v_quadro: create or replace, mesmas colunas, mesma ordem e tipos; tem_canhoto usa canhoto_enviado.
--   Grants e security_invoker preservados.

-- ---------------------------------------------------------------------------
-- canhoto_enviado
-- ---------------------------------------------------------------------------
create function public.canhoto_enviado(p_viagem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pode_ler() and exists (
    select 1
    from public.arquivo a
    join storage.objects o on o.bucket_id = 'documentos' and o.name = a.storage_path
    where a.viagem_id = p_viagem and a.tipo_arquivo_id = 15)
$$;

revoke execute on function public.canhoto_enviado(uuid) from public, anon;
grant execute on function public.canhoto_enviado(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mover_viagem (mesma assinatura e comportamento da 0400; canhoto com objeto)
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
     or (p_de = 'aguardando_carregamento' and p_para = 'em_carregamento')
     or (p_de = 'em_rota' and p_para = 'aguardando_descarga') then
    null;

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
    if v_viagem.pagamento_saida_em is null then
      raise exception 'falta confirmar o adiantamento e o vale-pedágio';
    end if;
    v_viagem.chave_cte := regexp_replace(v_dados ->> 'chave_cte', '[^0-9]', '', 'g');
    v_viagem.chave_mdfe := regexp_replace(v_dados ->> 'chave_mdfe', '[^0-9]', '', 'g');

  elsif p_de = 'aguardando_descarga' and p_para = 'aguardando_contagem' then
    v_texto := replace(btrim(v_dados ->> 'peso_chegada_kg'), ',', '.');
    v_peso := case when v_texto ~ '^[0-9]+(\.[0-9]+)?$' then round(v_texto::numeric, 1) end;
    if v_peso is null or v_peso <= 0 or v_peso >= 100000000000 then
      raise exception 'informe o peso de chegada';
    end if;
    if not public.canhoto_enviado(p_viagem) then
      raise exception 'falta o canhoto';
    end if;
    v_viagem.peso_chegada_kg := v_peso;

  elsif p_de = 'aguardando_contagem' and p_para = 'frete_finalizado' then
    v_texto := v_dados ->> 'divergencia';
    if v_texto in ('falta', 'sobra', 'avaria') then
      raise exception 'com divergência, a viagem vai para "Resolução de divergência na carga"';
    end if;
    if v_texto is distinct from 'sem_divergencia' then
      raise exception 'informe o resultado da contagem';
    end if;
    v_viagem.divergencia := 'sem_divergencia';
    v_viagem.finalizada_em := now();

  elsif p_de = 'aguardando_contagem' and p_para = 'resolucao_divergencia' then
    v_texto := v_dados ->> 'divergencia';
    if v_texto = 'sem_divergencia' then
      raise exception 'sem divergência, a viagem vai para "Frete finalizado"';
    end if;
    if v_texto is null or v_texto not in ('falta', 'sobra', 'avaria') then
      raise exception 'informe o resultado da contagem';
    end if;
    if nullif(btrim(v_dados ->> 'divergencia_descricao'), '') is null then
      raise exception 'descreva a divergência';
    end if;
    v_viagem.divergencia := v_texto::public.resultado_contagem;
    v_viagem.divergencia_descricao := btrim(v_dados ->> 'divergencia_descricao');

  elsif p_de = 'resolucao_divergencia' and p_para = 'frete_finalizado' then
    if nullif(btrim(v_dados ->> 'resolucao'), '') is null then
      raise exception 'descreva a resolução';
    end if;
    v_viagem.resolucao := btrim(v_dados ->> 'resolucao');
    v_viagem.finalizada_em := now();

  elsif (p_de = 'aguardando_carregamento' and p_para = 'transito')
     or (p_de = 'em_carregamento' and p_para = 'aguardando_carregamento')
     or (p_de = 'aguardando_nf_pagamento' and p_para = 'em_carregamento') then
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
-- v_quadro (mesmas colunas da 0500; tem_canhoto com objeto)
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
    where o.viagem_id = v.id and o.resolvida_em is null) as ocorrencias_abertas
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
