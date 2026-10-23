-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 9: tipo_arquivo, arquivo, bucket "documentos", políticas de storage.objects,
-- registrar_visualizacao e v_pendencias_documentos.
-- Só documentos fictícios (CPF 52998224725/11144477735, CNPJ 11222333000181) e placas de teste.
-- Nenhum DELETE: "só admin apaga" é verificado por pg_policies.

-- Auxiliares (não rodam como teste: o nome não começa com test_).
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

-- Veículo (placa TST0001...) com posse e documento informados; posse <> documento = arrendado.
create function tests.novo_veiculo(p_posse uuid, p_doc uuid) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), 7, p_posse, p_doc)
  returning id into v_id;
  return v_id;
end $$;

create function tests.novo_motorista(p_doc text) returns uuid language plpgsql as $$
declare
  v_id uuid := tests.nova_pessoa(p_doc);
begin
  insert into public.motorista (pessoa_id) values (v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create function tests.test_tipo_arquivo_carga() returns setof text language plpgsql as $$
begin
  return next is(
    array(select nome from public.tipo_arquivo where id between 1 and 14 order by id),
    array['ANTT', 'ASSINATURA', 'CARIMBO', 'CND', 'CNH', 'COMP. RESIDÊNCIA', 'CONTRATO',
          'CRV / DUT', 'CRLV', 'DOC PESSOAL', 'FOTO', 'FOTO CONJUNTO', 'LOGO', 'OUTROS'],
    'tipo_arquivo: 14 tipos, ids 1 a 14 nessa ordem');
  return next is((select min(id) from public.tipo_arquivo), 1::smallint, 'tipo_arquivo: id mínimo 1');
  return next is((select max(id) from public.tipo_arquivo where id <= 14), 14::smallint, 'tipo_arquivo: id 14 presente');
  return next is(
    (select count(*) from public.tipo_arquivo where not (aplica_pessoa or aplica_veiculo or aplica_viagem)),
    0::bigint, 'tipo_arquivo: todo tipo se aplica a pessoa, veículo ou viagem');
  return next ok(
    (select aplica_veiculo and not aplica_pessoa from public.tipo_arquivo where nome = 'CRLV'),
    'CRLV é só de veículo');
  return next ok(
    (select aplica_pessoa and not aplica_veiculo from public.tipo_arquivo where nome = 'CNH'),
    'CNH é só de pessoa');
  return next ok(
    (select aplica_pessoa and aplica_veiculo from public.tipo_arquivo where nome = 'CONTRATO'),
    'CONTRATO vale para pessoa e veículo');
end $$;

-- ---------------------------------------------------------------------------
-- Os 5 testes do plano (+ extras)
-- ---------------------------------------------------------------------------
create function tests.test_arquivo_um_dono() returns setof text language plpgsql as $$
declare
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_prop uuid := tests.novo_proprietario('11222333000181');
  v_vei uuid := tests.novo_veiculo(v_prop, v_prop);
begin
  return next throws_ok(
    format('insert into public.arquivo (tipo_arquivo_id, pessoa_id, veiculo_id, storage_path) values (7, %L, %L, %L)',
      v_pes, v_vei, 'teste/dois-donos.pdf'),
    '23514', null, 'arquivo com pessoa_id e veiculo_id é recusado');
  return next throws_ok(
    $q$insert into public.arquivo (tipo_arquivo_id, storage_path) values (7, 'teste/sem-dono.pdf')$q$,
    '23514', null, 'arquivo sem pessoa_id nem veiculo_id é recusado');
  return next lives_ok(
    format('insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (5, %L, %L)', v_pes, 'teste/pessoa.pdf'),
    'arquivo só de pessoa é aceito');
  return next lives_ok(
    format('insert into public.arquivo (tipo_arquivo_id, veiculo_id, storage_path) values (9, %L, %L)', v_vei, 'teste/veiculo.pdf'),
    'arquivo só de veículo é aceito');
  return next throws_ok(
    format('insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path, tamanho_bytes) values (5, %L, %L, -1)', v_pes, 'teste/neg.pdf'),
    '23514', null, 'tamanho_bytes negativo é recusado');
  return next throws_ok(
    format('insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (5, %L, %L)', v_pes, 'teste/pessoa.pdf'),
    '23505', null, 'storage_path é único');
end $$;

create function tests.test_arquivo_restrito_so_admin() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.res@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei.res@exemplo.test', 'leitura');
  v_adm uuid := tests.criar_usuario('adm.res@exemplo.test', 'admin');
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_arq_r uuid := gen_random_uuid();
  v_arq_n uuid := gen_random_uuid();
  v_path_r text;
  v_path_n text;
  v_a_op bigint; v_s_op bigint; v_a_lei bigint; v_s_lei bigint; v_a_adm bigint; v_s_adm bigint;
  v_n_op bigint; v_ns_op bigint;
begin
  v_path_r := format('pessoa/%s/%s-cnh-restrita.pdf', v_pes, v_arq_r);
  v_path_n := format('pessoa/%s/%s-comprovante.pdf', v_pes, v_arq_n);
  -- como serviço (postgres): arquivo restrito + objeto; arquivo comum + objeto
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, restrito)
  values (v_arq_r, 5, v_pes, v_path_r, true), (v_arq_n, 6, v_pes, v_path_n, false);
  insert into storage.objects (bucket_id, name) values ('documentos', v_path_r), ('documentos', v_path_n);

  perform tests.como(v_op);
  select count(*) into v_a_op from public.arquivo where id = v_arq_r;
  select count(*) into v_s_op from storage.objects where bucket_id = 'documentos' and name = v_path_r;
  select count(*) into v_n_op from public.arquivo where id = v_arq_n;
  select count(*) into v_ns_op from storage.objects where bucket_id = 'documentos' and name = v_path_n;
  perform tests.como(v_lei);
  select count(*) into v_a_lei from public.arquivo where id = v_arq_r;
  select count(*) into v_s_lei from storage.objects where bucket_id = 'documentos' and name = v_path_r;
  perform tests.como(v_adm);
  select count(*) into v_a_adm from public.arquivo where id = v_arq_r;
  select count(*) into v_s_adm from storage.objects where bucket_id = 'documentos' and name = v_path_r;
  perform tests.como_servico();

  return next is(v_a_op, 0::bigint, 'operacao não vê arquivo restrito');
  return next is(v_s_op, 0::bigint, 'operacao não vê o objeto do arquivo restrito em storage.objects');
  return next is(v_a_lei, 0::bigint, 'leitura não vê arquivo restrito');
  return next is(v_s_lei, 0::bigint, 'leitura não vê o objeto do arquivo restrito em storage.objects');
  return next is(v_a_adm, 1::bigint, 'admin vê arquivo restrito');
  return next is(v_s_adm, 1::bigint, 'admin vê o objeto do arquivo restrito em storage.objects');
  return next is(v_n_op, 1::bigint, 'operacao vê arquivo não restrito');
  return next is(v_ns_op, 1::bigint, 'operacao vê o objeto do arquivo não restrito');
  return next ok(public.arquivo_restrito(v_path_r), 'arquivo_restrito: true para o caminho restrito');
  return next ok(not public.arquivo_restrito(v_path_n), 'arquivo_restrito: false para o caminho comum');
  return next ok(public.arquivo_restrito('nao/existe.pdf'), 'arquivo_restrito: true (fail-closed) para caminho sem arquivo');
