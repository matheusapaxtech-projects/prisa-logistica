-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 1 do quadro da operação: cliente (papel da pessoa) e locais de coleta/descarga
-- (pessoa_endereco com tipo = 'coleta_descarga' + janela_atendimento e contato_local).
-- Só documentos fictícios (CNPJ 11222333000181).

create function tests.test_operacao_cria_cliente() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pid uuid := gen_random_uuid();
  v_n bigint;
begin
  perform tests.executar_como(v_op, format($q$
    insert into public.pessoa (id, tipo, nome, cnpj) values (%L, 'pj', 'Cliente Teste', '11222333000181');
    insert into public.cliente (pessoa_id) values (%L)$q$, v_pid, v_pid));
  select count(*) into v_n from public.cliente where pessoa_id = v_pid;
  return next is(v_n, 1::bigint, 'operação cria pessoa PJ e cliente');
  return next is((select condicao_faturamento::text from public.cliente where pessoa_id = v_pid), 'por_cte',
    'condição de faturamento padrão é por_cte');
  return next is((select exige_gr from public.cliente where pessoa_id = v_pid), false, 'exige_gr padrão é falso');
  return next is((select exige_sm from public.cliente where pessoa_id = v_pid), false, 'exige_sm padrão é falso');
  return next is((select created_by from public.cliente where pessoa_id = v_pid), v_op, 'created_by = auth.uid() do insert');
end $$;

create function tests.test_leitura_nao_cria_cliente() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_pid uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Cliente Teste', '11222333000181') returning id into v_pid;
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.cliente (pessoa_id) values (%L)$q$)$f$, v_lei, v_pid),
    '42501', null, 'leitura não cria cliente (RLS)');
end $$;

create function tests.test_local_coleta_descarga() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pid uuid;
  v_eid uuid := gen_random_uuid();
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Cliente Teste', '11222333000181') returning id into v_pid;
  perform tests.executar_como(v_op, format($q$
    insert into public.pessoa_endereco (id, pessoa_id, tipo, cidade, uf, janela_atendimento, contato_local)
    values (%L, %L, 'coleta_descarga', 'Curitiba', 'PR', 'seg a sex 7h–17h', 'portaria')$q$, v_eid, v_pid));
  return next is((select janela_atendimento from public.pessoa_endereco where id = v_eid), 'seg a sex 7h–17h',
    'janela de atendimento gravada no local de coleta/descarga');
  return next is((select contato_local from public.pessoa_endereco where id = v_eid), 'portaria',
    'contato do local gravado');
  return next is((select tipo::text from public.pessoa_endereco where id = v_eid), 'coleta_descarga',
    'tipo do endereço é coleta_descarga');
end $$;

create function tests.test_cliente_auditado() returns setof text language plpgsql as $$
declare
  v_pid uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Cliente Teste', '11222333000181') returning id into v_pid;
  insert into public.cliente (pessoa_id) values (v_pid);
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.cliente'::regclass
                         and tgname = 'trg_auditoria' and not tgisinternal),
    'cliente: auditoria ligada');
  return next ok(exists (select 1 from public.auditoria where tabela = 'cliente' and registro_id = v_pid::text),
    'insert em cliente gera linha em auditoria');
end $$;

create function tests.test_pessoa_com_cliente_nao_apaga() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm@exemplo.test', 'admin');
  v_pid uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Cliente Teste', '11222333000181') returning id into v_pid;
  insert into public.cliente (pessoa_id) values (v_pid);
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$delete from public.pessoa where id = %L$q$)$f$, v_adm, v_pid),
    '23503', null, 'pessoa que é cliente não pode ser apagada (on delete restrict)');
end $$;

-- ---------------------------------------------------------------------------
-- Estrutura: enum, políticas, privilégios, trigger de updated_at
-- ---------------------------------------------------------------------------
create function tests.test_cliente_estrutura() returns setof text language plpgsql as $$
declare
  p text;
begin
  return next is(
    (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e
     where e.enumtypid = 'public.condicao_faturamento'::regtype),
    array['por_cte', 'semanal', 'quinzenal', 'mensal'], 'enum condicao_faturamento');
  return next ok((select relrowsecurity from pg_class where oid = 'public.cliente'::regclass), 'cliente: RLS ligada');
  return next is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'cliente'),
    4::bigint, 'cliente: quatro políticas');
  return next ok((select qual like '%pode_ler%' from pg_policies where tablename = 'cliente' and cmd = 'SELECT'),
    'cliente: select exige pode_ler');
  return next ok((select with_check like '%pode_editar%' from pg_policies where tablename = 'cliente' and cmd = 'INSERT'),
    'cliente: insert exige pode_editar');
  return next ok((select qual like '%pode_editar%' and with_check like '%pode_editar%' from pg_policies
                  where tablename = 'cliente' and cmd = 'UPDATE'),
    'cliente: update com using e with check pode_editar');
  return next ok((select qual like '%eh_admin%' from pg_policies where tablename = 'cliente' and cmd = 'DELETE'),
    'cliente: exclusão exige eh_admin');
  foreach p in array array['truncate', 'references', 'trigger'] loop
    return next ok(not has_table_privilege('authenticated', 'public.cliente', p), format('cliente: authenticated sem %s', p));
  end loop;
  foreach p in array array['select', 'insert', 'update', 'delete', 'truncate'] loop
    return next ok(not has_table_privilege('anon', 'public.cliente', p), format('cliente: anon sem %s', p));
  end loop;
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.cliente'::regclass
                         and tgname = 'cliente_set_updated_at' and not tgisinternal),
    'cliente: trigger de updated_at');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
