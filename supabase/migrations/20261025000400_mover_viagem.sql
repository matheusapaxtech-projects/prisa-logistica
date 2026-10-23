-- Migration 20261025000400: mover a viagem pelas colunas do Quadro, chaves do CT-e/MDF-e e pagamento de saída.
--
-- chave_dfe_valida          = 44 dígitos (tudo que não é dígito é ignorado: espaços e pontos do DACTE), modelo
--                             nas posições 21-22 e dígito verificador módulo 11.
-- confirmar_pagamento_saida = adiantamento e vale-pedágio resolvidos (admin, operação ou financeiro), antes de
--                             Em rota; não muda a coluna, só grava pagamento_saida_em/por e um evento de = para.
-- mover_viagem              = única porta para trocar status_campo depois do início. Recebe a coluna que a tela
--                             via (p_de); se a viagem já mudou, recusa com "o quadro foi atualizado" sem gravar nada.
--                             Passagens permitidas e dados exigidos: ver o plano (Task 4) e os comentários abaixo.
--
-- Decisões desta migration (ver relatório da Task 4):
-- * Travas: a viagem (for update) é a única linha travada; viagem_pausa e arquivo são lidos/gravados depois dela.
--   Mesma ordem de iniciar_viagem/cancelar_viagem (viagem primeiro).
-- * Viagem cancelada: "a viagem foi cancelada; o quadro foi atualizado" (o cartão sumiu do quadro de outra pessoa).
-- * Pesos aceitam número JSON ou texto com vírgula/ponto decimal; arredondados a 0,1 kg como a coluna; zero depois do
--   arredondamento, negativo, não numérico ou acima do que cabe em numeric(12,1) → "informe o peso de ...".
-- * Recusas de dado além das do plano (o plano não dizia o texto): "informe se a pausa é programada",
--   "informe o resultado da contagem", "com divergência, a viagem vai para ...", "sem divergência, a viagem vai
--   para ...", e as de confirmar_pagamento_saida.
-- * Pausa: inicio e fim com clock_timestamp() (fim > inicio mesmo dentro de uma transação, como cancelar_viagem).
-- * Voltar uma coluna não apaga o que foi gravado (peso de saída, pagamento): a próxima passagem sobrescreve.

-- ---------------------------------------------------------------------------
-- chave_dfe_valida
-- ---------------------------------------------------------------------------
create function public.chave_dfe_valida(p_chave text, p_modelo text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_chave text := regexp_replace(coalesce(p_chave, ''), '[^0-9]', '', 'g');
  v_soma int := 0;
  v_dv int;
begin
  if length(v_chave) <> 44 or substr(v_chave, 21, 2) is distinct from p_modelo then
    return false;
  end if;
  -- pesos 2..9 da direita para a esquerda sobre os 43 primeiros dígitos
  for i in 1..43 loop
    v_soma := v_soma + substr(v_chave, i, 1)::int * (2 + (43 - i) % 8);
  end loop;
  v_dv := 11 - v_soma % 11;
  if v_dv >= 10 then
    v_dv := 0;
  end if;
  return substr(v_chave, 44, 1)::int = v_dv;
end $$;

revoke execute on function public.chave_dfe_valida(text, text) from public, anon;
grant execute on function public.chave_dfe_valida(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- confirmar_pagamento_saida
-- ---------------------------------------------------------------------------
create function public.confirmar_pagamento_saida(p_viagem uuid)
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

revoke execute on function public.confirmar_pagamento_saida(uuid) from public, anon;
grant execute on function public.confirmar_pagamento_saida(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mover_viagem
-- ---------------------------------------------------------------------------
create function public.mover_viagem(p_viagem uuid, p_de public.status_campo, p_para public.status_campo,
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
    if not exists (select 1 from public.arquivo a where a.viagem_id = p_viagem and a.tipo_arquivo_id = 15) then
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
