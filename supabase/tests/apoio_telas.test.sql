-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 1 da fase 1 web: colunas novas, v_vencimentos, listar_usuarios, definir_perfil,
-- salvar_conjunto e encerrar_conjunto (migration apoio_telas).
-- Só documentos fictícios (CPF 52998224725/11144477735, CNPJ 11222333000181) e placas de teste (TST...).
-- Nenhum DELETE; todo UPDATE tem WHERE.

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

create function tests.novo_proprietario(p_doc text, p_rntrc_validade date default null) returns uuid language plpgsql as $$
declare
  v_id uuid := tests.nova_pessoa(p_doc);
begin
  insert into public.proprietario (pessoa_id, rntrc_validade) values (v_id, p_rntrc_validade);
  return v_id;
end $$;

create function tests.novo_motorista(
  p_doc text, p_cnh_validade date, p_gr_validade date default null,
  p_situacao public.situacao_cadastro default 'normal')
returns uuid language plpgsql as $$
declare
  v_id uuid := tests.nova_pessoa(p_doc);
begin
  insert into public.motorista (pessoa_id, cnh_validade, gr_validade, situacao_cadastro)
  values (v_id, p_cnh_validade, p_gr_validade, p_situacao);
  return v_id;
end $$;

create sequence tests.seq_placa;

-- Veículo (placa TST0001...) do tipo informado, com seguro/IPVA opcionais.
create function tests.novo_veiculo(
  p_tipo integer, p_prop uuid, p_seguro date default null, p_ipva date default null)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.veiculo (placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, seguro_validade, venc_ipva)
  values ('TST' || lpad(nextval('tests.seq_placa')::text, 4, '0'), p_tipo, p_prop, p_prop, p_seguro, p_ipva)
  returning id into v_id;
  return v_id;
end $$;

-- Conjunto aberto (início há 1 dia, para permitir fechar com fim = now()) e itens 1..n.
-- A validação roda no fim da transação (constraint triggers adiadas): cada montagem começa adiada,
-- porque um `set constraints all immediate` de um teste anterior vaza para os seguintes.
create function tests.novo_conjunto(p_cavalo uuid, p_itens uuid[] default '{}')
returns uuid language plpgsql as $$
declare
  v_id uuid;
  i int;
begin
  set constraints all deferred;
  insert into public.conjunto (cavalo_id, inicio) values (p_cavalo, now() - interval '1 day') returning id into v_id;
  for i in 1 .. coalesce(cardinality(p_itens), 0) loop
    insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values (v_id, i, p_itens[i]);
  end loop;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------------
create function tests.test_colunas_novas() returns setof text language plpgsql as $$
declare
  v_pes uuid := tests.nova_pessoa('52998224725');
  v_prop uuid := tests.novo_proprietario('11222333000181');
begin
  return next has_column('public', 'pessoa', 'qualificacao_inss', 'pessoa.qualificacao_inss existe');
  return next has_column('public', 'proprietario', 'frete_empresa_motorista_valor', 'proprietario.frete_empresa_motorista_valor existe');
  return next has_column('public', 'proprietario', 'frete_empresa_motorista_percentual', 'proprietario.frete_empresa_motorista_percentual existe');
  return next lives_ok(
    format($f$update public.pessoa set qualificacao_inss = 'com_pendencia' where id = %L$f$, v_pes),
    'qualificacao_inss aceita com_pendencia');
  return next throws_ok(
    format($f$update public.pessoa set qualificacao_inss = 'talvez' where id = %L$f$, v_pes),
    '23514', null, 'qualificacao_inss recusa valor fora da lista');
  return next lives_ok(
    format($f$update public.proprietario set frete_empresa_motorista_valor = 150.50, frete_empresa_motorista_percentual = 92.5 where pessoa_id = %L$f$, v_prop),
    'frete empresa-motorista aceita valor e percentual');
  return next throws_ok(
    format($f$update public.proprietario set frete_empresa_motorista_percentual = 101 where pessoa_id = %L$f$, v_prop),
    '23514', null, 'percentual do frete acima de 100 é recusado');
