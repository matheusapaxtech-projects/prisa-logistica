-- Migration 20261026000200: ajustes do financeiro depois da revisão.
--
-- 1. Regra casa por palavra inteira ("TED" não pega "TEDESCO") e não nasce de descrição genérica
--    ("PIX RECEBIDO", "TED", "PAGTO BOLETO"): sem nenhuma palavra que identifique quem pagou/recebeu,
--    a regra classificaria tudo errado. A classificação passa a dizer se gravou a regra, por isso vira
--    fin_classificar_lancamento (retorno jsonb); a fin_classificar antiga perde o acesso e fica sem uso
--    (sem DROP: esta migration só acrescenta).
-- 2. "Lembrar" em lote não grava uma linha de auditoria por lançamento (fica a da regra e a do
--    lançamento escolhido); a importação não gera linha de "alteração" logo depois da inclusão.
-- 3. A importação conta os prováveis repetidos: lançamento novo com a mesma data, valor e histórico
--    de um que já estava na conta (bancos que mudam o FITID a cada exportação).
-- 4. Saldo mais recente de cada conta até uma data, direto no banco (sem o limite de linhas da API).

-- ---------------------------------------------------------------------------
-- 1. Regras: palavra inteira e descrição que identifica alguém
-- ---------------------------------------------------------------------------
create function public.fin_chave_contem(p_chave text, p_regra text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select position(' ' || p_regra || ' ' in ' ' || p_chave || ' ') > 0
$$;

-- Palavras que aparecem em todo extrato e não dizem quem é: operação, direção, meio de pagamento,
-- tipo de empresa. A chave precisa de duas palavras e de pelo menos uma fora desta lista.
create function public.fin_chave_serve_para_regra(p_chave text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(array_length(p.palavras, 1), 0) >= 2
     and exists (
       select 1 from unnest(p.palavras) w
       where w <> all (array[
         'PIX', 'TED', 'DOC', 'TEF', 'TAR', 'TARIFA', 'SISPAG', 'PAGAMENTO', 'PAGTO', 'PGTO', 'PAG', 'PAGT',
         'RECEBIDO', 'RECEBIDA', 'RECEB', 'REC', 'ENVIADO', 'ENVIADA', 'ENV', 'TRANSF', 'TRANSFERENCIA',
         'CREDITO', 'CRED', 'DEBITO', 'DEB', 'COMPRA', 'BOLETO', 'CARTAO', 'SAQUE', 'DEPOSITO', 'TITULO',
         'CONTA', 'AUT', 'AUTOMATICO', 'ELETRONICO', 'ONLINE', 'INTERNET', 'BANKING', 'MOBILE', 'APP',
         'VISA', 'ELO', 'MASTERCARD', 'MAESTRO', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'PARA', 'EM', 'POR', 'COM',
         'LTDA', 'SA', 'ME', 'EPP', 'EIRELI', 'CIA', 'EMPRESA', 'OUTROS', 'DIVERSOS', 'ENTRADA', 'SAIDA'
       ])
     )
  from (select string_to_array(btrim(p_chave), ' ') as palavras) p
$$;

revoke execute on function public.fin_chave_contem(text, text) from public, anon;
revoke execute on function public.fin_chave_serve_para_regra(text) from public, anon;
grant execute on function public.fin_chave_contem(text, text) to authenticated;
grant execute on function public.fin_chave_serve_para_regra(text) to authenticated;

create or replace function public.fin_categoria_por_regra(p_chave text)
returns public.fin_categoria
language sql
stable
security invoker
set search_path = public
as $$
  select r.categoria
  from public.fin_regra r
  where public.fin_chave_contem(p_chave, r.chave)
  order by length(r.chave) desc, r.chave
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 2. Auditoria: lote de "Lembrar" sem uma linha por lançamento
-- ---------------------------------------------------------------------------
create or replace trigger trg_auditoria after update on public.fin_lancamento
  for each row
  when (coalesce(current_setting('nilt.auditoria_lote', true), '') <> 'off')
  execute function public.fn_auditoria();

-- Importação: inclusão e exclusão (desfazer). A contagem de novos, gravada logo depois, não é alteração.
create or replace trigger trg_auditoria after insert or delete on public.fin_importacao
  for each row execute function public.fn_auditoria();

-- fin_classificar_lancamento devolve { outros, regra }: quantos outros lançamentos foram classificados
-- e se a regra foi gravada (false quando a descrição é genérica demais).
revoke execute on function public.fin_classificar(uuid, public.fin_categoria, boolean) from authenticated;

create function public.fin_classificar_lancamento(p_id uuid, p_categoria public.fin_categoria, p_lembrar boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_chave text;
  v_outros integer := 0;
  v_regra boolean := false;
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

  if p_lembrar and p_categoria is not null and public.fin_chave_serve_para_regra(v_chave) then
    insert into public.fin_regra (chave, categoria) values (v_chave, p_categoria)
    on conflict (chave) do update set categoria = excluded.categoria;
    v_regra := true;

    perform set_config('nilt.auditoria_lote', 'off', true);
    update public.fin_lancamento
    set categoria = p_categoria, classificado_em = now(), classificado_por = auth.uid()
    where categoria is null and id <> p_id and public.fin_chave_contem(chave, v_chave);
    get diagnostics v_outros = row_count;
    perform set_config('nilt.auditoria_lote', '', true);
  end if;

  return jsonb_build_object('outros', v_outros, 'regra', v_regra);
end
$$;

revoke execute on function public.fin_classificar_lancamento(uuid, public.fin_categoria, boolean) from public, anon;
grant execute on function public.fin_classificar_lancamento(uuid, public.fin_categoria, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Importação: prováveis repetidos
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

  update public.fin_importacao set novos = v_novos where id = v_imp;

  return jsonb_build_object(
    'importacao_id', v_imp,
    'conta_id', v_conta,
    'total', v_total,
    'novos', v_novos,
    'classificados', v_classificados,
    'suspeitos', v_suspeitos
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Saldo mais recente de cada conta até uma data
-- ---------------------------------------------------------------------------
create function public.fin_saldos_ate(p_fim date)
returns table (conta_id uuid, banco text, agencia text, numero text, apelido text, saldo numeric, saldo_em date)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (i.conta_id) i.conta_id, c.banco, c.agencia, c.numero, c.apelido, i.saldo, i.saldo_em
  from public.fin_importacao i
  join public.fin_conta c on c.id = i.conta_id
  where i.saldo is not null and i.saldo_em is not null and i.saldo_em <= p_fim
  order by i.conta_id, i.saldo_em desc, i.created_at desc
$$;

revoke execute on function public.fin_saldos_ate(date) from public, anon;
grant execute on function public.fin_saldos_ate(date) to authenticated;
