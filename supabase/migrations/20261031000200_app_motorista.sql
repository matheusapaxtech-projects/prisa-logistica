-- Migration 20261031000200: base do banco para o app do motorista e do agregado
-- (docs/superpowers/specs/2026-10-25-app-motorista-design.md).
--
-- 1. perfil_usuario.motorista_id: o usuário de papel 'motorista' é ligado ao cadastro dele (e só ele tem).
-- 2. veiculo.tipo_carroceria: o despacho do sócio avisa "Carroceria não informada"; a oferta filtra por ela.
-- 3. frete_oferta: a operação publica o pedido para o app com o frete do motorista por tonelada, a posição da
--    coleta (da lista de municípios da tela), carrocerias aceitas, eixos mínimos e raio. Uma aberta por pedido.
-- 4. frete_interesse: o "Tenho interesse" do motorista. É só um aviso: não reserva a carga.
-- 5. motorista_disponibilidade.origem: o check-in agora também vem do app (posição do GPS).
-- 6. Funções do app (security definer, sempre pelo próprio motorista): meu_motorista, meu_cadastro,
--    minhas_pendencias, fretes_para_mim, registrar_checkin, encerrar_checkin, registrar_interesse,
--    desistir_interesse. Devolvem só o que o motorista pode ver: nunca frete da empresa, margem ou CT-e.
-- 7. v_frete_interesse: os interessados de cada oferta, para a operação (vale o RLS de quem lê o sistema).

-- ---------------------------------------------------------------------------
-- 1. Usuário do app ligado ao motorista
-- ---------------------------------------------------------------------------
alter table public.perfil_usuario
  add column motorista_id uuid unique references public.motorista (pessoa_id) on delete cascade,
  add constraint perfil_usuario_motorista_so_no_papel check ((papel = 'motorista') = (motorista_id is not null));

comment on column public.perfil_usuario.motorista_id is 'Cadastro do motorista deste usuário do app. Só o papel motorista tem.';

-- ---------------------------------------------------------------------------
-- 2. Carroceria
-- ---------------------------------------------------------------------------
create type public.tipo_carroceria as enum (
  'graneleiro', 'basculante', 'cacamba', 'bau', 'sider', 'grade_baixa', 'prancha', 'tanque', 'frigorifico',
  'porta_container', 'boiadeiro', 'cegonha', 'outro');

alter table public.veiculo add column tipo_carroceria public.tipo_carroceria;

comment on column public.veiculo.tipo_carroceria is 'Carroceria da carreta (ou do caminhão, no truck). Nulo = não informada.';

-- ---------------------------------------------------------------------------
-- 3. Oferta de frete para o app
-- ---------------------------------------------------------------------------
create table public.frete_oferta (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido (id) on delete cascade,
  frete_motorista_por_t numeric(12, 2) not null,
  coleta_latitude numeric(9, 6) not null,
  coleta_longitude numeric(9, 6) not null,
  coleta_uf public.uf not null,
  carrocerias public.tipo_carroceria[],
  eixos_minimos smallint,
  raio_km integer not null default 300,
  observacao text,
  publicada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint frete_oferta_frete_positivo check (frete_motorista_por_t > 0),
  constraint frete_oferta_latitude check (coleta_latitude between -35 and 6),
  constraint frete_oferta_longitude check (coleta_longitude between -75 and -28),
  constraint frete_oferta_raio check (raio_km between 1 and 1500),
  constraint frete_oferta_eixos check (eixos_minimos is null or eixos_minimos between 2 and 12),
  constraint frete_oferta_carrocerias check (carrocerias is null or cardinality(carrocerias) > 0),
  constraint frete_oferta_periodo check (encerrada_em is null or encerrada_em >= publicada_em)
);

comment on table public.frete_oferta is 'Pedido publicado para o app do motorista, com o frete do motorista. Encerrada = some do app.';

create unique index frete_oferta_aberta_uk on public.frete_oferta (pedido_id) where encerrada_em is null;
create index frete_oferta_pedido_idx on public.frete_oferta (pedido_id);

create trigger frete_oferta_set_updated_at
  before update on public.frete_oferta
  for each row execute function public.fn_set_updated_at();

revoke truncate, references, trigger on public.frete_oferta from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.frete_oferta from anon;
alter table public.frete_oferta enable row level security;
create policy frete_oferta_select on public.frete_oferta
  for select to authenticated using ((select public.pode_ler()));