end $$;

-- ---------------------------------------------------------------------------
-- v_vencimentos
-- ---------------------------------------------------------------------------
create function tests.test_vencimentos_sem_duplicar() returns setof text language plpgsql as $$
declare
  v_mot uuid := tests.novo_motorista('52998224725', current_date - 10);
begin
  -- arquivo CNH vencido do mesmo motorista e outro documento (CND) que não está no cadastro
  insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path, validade)
  values (5, v_mot, 'teste/apoio/cnh-vencida.pdf', current_date - 10),
         (4, v_mot, 'teste/apoio/cnd.pdf', current_date + 20);

  return next is(
    (select count(*) from public.v_vencimentos where pessoa_id = v_mot and tipo = 'CNH'),
    1::bigint, 'CNH vencida no cadastro e como arquivo do mesmo motorista: uma linha só');
  return next is(
    (select arquivo_id from public.v_vencimentos where pessoa_id = v_mot and tipo = 'CNH'),
    null::uuid, 'fica a linha do cadastro (sem arquivo_id)');
  return next is(
    (select dias from public.v_vencimentos where pessoa_id = v_mot and tipo = 'CNH'),
    -10, 'dias = data - hoje (vencida há 10 dias)');
  return next is(
    (select count(*) from public.v_vencimentos where pessoa_id = v_mot and tipo = 'CND' and arquivo_id is not null),
    1::bigint, 'arquivo de outro tipo (CND) entra com o nome do tipo e o arquivo_id');
  return next is(
    (select count(*) from public.v_vencimentos where pessoa_id = v_mot),
    2::bigint, 'o motorista tem só duas linhas (CNH e CND)');
end $$;

create function tests.test_vencimentos_origens() returns setof text language plpgsql as $$
declare
  v_mot uuid := tests.novo_motorista('52998224725', current_date + 400, current_date + 5);
  v_canc uuid := tests.novo_motorista('11144477735', current_date - 30, current_date - 20, 'cancelado');
  v_prop uuid := tests.novo_proprietario('11222333000181', current_date + 15);
  v_vei uuid := tests.novo_veiculo(7, v_prop, current_date + 30, current_date + 60);
begin
  insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path, validade)
  values (1, v_prop, 'teste/apoio/antt.pdf', current_date + 15);
  insert into public.arquivo (tipo_arquivo_id, veiculo_id, storage_path, validade)
  values (9, v_vei, 'teste/apoio/crlv.pdf', current_date + 7);
  -- motorista cancelado: o arquivo CNH é o mesmo documento da linha de cadastro (que não conta); o CND não
  insert into public.arquivo (tipo_arquivo_id, pessoa_id, storage_path, validade)
  values (5, v_canc, 'teste/apoio/cnh-cancelado.pdf', current_date - 30),
         (4, v_canc, 'teste/apoio/cnd-cancelado.pdf', current_date + 40);

  return next is(
    array(select tipo from public.v_vencimentos where pessoa_id = v_mot order by tipo),
    array['CNH', 'Consulta de risco'],
    'motorista: CNH e consulta de risco (gerenciadora)');
  return next is(
    (select dias from public.v_vencimentos where pessoa_id = v_mot and tipo = 'Consulta de risco'),
    5, 'consulta de risco: dias até a validade');
  return next is(
    (select count(*) from public.v_vencimentos where pessoa_id = v_canc and tipo in ('CNH', 'Consulta de risco')),
    0::bigint, 'motorista cancelado: nem CNH e consulta de risco do cadastro nem o arquivo CNH viram vencimento');
  return next is(
    array(select tipo from public.v_vencimentos where pessoa_id = v_canc order by tipo),
    array['CND'],
    'motorista cancelado: arquivo de outro documento (CND) segue na lista');
  return next is(
    array(select tipo from public.v_vencimentos where pessoa_id = v_prop order by tipo),
    array['RNTRC'],
    'proprietário: RNTRC no cadastro e arquivo ANTT da mesma validade saem uma vez só (fica RNTRC)');
  return next is(
    array(select tipo from public.v_vencimentos where veiculo_id = v_vei order by tipo),
    array['CRLV', 'IPVA', 'Seguro'],
    'veículo: seguro, IPVA e arquivo CRLV');
  return next is(
    (select arquivo_id is not null from public.v_vencimentos where veiculo_id = v_vei and tipo = 'CRLV'),
    true, 'a linha do CRLV traz o arquivo_id');
  return next is(
    (select pessoa_id from public.v_vencimentos where veiculo_id = v_vei and tipo = 'IPVA'),
    null::uuid, 'linha de veículo não tem pessoa_id');