end $$;

create function tests.test_bucket_privado() returns setof text language plpgsql as $$
begin
  return next is((select public from storage.buckets where id = 'documentos'), false, 'bucket documentos é privado');
end $$;

create function tests.test_bucket_limites() returns setof text language plpgsql as $$
begin
  return next is((select file_size_limit from storage.buckets where id = 'documentos'), 20971520::bigint,
    'bucket documentos: limite de 20 MB');
  return next is(
    (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'documentos'),
    array['application/pdf', 'image/heic', 'image/jpeg', 'image/png'],
    'bucket documentos: pdf, jpeg, png e heic');
end $$;

create function tests.test_pendencia_arrendado() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.pend@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm.pend@exemplo.test', 'admin');
  v_pos uuid := tests.novo_proprietario('52998224725');
  v_doc uuid := tests.novo_proprietario('11222333000181');
  v_arr uuid := tests.novo_veiculo(v_pos, v_doc);
  v_prp uuid := tests.novo_veiculo(v_pos, v_pos);
  v_antes bigint; v_depois bigint; v_op_antes bigint; v_proprio bigint;
begin
  select count(*) into v_antes from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  select count(*) into v_proprio from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_prp;
  perform tests.como(v_op);
  select count(*) into v_op_antes from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como_servico();
  return next is(v_antes, 1::bigint, 'veículo arrendado sem CONTRATO aparece como pendência');
  return next is(v_op_antes, 1::bigint, 'a view (security_invoker) também mostra a pendência para operacao');
  return next is(v_proprio, 0::bigint, 'veículo não arrendado não gera pendência de contrato');

  -- um arquivo que não é CONTRATO não resolve a pendência
  insert into public.arquivo (tipo_arquivo_id, veiculo_id, storage_path)
  values (9, v_arr, 'veiculo/' || v_arr || '/crlv.pdf');
  select count(*) into v_depois from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  return next is(v_depois, 1::bigint, 'um CRLV não resolve a pendência de contrato');

  insert into public.arquivo (tipo_arquivo_id, veiculo_id, storage_path)
  values (7, v_arr, 'veiculo/' || v_arr || '/contrato.pdf');
  -- só a linha não basta: o objeto precisa estar no Storage (migration pendencias_arquivos)
  select count(*) into v_depois from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  return next is(v_depois, 1::bigint, 'CONTRATO só com a linha (sem o objeto no Storage) não resolve a pendência');

  -- (existe_arquivo_enviado só responde a quem tem pode_ler(): daqui em diante a view é lida como admin)
  insert into storage.objects (bucket_id, name) values ('documentos', 'veiculo/' || v_arr || '/contrato.pdf');
  perform tests.como(v_adm);
  select count(*) into v_depois from public.v_pendencias_documentos
   where tipo_pendencia = 'veiculo_arrendado_sem_contrato' and veiculo_id = v_arr;
  perform tests.como_servico();
  return next is(v_depois, 0::bigint, 'com o CONTRATO enviado a pendência some');
