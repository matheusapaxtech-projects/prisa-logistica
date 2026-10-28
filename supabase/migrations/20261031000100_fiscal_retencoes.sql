-- Migration 20261031000100: retenções e tributos do frete pago a transportador autônomo pessoa física.
--
-- Quando a PRISA paga frete a um contratado pessoa física (TAC PF), retém do motorista INSS (11%),
-- SEST (1,5%) e SENAT (1,0%) sobre a base de 20% do frete, recolhe o INSS patronal (20% da mesma base) e
-- informa ao contador a base do IRRF (10% do frete, tabela progressiva somando o mês do contratado).
-- São as mesmas taxas de calcular_cte (migration 20261027000100); as guias vencem no dia 20 do mês seguinte.
--
-- fiscal_retencoes(competencia) = uma linha por viagem finalizada no mês (Brasília), não cancelada, com
--                                 contratado PF (proprietário ANTT do cavalo), fora da frota própria e com
--                                 frete do motorista. Cada imposto é arredondado na linha (como no recibo).
-- fiscal_vencimento_guia        = dia 20 do mês seguinte; caindo em sábado ou domingo, antecipa para a
--                                 sexta (feriados não estão no banco: o contador confere).
-- fiscal_guia                   = guias do mês geradas pela tela: INSS (retido + patronal) e SEST/SENAT.
--                                 Uma por tipo e competência. Gerar de novo atualiza o valor enquanto a
--                                 guia não foi paga; guia paga não muda.
-- fiscal_gerar_guias            = soma fiscal_retencoes e grava as duas guias (sem retenções, nada).
-- fiscal_marcar_guia            = marca a guia como paga (com a data) ou desfaz.
--
-- Acesso: só admin e financeiro (pode_financeiro()).

