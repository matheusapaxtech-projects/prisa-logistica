-- Migration 20261026000100: financeiro (extrato bancário OFX, categorias e resultado mensal).
--
-- O financeiro da Prisa tem poucos históricos: receita de frete, pagamento de frete (Roadcard),
-- despesa, empréstimo e sua devolução, aporte de capital e sua devolução. O extrato do banco (OFX) é
-- importado; cada lançamento recebe uma categoria (à mão ou por uma regra aprendida pela descrição) e
-- o resultado sai por mês.
--
-- fin_conta        conta bancária, criada sozinha na primeira importação (banco + agência + conta do OFX)
-- fin_importacao   cada arquivo importado (período, saldo, quantos lançamentos e quantos novos)
-- fin_lancamento   um lançamento do extrato; único por (conta, FITID): importar o mesmo arquivo de
--                  novo não duplica. valor com sinal (crédito +, débito −), como no OFX.
-- fin_regra        "descrição parecida → categoria": `chave` é a descrição normalizada (maiúsculas, sem
--                  acento, sem números; quem normaliza é a aplicação, em lib/financeiro.ts). Vale
--                  para o lançamento cuja chave contém a da regra; a regra mais longa ganha.
--
-- Acesso: só admin e financeiro (pode_financeiro()), em leitura e escrita. A operação não vê.

-- ---------------------------------------------------------------------------
-- Enum e função de acesso
-- ---------------------------------------------------------------------------
create type public.fin_categoria as enum (
  'receita_frete',
  'pagamento_frete',
  'despesa',
  'emprestimo',
  'devolucao_emprestimo',
  'aporte_capital',
  'devolucao_capital',
  'transferencia'
);

create function public.pode_financeiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_papel('admin', 'financeiro')
$$;

revoke execute on function public.pode_financeiro() from public, anon;
grant execute on function public.pode_financeiro() to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.fin_conta (
  id uuid primary key default gen_random_uuid(),
  banco text not null check (banco <> ''),
  agencia text not null default '',
  numero text not null check (numero <> ''),
  apelido text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (banco, agencia, numero)
);

create table public.fin_importacao (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_conta (id) on delete restrict,
  nome_arquivo text not null,
  inicio date,
  fim date,
  saldo numeric(14, 2),
  saldo_em date,
  total integer not null default 0 check (total >= 0),
  novos integer not null default 0 check (novos >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index fin_importacao_conta_idx on public.fin_importacao (conta_id);

create table public.fin_lancamento (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.fin_conta (id) on delete restrict,
  -- Desfazer a importação apaga os lançamentos que ela trouxe.
  importacao_id uuid not null references public.fin_importacao (id) on delete cascade,
  fitid text not null check (fitid <> ''),
  data date not null,
  valor numeric(14, 2) not null,
  descricao text not null,
  chave text not null,
  categoria public.fin_categoria,
  observacao text,
  classificado_em timestamptz,
  classificado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (conta_id, fitid)
);

create index fin_lancamento_data_idx on public.fin_lancamento (data);
create index fin_lancamento_importacao_idx on public.fin_lancamento (importacao_id);
create index fin_lancamento_sem_categoria_idx on public.fin_lancamento (data) where categoria is null;

create table public.fin_regra (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (length(chave) >= 3),
  categoria public.fin_categoria not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger fin_conta_set_updated_at before update on public.fin_conta
  for each row execute function public.fn_set_updated_at();
create trigger fin_lancamento_set_updated_at before update on public.fin_lancamento
  for each row execute function public.fn_set_updated_at();
create trigger fin_regra_set_updated_at before update on public.fin_regra
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Resumo por mês e categoria (a tela monta o resultado a partir daqui; sem o limite de linhas da API)
-- ---------------------------------------------------------------------------
create view public.fin_resumo_mensal
with (security_invoker = true)
as
select
  to_char(l.data, 'YYYY-MM') as mes,
  l.categoria,
  sum(l.valor)::numeric(14, 2) as valor,
  count(*)::integer as quantidade
from public.fin_lancamento l
group by 1, 2;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos; RLS governa o resto)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on public.fin_conta, public.fin_importacao, public.fin_lancamento, public.fin_regra from authenticated;
revoke all on public.fin_conta, public.fin_importacao, public.fin_lancamento, public.fin_regra, public.fin_resumo_mensal from anon;
grant select on public.fin_resumo_mensal to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: tudo só para admin e financeiro
-- ---------------------------------------------------------------------------
alter table public.fin_conta enable row level security;
alter table public.fin_importacao enable row level security;
alter table public.fin_lancamento enable row level security;
alter table public.fin_regra enable row level security;

create policy fin_conta_todos on public.fin_conta
  for all to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));
create policy fin_importacao_todos on public.fin_importacao
  for all to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));
create policy fin_lancamento_todos on public.fin_lancamento
  for all to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));
create policy fin_regra_todos on public.fin_regra
  for all to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));

-- ---------------------------------------------------------------------------
-- Categoria pela regra mais longa contida na chave (null se nenhuma)
-- ---------------------------------------------------------------------------
create function public.fin_categoria_por_regra(p_chave text)
returns public.fin_categoria
language sql
stable
security invoker
set search_path = public
as $$
  select r.categoria
  from public.fin_regra r
  where position(r.chave in p_chave) > 0
  order by length(r.chave) desc, r.chave
  limit 1