end $$;

create function tests.test_pendencia_arquivo_vencido() returns setof text language plpgsql as $$
declare
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_venc uuid := gen_random_uuid();
  v_hoje uuid := gen_random_uuid();
  v_fut uuid := gen_random_uuid();
  v_sem uuid := gen_random_uuid();
begin
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, validade) values
    (v_venc, 4, v_pes, 'pessoa/' || v_pes || '/' || v_venc || '-cnd.pdf', tests.hoje() - 1),
    (v_hoje, 4, v_pes, 'pessoa/' || v_pes || '/' || v_hoje || '-cnd.pdf', tests.hoje()),
    (v_fut,  4, v_pes, 'pessoa/' || v_pes || '/' || v_fut  || '-cnd.pdf', tests.hoje() + 30),
    (v_sem,  4, v_pes, 'pessoa/' || v_pes || '/' || v_sem  || '-cnd.pdf', null);
  return next is(
    (select count(*) from public.v_pendencias_documentos where tipo_pendencia = 'arquivo_vencido' and arquivo_id = v_venc),
    1::bigint, 'validade de ontem: arquivo_vencido');
  return next is(
    (select pessoa_id from public.v_pendencias_documentos where tipo_pendencia = 'arquivo_vencido' and arquivo_id = v_venc),
    v_pes, 'arquivo_vencido traz o pessoa_id do dono');
  return next is(
    (select count(*) from public.v_pendencias_documentos
      where tipo_pendencia = 'arquivo_vencido' and arquivo_id in (v_hoje, v_fut, v_sem)),
    0::bigint, 'validade hoje, futura ou nula: sem pendência');
end $$;

create function tests.test_pendencia_motorista() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm.mot@exemplo.test', 'admin');
  v_mot uuid := tests.novo_motorista('52998224725');
  v_outro uuid := tests.nova_pessoa('11144477735');  -- pessoa que não é motorista
  v_cnh bigint; v_comp bigint; v_nenhuma bigint;