-- ---------------------------------------------------------------------------
-- Vencimento
-- ---------------------------------------------------------------------------
create function public.fiscal_vencimento_guia(p_competencia date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case extract(isodow from d)
           when 6 then d - 1
           when 7 then d - 2
           else d end
  from (select (date_trunc('month', p_competencia) + interval '1 month' + interval '19 days')::date as d) x
$$;

revoke execute on function public.fiscal_vencimento_guia(date) from public, anon;
grant execute on function public.fiscal_vencimento_guia(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Retenções do mês
-- ---------------------------------------------------------------------------
create function public.fiscal_retencoes(p_competencia date)
returns table (
  viagem_id uuid,
  viagem_numero bigint,
  data date,
  cte_numero integer,
  contratado_id uuid,
  contratado_nome text,
  contratado_cpf text,
  frete numeric,
  base numeric,
  inss numeric,
  sest numeric,
  senat numeric,
  patronal numeric,
  base_irrf numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_competencia)::date;
begin
  if not public.pode_financeiro() then
    raise exception 'sem permissão para ver as retenções' using errcode = '42501';
  end if;

  return query
  with v as (
    select vi.id, vi.numero, vi.chave_cte, cav.proprietario_documento_id as contratado,
           (vi.finalizada_em at time zone 'America/Sao_Paulo')::date as dia,
           public.frete_da_viagem(vi.id) as fr
    from public.viagem vi
    join public.veiculo cav on cav.id = vi.cavalo_id
    where vi.finalizada_em is not null
      and vi.cancelada_em is null
      and (vi.finalizada_em at time zone 'America/Sao_Paulo')::date >= v_inicio
      and (vi.finalizada_em at time zone 'America/Sao_Paulo')::date < (v_inicio + interval '1 month')::date
  ),
  f as (
    select v.*, (v.fr ->> 'frete_motorista')::numeric as frete, round((v.fr ->> 'frete_motorista')::numeric * 0.2, 2) as base
    from v
    where (v.fr ->> 'contratado_pf')::boolean
      and not (v.fr ->> 'frota_propria')::boolean
      and coalesce((v.fr ->> 'frete_motorista')::numeric, 0) > 0
  )
  select f.id, f.numero, f.dia,
         case when f.chave_cte ~ '^[0-9]{44}$' then substr(f.chave_cte, 26, 9)::integer end,
         f.contratado, p.nome::text, p.cpf,
         f.frete, f.base,
         round(f.base * 0.11, 2), round(f.base * 0.015, 2), round(f.base * 0.01, 2), round(f.base * 0.2, 2),
         round(f.frete * 0.1, 2)
  from f
  join public.pessoa p on p.id = f.contratado
  order by f.dia, f.numero;
end $$;

revoke execute on function public.fiscal_retencoes(date) from public, anon;
grant execute on function public.fiscal_retencoes(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Guias
-- ---------------------------------------------------------------------------
create type public.fiscal_tipo_guia as enum ('inss', 'sest_senat');

create table public.fiscal_guia (
  id uuid primary key default gen_random_uuid(),
  competencia date not null check (competencia = date_trunc('month', competencia)::date),
  tipo public.fiscal_tipo_guia not null,
  valor numeric(12, 2) not null check (valor > 0),
  vencimento date not null,
  paga_em date,
  gerada_em timestamptz not null default now(),
  gerada_por uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (competencia, tipo)
);

alter table public.fiscal_guia enable row level security;

-- Só leitura pela API; gravação pelas funções abaixo.
create policy fiscal_guia_ler on public.fiscal_guia
  for select to authenticated using ((select public.pode_financeiro()));

grant select on public.fiscal_guia to authenticated;

create trigger trg_auditoria after insert or update or delete on public.fiscal_guia
  for each row execute function public.fn_auditoria();

-- Gera (ou atualiza, se ainda não paga) as guias do mês. Devolve quantas foram gravadas.
create function public.fiscal_gerar_guias(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_inss numeric;
  v_sest_senat numeric;
  v_n integer := 0;
  v_linhas integer;
begin
  if not public.pode_financeiro() then
    raise exception 'sem permissão para gerar as guias' using errcode = '42501';
  end if;
  if v_comp > date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date then
    raise exception 'o mês % ainda não começou', to_char(v_comp, 'MM/YYYY');
  end if;

  select coalesce(sum(r.inss + r.patronal), 0), coalesce(sum(r.sest + r.senat), 0)
    into v_inss, v_sest_senat
  from public.fiscal_retencoes(v_comp) r;

  if v_inss = 0 then
    raise exception 'nenhum frete pago a autônomo pessoa física em %', to_char(v_comp, 'MM/YYYY');
  end if;

  if exists (select 1 from public.fiscal_guia g where g.competencia = v_comp and g.paga_em is not null) then
    raise exception 'há guia de % já paga: desmarque o pagamento antes de gerar de novo', to_char(v_comp, 'MM/YYYY');
  end if;

  insert into public.fiscal_guia as g (competencia, tipo, valor, vencimento)
  values (v_comp, 'inss', v_inss, public.fiscal_vencimento_guia(v_comp)),
         (v_comp, 'sest_senat', v_sest_senat, public.fiscal_vencimento_guia(v_comp))
  on conflict (competencia, tipo) do update
    set valor = excluded.valor, vencimento = excluded.vencimento, gerada_em = now(), gerada_por = auth.uid(),
        updated_at = now(), updated_by = auth.uid()
    where g.valor is distinct from excluded.valor or g.vencimento is distinct from excluded.vencimento;
  get diagnostics v_linhas = row_count;
  v_n := v_linhas;
  return v_n;
end $$;

revoke execute on function public.fiscal_gerar_guias(date) from public, anon;
grant execute on function public.fiscal_gerar_guias(date) to authenticated;

-- Marca a guia como paga em p_data (nulo desfaz).
create function public.fiscal_marcar_guia(p_guia uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_financeiro() then
    raise exception 'sem permissão para marcar a guia' using errcode = '42501';
  end if;
  update public.fiscal_guia
     set paga_em = p_data, updated_at = now(), updated_by = auth.uid()
   where id = p_guia and paga_em is distinct from p_data;
  if not found and not exists (select 1 from public.fiscal_guia where id = p_guia) then
    raise exception 'guia não encontrada';
  end if;
end $$;

revoke execute on function public.fiscal_marcar_guia(uuid, date) from public, anon;
grant execute on function public.fiscal_marcar_guia(uuid, date) to authenticated;