create policy frete_oferta_insert on public.frete_oferta
  for insert to authenticated with check ((select public.pode_editar()));
create policy frete_oferta_update on public.frete_oferta
  for update to authenticated using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy frete_oferta_delete on public.frete_oferta
  for delete to authenticated using ((select public.eh_admin()));
select public.auditar('public.frete_oferta');

-- ---------------------------------------------------------------------------
-- 4. Interesse do motorista
-- ---------------------------------------------------------------------------
create table public.frete_interesse (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.frete_oferta (id) on delete cascade,
  motorista_id uuid not null references public.motorista (pessoa_id) on delete cascade,
  conjunto_id uuid not null references public.conjunto (id) on delete cascade,
  km_ate_embarque integer not null,
  created_at timestamptz not null default now(),
  desistiu_em timestamptz,
  constraint frete_interesse_unico unique (oferta_id, motorista_id)
);

comment on table public.frete_interesse is 'Tenho interesse do app. Aviso para a operação: não reserva a carga. Só as funções do app gravam.';

create index frete_interesse_motorista_idx on public.frete_interesse (motorista_id);
create index frete_interesse_conjunto_idx on public.frete_interesse (conjunto_id);

revoke insert, update, delete, truncate, references, trigger on public.frete_interesse from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.frete_interesse from anon;
alter table public.frete_interesse enable row level security;
create policy frete_interesse_select on public.frete_interesse
  for select to authenticated using ((select public.pode_ler()));
select public.auditar('public.frete_interesse');

-- ---------------------------------------------------------------------------
-- 5. Check-in pelo app
-- ---------------------------------------------------------------------------
alter table public.motorista_disponibilidade
  add column origem text not null default 'operacao',
  add constraint motorista_disponibilidade_origem check (origem in ('operacao', 'app'));

comment on column public.motorista_disponibilidade.origem is 'operacao = registrado na tela Motoristas livres; app = check-in do próprio motorista.';

-- ---------------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------------
-- Km por estrada estimado (estradaKm da calculadora, web/src/lib/calculadora/rota.ts): linha reta × fator
-- da UF de destino; até 50 km de linha reta o fator mínimo é 1,35.
create function public.km_estrada_estimado(
  p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric, p_uf_destino public.uf)
returns integer
language sql
immutable
set search_path = ''
as $$
  with lr as (
    select 2 * 6371 * asin(sqrt(
      power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
      + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8))
        * power(sin(radians((p_lon2 - p_lon1)::float8) / 2), 2))) as km
  ), f as (
    select case p_uf_destino::text
      when 'PR' then 1.25 when 'SP' then 1.22 when 'MS' then 1.35 when 'MT' then 1.3 when 'GO' then 1.22
      when 'DF' then 1.2 when 'MG' then 1.17 when 'RS' then 1.45 when 'RJ' then 1.22 when 'ES' then 1.22
      when 'BA' then 1.2
      when 'SC' then case when p_lon2 > -50 then 1.25 else 1.42 end
      else 1.25 end as fator
  )
  select round(lr.km * case when lr.km < 50 then greatest(1.35, f.fator) else f.fator end)::integer
  from lr, f
$$;

grant execute on function public.km_estrada_estimado(numeric, numeric, numeric, numeric, public.uf) to authenticated;

-- Motorista do usuário logado (papel motorista, perfil ativo); nulo para os demais.
create function public.meu_motorista()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.motorista_id
  from public.perfil_usuario p
  where p.user_id = (select auth.uid()) and p.ativo and p.papel = 'motorista'
$$;

revoke execute on function public.meu_motorista() from public, anon;
grant execute on function public.meu_motorista() to authenticated;

-- O motorista logado ou erro 42501 (usado no começo de cada função do app).
create function public.exigir_motorista()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid := public.meu_motorista();
begin
  if v is null then
    raise exception 'só o motorista usa o app' using errcode = '42501';
  end if;
  return v;
end $$;

revoke execute on function public.exigir_motorista() from public, anon, authenticated;