begin
  return next is(
    (select count(*) from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_cnh' and pessoa_id = v_mot),
    1::bigint, 'motorista sem CNH: pendência');
  return next is(
    (select count(*) from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_comprovante' and pessoa_id = v_mot),
    1::bigint, 'motorista sem comprovante: pendência');
  return next is(
    (select count(*) from public.v_pendencias_documentos where pessoa_id = v_outro),
    0::bigint, 'pessoa que não é motorista não gera pendência de motorista');

  insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (5, v_mot, 'pessoa/' || v_mot || '/cnh.pdf');
  insert into storage.objects (bucket_id, name) values ('documentos', 'pessoa/' || v_mot || '/cnh.pdf');
  -- (existe_arquivo_enviado só responde a quem tem pode_ler(): a view é lida como admin)
  perform tests.como(v_adm);
  select count(*) into v_cnh from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_cnh' and pessoa_id = v_mot;
  select count(*) into v_comp from public.v_pendencias_documentos where tipo_pendencia = 'motorista_sem_comprovante' and pessoa_id = v_mot;
  perform tests.como_servico();
  return next is(v_cnh, 0::bigint, 'com arquivo CNH enviado a pendência de CNH some');
  return next is(v_comp, 1::bigint, 'a pendência de comprovante continua');

  insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (6, v_mot, 'pessoa/' || v_mot || '/comp.pdf');
  insert into storage.objects (bucket_id, name) values ('documentos', 'pessoa/' || v_mot || '/comp.pdf');
  perform tests.como(v_adm);
  select count(*) into v_nenhuma from public.v_pendencias_documentos where pessoa_id = v_mot and tipo_pendencia like 'motorista_sem_%';
  perform tests.como_servico();
  return next is(v_nenhuma, 0::bigint, 'com CNH e comprovante, nenhuma pendência de motorista');
end $$;

create function tests.test_visualizacao_auditada() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.vis@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm.vis@exemplo.test', 'admin');
  v_sem uuid := tests.criar_usuario('sem.vis@exemplo.test', null);
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_arq uuid := gen_random_uuid();
  v_rst uuid := gen_random_uuid();
  v_n_op bigint; v_usr uuid; v_n_adm bigint;
begin
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, restrito) values
    (v_arq, 6, v_pes, 'pessoa/' || v_pes || '/' || v_arq || '-comp.pdf', false),
    (v_rst, 5, v_pes, 'pessoa/' || v_pes || '/' || v_rst || '-cnh.pdf', true);

  perform tests.executar_como(v_op, format('select public.registrar_visualizacao(%L)', v_arq));
  select count(*), (array_agg(usuario_id))[1] into v_n_op, v_usr from public.auditoria
   where tabela = 'arquivo' and registro_id = v_arq::text and acao = 'visualizacao';
  return next is(v_n_op, 1::bigint, 'operacao: 1 linha de auditoria com acao = visualizacao');
  return next is(v_usr, v_op, 'a auditoria registra o usuário que visualizou');

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.registrar_visualizacao(%L)$q$)$f$, v_sem, v_arq),
    '42501', null, 'usuário sem perfil não registra visualização');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.registrar_visualizacao(%L)$q$)$f$, v_op, v_rst),
    'P0002', 'arquivo não encontrado', 'operacao não registra visualização de arquivo restrito');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.registrar_visualizacao(%L)$q$)$f$, v_op, gen_random_uuid()),
    'P0002', 'arquivo não encontrado', 'arquivo inexistente: mesmo erro');
  return next is(
    (select count(*) from public.auditoria where tabela = 'arquivo' and registro_id = v_rst::text and acao = 'visualizacao'),
    0::bigint, 'recusas não deixam linha de auditoria');

  perform tests.executar_como(v_adm, format('select public.registrar_visualizacao(%L)', v_rst));
  select count(*) into v_n_adm from public.auditoria
   where tabela = 'arquivo' and registro_id = v_rst::text and acao = 'visualizacao';
  return next is(v_n_adm, 1::bigint, 'admin registra visualização de arquivo restrito');

  return next ok(has_function_privilege('authenticated', 'public.registrar_visualizacao(uuid)', 'execute'),
    'authenticated executa registrar_visualizacao');
  return next ok(not has_function_privilege('anon', 'public.registrar_visualizacao(uuid)', 'execute'),
    'anon não executa registrar_visualizacao');
  return next ok(not has_function_privilege('anon', 'public.arquivo_restrito(text)', 'execute'),
    'anon não executa arquivo_restrito');
  return next ok(has_function_privilege('authenticated', 'public.arquivo_restrito(text)', 'execute'),
    'authenticated executa arquivo_restrito (as políticas de storage precisam)');
