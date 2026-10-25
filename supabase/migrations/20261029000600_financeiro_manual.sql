-- Migration 20261029000600: lançamento feito à mão no financeiro (sem extrato OFX).
--
-- Até aqui todo lançamento vinha de uma importação. Agora o financeiro também lança à mão: o que
-- ainda não está no extrato, o que foi pago em dinheiro, o que o banco não exporta. Lançamento à mão
-- é o que não tem importação (importacao_id e fitid nulos, sempre juntos). Ele entra no resultado do
-- mês igual aos do extrato (fin_resumo_mensal não muda).
--
-- 1. fin_lancamento: importacao_id, fitid e conta_id podem ficar nulos, só no lançamento à mão (conta
--    nula = dinheiro/caixa, ou conta que ainda não veio por OFX). O lançamento do extrato continua
--    com data, valor, histórico e conta presos ao arquivo; só a categoria e a observação mudam.
-- 2. Excluir um lançamento sozinho: só o feito à mão. O do extrato sai desfazendo a importação (a
--    cascata da chave estrangeira não passa pelo RLS).
-- 3. Auditoria: inclusão e exclusão do lançamento à mão (as do extrato já ficam na importação).
-- 4. A importação conta os lançamentos do arquivo que batem com um feito à mão (mesma data e valor,
--    na mesma conta ou num sem conta), para o financeiro conferir e não contar duas vezes.

-- ---------------------------------------------------------------------------
-- 1. Colunas e regras do lançamento à mão
-- ---------------------------------------------------------------------------
alter table public.fin_lancamento
  alter column importacao_id drop not null,
  alter column fitid drop not null,
  alter column conta_id drop not null;

alter table public.fin_lancamento
  add constraint fin_lancamento_origem_ck check ((importacao_id is null) = (fitid is null)),
  add constraint fin_lancamento_conta_extrato_ck check (importacao_id is null or conta_id is not null),
  add constraint fin_lancamento_manual_ck check (
    importacao_id is not null
    or (valor <> 0 and length(btrim(descricao)) between 1 and 200 and coalesce(length(observacao), 0) <= 500)
  );

-- O que veio do extrato fica como o banco mandou; nenhum lançamento troca de origem.
create function public.fn_fin_lancamento_protege()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.importacao_id is distinct from old.importacao_id or new.fitid is distinct from old.fitid then
    raise exception 'Um lançamento não muda de origem (extrato ou à mão).';
  end if;
  if old.importacao_id is not null
     and (new.data, new.valor, new.descricao, new.chave, new.conta_id)
         is distinct from (old.data, old.valor, old.descricao, old.chave, old.conta_id) then
    raise exception 'Lançamento do extrato: data, valor, histórico e conta vêm do banco e não mudam. Só a categoria muda.';
  end if;
  return new;
end
$$;

revoke execute on function public.fn_fin_lancamento_protege() from public, anon, authenticated;

create trigger fin_lancamento_protege before update on public.fin_lancamento
  for each row execute function public.fn_fin_lancamento_protege();

create index fin_lancamento_manual_idx on public.fin_lancamento (data) where importacao_id is null;

-- ---------------------------------------------------------------------------
-- 2. RLS: a política única vira uma por comando; excluir, só o lançamento à mão
-- ---------------------------------------------------------------------------
drop policy fin_lancamento_todos on public.fin_lancamento;

create policy fin_lancamento_ver on public.fin_lancamento
  for select to authenticated
  using ((select public.pode_financeiro()));
create policy fin_lancamento_incluir on public.fin_lancamento
  for insert to authenticated
  with check ((select public.pode_financeiro()));
create policy fin_lancamento_alterar on public.fin_lancamento
  for update to authenticated
  using ((select public.pode_financeiro())) with check ((select public.pode_financeiro()));
create policy fin_lancamento_excluir on public.fin_lancamento
  for delete to authenticated
  using ((select public.pode_financeiro()) and importacao_id is null);

-- ---------------------------------------------------------------------------
-- 3. Auditoria do lançamento à mão
-- ---------------------------------------------------------------------------
create trigger trg_auditoria_manual_inclusao after insert on public.fin_lancamento
  for each row when (new.importacao_id is null) execute function public.fn_auditoria();
create trigger trg_auditoria_manual_exclusao after delete on public.fin_lancamento
  for each row when (old.importacao_id is null) execute function public.fn_auditoria();

-- ---------------------------------------------------------------------------
-- 4. Importação: lançamentos do arquivo que batem com um feito à mão
-- ---------------------------------------------------------------------------
create or replace function public.fin_importar_extrato(p jsonb)
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
  v_suspeitos integer;
  v_manuais integer;
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

  select count(*) into v_suspeitos
  from public.fin_lancamento n
  where n.importacao_id = v_imp
    and exists (
      select 1 from public.fin_lancamento o
      where o.conta_id = n.conta_id and o.importacao_id <> v_imp
        and o.data = n.data and o.valor = n.valor and o.chave = n.chave
    );

  select count(*) into v_manuais
  from public.fin_lancamento n
  where n.importacao_id = v_imp
    and exists (
      select 1 from public.fin_lancamento m
      where m.importacao_id is null
        and (m.conta_id is null or m.conta_id = n.conta_id)
        and m.data = n.data and m.valor = n.valor
    );

  update public.fin_importacao set novos = v_novos where id = v_imp;

  return jsonb_build_object(
    'importacao_id', v_imp,
    'conta_id', v_conta,
    'total', v_total,
    'novos', v_novos,
    'classificados', v_classificados,
    'suspeitos', v_suspeitos,
    'manuais', v_manuais
  );
end
$$;