end $$;

create function tests.test_vencimentos_privilegios() returns setof text language plpgsql as $$
begin
  return next ok(not has_table_privilege('anon', 'public.v_vencimentos', 'select'), 'anon não lê v_vencimentos');
  return next ok(has_table_privilege('authenticated', 'public.v_vencimentos', 'select'), 'authenticated lê v_vencimentos');
  return next ok(not has_table_privilege('authenticated', 'public.v_vencimentos', 'insert'), 'authenticated não escreve na view');
  return next ok(
    coalesce((select 'security_invoker=true' = any (c.reloptions) from pg_class c
              where c.oid = 'public.v_vencimentos'::regclass), false),
    'v_vencimentos usa security_invoker');
end $$;

-- ---------------------------------------------------------------------------
-- listar_usuarios e definir_perfil
-- ---------------------------------------------------------------------------
create function tests.test_listar_usuarios_so_admin() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm.apoio@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op.apoio@exemplo.test', 'operacao');
  v_sem uuid := tests.criar_usuario('sem.apoio@exemplo.test', null);
  v_ultimo timestamptz := now() - interval '2 hours';
  v_n_adm bigint;
  v_n_sem bigint;
  v_papel public.app_papel;
  v_nome text;
  v_ativo boolean;
  v_acesso timestamptz;
  v_email text;
  v_acesso_adm timestamptz;
begin
  update auth.users set last_sign_in_at = v_ultimo where id = v_adm;

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select * from public.listar_usuarios()$q$)$f$, v_op),
    '42501', 'só o administrador pode ver os usuários', 'operação não lista usuários');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select * from public.listar_usuarios()$q$)$f$, v_sem),
    '42501', 'só o administrador pode ver os usuários', 'usuário sem perfil não lista usuários');

  perform tests.como(v_adm);
  select count(*) into v_n_adm from public.listar_usuarios() u where u.user_id = v_adm;
  select count(*) into v_n_sem from public.listar_usuarios() u where u.user_id = v_sem;
  select u.papel, u.nome, u.ativo, u.ultimo_acesso, u.email
    into v_papel, v_nome, v_ativo, v_acesso, v_email
  from public.listar_usuarios() u where u.user_id = v_sem;
  select u.ultimo_acesso into v_acesso_adm from public.listar_usuarios() u where u.user_id = v_adm;
  perform tests.como_servico();

  return next is(v_n_adm, 1::bigint, 'admin vê o próprio usuário na lista');
  return next is(v_n_sem, 1::bigint, 'admin vê usuário de auth.users sem perfil');
  return next is(v_email, 'sem.apoio@exemplo.test', 'usuário sem perfil traz o e-mail');
  return next is(v_papel, null::public.app_papel, 'usuário sem perfil: papel nulo');
  return next is(v_nome, null::text, 'usuário sem perfil: nome nulo');
  return next is(v_ativo, false, 'usuário sem perfil: não está ativo');
  return next is(v_acesso, null::timestamptz, 'usuário sem perfil e sem login: ultimo_acesso nulo');
  return next is(v_acesso_adm, v_ultimo, 'ultimo_acesso vem de last_sign_in_at');
