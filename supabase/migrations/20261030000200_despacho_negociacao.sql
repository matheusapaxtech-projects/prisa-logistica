-- Migration 20261030000200: o que faltava do despacho do sistema do sócio (prisa-sistema.vercel.app/despacho).
--
-- 1. Gerenciadora de risco digitada à mão (decisão do usuário em 2026-10-25): o motorista já tinha
--    situacao_gr e gr_validade; ganha o nome da gerenciadora, a data e o protocolo da consulta.
-- 2. Aprovação do conjunto pela Prisa: conjunto novo nasce pendente; quem edita aprova depois de conferir os
--    documentos (aprovar_conjunto). Os conjuntos que já existem ficam aprovados na data em que foram criados.
-- 3. aptidao_viagem ganha as travas novas (mesma assinatura e mesma ordem de exibição):
--      gr_recusado (trava_legal), gr_sem_consulta e gr_vencida (trava), conjunto_nao_aprovado (trava) e o
--      aviso gr_vencendo (7 dias). Trava o administrador libera com justificativa ao iniciar a viagem;
--      trava_legal nunca libera.
-- 4. contratar_lote: cria de uma vez as viagens do lote sugerido no despacho (planejadas, vão para o Quadro).
--    Só conjunto sem trava; a soma dos pesos não passa do saldo do pedido.
-- 5. Negociações com o motorista (aba "Calculadora e negociações"): a proposta guarda a rota, a carga, o piso e
--    o frete oferecido. Aceitou: vira viagem planejada quando tem pedido e conjunto. Recusou: guarda quanto
--    ele pediu e o motivo. Com o número do CT-e o registro fica congelado.
--    O resultado do CT-e da proposta fica em negociacao_resultado, que só admin e financeiro leem (a margem
--    é dado sensível, como na calculadora).
-- 6. v_frete_pago_rota: o que já foi pago ao motorista por rota e eixos (negociações aceitas e viagens), para
--    o "Pago nesta rota" da calculadora.

-- ---------------------------------------------------------------------------
-- 1. Gerenciadora de risco
-- ---------------------------------------------------------------------------
alter table public.motorista
  add column gr_gerenciadora text,
  add column gr_consulta_em date,
  add column gr_protocolo text;

comment on column public.motorista.gr_gerenciadora is 'Nome da gerenciadora de risco que fez a última consulta (digitado).';
comment on column public.motorista.gr_consulta_em is 'Data da última consulta na gerenciadora de risco.';
comment on column public.motorista.gr_protocolo is 'Protocolo ou número da última consulta na gerenciadora de risco.';

-- ---------------------------------------------------------------------------
-- 2. Aprovação do conjunto
-- ---------------------------------------------------------------------------
alter table public.conjunto
  add column aprovado_em timestamptz,
  add column aprovado_por uuid;

update public.conjunto set aprovado_em = created_at, aprovado_por = created_by where aprovado_em is null;

comment on column public.conjunto.aprovado_em is 'Quando a Prisa aprovou o conjunto (documentos conferidos). Nulo = pendente: não pode ser contratado.';

