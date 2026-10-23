-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Migration pendencias_arquivos: v_pendencias_documentos só considera "anexado" o arquivo cujo objeto
-- existe no Storage (existe_arquivo_enviado), inclusive o restrito que a operação não enxerga.
-- Só documentos fictícios (CPF 52998224725, CNPJ 11222333000181) e placas de teste. Sem DELETE.

create function tests.nova_pessoa(p_doc text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  if length(p_doc) = 14 then
    insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa ' || p_doc, p_doc) returning id into v_id;
  else
    insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Pessoa ' || p_doc, p_doc) returning id into v_id;
  end if;
  return v_id;
end $$;

create function tests.novo_proprietario(p_doc text) returns uuid language plpgsql as $$
declare
  v_id uuid := tests.nova_pessoa(p_doc);
begin
  insert into public.proprietario (pessoa_id) values (v_id);
  return v_id;
end $$;

create sequence tests.seq_placa;

create function tests.novo_veiculo(p_posse uuid, p_doc uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), 7, p_posse, p_doc)
  returning id into v_id;
  return v_id;
end $$;

create function tests.test_operacao_nao_ve_pendencia_com_contrato_restrito() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.pa1@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm.pa1@exemplo.test', 'admin');
  v_pos uuid := tests.novo_proprietario('52998224725');
  v_doc uuid := tests.novo_proprietario('11222333000181');
  v_arr uuid := tests.novo_veiculo(v_pos, v_doc);
  v_arq uuid := gen_random_uuid();
  v_path text;
  v_antes bigint; v_op_linhas bigint; v_op_pend bigint; v_adm_pend bigint;
begin
  select count(*) into v_antes from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;

  -- contrato restrito com o objeto no Storage
  v_path := format('veiculo/%s/%s-contrato.pdf', v_arr, v_arq);
  insert into public.arquivo (id, tipo_arquivo_id, veiculo_id, storage_path, restrito) values (v_arq, 7, v_arr, v_path, true);
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);

  perform tests.como(v_op);
  select count(*) into v_op_linhas from public.arquivo where id = v_arq;
  select count(*) into v_op_pend from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como(v_adm);
  select count(*) into v_adm_pend from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como_servico();

  return next is(v_antes, 1::bigint, 'sem contrato nenhum: a pendência existe');
  return next is(v_op_linhas, 0::bigint, 'a operação não enxerga a linha do contrato restrito (RLS)');
  return next is(v_op_pend, 0::bigint, 'com o contrato restrito enviado, a operação NÃO vê a pendência');
  return next is(v_adm_pend, 0::bigint, 'nem o admin vê a pendência');
end $$;

create function tests.test_linha_sem_objeto_nao_resolve_a_pendencia() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.pa2@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm.pa2@exemplo.test', 'admin');
  v_pos uuid := tests.novo_proprietario('52998224725');
  v_doc uuid := tests.novo_proprietario('11222333000181');
  v_arr uuid := tests.novo_veiculo(v_pos, v_doc);
  v_arq uuid := gen_random_uuid();
  v_path text;
  v_op_sem bigint; v_adm_sem bigint; v_op_com bigint;
begin
  -- a linha existe (envio interrompido), o objeto não
  v_path := format('veiculo/%s/%s-contrato.pdf', v_arr, v_arq);
  insert into public.arquivo (id, tipo_arquivo_id, veiculo_id, storage_path, restrito) values (v_arq, 7, v_arr, v_path, true);

  perform tests.como(v_op);
  select count(*) into v_op_sem from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como(v_adm);
  select count(*) into v_adm_sem from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como_servico();

  -- o envio termina: o objeto aparece
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);
  perform tests.como(v_op);
  select count(*) into v_op_com from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como_servico();

  return next is(v_op_sem, 1::bigint, 'linha sem objeto: a operação vê a pendência');
  return next is(v_adm_sem, 1::bigint, 'linha sem objeto: o admin vê a pendência');
  return next is(v_op_com, 0::bigint, 'depois que o objeto existe, a pendência some');
end $$;

create function tests.test_cnh_restrita_e_comprovante() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.pa3@exemplo.test', 'operacao');
  v_mot uuid;
  v_cnh uuid := gen_random_uuid();
  v_comp uuid := gen_random_uuid();
  v_p_cnh text; v_p_comp text;
  v_a bigint; v_b bigint; v_c bigint; v_d bigint; v_e bigint; v_f bigint;