end $$;

create function tests.test_definir_perfil_nao_tira_proprio_admin() returns setof text language plpgsql as $$
declare
  v_adm uuid := tests.criar_usuario('adm2.apoio@exemplo.test', 'admin');
  v_op uuid := tests.criar_usuario('op2.apoio@exemplo.test', 'operacao');
  v_sem uuid := tests.criar_usuario('sem2.apoio@exemplo.test', null);
begin
  return next throws_ok(
    format($f$select tests.executar_como(%1$L, $q$select public.definir_perfil(%1$L, 'Admin', 'operacao', true)$q$)$f$, v_adm),
    'P0001', 'você não pode tirar o próprio acesso de administrador', 'admin não rebaixa o próprio papel');
  return next throws_ok(
    format($f$select tests.executar_como(%1$L, $q$select public.definir_perfil(%1$L, 'Admin', 'admin', false)$q$)$f$, v_adm),
    'P0001', 'você não pode tirar o próprio acesso de administrador', 'admin não se desativa');
  return next is(
    (select papel from public.perfil_usuario where user_id = v_adm), 'admin'::public.app_papel,
    'depois das recusas o admin continua admin');
  return next lives_ok(
    format($f$select tests.executar_como(%1$L, $q$select public.definir_perfil(%1$L, 'Admin Renomeado', 'admin', true)$q$)$f$, v_adm),
    'admin pode mudar o próprio nome mantendo papel e ativo');
  return next is(
    (select nome from public.perfil_usuario where user_id = v_adm), 'Admin Renomeado', 'nome do admin atualizado');

  -- admin cria o perfil de um usuário sem perfil (upsert) e depois o altera
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$select public.definir_perfil(%L, 'Fulana', 'financeiro', true)$q$)$f$, v_adm, v_sem),
    'admin cria o perfil de usuário sem perfil');
  return next is(
    (select papel from public.perfil_usuario where user_id = v_sem), 'financeiro'::public.app_papel, 'perfil criado com o papel informado');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$select public.definir_perfil(%L, 'Fulana', 'leitura', false)$q$)$f$, v_adm, v_sem),
    'admin altera papel e desativa outro usuário');
  return next is(
    (select ativo from public.perfil_usuario where user_id = v_sem), false, 'outro usuário desativado');
  return next is(
    (select papel from public.perfil_usuario where user_id = v_sem), 'leitura'::public.app_papel, 'outro usuário com o novo papel');

  -- quem não é admin não define perfil (nem o próprio)
  return next throws_ok(
    format($f$select tests.executar_como(%1$L, $q$select public.definir_perfil(%1$L, 'Op', 'admin', true)$q$)$f$, v_op),
    '42501', 'só o administrador pode alterar perfis de usuário', 'operação não se promove a admin');
  return next is(
    (select papel from public.perfil_usuario where user_id = v_op), 'operacao'::public.app_papel, 'operação continua operação');

  -- entradas inválidas
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.definir_perfil(%L, '  ', 'leitura', true)$q$)$f$, v_adm, v_sem),
    'P0001', 'informe o nome do usuário', 'nome em branco é recusado');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.definir_perfil(gen_random_uuid(), 'Fantasma', 'leitura', true)$q$)$f$, v_adm),
    'P0001', 'usuário não encontrado', 'id inexistente em auth.users é recusado');
end $$;

-- ---------------------------------------------------------------------------
-- salvar_conjunto e encerrar_conjunto
-- ---------------------------------------------------------------------------
create function tests.test_salvar_conjunto_rodotrem() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.conj@exemplo.test', 'operacao');
  v_p uuid := tests.novo_proprietario('11222333000181');
  v_cav uuid := tests.novo_veiculo(7, v_p);
  v_c1 uuid := tests.novo_veiculo(11, v_p);
  v_d uuid := tests.novo_veiculo(18, v_p);
  v_c2 uuid := tests.novo_veiculo(11, v_p);
  v_ant uuid;
  v_novo uuid;
