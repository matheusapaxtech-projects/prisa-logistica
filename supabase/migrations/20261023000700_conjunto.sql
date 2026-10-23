-- Migration 0700: conjunto (cavalo + carretas/dollies na ordem de engate), validação e capacidade.
--
-- conjunto        = cabeçalho: cavalo, motorista opcional, período (fim nulo = aberto).
-- conjunto_item   = peças engatadas atrás do cavalo, posição 1..5 (1 = primeira atrás do cavalo).
--                   Sem created_at/updated_at: a auditoria (trg_auditoria) já guarda quem/quando.
-- validar_conjunto = regras de composição, rodadas por constraint triggers no fim da transação
--                   (a tela grava cabeçalho e itens na mesma transação).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.conjunto (
  id uuid primary key default gen_random_uuid(),
  cavalo_id uuid not null references public.veiculo (id) on delete restrict,
  motorista_id uuid references public.motorista (pessoa_id) on delete restrict,
  inicio timestamptz not null default now(),
  fim timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- fim nulo = conjunto aberto (a comparação com null não é "false", então o "or" é só leitura).
  constraint conjunto_fim_depois_do_inicio check (fim is null or fim > inicio)
);

-- Um cavalo só tem um conjunto aberto por vez.
create unique index conjunto_cavalo_aberto_uk on public.conjunto (cavalo_id) where fim is null;
-- Índices das FKs (o parcial acima não atende consultas por cavalo em conjuntos fechados).
create index conjunto_cavalo_id_idx on public.conjunto (cavalo_id);
create index conjunto_motorista_id_idx on public.conjunto (motorista_id);

create trigger conjunto_set_updated_at
  before update on public.conjunto
  for each row execute function public.fn_set_updated_at();

create table public.conjunto_item (
  conjunto_id uuid not null references public.conjunto (id) on delete cascade,
  posicao smallint not null check (posicao between 1 and 5),
  veiculo_id uuid not null references public.veiculo (id) on delete restrict,
  primary key (conjunto_id, posicao),
  constraint conjunto_item_veiculo_unico unique (conjunto_id, veiculo_id)
);

-- conjunto_id já é a primeira coluna da PK; falta só o veículo.
create index conjunto_item_veiculo_id_idx on public.conjunto_item (veiculo_id);

-- ---------------------------------------------------------------------------
-- Validação
-- ---------------------------------------------------------------------------
-- security definer: a checagem "outro conjunto aberto" precisa enxergar conjuntos que o RLS do
-- chamador poderia esconder. search_path vazio: tudo qualificado.
-- Ordem das regras (a primeira que falhar levanta a exceção): cavalo, categoria dos itens,
-- posições, dolly primeiro/último, dollies seguidos, máximo de 3 carretas, outro conjunto aberto.
-- Conjunto inexistente (apagado / cascade): retorna sem erro.
--
-- Limitação conhecida (equipe de ~5 usuários): duas transações concorrentes podem colocar a mesma
-- carreta em dois conjuntos abertos, pois cada uma não enxerga a outra antes do commit. Não há
-- lock aqui de propósito; a segunda gravação posterior já é barrada pela validação.
create function public.validar_conjunto(p_conjunto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cavalo_id uuid;
  v_fim timestamptz;
  v_categoria public.categoria_veiculo;
  v_itens integer;
  v_min smallint;
  v_max smallint;
  v_invalidos integer;
  v_carretas integer;
  v_conflito boolean;
begin
  select c.cavalo_id, c.fim into v_cavalo_id, v_fim
  from public.conjunto c
  where c.id = p_conjunto;
  if not found then
    return;
  end if;

  -- 1. a base é um cavalo
  select tv.categoria into v_categoria
  from public.veiculo v
  join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
  where v.id = v_cavalo_id;
  if v_categoria is distinct from 'cavalo' then
    raise exception 'o cavalo do conjunto precisa ser da categoria cavalo';
  end if;

  select count(*),
         min(ci.posicao),
         max(ci.posicao),
         count(*) filter (where tv.categoria not in ('carreta', 'dolly')),
         count(*) filter (where tv.categoria = 'carreta')
    into v_itens, v_min, v_max, v_invalidos, v_carretas
  from public.conjunto_item ci
  join public.veiculo v on v.id = ci.veiculo_id
  join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
  where ci.conjunto_id = p_conjunto;

  -- 2. itens só carreta ou dolly
  if v_invalidos > 0 then
    raise exception 'itens do conjunto precisam ser carreta ou dolly';
  end if;

  if v_itens > 0 then
    -- 3. posições 1..n sem buracos (a PK garante que não há repetidas)
    if v_min <> 1 or v_max <> v_itens then
      raise exception 'posições do conjunto precisam começar em 1 e não ter buracos';
    end if;

    -- 4. dolly nunca na primeira nem na última posição
    if exists (
      select 1
      from public.conjunto_item ci
      join public.veiculo v on v.id = ci.veiculo_id
      join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
      where ci.conjunto_id = p_conjunto
        and tv.categoria = 'dolly'
        and ci.posicao in (1, v_itens)
    ) then
      raise exception 'dolly não pode ser a primeira nem a última peça';
    end if;

    -- 5. dois dollies em posições consecutivas
    if exists (
      select 1
      from public.conjunto_item a
      join public.veiculo va on va.id = a.veiculo_id
      join public.tipo_veiculo ta on ta.id = va.tipo_veiculo_id
      join public.conjunto_item b on b.conjunto_id = a.conjunto_id and b.posicao = a.posicao + 1
      join public.veiculo vb on vb.id = b.veiculo_id
      join public.tipo_veiculo tb on tb.id = vb.tipo_veiculo_id
      where a.conjunto_id = p_conjunto
        and ta.categoria = 'dolly'
        and tb.categoria = 'dolly'
    ) then
      raise exception 'dois dollies não podem ficar seguidos';
    end if;
  end if;

  -- 6. no máximo 3 carretas
  if v_carretas > 3 then
    raise exception 'conjunto aceita no máximo 3 carretas';
  end if;

  -- 7. nenhum veículo (cavalo ou item) em outro conjunto aberto. Só vale para conjunto aberto;
  --    a comparação cruza cavalo e itens deste com cavalo e itens dos outros.
  if v_fim is null then
    with meus as (
      select v_cavalo_id as veiculo_id
      union
      select ci.veiculo_id from public.conjunto_item ci where ci.conjunto_id = p_conjunto
    )
    select exists (
             select 1
             from public.conjunto o
             join meus m on m.veiculo_id = o.cavalo_id
             where o.id <> p_conjunto and o.fim is null
           )
        or exists (
             select 1
             from public.conjunto_item oi
             join public.conjunto o on o.id = oi.conjunto_id
             join meus m on m.veiculo_id = oi.veiculo_id
             where o.id <> p_conjunto and o.fim is null
           )
      into v_conflito;
    if v_conflito then
      raise exception 'veículo já está em outro conjunto aberto';
    end if;
  end if;
end $$;

-- Funções de trigger: security definer para chamar validar_conjunto (sem execute para o chamador).
create function public.fn_conjunto_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.validar_conjunto(coalesce(new.id, old.id));
  return null;
end $$;

create function public.fn_conjunto_item_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.validar_conjunto(new.conjunto_id);
  end if;
  -- delete, ou update que move o item para outro conjunto: o conjunto de origem também é validado
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.conjunto_id is distinct from new.conjunto_id) then
    perform public.validar_conjunto(old.conjunto_id);
  end if;
  return null;
