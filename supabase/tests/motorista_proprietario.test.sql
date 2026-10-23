-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 6: motorista, referências e proprietário. Só CPF/CNPJ fictícios.

create function tests.test_motorista_so_pf() returns setof text language plpgsql as $$
declare
  v_pj uuid;
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11222333000181') returning id into v_pj;
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista Teste', '52998224725') returning id into v_pf;
  return next throws_ok(
    format($f$insert into public.motorista (pessoa_id) values (%L)$f$, v_pj),
    'P0001', 'motorista precisa ser pessoa física', 'motorista ligado a pessoa PJ é recusado');
  return next lives_ok(
    format($f$insert into public.motorista (pessoa_id) values (%L)$f$, v_pf),
    'motorista ligado a pessoa PF é aceito');
end $$;

create function tests.test_tac_so_pf() returns setof text language plpgsql as $$
declare
  v_pj uuid;
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11222333000181') returning id into v_pj;
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Autonomo Teste', '52998224725') returning id into v_pf;
  return next throws_ok(
    format($f$insert into public.proprietario (pessoa_id, enquadramento_antt) values (%L, 'tac')$f$, v_pj),
    'P0001', 'TAC só para pessoa física', 'proprietário PJ com TAC é recusado');
  return next lives_ok(
    format($f$insert into public.proprietario (pessoa_id, enquadramento_antt) values (%L, 'etc')$f$, v_pj),
    'proprietário PJ com ETC é aceito');
  return next lives_ok(
    format($f$insert into public.proprietario (pessoa_id, enquadramento_antt) values (%L, 'tac')$f$, v_pf),
    'proprietário PF com TAC é aceito');
end $$;

create function tests.test_tac_so_pf_no_update() returns setof text language plpgsql as $$
declare
  v_pj uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11222333000181') returning id into v_pj;
  insert into public.proprietario (pessoa_id, enquadramento_antt) values (v_pj, 'etc');
  return next throws_ok(
    format($f$update public.proprietario set enquadramento_antt = 'tac' where pessoa_id = %L$f$, v_pj),
    'P0001', 'TAC só para pessoa física', 'trocar proprietário PJ para TAC é recusado');
end $$;

create function tests.test_pessoa_motorista_e_proprietario() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Dono Motorista', '52998224725') returning id into v_pf;
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.motorista (pessoa_id) values (%L)$q$)$f$, v_op, v_pf),
    'pessoa PF entra em motorista');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.proprietario (pessoa_id) values (%L)$q$)$f$, v_op, v_pf),
    'a mesma pessoa PF entra em proprietário');
end $$;

create function tests.test_situacao_dados_vencida() returns setof text language plpgsql as $$
declare
  v_a uuid;
  v_b uuid;
  v_vencida text;
  v_valida text;
  v_nome text;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'CNH Vencida', '52998224725') returning id into v_a;
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'CNH Valida', '11144477735') returning id into v_b;
  insert into public.motorista (pessoa_id, cnh_validade) values (v_a, current_date - 1);
  insert into public.motorista (pessoa_id, cnh_validade) values (v_b, current_date + 30);

  select situacao_dados, nome into v_vencida, v_nome from public.v_motorista_situacao where pessoa_id = v_a;
  select situacao_dados into v_valida from public.v_motorista_situacao where pessoa_id = v_b;

  return next is(v_vencida, 'vencido', 'cnh_validade ontem -> vencido');
  return next is(v_valida, 'habilitado', 'cnh_validade daqui a 30 dias -> habilitado');
  return next is(v_nome, 'CNH Vencida', 'view traz o nome da pessoa');
end $$;

create function tests.test_situacao_dados_gr_e_nulos() returns setof text language plpgsql as $$
declare
  v_a uuid;
  v_b uuid;
  v_gr text;
  v_nulos text;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'GR Vencida', '52998224725') returning id into v_a;
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Sem Datas', '11144477735') returning id into v_b;
  insert into public.motorista (pessoa_id, cnh_validade, gr_validade) values (v_a, current_date + 30, current_date - 1);
  insert into public.motorista (pessoa_id) values (v_b);

  select situacao_dados into v_gr from public.v_motorista_situacao where pessoa_id = v_a;
  select situacao_dados into v_nulos from public.v_motorista_situacao where pessoa_id = v_b;

  return next is(v_gr, 'vencido', 'CNH em dia mas gr_validade vencida -> vencido');
  return next is(v_nulos, 'habilitado', 'datas nulas -> habilitado');
