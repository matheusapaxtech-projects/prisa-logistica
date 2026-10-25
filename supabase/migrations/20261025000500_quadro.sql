-- Migration 20261025000500: views do Quadro da operação, tempos-limite das colunas e tempo real.
--
-- quadro_limite      = minutos para o cartão ficar âmbar e vermelho, por coluna (e por tipo de pausa).
--                      Carga inicial é decisão do plano; o admin muda depois. Coluna sem linha (Trânsito,
--                      Em rota, Frete finalizado) nunca muda de cor. Ninguém insere nem apaga pela API: a
--                      lista de chaves é fixa; o admin só muda os minutos.
-- v_quadro           = um cartão por viagem iniciada e não cancelada; "Frete finalizado" só mostra o que
--                      finalizou hoje no dia de Brasília (das 21h à meia-noite BRT o UTC já é amanhã).
-- v_pedido_saldo     = peso do pedido já alocado em viagens não canceladas (peso de saída quando já há,
--                      senão o previsto) e o saldo.
-- v_viagem_planejada = viagens planejadas (status_campo nulo, não canceladas) com a aptidão do conjunto.
-- Tempo real         = viagem entra na publicação supabase_realtime (o Quadro escuta e recarrega).
--
-- Decisões desta migration (ver relatório da Task 5):
-- * As três views são security_invoker: quem consulta vê o que o RLS deixa (pode_ler). Os cadastros
--   ligados (pedido, pessoa, endereço, veículo) entram com left join: o cartão nunca some por causa de
--   um cadastro relacionado.
-- * motorista_nome = apelido da pessoa ou, sem apelido, o primeiro nome; cliente_nome (tomador) =
--   apelido ou nome. Apelido só com espaços conta como sem apelido.
-- * v_viagem_planejada.aptidao repete a regra de iniciar_viagem (Ruling R4): pedido cancelado entra como
--   trava_legal no início da lista, para a tela não mostrar "Apta" uma viagem que não vai iniciar.
-- * tem_chaves = CT-e e MDF-e gravados; pagamento_saida = adiantamento e vale-pedágio confirmados;
--   tem_canhoto = arquivo tipo 15 (CANHOTO) da viagem; ocorrencias_abertas = ocorrências sem resolvida_em.

-- ---------------------------------------------------------------------------
-- quadro_limite
-- ---------------------------------------------------------------------------
create table public.quadro_limite (
  chave text primary key,
  minutos_ambar integer not null,
  minutos_vermelho integer not null,
  constraint quadro_limite_ambar_positivo check (minutos_ambar > 0),
  constraint quadro_limite_vermelho_depois_do_ambar check (minutos_vermelho > minutos_ambar)
);

insert into public.quadro_limite (chave, minutos_ambar, minutos_vermelho) values
  ('aguardando_carregamento', 120, 240),
  ('em_carregamento', 120, 240),
  ('aguardando_nf_pagamento', 120, 240),
  ('aguardando_descarga', 120, 240),
  ('aguardando_contagem', 240, 1440),
  ('resolucao_divergencia', 1440, 2880),
  ('pausa_nao_programada', 30, 60),
  ('pausa_programada', 60, 120);

-- Privilégios: authenticated só lê e muda os minutos (RLS: só admin muda); anon nada.
revoke select, insert, update, delete, truncate, references, trigger on public.quadro_limite from anon;
revoke insert, update, delete, truncate, references, trigger on public.quadro_limite from authenticated;
grant select on public.quadro_limite to authenticated;
grant update (minutos_ambar, minutos_vermelho) on public.quadro_limite to authenticated;

alter table public.quadro_limite enable row level security;

create policy quadro_limite_select on public.quadro_limite
  for select to authenticated using ((select public.pode_ler()));
create policy quadro_limite_update on public.quadro_limite
  for update to authenticated
  using ((select public.eh_admin())) with check ((select public.eh_admin()));

select public.auditar('public.quadro_limite');

-- ---------------------------------------------------------------------------
-- v_quadro
-- ---------------------------------------------------------------------------
create view public.v_quadro
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
  exists (select 1 from public.arquivo a where a.viagem_id = v.id and a.tipo_arquivo_id = 15) as tem_canhoto,
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

-- ---------------------------------------------------------------------------
-- v_pedido_saldo
-- ---------------------------------------------------------------------------
create view public.v_pedido_saldo
with (security_invoker = true) as
select
  p.id as pedido_id,
  p.numero,
  p.situacao,
  p.tomador_id,
  p.peso_total_kg,
  coalesce(al.peso_alocado_kg, 0) as peso_alocado_kg,
  p.peso_total_kg - coalesce(al.peso_alocado_kg, 0) as saldo_kg,
  coalesce(al.viagens, 0) as viagens
from public.pedido p
left join lateral (
  select sum(coalesce(v.peso_saida_kg, v.peso_previsto_kg)) as peso_alocado_kg,
         count(*)::integer as viagens
  from public.viagem v
  where v.pedido_id = p.id and v.cancelada_em is null
) al on true;

-- ---------------------------------------------------------------------------
-- v_viagem_planejada
-- ---------------------------------------------------------------------------
create view public.v_viagem_planejada
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
  select
    (case when pe.situacao = 'cancelado'
          then jsonb_build_array(jsonb_build_object(
                 'codigo', 'pedido_cancelado', 'nivel', 'trava_legal',
                 'mensagem', format('O pedido #%s está cancelado', pe.numero)))
          else '[]'::jsonb end)
    || coalesce((select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem)
                                  order by a.n)
                 from public.aptidao_viagem(v.conjunto_id, pe.tomador_id) with ordinality as a(codigo, nivel, mensagem, n)),
                '[]'::jsonb) as aptidao
) apt
cross join lateral (
  select count(*) filter (where e ->> 'nivel' in ('trava', 'trava_legal'))::integer as travas,
         count(*) filter (where e ->> 'nivel' = 'aviso')::integer as avisos
  from jsonb_array_elements(apt.aptidao) as e
) cnt
where v.cancelada_em is null
  and v.status_campo is null;

-- ---------------------------------------------------------------------------
-- Privilégios das views (só leitura para authenticated; anon nada)
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete, truncate, references, trigger on public.v_quadro from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_quadro from authenticated;
grant select on public.v_quadro to authenticated;

revoke select, insert, update, delete, truncate, references, trigger on public.v_pedido_saldo from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_pedido_saldo from authenticated;
grant select on public.v_pedido_saldo to authenticated;

revoke select, insert, update, delete, truncate, references, trigger on public.v_viagem_planejada from anon;
revoke insert, update, delete, truncate, references, trigger on public.v_viagem_planejada from authenticated;
grant select on public.v_viagem_planejada to authenticated;

-- ---------------------------------------------------------------------------
-- Tempo real
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.viagem;
