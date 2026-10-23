-- Migration apoio_telas: colunas, view de vencimentos e funções de apoio às telas da fase 1 web.
--
--   1. Colunas pedidas pelas telas de motorista/proprietário.
--   2. v_vencimentos: todo vencimento (cadastro + arquivos) numa lista só, sem repetir documento.
--   3. listar_usuarios / definir_perfil: administração de usuários (só admin).
--   4. salvar_conjunto / encerrar_conjunto: montagem e encerramento de conjuntos numa chamada só.
--
-- Funções novas nascem sem execute para PUBLIC e anon (migration 0901); os grants para
-- authenticated abaixo são explícitos de propósito.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------------
alter table public.pessoa
  add column qualificacao_inss text,
  add constraint pessoa_qualificacao_inss_valores
    check (qualificacao_inss in ('qualificado', 'nao_qualificado', 'com_pendencia'));

alter table public.proprietario
  add column frete_empresa_motorista_valor numeric(12, 2),
  add column frete_empresa_motorista_percentual numeric(5, 2),
  add constraint proprietario_frete_empresa_motorista_percentual_faixa
    check (frete_empresa_motorista_percentual between 0 and 100);

-- ---------------------------------------------------------------------------
-- 2. v_vencimentos
-- ---------------------------------------------------------------------------
-- tipo  = 'CNH', 'Consulta de risco', 'RNTRC', 'Seguro', 'IPVA' (cadastro) ou o nome do tipo de arquivo.
-- dias  = data - hoje (negativo = vencido).
-- Cadastro: motorista (CNH e consulta de risco, exceto cadastro cancelado), proprietário (RNTRC),
--   veículo (seguro e IPVA).
-- Arquivo: toda linha de arquivo com validade. Um documento que existe no cadastro e como arquivo do
--   mesmo tipo e dono sai uma vez só, com a linha do cadastro (a do arquivo é descartada). O arquivo
--   ANTT é o próprio RNTRC; os demais tipos casam pelo nome (CNH com CNH).
-- security_invoker: cada usuário vê o que o RLS dele deixa ver (arquivo restrito só para admin).
create view public.v_vencimentos
with (security_invoker = true) as
with cadastro as (
  select 'CNH'::text as tipo, m.pessoa_id, null::uuid as veiculo_id, null::uuid as arquivo_id, m.cnh_validade as data
  from public.motorista m
  where m.cnh_validade is not null and m.situacao_cadastro <> 'cancelado'
  union all
  select 'Consulta de risco'::text, m.pessoa_id, null::uuid, null::uuid, m.gr_validade
  from public.motorista m
  where m.gr_validade is not null and m.situacao_cadastro <> 'cancelado'
  union all
  select 'RNTRC'::text, p.pessoa_id, null::uuid, null::uuid, p.rntrc_validade
  from public.proprietario p
  where p.rntrc_validade is not null
  union all
  select 'Seguro'::text, null::uuid, v.id, null::uuid, v.seguro_validade
  from public.veiculo v
  where v.seguro_validade is not null
  union all
  select 'IPVA'::text, null::uuid, v.id, null::uuid, v.venc_ipva
  from public.veiculo v
  where v.venc_ipva is not null
)
select c.tipo, c.pessoa_id, c.veiculo_id, c.arquivo_id, c.data, (c.data - current_date)::int as dias
from cadastro c
union all
select t.nome, a.pessoa_id, a.veiculo_id, a.id, a.validade, (a.validade - current_date)::int
from public.arquivo a
join public.tipo_arquivo t on t.id = a.tipo_arquivo_id
where a.validade is not null
  and not exists (
    select 1
    from cadastro c
    where c.tipo = case t.nome when 'ANTT' then 'RNTRC' else t.nome end
      and c.pessoa_id is not distinct from a.pessoa_id
      and c.veiculo_id is not distinct from a.veiculo_id);