end $$;

create function tests.test_view_situacao_segura() returns setof text language plpgsql as $$
begin
  return next ok(
    (select coalesce('security_invoker=true' = any (reloptions), false) from pg_class
     where oid = 'public.v_motorista_situacao'::regclass),
    'v_motorista_situacao é security_invoker');
  return next ok(not has_table_privilege('anon', 'public.v_motorista_situacao', 'select'), 'anon sem select na view');
end $$;

create function tests.test_view_respeita_rls() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_pf uuid;
  v_com bigint;
  v_sem_n bigint;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista Teste', '52998224725') returning id into v_pf;
  insert into public.motorista (pessoa_id) values (v_pf);
  perform tests.como(v_lei);
  select count(*) into v_com from public.v_motorista_situacao;
  perform tests.como(v_sem);
  select count(*) into v_sem_n from public.v_motorista_situacao;
  perform tests.como_servico();
  return next is(v_com, 1::bigint, 'leitura enxerga motorista pela view');
  return next is(v_sem_n, 0::bigint, 'usuário sem perfil não enxerga nada pela view');
end $$;

create function tests.test_referencia_tipo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista Teste', '52998224725') returning id into v_pf;
  insert into public.motorista (pessoa_id) values (v_pf);
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.motorista_referencia (motorista_id, tipo, nome, telefone) values (%L, 'comercial', 'Transportadora Exemplo', '11999990000')$q$)$f$, v_op, v_pf),
    'referência comercial é aceita');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.motorista_referencia (motorista_id, tipo, nome) values (%L, 'pessoal', 'Fulano')$q$)$f$, v_op, v_pf),
    'referência pessoal é aceita');
  return next throws_ok(
    format($f$insert into public.motorista_referencia (motorista_id, tipo, nome) values (%L, 'outro', 'Fulano')$f$, v_pf),
    '22P02', null, 'tipo de referência inválido é recusado');
  return next throws_ok(
    format($f$insert into public.motorista_referencia (motorista_id, tipo) values (%L, 'pessoal')$f$, v_pf),
    '23502', null, 'referência sem nome é recusada');
end $$;

create function tests.test_percentuais_entre_0_e_100() returns setof text language plpgsql as $$
declare
  v_pj uuid;
begin
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11222333000181') returning id into v_pj;
  return next throws_ok(
    format($f$insert into public.proprietario (pessoa_id, taxa_adm_percentual) values (%L, 100.5)$f$, v_pj),
    '23514', null, 'taxa_adm_percentual acima de 100 é recusada');
  return next throws_ok(
    format($f$insert into public.proprietario (pessoa_id, limite_adiantamento_percentual) values (%L, -1)$f$, v_pj),
    '23514', null, 'limite_adiantamento_percentual negativo é recusado');
  return next lives_ok(
    format($f$insert into public.proprietario (pessoa_id, taxa_adm_percentual, limite_adiantamento_percentual) values (%L, 5, 70)$f$, v_pj),
    'percentuais válidos são aceitos');
end $$;

create function tests.test_leitura_nao_edita_motorista() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista Teste', '52998224725') returning id into v_pf;
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.motorista (pessoa_id) values (%L)$q$)$f$, v_lei, v_pf),
    '42501', null, 'leitura não insere motorista');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.proprietario (pessoa_id) values (%L)$q$)$f$, v_fin, v_pf),
    '42501', null, 'financeiro não insere proprietário');
end $$;

create function tests.test_triggers_funcoes_seguras() returns setof text language plpgsql as $$
declare
  f text;