-- Conjunto aberto do motorista, com eixos (cavalo + peças) e carrocerias informadas.
create function public.conjunto_do_motorista(p_motorista uuid)
returns table (conjunto_id uuid, eixos integer, carrocerias public.tipo_carroceria[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         (select sum(tv.eixos)::integer
            from public.veiculo v join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
           where v.id = c.cavalo_id or v.id in (select i.veiculo_id from public.conjunto_item i where i.conjunto_id = c.id)),
         (select array_agg(distinct v.tipo_carroceria) filter (where v.tipo_carroceria is not null)
            from public.veiculo v
           where v.id = c.cavalo_id or v.id in (select i.veiculo_id from public.conjunto_item i where i.conjunto_id = c.id))
  from public.conjunto c
  where c.motorista_id = p_motorista and c.fim is null
  order by c.inicio desc
  limit 1
$$;

revoke execute on function public.conjunto_do_motorista(uuid) from public, anon, authenticated;

-- Fretes em que o motorista pode entrar (regras da spec). Interno: as funções do app passam o próprio
-- motorista; ninguém chama direto.
create function public.fretes_do_motorista(p_motorista uuid)
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
    select ld.latitude, ld.longitude, ld.livre_ate
    from public.motorista_disponibilidade ld
    where ld.motorista_id = p_motorista
    order by ld.created_at desc
    limit 1
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
  cross join lateral (
    select public.km_estrada_estimado(d.latitude, d.longitude, o.coleta_latitude, o.coleta_longitude, o.coleta_uf) as km
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

revoke execute on function public.fretes_do_motorista(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funções do app
-- ---------------------------------------------------------------------------
-- Dados do próprio cadastro que o app mostra (sem dados de terceiros).
create function public.meu_cadastro()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', p.nome,
    'apelido', p.apelido,
    'situacao_cadastro', mo.situacao_cadastro,
    'cnh_categoria', mo.cnh_categoria,
    'cnh_validade', mo.cnh_validade,
    'situacao_gr', mo.situacao_gr,
    'gr_validade', mo.gr_validade,
    'conjunto', (select jsonb_build_object(
                   'cavalo', (select v.placa from public.veiculo v join public.conjunto c on c.cavalo_id = v.id
                               where c.id = cj.conjunto_id),
                   'eixos', cj.eixos,
                   'carrocerias', to_jsonb(cj.carrocerias))
                 from public.conjunto_do_motorista(mo.pessoa_id) cj),
    'checkin', (select jsonb_build_object('cidade', d.cidade, 'livre_ate', d.livre_ate, 'em', d.created_at)
                from public.motorista_disponibilidade d
                where d.motorista_id = mo.pessoa_id and d.livre_ate > now()
                order by d.created_at desc limit 1))
  from public.motorista mo
  join public.pessoa p on p.id = mo.pessoa_id
  where mo.pessoa_id = public.exigir_motorista()
$$;

-- O que falta para o motorista ser contratado: cadastro, conjunto, aptidão e check-in.
create function public.minhas_pendencias()
returns table (codigo text, nivel text, mensagem text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
  v_situacao public.situacao_cadastro;
  v_conjunto uuid;
begin
  select mo.situacao_cadastro into v_situacao from public.motorista mo where mo.pessoa_id = v_m;
  if v_situacao is distinct from 'normal' then
    return query select 'cadastro_em_analise'::text, 'trava'::text,
      case when v_situacao = 'cancelado' then 'Seu cadastro está cancelado. Fale com a Prisa.'
           else 'Seu cadastro está em análise pela Prisa.' end;
  end if;

  select cj.conjunto_id into v_conjunto from public.conjunto_do_motorista(v_m) cj;
  if v_conjunto is null then
    return query select 'sem_conjunto'::text, 'trava'::text, 'Nenhum caminhão ligado a você na Prisa.'::text;
  else
    return query select a.codigo, a.nivel, a.mensagem from public.aptidao_viagem(v_conjunto, null) a;
  end if;

  if not exists (select 1 from public.motorista_disponibilidade d where d.motorista_id = v_m and d.livre_ate > now()) then
    return query select 'sem_checkin'::text, 'aviso'::text, 'Avise que está livre para ver os fretes perto de você.'::text;
  end if;
end $$;

-- Fretes para o motorista logado.
create function public.fretes_para_mim()
returns table (
  oferta_id uuid, pedido_numero bigint, produto text,
  coleta_cidade text, coleta_uf public.uf, descarga_cidade text, descarga_uf public.uf,
  saldo_t numeric, coleta_prevista date, entrega_prevista date, frete_motorista_por_t numeric,
  km_ate_embarque integer, observacao text, tenho_interesse boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.oferta_id, f.pedido_numero, f.produto, f.coleta_cidade, f.coleta_uf, f.descarga_cidade, f.descarga_uf,
         f.saldo_t, f.coleta_prevista, f.entrega_prevista, f.frete_motorista_por_t, f.km_ate_embarque, f.observacao,
         exists (select 1 from public.frete_interesse i
                 where i.oferta_id = f.oferta_id and i.motorista_id = me.id and i.desistiu_em is null)
  from (select public.exigir_motorista() as id) me
  cross join lateral public.fretes_do_motorista(me.id) f
  order by f.km_ate_embarque, f.coleta_prevista nulls last
$$;

-- "Estou livre": posição do GPS (com o nome da cidade que o app achou) e até quando.
create function public.registrar_checkin(
  p_cidade text, p_latitude numeric, p_longitude numeric,
  p_livre_ate timestamptz default null, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
  v_ate timestamptz := coalesce(p_livre_ate, now() + interval '24 hours');
  v_id uuid;
begin
  if v_ate <= now() or v_ate > now() + interval '7 days' then
    raise exception 'escolha até quando está livre (no máximo 7 dias)' using errcode = '22023';
  end if;
  insert into public.motorista_disponibilidade
    (motorista_id, cidade, latitude, longitude, livre_desde, livre_ate, observacao, origem, created_by)
  values (v_m, btrim(coalesce(p_cidade, '')), p_latitude, p_longitude, now(), v_ate,
          nullif(btrim(p_observacao), ''), 'app', (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- "Não estou mais livre": encerra os check-ins ainda válidos.
create function public.encerrar_checkin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
begin
  update public.motorista_disponibilidade
     set livre_desde = least(livre_desde, now() - interval '1 second'), livre_ate = now(),
         updated_by = (select auth.uid())
   where motorista_id = v_m and livre_ate > now();
end $$;

-- "Tenho interesse": só nos fretes que aparecem para ele. Repetir reativa o interesse.
create function public.registrar_interesse(p_oferta uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
  v_f record;
  v_id uuid;
begin
  select f.conjunto_id, f.km_ate_embarque into v_f
  from public.fretes_do_motorista(v_m) f where f.oferta_id = p_oferta;
  if not found then
    raise exception 'este frete não está disponível para você' using errcode = 'P0001';
  end if;
  insert into public.frete_interesse (oferta_id, motorista_id, conjunto_id, km_ate_embarque)
  values (p_oferta, v_m, v_f.conjunto_id, v_f.km_ate_embarque)
  on conflict (oferta_id, motorista_id) do update
    set desistiu_em = null, created_at = now(), conjunto_id = excluded.conjunto_id,
        km_ate_embarque = excluded.km_ate_embarque
  returning id into v_id;
  return v_id;
end $$;

create function public.desistir_interesse(p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m uuid := public.exigir_motorista();
begin
  update public.frete_interesse set desistiu_em = now()
   where oferta_id = p_oferta and motorista_id = v_m and desistiu_em is null;
end $$;

revoke execute on function public.meu_cadastro() from public, anon;
revoke execute on function public.minhas_pendencias() from public, anon;
revoke execute on function public.fretes_para_mim() from public, anon;
revoke execute on function public.registrar_checkin(text, numeric, numeric, timestamptz, text) from public, anon;
revoke execute on function public.encerrar_checkin() from public, anon;
revoke execute on function public.registrar_interesse(uuid) from public, anon;
revoke execute on function public.desistir_interesse(uuid) from public, anon;
grant execute on function public.meu_cadastro() to authenticated;
grant execute on function public.minhas_pendencias() to authenticated;
grant execute on function public.fretes_para_mim() to authenticated;
grant execute on function public.registrar_checkin(text, numeric, numeric, timestamptz, text) to authenticated;
grant execute on function public.encerrar_checkin() to authenticated;
grant execute on function public.registrar_interesse(uuid) to authenticated;
grant execute on function public.desistir_interesse(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Interessados para a operação
-- ---------------------------------------------------------------------------
create view public.v_frete_interesse
with (security_invoker = true) as
select i.id, i.oferta_id, o.pedido_id, i.motorista_id, i.conjunto_id, i.km_ate_embarque, i.created_at,
       coalesce(nullif(btrim(p.apelido), ''), p.nome) as motorista_nome
from public.frete_interesse i
join public.frete_oferta o on o.id = i.oferta_id
join public.pessoa p on p.id = i.motorista_id
where i.desistiu_em is null;

revoke select on public.v_frete_interesse from anon;
grant select on public.v_frete_interesse to authenticated;