end $$;

revoke execute on function public.validar_conjunto(uuid) from public, anon, authenticated;
revoke execute on function public.fn_conjunto_validar() from public, anon, authenticated;
revoke execute on function public.fn_conjunto_item_validar() from public, anon, authenticated;

create constraint trigger conjunto_validar
  after insert or update or delete on public.conjunto
  deferrable initially deferred
  for each row execute function public.fn_conjunto_validar();

create constraint trigger conjunto_item_validar
  after insert or update or delete on public.conjunto_item
  deferrable initially deferred
  for each row execute function public.fn_conjunto_item_validar();

-- ---------------------------------------------------------------------------
-- View de capacidade
-- ---------------------------------------------------------------------------
-- capacidade_total_t = soma de capacidade_carga só das carretas (dolly não carrega; carreta sem
--   capacidade calculável conta 0).
-- tara_total_t = tara do cavalo + tara de todos os itens; tara nula conta 0.
-- excede_cmt = capacidade_total_t > cmt_t - tara_total_t; falso quando o cmt do cavalo é nulo.
create view public.v_conjunto_capacidade
with (security_invoker = true) as
select
  c.id as conjunto_id,
  c.cavalo_id,
  cav.cmt_t,
  coalesce(cav.tara_t, 0) + coalesce(it.tara_itens_t, 0) as tara_total_t,
  coalesce(it.capacidade_carretas_t, 0) as capacidade_total_t,
  coalesce(
    coalesce(it.capacidade_carretas_t, 0) > cav.cmt_t - (coalesce(cav.tara_t, 0) + coalesce(it.tara_itens_t, 0)),
    false) as excede_cmt
from public.conjunto c
join public.veiculo cav on cav.id = c.cavalo_id
left join lateral (
  select
    sum(public.capacidade_carga(v)) filter (where tv.categoria = 'carreta') as capacidade_carretas_t,
    sum(coalesce(v.tara_t, 0)) as tara_itens_t
  from public.conjunto_item ci
  join public.veiculo v on v.id = ci.veiculo_id
  join public.tipo_veiculo tv on tv.id = v.tipo_veiculo_id
  where ci.conjunto_id = c.id
) it on true;

revoke insert, update, delete, truncate, references, trigger on public.v_conjunto_capacidade from anon, authenticated;
revoke select on public.v_conjunto_capacidade from anon;
grant select on public.v_conjunto_capacidade to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS governa select/insert/update/delete)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.conjunto from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.conjunto from anon;
revoke truncate, references, trigger on public.conjunto_item from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.conjunto_item from anon;

-- ---------------------------------------------------------------------------
-- RLS: leitura pode_ler; escrita pode_editar; exclusão só admin
-- ---------------------------------------------------------------------------
alter table public.conjunto enable row level security;
alter table public.conjunto_item enable row level security;

create policy conjunto_select on public.conjunto
  for select to authenticated using ((select public.pode_ler()));
create policy conjunto_insert on public.conjunto
  for insert to authenticated with check ((select public.pode_editar()));
create policy conjunto_update on public.conjunto
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy conjunto_delete on public.conjunto
  for delete to authenticated using ((select public.eh_admin()));

create policy conjunto_item_select on public.conjunto_item
  for select to authenticated using ((select public.pode_ler()));
create policy conjunto_item_insert on public.conjunto_item
  for insert to authenticated with check ((select public.pode_editar()));
create policy conjunto_item_update on public.conjunto_item
  for update to authenticated
  using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy conjunto_item_delete on public.conjunto_item
  for delete to authenticated using ((select public.eh_admin()));

-- ---------------------------------------------------------------------------
-- Auditoria (conjunto_item tem PK composta: registro_id = 'conjunto_id:posicao')
-- ---------------------------------------------------------------------------
select public.auditar('public.conjunto');
select public.auditar('public.conjunto_item');