begin
  foreach f in array array['public.fn_motorista_so_pf()', 'public.fn_proprietario_tac_so_pf()'] loop
    return next ok((select prosecdef from pg_proc where oid = f::regprocedure), f || ' é security definer');
    return next ok(
      exists (select 1 from pg_proc p where p.oid = f::regprocedure
                and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
      f || ' declara search_path');
    return next ok(not has_function_privilege('anon', f, 'execute'), f || ': anon sem execute');
    return next ok(not has_function_privilege('authenticated', f, 'execute'), f || ': authenticated sem execute');
  end loop;
end $$;

-- "Só admin apaga" verificado pela estrutura das políticas (o teste não executa remoções).
create function tests.test_politicas_exclusao_so_admin() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
  v_qual text;
begin
  foreach t in array array['motorista', 'motorista_referencia', 'proprietario'] loop
    select count(*), max(qual) into v_n, v_qual
    from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE';
    return next is(v_n, 1, format('%s: exatamente uma política de exclusão', t));
    return next ok(v_qual like '%eh_admin%', format('%s: exclusão exige eh_admin()', t));
  end loop;
end $$;

create function tests.test_politicas_uma_por_comando() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
begin
  foreach t in array array['motorista', 'motorista_referencia', 'proprietario'] loop
    select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = t;
    return next is(v_n, 4, format('%s: quatro políticas (uma por comando)', t));
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass),
      format('%s: RLS ligada', t));
  end loop;
end $$;

create function tests.test_privilegios_revogados() returns setof text language plpgsql as $$
declare
  t text;
  p text;
begin
  foreach t in array array['motorista', 'motorista_referencia', 'proprietario'] loop
    foreach p in array array['truncate', 'references', 'trigger'] loop
      return next ok(not has_table_privilege('authenticated', format('public.%I', t), p),
        format('%s: authenticated sem %s', t, p));
    end loop;
    foreach p in array array['insert', 'update', 'delete', 'truncate'] loop
      return next ok(not has_table_privilege('anon', format('public.%I', t), p),
        format('%s: anon sem %s', t, p));
    end loop;
  end loop;
end $$;

create function tests.test_auditoria_ligada() returns setof text language plpgsql as $$
declare
  t text;
begin
  foreach t in array array['motorista', 'motorista_referencia', 'proprietario'] loop
    return next ok(exists (select 1 from pg_trigger
                           where tgrelid = format('public.%I', t)::regclass
                             and tgname = 'trg_auditoria' and not tgisinternal),
      format('%s: auditoria ligada', t));
  end loop;
end $$;

create function tests.test_cascade_e_indice_fk() returns setof text language plpgsql as $$
begin
  return next ok(exists (select 1 from pg_constraint
                         where conrelid = 'public.motorista'::regclass and contype = 'f'
                           and confrelid = 'public.pessoa'::regclass and confdeltype = 'c'),
    'motorista -> pessoa on delete cascade');
  return next ok(exists (select 1 from pg_constraint
                         where conrelid = 'public.proprietario'::regclass and contype = 'f'
                           and confrelid = 'public.pessoa'::regclass and confdeltype = 'c'),
    'proprietario -> pessoa on delete cascade');
  return next ok(exists (select 1 from pg_constraint
                         where conrelid = 'public.motorista_referencia'::regclass and contype = 'f'
                           and confrelid = 'public.motorista'::regclass and confdeltype = 'c'),
    'motorista_referencia -> motorista on delete cascade');
  return next ok(exists (select 1 from pg_indexes
                         where schemaname = 'public' and tablename = 'motorista_referencia'
                           and indexdef like '%(motorista_id)%'),
    'motorista_referencia.motorista_id indexado');
end $$;

create function tests.test_updated_by_carimbado() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pf uuid;
  v_by uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Motorista Teste', '52998224725') returning id into v_pf;
  insert into public.motorista (pessoa_id) values (v_pf);
  perform tests.como(v_op);
  update public.motorista set radio = 'R1' where pessoa_id = v_pf;
  perform tests.como_servico();
  select updated_by into v_by from public.motorista where pessoa_id = v_pf;
  return next is(v_by, v_op, 'trigger carimba updated_by em motorista');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