$$;

revoke execute on function public.fin_categoria_por_regra(text) from public, anon;
grant execute on function public.fin_categoria_por_regra(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Importação do extrato (tudo ou nada)
-- ---------------------------------------------------------------------------
-- p = { banco, agencia, numero, nome_arquivo, inicio, fim, saldo, saldo_em,
--       lancamentos: [{ fitid, data, valor, descricao, chave }] }
-- Devolve { importacao_id, conta_id, total, novos, classificados }.
create function public.fin_importar_extrato(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conta uuid;
  v_imp uuid;
  v_total integer;
  v_novos integer;
  v_classificados integer;
begin
  if not public.pode_financeiro() then
    raise exception 'Só o administrador e o financeiro importam extratos.' using errcode = '42501';
  end if;
  if coalesce(p ->> 'banco', '') = '' or coalesce(p ->> 'numero', '') = '' then
    raise exception 'O extrato não diz o banco e a conta. Exporte o arquivo OFX de novo pelo banco.';
  end if;
  v_total := coalesce(jsonb_array_length(p -> 'lancamentos'), 0);
  if v_total = 0 then
    raise exception 'O extrato não tem lançamentos. Confira o período escolhido no banco.';
  end if;

  insert into public.fin_conta (banco, agencia, numero)
  values (p ->> 'banco', coalesce(p ->> 'agencia', ''), p ->> 'numero')
  on conflict (banco, agencia, numero) do nothing;
  select id into v_conta from public.fin_conta
  where banco = p ->> 'banco' and agencia = coalesce(p ->> 'agencia', '') and numero = p ->> 'numero';

  insert into public.fin_importacao (conta_id, nome_arquivo, inicio, fim, saldo, saldo_em, total)
  values (
    v_conta,
    coalesce(nullif(p ->> 'nome_arquivo', ''), 'extrato.ofx'),
    (p ->> 'inicio')::date,
    (p ->> 'fim')::date,
    (p ->> 'saldo')::numeric,
    (p ->> 'saldo_em')::date,
    v_total
  )
  returning id into v_imp;

  insert into public.fin_lancamento (conta_id, importacao_id, fitid, data, valor, descricao, chave, categoria)
  select v_conta, v_imp, x.fitid, x.data, x.valor, x.descricao, x.chave, public.fin_categoria_por_regra(x.chave)
  from jsonb_to_recordset(p -> 'lancamentos') as x (fitid text, data date, valor numeric, descricao text, chave text)
  on conflict (conta_id, fitid) do nothing;
  get diagnostics v_novos = row_count;

  select count(*) into v_classificados
  from public.fin_lancamento where importacao_id = v_imp and categoria is not null;

  update public.fin_importacao set novos = v_novos where id = v_imp;

  return jsonb_build_object(
    'importacao_id', v_imp,
    'conta_id', v_conta,
    'total', v_total,
    'novos', v_novos,
    'classificados', v_classificados
  );
end
$$;

revoke execute on function public.fin_importar_extrato(jsonb) from public, anon;
grant execute on function public.fin_importar_extrato(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Classificar um lançamento (e, se pedir, lembrar para os parecidos)
-- ---------------------------------------------------------------------------
-- p_categoria null tira a categoria. p_lembrar grava a regra com a chave do lançamento e aplica aos
-- lançamentos ainda sem categoria que a contêm. Devolve quantos OUTROS lançamentos foram classificados.
create function public.fin_classificar(p_id uuid, p_categoria public.fin_categoria, p_lembrar boolean default false)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_chave text;
  v_outros integer := 0;
begin
  update public.fin_lancamento
  set categoria = p_categoria,
      classificado_em = case when p_categoria is null then null else now() end,
      classificado_por = case when p_categoria is null then null else auth.uid() end
  where id = p_id
  returning chave into v_chave;
  if not found then
    raise exception 'Lançamento não encontrado. Atualize a página.';
  end if;

  if p_lembrar and p_categoria is not null and length(v_chave) >= 3 then
    insert into public.fin_regra (chave, categoria) values (v_chave, p_categoria)
    on conflict (chave) do update set categoria = excluded.categoria;

    update public.fin_lancamento
    set categoria = p_categoria, classificado_em = now(), classificado_por = auth.uid()
    where categoria is null and id <> p_id and position(v_chave in chave) > 0;
    get diagnostics v_outros = row_count;
  end if;

  return v_outros;
end
$$;

revoke execute on function public.fin_classificar(uuid, public.fin_categoria, boolean) from public, anon;
grant execute on function public.fin_classificar(uuid, public.fin_categoria, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
-- Conta, importação (inclusive desfazer) e regra: tudo. Lançamento: só a alteração (quem mudou a
-- categoria); a entrada e a saída em lote já ficam na linha da importação, sem centenas de linhas
-- por arquivo na Auditoria.
select public.auditar('public.fin_conta');
select public.auditar('public.fin_importacao');
select public.auditar('public.fin_regra');

create trigger trg_auditoria after update on public.fin_lancamento
  for each row execute function public.fn_auditoria();