begin
  -- conjunto anterior aberto do mesmo cavalo, já com a carreta que vai para o novo conjunto
  v_ant := tests.novo_conjunto(v_cav, array[v_c1]);

  perform tests.como(v_op);
  v_novo := public.salvar_conjunto(null, v_cav, null, array[v_c1, v_d, v_c2]);
  perform tests.como_servico();

  return next isnt(v_novo, null::uuid, 'salvar_conjunto devolve o id do novo conjunto');
  return next is(
    (select count(*) from public.conjunto where cavalo_id = v_cav and fim is null),
    1::bigint, 'o cavalo tem exatamente 1 conjunto aberto');
  return next is(
    (select id from public.conjunto where cavalo_id = v_cav and fim is null),
    v_novo, 'o conjunto aberto é o novo');
  return next is(
    array(select veiculo_id from public.conjunto_item where conjunto_id = v_novo order by posicao),
    array[v_c1, v_d, v_c2], 'cavalo + carreta + dolly + carreta: itens na ordem informada');
  return next is(
    array(select posicao from public.conjunto_item where conjunto_id = v_novo order by posicao),
    array[1, 2, 3]::smallint[], 'posições 1 a 3');
  return next isnt(
    (select fim from public.conjunto where id = v_ant), null::timestamptz,
    'o conjunto anterior do cavalo ficou com fim');
  return next is(
    (select motorista_id from public.conjunto where id = v_novo), null::uuid, 'motorista pode ficar em branco');
end $$;

create function tests.test_salvar_conjunto_edicao() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.conj2@exemplo.test', 'operacao');
  v_p uuid := tests.novo_proprietario('11222333000181');
  v_mot uuid := tests.novo_motorista('52998224725', current_date + 400);
  v_cav1 uuid := tests.novo_veiculo(7, v_p);
  v_cav2 uuid := tests.novo_veiculo(6, v_p);
  v_c1 uuid := tests.novo_veiculo(11, v_p);
  v_a uuid;
  v_novo uuid;
begin
  v_a := tests.novo_conjunto(v_cav1, array[v_c1]);

  -- editar = salvar apontando o conjunto antigo, agora com outro cavalo e a mesma carreta
  perform tests.como(v_op);
  v_novo := public.salvar_conjunto(v_a, v_cav2, v_mot, array[v_c1]);
  perform tests.como_servico();

  return next isnt((select fim from public.conjunto where id = v_a), null::timestamptz, 'o conjunto editado é encerrado');
  return next is(
    (select count(*) from public.conjunto where id = v_novo and fim is null and cavalo_id = v_cav2 and motorista_id = v_mot),
    1::bigint, 'novo conjunto aberto com o cavalo e o motorista informados');
  return next is(
    (select count(*) from public.conjunto where cavalo_id = v_cav1 and fim is null),
    0::bigint, 'o cavalo antigo fica sem conjunto aberto');
  return next is(
    (select count(*) from public.conjunto_item where conjunto_id = v_novo), 1::bigint, 'novo conjunto com 1 item');
end $$;

create function tests.test_salvar_conjunto_dolly_ponta() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.conj3@exemplo.test', 'operacao');
  v_p uuid := tests.novo_proprietario('11222333000181');
  v_cav uuid := tests.novo_veiculo(7, v_p);
  v_c1 uuid := tests.novo_veiculo(11, v_p);
  v_c2 uuid := tests.novo_veiculo(11, v_p);
  v_d uuid := tests.novo_veiculo(18, v_p);
  v_ant uuid;