end $$;

-- ---------------------------------------------------------------------------
-- RLS de arquivo e do storage (comportamento)
-- ---------------------------------------------------------------------------
create function tests.test_rls_arquivo() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.rls@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei.rls@exemplo.test', 'leitura');
  v_sem uuid := tests.criar_usuario('sem.rls@exemplo.test', null);
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_arq uuid := gen_random_uuid();
  v_n_lei bigint; v_n_sem bigint; v_t_lei bigint; v_t_sem bigint;
begin
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path)
  values (v_arq, 6, v_pes, 'pessoa/' || v_pes || '/' || v_arq || '-comp.pdf');

  perform tests.como(v_lei);
  select count(*) into v_n_lei from public.arquivo where id = v_arq;
  select count(*) into v_t_lei from public.tipo_arquivo where id between 1 and 14;
  perform tests.como(v_sem);
  select count(*) into v_n_sem from public.arquivo;
  select count(*) into v_t_sem from public.tipo_arquivo;
  perform tests.como_servico();
  return next is(v_n_lei, 1::bigint, 'leitura lê arquivo');
  return next is(v_t_lei, 14::bigint, 'leitura lê tipo_arquivo');
  return next is(v_n_sem, 0::bigint, 'sem perfil não lê arquivo');
  return next is(v_t_sem, 0::bigint, 'sem perfil não lê tipo_arquivo');

  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (5, %L, 'op/cnh.pdf')$q$)$f$, v_op, v_pes),
    'operacao insere arquivo');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$update public.arquivo set numero = '123' where id = %L$q$)$f$, v_op, v_arq),
    'operacao atualiza arquivo');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path) values (5, %L, 'lei/cnh.pdf')$q$)$f$, v_lei, v_pes),
    '42501', null, 'leitura não insere arquivo');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.tipo_arquivo (nome, aplica_pessoa) values ('NOVO', true)$q$)$f$, v_op),
    '42501', null, 'operacao não altera o catálogo tipo_arquivo');
  return next is(
    (select numero from public.arquivo where id = v_arq), '123', 'o update de operacao foi gravado');
  return next is(
    (select updated_by from public.arquivo where id = v_arq), v_op, 'updated_by = usuário que atualizou');

  -- storage.objects: insert só para quem edita
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into storage.objects (bucket_id, name) values ('documentos', 'op/upload.pdf')$q$)$f$, v_op),
    'operacao envia objeto ao bucket documentos');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into storage.objects (bucket_id, name) values ('documentos', 'lei/upload.pdf')$q$)$f$, v_lei),
    '42501', null, 'leitura não envia objeto ao bucket documentos');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into storage.objects (bucket_id, name) values ('outro', 'op/x.pdf')$q$)$f$, v_op),
    null, null, 'as políticas não liberam outros buckets');
end $$;

-- ---------------------------------------------------------------------------
-- Estrutura (inclui "só admin apaga", sem DELETE)
-- ---------------------------------------------------------------------------
create function tests.test_politicas_estrutura() returns setof text language plpgsql as $$
declare
  t text;
  c text;