begin
  v_mot := tests.nova_pessoa('52998224725');
  insert into public.motorista (pessoa_id) values (v_mot);

  perform tests.como(v_op);
  select count(*) into v_a from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_cnh' and pessoa_id = v_mot;
  select count(*) into v_b from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_comprovante' and pessoa_id = v_mot;
  perform tests.como_servico();

  -- CNH restrita: linha sem objeto não resolve; com objeto resolve (mesmo invisível para a operação)
  v_p_cnh := format('pessoa/%s/%s-cnh.pdf', v_mot, v_cnh);
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, restrito) values (v_cnh, 5, v_mot, v_p_cnh, true);
  perform tests.como(v_op);
  select count(*) into v_c from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_cnh' and pessoa_id = v_mot;
  perform tests.como_servico();
  insert into storage.objects (bucket_id, name) values ('documentos', v_p_cnh);
  perform tests.como(v_op);
  select count(*) into v_d from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_cnh' and pessoa_id = v_mot;
  perform tests.como_servico();

  -- comprovante comum, só com o objeto
  v_p_comp := format('pessoa/%s/%s-comp.pdf', v_mot, v_comp);
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path) values (v_comp, 6, v_mot, v_p_comp);
  perform tests.como(v_op);
  select count(*) into v_e from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_comprovante' and pessoa_id = v_mot;
  perform tests.como_servico();
  insert into storage.objects (bucket_id, name) values ('documentos', v_p_comp);
  perform tests.como(v_op);
  select count(*) into v_f from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_comprovante' and pessoa_id = v_mot;
  perform tests.como_servico();

  return next is(v_a, 1::bigint, 'motorista sem CNH: a operação vê a pendência');
  return next is(v_b, 1::bigint, 'motorista sem comprovante: a operação vê a pendência');
  return next is(v_c, 1::bigint, 'CNH restrita só com a linha (sem objeto): a pendência continua');
  return next is(v_d, 0::bigint, 'CNH restrita com objeto: a operação NÃO vê a pendência de CNH');
  return next is(v_e, 1::bigint, 'comprovante só com a linha: a pendência continua');
  return next is(v_f, 0::bigint, 'comprovante com objeto: a pendência some');
end $$;

create function tests.test_existe_arquivo_enviado_permissoes() returns setof text language plpgsql as $$
declare
  v_sem uuid := tests.criar_usuario('sem.pa4@exemplo.test', null);
  v_lei uuid := tests.criar_usuario('lei.pa4@exemplo.test', 'leitura');
  v_pos uuid := tests.novo_proprietario('52998224725');
  v_arr uuid := tests.novo_veiculo(v_pos, tests.novo_proprietario('11222333000181'));
  v_arq uuid := gen_random_uuid();
  v_path text;
  v_sem_r boolean; v_lei_r boolean; v_serv boolean;
begin
  v_path := format('veiculo/%s/%s-contrato.pdf', v_arr, v_arq);
  insert into public.arquivo (id, tipo_arquivo_id, veiculo_id, storage_path, restrito) values (v_arq, 7, v_arr, v_path, true);
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);

  perform tests.como(v_sem);
  select public.existe_arquivo_enviado(null, v_arr, 'CONTRATO') into v_sem_r;
  perform tests.como(v_lei);
  select public.existe_arquivo_enviado(null, v_arr, 'CONTRATO') into v_lei_r;
  perform tests.como_servico();
  -- como postgres auth.uid() é nulo: sem pode_ler(), devolve false
  select public.existe_arquivo_enviado(null, v_arr, 'CONTRATO') into v_serv;

  return next is(v_sem_r, false, 'sem perfil: false (não revela nada)');
  return next is(v_lei_r, true, 'leitura (pode_ler): true, o arquivo existe');
  return next is(v_serv, false, 'sem usuário logado: false');
  return next ok(not has_function_privilege('anon', 'public.existe_arquivo_enviado(uuid,uuid,text)', 'execute'),
    'anon não executa existe_arquivo_enviado');
  return next ok(has_function_privilege('authenticated', 'public.existe_arquivo_enviado(uuid,uuid,text)', 'execute'),
    'authenticated executa existe_arquivo_enviado');
  return next is(
    (select array_agg(attname::text order by attnum) from pg_attribute
      where attrelid = 'public.v_pendencias_documentos'::regclass and attnum > 0),
    array['tipo_pendencia', 'pessoa_id', 'veiculo_id', 'arquivo_id', 'descricao'],
    'v_pendencias_documentos mantém as mesmas colunas, na mesma ordem');
  return next ok(not has_table_privilege('anon', 'public.v_pendencias_documentos', 'select'),
    'anon continua sem select na view');
  return next ok(has_table_privilege('authenticated', 'public.v_pendencias_documentos', 'select'),
    'authenticated continua com select na view');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