revoke insert, update, delete, truncate, references, trigger on public.v_vencimentos from anon, authenticated;
revoke select on public.v_vencimentos from anon;
grant select on public.v_vencimentos to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Usuários
-- ---------------------------------------------------------------------------
-- security definer: lê auth.users, que o chamador não enxerga. Só o administrador chama.
-- Inclui usuários de auth.users sem perfil (papel e nome nulos, ativo = false).
-- #variable_conflict: os nomes das colunas de saída (user_id, nome...) coincidem com colunas lidas.
create function public.listar_usuarios()
returns table (
  user_id uuid,
  email text,
  nome text,
  papel public.app_papel,
  ativo boolean,
  ultimo_acesso timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.eh_admin() then
    raise exception 'só o administrador pode ver os usuários' using errcode = '42501';
  end if;

  return query
  select u.id,
         u.email::text,
         p.nome,
         p.papel,
         coalesce(p.ativo, false),
         u.last_sign_in_at
  from auth.users u
  left join public.perfil_usuario p on p.user_id = u.id
  where u.deleted_at is null
  order by p.nome nulls last, u.email;
end $$;

-- Cria ou atualiza o perfil de um usuário (upsert). O administrador não pode tirar o próprio
-- acesso de administrador (rebaixar ou desativar a si mesmo).
create function public.definir_perfil(
  p_user_id uuid,
  p_nome text,
  p_papel public.app_papel,
  p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'só o administrador pode alterar perfis de usuário' using errcode = '42501';
  end if;

  if nullif(btrim(p_nome), '') is null then
    raise exception 'informe o nome do usuário';
  end if;
  if p_papel is null or p_ativo is null then
    raise exception 'informe o papel e se o usuário está ativo';
  end if;

  if p_user_id = (select auth.uid()) and (p_papel <> 'admin' or not p_ativo) then
    raise exception 'você não pode tirar o próprio acesso de administrador';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'usuário não encontrado';
  end if;

  insert into public.perfil_usuario (user_id, nome, papel, ativo, updated_by)
  values (p_user_id, btrim(p_nome), p_papel, p_ativo, (select auth.uid()))
  on conflict (user_id) do update
    set nome = excluded.nome,
        papel = excluded.papel,
        ativo = excluded.ativo;
end $$;

revoke execute on function public.listar_usuarios() from public, anon;
revoke execute on function public.definir_perfil(uuid, text, public.app_papel, boolean) from public, anon;
grant execute on function public.listar_usuarios() to authenticated;
grant execute on function public.definir_perfil(uuid, text, public.app_papel, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Conjuntos
-- ---------------------------------------------------------------------------
-- security invoker: o RLS do chamador vale (só admin/operacao gravam).
-- A composição é validada por constraint triggers adiadas (validar_conjunto); aqui o fim da função
-- força a validação com `set constraints all immediate`, para o erro original subir dentro da
-- chamada e nada ser gravado. Antes de inserir, encerra o conjunto informado (edição) e qualquer
-- conjunto aberto do mesmo cavalo (índice único conjunto_cavalo_aberto_uk).
-- Itens: posição = ordem do array (1 = primeira peça atrás do cavalo).
create function public.salvar_conjunto(
  p_conjunto_id uuid,
  p_cavalo_id uuid,
  p_motorista_id uuid,
  p_itens uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  i int;
begin
  if p_cavalo_id is null then
    raise exception 'informe o cavalo do conjunto';
  end if;

  update public.conjunto c
     set fim = now()
   where c.fim is null
     and (c.id = p_conjunto_id or c.cavalo_id = p_cavalo_id);

  insert into public.conjunto (cavalo_id, motorista_id)
  values (p_cavalo_id, p_motorista_id)
  returning id into v_id;

  for i in 1 .. coalesce(cardinality(p_itens), 0) loop
    insert into public.conjunto_item (conjunto_id, posicao, veiculo_id)
    values (v_id, i, p_itens[i]);
  end loop;

  set constraints all immediate;

  return v_id;
end $$;

-- Encerra um conjunto aberto (fim = agora). Sem permissão de edição o update não acha a linha: erro claro.
create function public.encerrar_conjunto(p_conjunto_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fim timestamptz;
begin
  select c.fim into v_fim
  from public.conjunto c
  where c.id = p_conjunto_id;
  if not found then
    raise exception 'conjunto não encontrado';
  end if;
  if v_fim is not null then
    raise exception 'conjunto já encerrado';
  end if;

  update public.conjunto c
     set fim = now()
   where c.id = p_conjunto_id and c.fim is null;
  if not found then
    raise exception 'sem permissão para encerrar o conjunto' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.salvar_conjunto(uuid, uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.encerrar_conjunto(uuid) from public, anon;
grant execute on function public.salvar_conjunto(uuid, uuid, uuid, uuid[]) to authenticated;
grant execute on function public.encerrar_conjunto(uuid) to authenticated;