begin
  foreach t in array array['arquivo', 'tipo_arquivo'] loop
    return next ok((select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass),
      format('%s: RLS ligada', t));
    foreach c in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      return next is(
        (select count(*) from pg_policies where schemaname = 'public' and tablename = t and cmd = c),
        1::bigint, format('%s: uma política de %s', t, c));
    end loop;
    return next ok(
      (select qual like '%eh_admin%' from pg_policies where schemaname = 'public' and tablename = t and cmd = 'DELETE'),
      format('%s: delete só admin (eh_admin)', t));
  end loop;

  return next ok(
    (select qual like '%eh_admin%' and qual like '%restrito%' and qual like '%pode_ler%'
       from pg_policies where schemaname = 'public' and tablename = 'arquivo' and cmd = 'SELECT'),
    'arquivo: select = pode_ler e (não restrito ou admin)');
  return next ok(
    (select with_check like '%pode_editar%' from pg_policies where schemaname = 'public' and tablename = 'arquivo' and cmd = 'INSERT'),
    'arquivo: insert exige pode_editar');
  return next ok(
    (select qual like '%pode_editar%' and qual like '%restrito%' and qual like '%eh_admin%' and with_check like '%pode_editar%'
       from pg_policies where schemaname = 'public' and tablename = 'arquivo' and cmd = 'UPDATE'),
    'arquivo: update com using (pode_editar e não restrito ou admin) e with check de pode_editar');

  -- storage.objects (políticas deste bucket)
  return next is(
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'documentos\_%'),
    3::bigint, 'storage.objects: 3 políticas documentos_*');
  return next ok(
    (select qual like '%documentos%' and qual like '%pode_ler%' and qual like '%arquivo_restrito%' and qual like '%eh_admin%'
       from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'documentos_select' and cmd = 'SELECT'),
    'storage.objects: select = documentos, pode_ler e arquivo_restrito ou admin');
  return next ok(
    (select with_check like '%documentos%' and with_check like '%pode_editar%'
       from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'documentos_insert' and cmd = 'INSERT'),
    'storage.objects: insert = documentos e pode_editar');
  return next ok(
    (select qual like '%documentos%' and qual like '%eh_admin%'
       from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'documentos_delete' and cmd = 'DELETE'),
    'storage.objects: delete = documentos e só admin');
  return next is(
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'documentos\_%' and roles <> array['authenticated']::name[]),
    0::bigint, 'storage.objects: políticas documentos_* só para authenticated');

  -- privilégios
  return next ok(not has_table_privilege('anon', 'public.arquivo', 'insert')
                 and not has_table_privilege('anon', 'public.arquivo', 'update')
                 and not has_table_privilege('anon', 'public.arquivo', 'delete'),
    'anon sem escrita em arquivo');
  return next is(
    (select count(*) from pg_policies where schemaname = 'public' and tablename in ('arquivo', 'tipo_arquivo')
      and not (roles = array['authenticated']::name[])),
    0::bigint, 'nenhuma política de arquivo/tipo_arquivo vale para anon');
  return next ok(not has_table_privilege('anon', 'public.v_pendencias_documentos', 'select'),
    'anon não lê v_pendencias_documentos');
  return next ok(has_table_privilege('authenticated', 'public.v_pendencias_documentos', 'select'),
    'authenticated lê v_pendencias_documentos');
  return next ok(not has_table_privilege('authenticated', 'public.v_pendencias_documentos', 'insert, update, delete'),
    'authenticated não escreve na view');
  return next ok(
    (select coalesce(reloptions::text[] @> array['security_invoker=true'], false)
       from pg_class where oid = 'public.v_pendencias_documentos'::regclass),
    'v_pendencias_documentos: security_invoker');
end $$;

create function tests.test_estrutura_arquivo() returns setof text language plpgsql as $$
declare
  c text;
begin
  -- funções security definer com search_path vazio
  return next ok(
    (select count(*) = 2 from pg_proc
      where oid in ('public.arquivo_restrito(text)'::regprocedure, 'public.registrar_visualizacao(uuid)'::regprocedure)
        and prosecdef and proconfig @> array['search_path=""']),
    'arquivo_restrito e registrar_visualizacao: security definer com search_path vazio');

  -- índices das FKs
  foreach c in array array['tipo_arquivo_id', 'pessoa_id', 'veiculo_id'] loop
    return next ok(exists (
      select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
      where i.indrelid = 'public.arquivo'::regclass and a.attname = c),
      format('arquivo.%s: índice na FK', c));
  end loop;

  -- triggers
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.arquivo'::regclass
                         and tgname = 'arquivo_set_updated_at' and not tgisinternal),
    'arquivo: trigger de updated_at');
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.arquivo'::regclass
                         and tgname = 'trg_auditoria' and not tgisinternal),
    'arquivo: auditoria ligada');
  return next ok(exists (select 1 from pg_trigger where tgrelid = 'public.tipo_arquivo'::regclass
                         and tgname = 'trg_auditoria' and not tgisinternal),
    'tipo_arquivo: auditoria ligada');
end $$;