create function public.aprovar_conjunto(p_conjunto uuid, p_aprovar boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação aprovam conjunto' using errcode = '42501';
  end if;
  update public.conjunto
     set aprovado_em = case when p_aprovar then now() end,
         aprovado_por = case when p_aprovar then (select auth.uid()) end
   where id = p_conjunto;
  if not found then
    raise exception 'conjunto não encontrado' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.aprovar_conjunto(uuid, boolean) from public, anon;
grant execute on function public.aprovar_conjunto(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. aptidao_viagem (versão da 20261029000300 + gerenciadora de risco e aprovação do conjunto)
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
    select c.id, c.cavalo_id, c.motorista_id, c.fim, c.aprovado_em,
           exists (select 1 from public.conjunto_item ci where ci.conjunto_id = c.id) as tem_itens
    from public.conjunto c
    where c.id = p_conjunto
  ),
  mot as (
    select m.cnh_categoria, m.cnh_validade, m.situacao_cadastro, m.situacao_gr, m.gr_validade, p.nome, cj.tem_itens
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
    union all
    select 6, 'gr_recusado', 'trava_legal', format('Motorista %s: recusado pela gerenciadora de risco', mot.nome)
    from mot where mot.situacao_gr = 'recusado'
    -- trava
    union all
    select 9, 'conjunto_nao_aprovado', 'trava', 'Conjunto ainda não aprovado pela Prisa'
    from cj where cj.aprovado_em is null
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
    select 14, 'gr_sem_consulta', 'trava', format('Motorista %s: sem consulta na gerenciadora de risco', mot.nome)
    from mot
    where mot.situacao_gr = 'sem_consulta' or (mot.situacao_gr = 'habilitado' and mot.gr_validade is null)
    union all
    select 15, 'gr_vencida', 'trava',
           case when mot.gr_validade is null then format('Motorista %s: consulta na gerenciadora de risco vencida', mot.nome)
                else format('Motorista %s: consulta na gerenciadora de risco vencida em %s', mot.nome, to_char(mot.gr_validade, 'DD/MM/YYYY')) end
    from mot, hoje
    where mot.situacao_gr = 'vencido' or (mot.situacao_gr = 'habilitado' and mot.gr_validade < hoje.dia)
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
    select 51, 'gr_vencendo', 'aviso',
           format('Consulta na gerenciadora de risco vence em %s', to_char(mot.gr_validade, 'DD/MM/YYYY'))
    from mot, hoje
    where mot.situacao_gr = 'habilitado' and mot.gr_validade >= hoje.dia and mot.gr_validade <= hoje.dia + 7
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

-- Aptidão de vários conjuntos numa chamada só (o ranking do despacho mostra a de cada candidato).
create function public.aptidao_conjuntos(p_conjuntos uuid[], p_tomador uuid default null)
returns table (conjunto_id uuid, codigo text, nivel text, mensagem text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, a.codigo, a.nivel, a.mensagem
  from unnest(p_conjuntos) as c(id)
  cross join lateral public.aptidao_viagem(c.id, p_tomador) a
$$;

revoke execute on function public.aptidao_conjuntos(uuid[], uuid) from public, anon;
grant execute on function public.aptidao_conjuntos(uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. contratar_lote
-- ---------------------------------------------------------------------------
-- p_itens = [{ conjunto_id, peso_kg, frete_motorista (total, R$), km, pedagio }]. Devolve os ids das viagens,
-- na ordem dos itens. Tudo ou nada.
create function public.contratar_lote(p_pedido uuid, p_itens jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pedido public.pedido%rowtype;
  v_saldo numeric;
  v_total numeric := 0;
  v_item jsonb;
  v_cj public.conjunto%rowtype;
  v_placa text;
  v_travas text;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  if not public.pode_editar() then
    raise exception 'sem permissão para contratar' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Escolha pelo menos um caminhão para contratar.';
  end if;

  select * into v_pedido from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_pedido.situacao <> 'aberto' then
    raise exception 'O pedido #% está cancelado; não dá para contratar nele.', v_pedido.numero;
  end if;

  select s.saldo_kg into v_saldo from public.v_pedido_saldo s where s.pedido_id = p_pedido;
  select coalesce(sum((i ->> 'peso_kg')::numeric), 0) into v_total from jsonb_array_elements(p_itens) i;
  if v_total > coalesce(v_saldo, v_pedido.peso_total_kg) + 1 then
    raise exception 'O lote tem % kg e o pedido #% só tem % kg a planejar.',
      round(v_total), v_pedido.numero, round(coalesce(v_saldo, v_pedido.peso_total_kg));
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_cj from public.conjunto where id = (v_item ->> 'conjunto_id')::uuid;
    if not found or v_cj.fim is not null then
      raise exception 'Um dos conjuntos do lote foi encerrado. Atualize a tela e monte o lote de novo.';
    end if;
    select placa into v_placa from public.veiculo where id = v_cj.cavalo_id;
    if v_cj.motorista_id is null then
      raise exception 'O conjunto % está sem motorista.', v_placa;
    end if;
    if not ((v_item ->> 'peso_kg')::numeric > 0) then
      raise exception 'Peso inválido para o conjunto %.', v_placa;
    end if;

    select string_agg(a.mensagem, '; ') into v_travas
    from public.aptidao_viagem(v_cj.id, v_pedido.tomador_id) a
    where a.nivel in ('trava', 'trava_legal');
    if v_travas is not null then
      raise exception 'O conjunto % não pode ser contratado: %', v_placa, v_travas;
    end if;

    insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                               frete_motorista_valor, frete_motorista_tipo, km_viagem, pedagio_valor)
    values (p_pedido, v_cj.id, v_cj.cavalo_id, v_cj.motorista_id, round((v_item ->> 'peso_kg')::numeric),
            round((v_item ->> 'frete_motorista')::numeric, 2), 'total',
            nullif(round((v_item ->> 'km')::numeric), 0), round(coalesce((v_item ->> 'pedagio')::numeric, 0), 2))
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return v_ids;
end $$;

revoke execute on function public.contratar_lote(uuid, jsonb) from public, anon;
grant execute on function public.contratar_lote(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Negociações com o motorista
-- ---------------------------------------------------------------------------
create type public.situacao_negociacao as enum ('aberta', 'aceita', 'recusada', 'cte_emitido');

create table public.negociacao_frete (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedido (id) on delete set null,
  motorista_id uuid not null references public.motorista (pessoa_id) on delete restrict,
  conjunto_id uuid references public.conjunto (id) on delete set null,
  origem text not null,
  destino text not null,
  km integer not null,
  eixos smallint not null,
  pedagio numeric(12, 2) not null default 0,
  tipo_carga public.tipo_carga_antt not null,
  peso_kg numeric(12, 0) not null,
  valor_mercadoria_t numeric(12, 2),
  frete_cliente_t numeric(12, 2),
  piso numeric(12, 2) not null,
  frete_motorista numeric(12, 2) not null,
  situacao public.situacao_negociacao not null default 'aberta',
  valor_pedido numeric(12, 2),
  motivo text,
  viagem_id uuid references public.viagem (id) on delete set null,
  cte_numero text,
  respondida_em timestamptz,
  cte_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint negociacao_origem_preenchida check (btrim(origem) <> ''),
  constraint negociacao_destino_preenchido check (btrim(destino) <> ''),
  constraint negociacao_km_positivo check (km > 0 and km < 10000),
  constraint negociacao_eixos check (eixos between 2 and 9),
  constraint negociacao_pedagio check (pedagio >= 0),
  constraint negociacao_peso_positivo check (peso_kg > 0),
  constraint negociacao_frete_positivo check (frete_motorista > 0),
  constraint negociacao_valor_pedido check (valor_pedido is null or valor_pedido > 0),
  constraint negociacao_cte check ((situacao = 'cte_emitido') = (cte_numero is not null))
);

create index negociacao_frete_motorista_idx on public.negociacao_frete (motorista_id);
create index negociacao_frete_pedido_idx on public.negociacao_frete (pedido_id);
create index negociacao_frete_viagem_idx on public.negociacao_frete (viagem_id);
create index negociacao_frete_conjunto_idx on public.negociacao_frete (conjunto_id);

-- Resultado do CT-e da proposta (só admin e financeiro leem).
create table public.negociacao_resultado (
  negociacao_id uuid primary key references public.negociacao_frete (id) on delete cascade,
  resultado_liquido numeric(12, 2) not null,
  margem_liquida numeric(8, 5) not null
);

-- CT-e emitido congela o registro.
create function public.fn_negociacao_congelada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cte_emitido' then
    raise exception 'Negociação com CT-e emitido não muda: o registro está congelado.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function public.fn_negociacao_congelada() from public, anon, authenticated;

create trigger negociacao_congelada
  before update or delete on public.negociacao_frete
  for each row execute function public.fn_negociacao_congelada();

create trigger negociacao_frete_set_updated_at
  before update on public.negociacao_frete
  for each row execute function public.fn_set_updated_at();

revoke truncate, references, trigger on public.negociacao_frete, public.negociacao_resultado from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.negociacao_frete, public.negociacao_resultado from anon;

alter table public.negociacao_frete enable row level security;
alter table public.negociacao_resultado enable row level security;

-- Gravação só pelas funções abaixo (security definer, com as conferências de permissão).
create policy negociacao_frete_select on public.negociacao_frete
  for select to authenticated using ((select public.pode_ler()));
create policy negociacao_frete_delete on public.negociacao_frete
  for delete to authenticated using ((select public.eh_admin()) and situacao = 'aberta');
create policy negociacao_resultado_select on public.negociacao_resultado
  for select to authenticated using ((select public.pode_financeiro()));

select public.auditar('public.negociacao_frete');

-- Grava a proposta (situação "aberta"). p: as colunas da negociação; o resultado vai para negociacao_resultado.
create function public.registrar_negociacao(p jsonb, p_resultado_liquido numeric default null, p_margem_liquida numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação registram negociação' using errcode = '42501';
  end if;
  if not exists (select 1 from public.motorista m where m.pessoa_id = (p ->> 'motorista_id')::uuid) then
    raise exception 'Escolha o motorista do acervo para salvar a negociação.';
  end if;
  insert into public.negociacao_frete (pedido_id, motorista_id, conjunto_id, origem, destino, km, eixos, pedagio, tipo_carga,
                                       peso_kg, valor_mercadoria_t, frete_cliente_t, piso, frete_motorista)
  values ((p ->> 'pedido_id')::uuid, (p ->> 'motorista_id')::uuid, (p ->> 'conjunto_id')::uuid,
          btrim(p ->> 'origem'), btrim(p ->> 'destino'), round((p ->> 'km')::numeric), (p ->> 'eixos')::smallint,
          round(coalesce((p ->> 'pedagio')::numeric, 0), 2), (p ->> 'tipo_carga')::public.tipo_carga_antt,
          round((p ->> 'peso_kg')::numeric), round((p ->> 'valor_mercadoria_t')::numeric, 2),
          round((p ->> 'frete_cliente_t')::numeric, 2), round((p ->> 'piso')::numeric, 2),
          round((p ->> 'frete_motorista')::numeric, 2))
  returning id into v_id;
  if p_resultado_liquido is not null and p_margem_liquida is not null then
    insert into public.negociacao_resultado (negociacao_id, resultado_liquido, margem_liquida)
    values (v_id, round(p_resultado_liquido, 2), round(p_margem_liquida, 5));
  end if;
  return v_id;
end $$;

revoke execute on function public.registrar_negociacao(jsonb, numeric, numeric) from public, anon;
grant execute on function public.registrar_negociacao(jsonb, numeric, numeric) to authenticated;

-- Resposta do motorista. Aceitou com pedido e conjunto: cria a viagem planejada (vai para o Quadro) e devolve
-- o id dela. Recusou: guarda quanto ele pediu e o motivo.
create function public.responder_negociacao(p_id uuid, p_aceita boolean, p_valor_pedido numeric default null, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.negociacao_frete%rowtype;
  v_viagem uuid;
  v_cj public.conjunto%rowtype;
  v_pedido public.pedido%rowtype;
  v_travas text;
begin
  if not public.pode_editar() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into n from public.negociacao_frete where id = p_id for update;
  if not found then
    raise exception 'negociação não encontrada' using errcode = 'P0002';
  end if;
  if n.situacao <> 'aberta' then
    raise exception 'Esta negociação já foi respondida.';
  end if;

  if not p_aceita then
    update public.negociacao_frete
       set situacao = 'recusada', valor_pedido = case when p_valor_pedido > 0 then round(p_valor_pedido, 2) end,
           motivo = nullif(btrim(p_motivo), ''), respondida_em = now()
     where id = p_id;
    return null;
  end if;

  if n.pedido_id is not null and n.conjunto_id is not null then
    select * into v_pedido from public.pedido where id = n.pedido_id for update;
    if v_pedido.situacao <> 'aberto' then
      raise exception 'O pedido #% está cancelado; não dá para contratar nele.', v_pedido.numero;
    end if;
    select * into v_cj from public.conjunto where id = n.conjunto_id;
    if v_cj.fim is not null or v_cj.motorista_id is distinct from n.motorista_id then
      raise exception 'O conjunto deste motorista mudou. Salve a negociação de novo com o conjunto atual.';
    end if;
    select string_agg(a.mensagem, '; ') into v_travas
    from public.aptidao_viagem(v_cj.id, v_pedido.tomador_id) a
    where a.nivel in ('trava', 'trava_legal');
    if v_travas is not null then
      raise exception 'O motorista aceitou, mas ainda não pode ser contratado: %', v_travas;
    end if;
    insert into public.viagem (pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg,
                               frete_motorista_valor, frete_motorista_tipo, km_viagem, pedagio_valor)
    values (n.pedido_id, v_cj.id, v_cj.cavalo_id, v_cj.motorista_id, n.peso_kg, n.frete_motorista, 'total', n.km, n.pedagio)
    returning id into v_viagem;
  end if;

  update public.negociacao_frete
     set situacao = 'aceita', viagem_id = v_viagem, motivo = nullif(btrim(p_motivo), ''), respondida_em = now()
   where id = p_id;
  return v_viagem;
end $$;

revoke execute on function public.responder_negociacao(uuid, boolean, numeric, text) from public, anon;
grant execute on function public.responder_negociacao(uuid, boolean, numeric, text) to authenticated;

-- Número do CT-e: a negociação aceita vira "CT-e emitido" e fica congelada.
create function public.informar_cte_negociacao(p_id uuid, p_numero text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_situacao public.situacao_negociacao;
begin
  if not public.pode_editar() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_numero), '') is null then
    raise exception 'Informe o número do CT-e.';
  end if;
  select situacao into v_situacao from public.negociacao_frete where id = p_id for update;
  if not found then
    raise exception 'negociação não encontrada' using errcode = 'P0002';
  end if;
  if v_situacao <> 'aceita' then
    raise exception 'Só negociação aceita recebe o número do CT-e.';
  end if;
  update public.negociacao_frete
     set situacao = 'cte_emitido', cte_numero = btrim(p_numero), cte_em = now()
   where id = p_id;
end $$;

revoke execute on function public.informar_cte_negociacao(uuid, text) from public, anon;
grant execute on function public.informar_cte_negociacao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. v_frete_pago_rota
-- ---------------------------------------------------------------------------
create view public.v_frete_pago_rota
with (security_invoker = true) as
select 'negociacao'::text as fonte,
       n.id,
       (n.created_at at time zone 'America/Sao_Paulo')::date as dia,
       n.motorista_id,
       n.origem,
       n.destino,
       n.km,
       n.eixos::integer as eixos,
       n.frete_motorista as valor
from public.negociacao_frete n
where n.situacao in ('aceita', 'cte_emitido') and n.viagem_id is null
union all
select 'viagem',
       v.id,
       (coalesce(v.iniciada_em, v.created_at) at time zone 'America/Sao_Paulo')::date,
       v.motorista_id,
       lc.cidade || '/' || lc.uf,
       ld.cidade || '/' || ld.uf,
       v.km_viagem::integer,
       e.eixos,
       case when v.frete_motorista_tipo = 'por_tonelada'
            then round(v.frete_motorista_valor * v.peso_previsto_kg / 1000, 2)
            else v.frete_motorista_valor end
from public.viagem v
join public.pedido pe on pe.id = v.pedido_id
join public.pessoa_endereco lc on lc.id = pe.local_coleta_id
join public.pessoa_endereco ld on ld.id = pe.local_descarga_id
cross join lateral (
  select sum(tv.eixos)::integer as eixos
  from (select v.cavalo_id as veiculo_id
        union all
        select ci.veiculo_id from public.conjunto_item ci where ci.conjunto_id = v.conjunto_id) x
  join public.veiculo ve on ve.id = x.veiculo_id
  join public.tipo_veiculo tv on tv.id = ve.tipo_veiculo_id
) e
where v.cancelada_em is null and v.frete_motorista_valor > 0 and v.km_viagem > 0;
