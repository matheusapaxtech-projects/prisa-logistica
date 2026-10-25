-- Migration 20261029000100: rotas salvas pela equipe (Calculadora de Frete PRISA, "Salvar rota").
--
-- rota_salva = km e pedágio conferidos no Qualp para origem → (pontos de passagem) → destino. Na próxima
--   cotação a calculadora usa a rota salva no lugar da estimativa, e a nova viagem do pedido já vem com
--   km e pedágio. O pedágio vale para `eixos`; para outro número de eixos a tela converte por eixo/km.
-- chave = origem, vias e destino normalizados (sem acento, minúsculas, espaços simples), a mesma conta de
--   `normalizar` em web/src/lib/calculadora/rota.ts: uma rota só por trajeto.
-- salvar_rota = grava ou atualiza pela chave (security invoker: vale o RLS de quem chama).
-- Leitura: quem lê o sistema. Gravação: admin e operação (pode_editar). Exclusão: só admin.

create function public.normalizar_rota(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(regexp_replace(extensions.unaccent(coalesce(p, '')), '\s+', ' ', 'g')))
$$;

revoke execute on function public.normalizar_rota(text) from public, anon;
grant execute on function public.normalizar_rota(text) to authenticated;

create table public.rota_salva (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  destino text not null,
  vias text[] not null default '{}',
  chave text not null unique,
  km integer not null,
  eixos smallint not null,
  pedagio numeric(12, 2),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint rota_salva_origem_preenchida check (btrim(origem) <> ''),
  constraint rota_salva_destino_preenchido check (btrim(destino) <> ''),
  constraint rota_salva_km_positivo check (km > 0 and km < 10000),
  constraint rota_salva_eixos check (eixos between 2 and 9),
  constraint rota_salva_pedagio_nao_negativo check (pedagio >= 0)
);

create function public.fn_rota_salva_chave()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.origem := btrim(new.origem);
  new.destino := btrim(new.destino);
  new.vias := coalesce((select array_agg(btrim(v) order by o) from unnest(new.vias) with ordinality as t(v, o) where btrim(v) <> ''), '{}');
  new.chave := public.normalizar_rota(new.origem) || '>' || public.normalizar_rota(new.destino)
    || coalesce((select '|' || string_agg(public.normalizar_rota(v), '>' order by o) from unnest(new.vias) with ordinality as t(v, o)), '');
  return new;
end $$;

revoke execute on function public.fn_rota_salva_chave() from public, anon, authenticated;

create trigger rota_salva_chave
  before insert or update on public.rota_salva
  for each row execute function public.fn_rota_salva_chave();

create trigger rota_salva_set_updated_at
  before update on public.rota_salva
  for each row execute function public.fn_set_updated_at();

revoke truncate, references, trigger on public.rota_salva from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.rota_salva from anon;

alter table public.rota_salva enable row level security;

create policy rota_salva_select on public.rota_salva
  for select to authenticated using ((select public.pode_ler()));
create policy rota_salva_insert on public.rota_salva
  for insert to authenticated with check ((select public.pode_editar()));
create policy rota_salva_update on public.rota_salva
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy rota_salva_delete on public.rota_salva
  for delete to authenticated using ((select public.eh_admin()));

select public.auditar('public.rota_salva');

-- Grava ou atualiza a rota do trajeto (mesma chave). Devolve o id.
create function public.salvar_rota(p_origem text, p_destino text, p_vias text[], p_km integer, p_eixos integer,
                                   p_pedagio numeric default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação salvam rotas' using errcode = '42501';
  end if;
  insert into public.rota_salva (origem, destino, vias, chave, km, eixos, pedagio)
  values (p_origem, p_destino, coalesce(p_vias, '{}'), '', p_km, p_eixos, case when p_pedagio > 0 then round(p_pedagio, 2) end)
  on conflict (chave) do update
    set origem = excluded.origem, destino = excluded.destino, vias = excluded.vias,
        km = excluded.km, eixos = excluded.eixos, pedagio = excluded.pedagio
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.salvar_rota(text, text, text[], integer, integer, numeric) from public, anon;
grant execute on function public.salvar_rota(text, text, text[], integer, integer, numeric) to authenticated;