-- ---------------------------------------------------------------------------
-- Fix round 1: update protegido (I1) e storage fail-closed (I2)
-- ---------------------------------------------------------------------------
create function tests.test_update_nao_desmarca_restrito() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.upd@exemplo.test', 'operacao');
  v_adm uuid := tests.criar_usuario('adm.upd@exemplo.test', 'admin');
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_r uuid := gen_random_uuid();
  v_n uuid := gen_random_uuid();
  v_restrito_apos boolean;
  v_n_restrito boolean;
  v_numero text;
begin
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, restrito) values
    (v_r, 5, v_pes, 'pessoa/' || v_pes || '/' || v_r || '-cnh.pdf', true),
    (v_n, 6, v_pes, 'pessoa/' || v_pes || '/' || v_n || '-comp.pdf', false);

  -- (a) WHERE que não referencia colunas de arquivo: não pode alcançar a linha restrita
  perform tests.executar_como(v_op, $q$update public.arquivo set restrito = false where now() > '2000-01-01'$q$);
  perform tests.executar_como(v_op, $q$update public.arquivo set numero = 'X'$q$);
  select restrito into v_restrito_apos from public.arquivo where id = v_r;
  select numero into v_numero from public.arquivo where id = v_r;
  return next is(v_restrito_apos, true, 'operacao com update sem referência a colunas não desmarca arquivo restrito');
  return next is(v_numero, null, 'operacao não altera nenhuma coluna de arquivo restrito');

  -- (b) não admin pode marcar como restrito um arquivo visível. Atenção (semântica do Postgres):
  -- com WHERE que lê colunas (ex.: where id = ...) a política de SELECT também vale para a linha
  -- nova, e restrito = true a reprova (42501); só o UPDATE sem referência a colunas passa.
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$update public.arquivo set restrito = true where id = %L$q$)$f$, v_op, v_n),
    '42501', null, 'operacao não marca restrito com WHERE em coluna (SELECT policy vale para a linha nova)');
  perform tests.executar_como(v_op, $q$update public.arquivo set restrito = true where now() > '2000-01-01'$q$);
  select restrito into v_n_restrito from public.arquivo where id = v_n;
  return next is(v_n_restrito, true, 'operacao marca como restrito o arquivo visível (UPDATE sem referência a colunas)');
  select restrito into v_restrito_apos from public.arquivo where id = v_r;
  return next is(v_restrito_apos, true, 'o arquivo que já era restrito continua intocado');

  -- depois de restrito, a própria operacao não mexe mais nele
  perform tests.executar_como(v_op, format('update public.arquivo set restrito = false where id = %L', v_n));
  select restrito into v_n_restrito from public.arquivo where id = v_n;
  return next is(v_n_restrito, true, 'operacao não consegue desmarcar o que acabou de restringir');

  -- admin continua podendo desmarcar
  perform tests.executar_como(v_adm, format('update public.arquivo set restrito = false where id = %L', v_r));
  select restrito into v_restrito_apos from public.arquivo where id = v_r;
  return next is(v_restrito_apos, false, 'admin desmarca arquivo restrito');
end $$;

create function tests.test_storage_sem_arquivo_so_admin() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.orf@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei.orf@exemplo.test', 'leitura');
  v_adm uuid := tests.criar_usuario('adm.orf@exemplo.test', 'admin');
  v_path text := 'pessoa/orfao/sem-arquivo.pdf';
  v_op_n bigint; v_lei_n bigint; v_adm_n bigint;
begin
  insert into storage.objects (bucket_id, name) values ('documentos', v_path);
  perform tests.como(v_op);
  select count(*) into v_op_n from storage.objects where bucket_id = 'documentos' and name = v_path;
  perform tests.como(v_lei);
  select count(*) into v_lei_n from storage.objects where bucket_id = 'documentos' and name = v_path;
  perform tests.como(v_adm);
  select count(*) into v_adm_n from storage.objects where bucket_id = 'documentos' and name = v_path;
  perform tests.como_servico();
  return next is(v_op_n, 0::bigint, 'operacao não vê objeto sem arquivo registrado');
  return next is(v_lei_n, 0::bigint, 'leitura não vê objeto sem arquivo registrado');
  return next is(v_adm_n, 1::bigint, 'admin vê objeto sem arquivo registrado');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
