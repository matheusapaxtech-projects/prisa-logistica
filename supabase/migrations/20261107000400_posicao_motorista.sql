-- Migration 20261107000400: posição do motorista pelo GPS do app, o tempo todo (pedido de 2026-10-25).
--
-- O app manda a posição em segundo plano (serviço de localização do Android com aviso fixo). Guardamos só a
-- última posição de cada motorista (LGPD: o mínimo para a finalidade, que é achar o caminhão mais perto da
-- coleta). O histórico de rota fica para o rastreamento da viagem, numa etapa própria.
--
-- Onde a posição vale:
-- - fretes_do_motorista (app): distância até a coleta pela posição do GPS se ela tem até 2 h; senão, a do
--   último "Estou livre".
-- - v_motorista_livre (ranking do despacho): o mesmo critério; colunas novas posicao_em e posicao_gps no fim.
-- O "Estou livre" continua sendo o que diz se o motorista quer carga e até quando: a posição sozinha não o
-- coloca no ranking.

create table public.motorista_posicao (
  motorista_id uuid primary key references public.motorista (pessoa_id) on delete cascade,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  precisao_m numeric(8, 1),
  em timestamptz not null,
  recebida_em timestamptz not null default now(),
  constraint motorista_posicao_latitude check (latitude between -35 and 6),
  constraint motorista_posicao_longitude check (longitude between -75 and -28),
  constraint motorista_posicao_precisao check (precisao_m is null or precisao_m >= 0)
);

comment on table public.motorista_posicao is 'Última posição do GPS do app do motorista. Só registrar_posicao grava.';

revoke insert, update, delete, truncate, references, trigger on public.motorista_posicao from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.motorista_posicao from anon;
alter table public.motorista_posicao enable row level security;
create policy motorista_posicao_select on public.motorista_posicao
  for select to authenticated using ((select public.pode_ler()));