begin
  v_ant := tests.novo_conjunto(v_cav, array[v_c2]);

  -- dolly na última posição
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.salvar_conjunto(null, %L, null, array[%L, %L]::uuid[])$q$)$f$,
      v_op, v_cav, v_c1, v_d),
    'P0001', 'dolly não pode ser a primeira nem a última peça', 'dolly na ponta é recusado com a mensagem original');
  -- dolly na primeira posição
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.salvar_conjunto(null, %L, null, array[%L, %L]::uuid[])$q$)$f$,
      v_op, v_cav, v_d, v_c1),
    'P0001', 'dolly não pode ser a primeira nem a última peça', 'dolly na primeira posição também');

  return next is(
    (select count(*) from public.conjunto where cavalo_id = v_cav), 1::bigint,
    'nada gravado: o cavalo continua com um único conjunto');
  return next is(
    (select fim from public.conjunto where id = v_ant), null::timestamptz,
    'nada gravado: o conjunto anterior continua aberto');
  return next is(
    array(select veiculo_id from public.conjunto_item where conjunto_id = v_ant),
    array[v_c2], 'nada gravado: os itens do conjunto anterior não mudaram');
  return next is(
    (select count(*) from public.conjunto_item where veiculo_id = v_d), 0::bigint,
    'nada gravado: o dolly não foi engatado em lugar nenhum');
end $$;

create function tests.test_encerrar_conjunto_duas_vezes() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op.conj4@exemplo.test', 'operacao');
  v_lei uuid := tests.criar_usuario('lei.conj4@exemplo.test', 'leitura');
  v_p uuid := tests.novo_proprietario('11222333000181');
  v_cav uuid := tests.novo_veiculo(7, v_p);
  v_conj uuid;
begin
  v_conj := tests.novo_conjunto(v_cav, '{}');

  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.encerrar_conjunto(%L)$q$)$f$, v_lei, v_conj),
    '42501', 'sem permissão para encerrar o conjunto', 'leitura não encerra conjunto');
  return next is((select fim from public.conjunto where id = v_conj), null::timestamptz, 'conjunto continua aberto após a recusa');

  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$select public.encerrar_conjunto(%L)$q$)$f$, v_op, v_conj),
    'operação encerra o conjunto aberto');
  return next isnt((select fim from public.conjunto where id = v_conj), null::timestamptz, 'conjunto encerrado tem fim');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.encerrar_conjunto(%L)$q$)$f$, v_op, v_conj),
    'P0001', 'conjunto já encerrado', 'encerrar de novo é recusado');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$select public.encerrar_conjunto(gen_random_uuid())$q$)$f$, v_op),
    'P0001', 'conjunto não encontrado', 'conjunto inexistente é recusado');
end $$;

-- ---------------------------------------------------------------------------
-- Privilégios das funções novas
-- ---------------------------------------------------------------------------
create function tests.test_privilegios_funcoes() returns setof text language plpgsql as $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.listar_usuarios()',
    'public.definir_perfil(uuid, text, public.app_papel, boolean)',
    'public.salvar_conjunto(uuid, uuid, uuid, uuid[])',
    'public.encerrar_conjunto(uuid)']
  loop
    return next ok(not has_function_privilege('anon', v_fn, 'execute'), v_fn || ': anon sem execute');
    return next ok(not has_function_privilege('public', v_fn, 'execute'), v_fn || ': PUBLIC sem execute');
    return next ok(has_function_privilege('authenticated', v_fn, 'execute'), v_fn || ': authenticated com execute');
  end loop;
  return next ok(
    (select p.prosecdef from pg_proc p where p.oid = 'public.listar_usuarios()'::regprocedure),
    'listar_usuarios é security definer');
  return next ok(
    (select p.prosecdef from pg_proc p where p.oid = 'public.definir_perfil(uuid, text, public.app_papel, boolean)'::regprocedure),
    'definir_perfil é security definer');
  return next ok(
    not (select p.prosecdef from pg_proc p where p.oid = 'public.salvar_conjunto(uuid, uuid, uuid, uuid[])'::regprocedure),
    'salvar_conjunto é security invoker (RLS vale)');
  return next ok(
    not (select p.prosecdef from pg_proc p where p.oid = 'public.encerrar_conjunto(uuid)'::regprocedure),
    'encerrar_conjunto é security invoker (RLS vale)');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