-- Posição do app (em = hora em que o GPS mediu). Posição mais velha que a guardada é ignorada (o Android
-- pode entregar lotes fora de ordem); hora no futuro vira agora.
create function public.registrar_posicao(
  p_latitude numeric, p_longitude numeric, p_precisao_m numeric default null, p_em timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
  v_em timestamptz := least(coalesce(p_em, now()), now());
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -35 and 6 or p_longitude not between -75 and -28 then
    raise exception 'Posição fora do Brasil.' using errcode = 'P0001';
  end if;
  insert into public.motorista_posicao (motorista_id, latitude, longitude, precisao_m, em)
  values (v_m, round(p_latitude, 6), round(p_longitude, 6), p_precisao_m, v_em)
  on conflict (motorista_id) do update
    set latitude = excluded.latitude, longitude = excluded.longitude, precisao_m = excluded.precisao_m,
        em = excluded.em, recebida_em = now()
    where public.motorista_posicao.em <= excluded.em;
end $$;

revoke execute on function public.registrar_posicao(numeric, numeric, numeric, timestamptz) from public, anon;
grant execute on function public.registrar_posicao(numeric, numeric, numeric, timestamptz) to authenticated;

-- Onde o motorista está para o despacho: GPS com até 2 h, senão o último "Estou livre".
create function public.posicao_do_motorista(p_motorista uuid)
returns table (latitude numeric, longitude numeric, em timestamptz, gps boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select x.latitude, x.longitude, x.em, x.gps
  from (
    select p.latitude, p.longitude, p.em, true as gps, 1 as ordem
    from public.motorista_posicao p
    where p.motorista_id = p_motorista and p.em > now() - interval '2 hours'
    union all
    select d.latitude, d.longitude, d.created_at, false, 2
    from (select * from public.motorista_disponibilidade d
          where d.motorista_id = p_motorista order by d.created_at desc limit 1) d
  ) x
  order by x.ordem
  limit 1
$$;

revoke execute on function public.posicao_do_motorista(uuid) from public, anon, authenticated;

-- fretes_do_motorista: igual à 20261107000200, com a distância pela posição atual.
create or replace function public.fretes_do_motorista(p_motorista uuid)
returns table (
  oferta_id uuid, pedido_numero bigint, produto text,
  coleta_cidade text, coleta_uf public.uf, descarga_cidade text, descarga_uf public.uf,
  saldo_t numeric, coleta_prevista date, entrega_prevista date, frete_motorista_por_t numeric,
  km_ate_embarque integer, conjunto_id uuid, observacao text)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select mo.pessoa_id from public.motorista mo
    where mo.pessoa_id = p_motorista and mo.situacao_cadastro = 'normal'
  ), cj as (
    select * from public.conjunto_do_motorista(p_motorista)
  ), d as (
    select ld.livre_ate
    from public.motorista_disponibilidade ld
    where ld.motorista_id = p_motorista
    order by ld.created_at desc
    limit 1
  ), pos as (
    select * from public.posicao_do_motorista(p_motorista)
  ), em_viagem as (
    select 1 from public.viagem v
    where v.motorista_id = p_motorista and v.cancelada_em is null and v.status_campo is not null
      and v.status_campo not in ('frete_finalizado', 'aguardando_saldo')
    limit 1
  )
  select o.id, pe.numero, pe.produto,
         ec.cidade, ec.uf, ed.cidade, ed.uf,
         round(s.saldo_kg / 1000, 2), pe.coleta_prevista, pe.entrega_prevista, o.frete_motorista_por_t,
         k.km, cj.conjunto_id, o.observacao
  from public.frete_oferta o
  join public.pedido pe on pe.id = o.pedido_id
  join public.v_pedido_saldo s on s.pedido_id = pe.id
  join public.pessoa_endereco ec on ec.id = pe.local_coleta_id
  join public.pessoa_endereco ed on ed.id = pe.local_descarga_id
  cross join m
  cross join cj
  cross join d
  cross join pos
  cross join lateral (
    select public.km_estrada_estimado(pos.latitude, pos.longitude, o.coleta_latitude, o.coleta_longitude, o.coleta_uf) as km
  ) k
  where o.encerrada_em is null
    and pe.situacao = 'aberto'
    and s.saldo_kg > 0
    and not exists (select 1 from em_viagem)
    and d.livre_ate > now()
    and d.livre_ate >= coalesce(((pe.coleta_prevista + time '08:00') at time zone 'America/Sao_Paulo'), now())
    and k.km <= o.raio_km
    and (o.eixos_minimos is null or coalesce(cj.eixos, 0) >= o.eixos_minimos)
    and (o.carrocerias is null or cj.carrocerias && o.carrocerias)
    and not exists (
      select 1 from public.aptidao_viagem(cj.conjunto_id, pe.tomador_id) a
      where a.nivel in ('trava', 'trava_legal'))
$$;

-- v_motorista_livre: mesmas colunas da 20261029000500, com a posição do GPS (até 2 h) no lugar da do check-in;
-- posicao_em e posicao_gps no fim. A posição só é lida por quem lê o sistema (o motorista não lê esta view).
create or replace view public.v_motorista_livre
with (security_invoker = true) as
select distinct on (d.motorista_id)
  d.id, d.motorista_id, d.cidade,
  coalesce(g.latitude, d.latitude) as latitude,
  coalesce(g.longitude, d.longitude) as longitude,
  d.livre_desde, d.livre_ate, d.observacao, d.created_at,
  (select count(*)::integer from public.viagem v
    where v.motorista_id = d.motorista_id and v.status_campo = 'frete_finalizado') as viagens_finalizadas,
  (select count(*)::integer from public.viagem_ocorrencia o join public.viagem v on v.id = o.viagem_id
    where v.motorista_id = d.motorista_id) as ocorrencias,
  coalesce(g.em, d.created_at) as posicao_em,
  (g.motorista_id is not null) as posicao_gps
from public.motorista_disponibilidade d
left join public.motorista_posicao g
  on g.motorista_id = d.motorista_id and g.em > now() - interval '2 hours'
order by d.motorista_id, d.created_at desc;
