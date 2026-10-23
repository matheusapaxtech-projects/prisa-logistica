-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Task 5: pessoa PF/PJ, contatos, contas bancárias e Pix. Só CPF/CNPJ fictícios.

create function tests.test_pessoa_pf_exige_cpf_valido() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano de Tal', '52998224724')$q$)$f$, v_op),
    '23514', null, 'PF com CPF de dígito verificador errado é recusada');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano de Tal', '52998224725')$q$)$f$, v_op),
    'PF com CPF válido é aceita');
end $$;

create function tests.test_pessoa_cpf_com_mascara() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_cpf text;
begin
  perform tests.executar_como(v_op,
    $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano de Tal', '529.982.247-25')$q$);
  select cpf into v_cpf from public.pessoa where nome = 'Fulano de Tal';
  return next is(v_cpf, '52998224725', 'CPF com máscara é gravado só com dígitos');
end $$;

create function tests.test_pessoa_cnpj_com_mascara() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_cnpj text;
begin
  perform tests.executar_como(v_op,
    $q$insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11.222.333/0001-81')$q$);
  select cnpj into v_cnpj from public.pessoa where nome = 'Empresa Teste';
  return next is(v_cnpj, '11222333000181', 'CNPJ com máscara é gravado só com dígitos');
end $$;

create function tests.test_pessoa_pj_exige_cnpj() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome) values ('pj', 'Empresa Teste')$q$)$f$, v_op),
    '23514', null, 'PJ sem CNPJ é recusada');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pj', 'Empresa Teste', '52998224725')$q$)$f$, v_op),
    '23514', null, 'PJ com CPF é recusada');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf, cnpj) values ('pf', 'Fulano', '52998224725', '11222333000181')$q$)$f$, v_op),
    '23514', null, 'PF com CPF e CNPJ é recusada');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Empresa Teste', '11222333000181')$q$)$f$, v_op),
    'PJ com CNPJ válido é aceita');
end $$;

create function tests.test_cpf_duplicado() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
begin
  perform tests.executar_como(v_op,
    $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Primeira', '52998224725')$q$);
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Segunda', '529.982.247-25')$q$)$f$, v_op),
    '23505', null, 'segunda PF com o mesmo CPF (mesmo mascarado) é recusada');
end $$;

create function tests.test_titular_confere() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_pf uuid;
  v_pj uuid;
  v_igual boolean;
  v_dif boolean;
  v_nulo boolean;
  v_pj_igual boolean;
  v_doc text;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Titular PF', '52998224725') returning id into v_pf;
  insert into public.pessoa (tipo, nome, cnpj) values ('pj', 'Titular PJ', '11222333000181') returning id into v_pj;

  perform tests.executar_como(v_fin, format(
    $q$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, favorecido_documento) values (%L, '001', '529.982.247-25')$q$, v_pf));
  perform tests.executar_como(v_fin, format(
    $q$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, favorecido_documento) values (%L, '341', '11144477735')$q$, v_pf));
  perform tests.executar_como(v_fin, format(
    $q$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo) values (%L, '237')$q$, v_pf));
  perform tests.executar_como(v_fin, format(
    $q$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, favorecido_documento) values (%L, '001', '11222333000181')$q$, v_pj));

  select titular_confere, favorecido_documento into v_igual, v_doc
    from public.pessoa_conta_bancaria where pessoa_id = v_pf and banco_codigo = '001';
  select titular_confere into v_dif from public.pessoa_conta_bancaria where pessoa_id = v_pf and banco_codigo = '341';
  select titular_confere into v_nulo from public.pessoa_conta_bancaria where pessoa_id = v_pf and banco_codigo = '237';
  select titular_confere into v_pj_igual from public.pessoa_conta_bancaria where pessoa_id = v_pj;

  return next is(v_igual, true, 'favorecido = CPF da pessoa (mesmo com máscara) -> titular_confere true');
  return next is(v_doc, '52998224725', 'favorecido_documento é normalizado para dígitos');
  return next is(v_dif, false, 'favorecido diferente do CPF -> false');
  return next is(v_nulo, false, 'favorecido_documento nulo -> false');
  return next is(v_pj_igual, true, 'favorecido = CNPJ da pessoa jurídica -> true');

  -- Atualização do favorecido recalcula.
  update public.pessoa_conta_bancaria set favorecido_documento = '11144477735'
    where pessoa_id = v_pf and banco_codigo = '001';
  select titular_confere into v_igual from public.pessoa_conta_bancaria where pessoa_id = v_pf and banco_codigo = '001';
  return next is(v_igual, false, 'update do favorecido recalcula titular_confere');
end $$;

-- O trigger lê pessoa fora da RLS do chamador: security definer com search_path fixo.
create function tests.test_titular_confere_funcao_segura() returns setof text language plpgsql as $$
begin
  return next ok(
    (select prosecdef from pg_proc where oid = 'public.fn_conta_bancaria_titular()'::regprocedure),
    'fn_conta_bancaria_titular é security definer');
  return next ok(
    exists (select 1 from pg_proc p
            where p.oid = 'public.fn_conta_bancaria_titular()'::regprocedure
              and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
    'fn_conta_bancaria_titular declara search_path');
  return next ok(not has_function_privilege('anon', 'public.fn_conta_bancaria_titular()', 'execute'),
    'anon sem execute em fn_conta_bancaria_titular');
end $$;

create function tests.test_leitura_nao_edita() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
begin
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725')$q$)$f$, v_lei),
    '42501', null, 'leitura não insere pessoa');
end $$;

create function tests.test_leitura_le() returns setof text language plpgsql as $$
declare
  v_lei uuid := tests.criar_usuario('lei@exemplo.test', 'leitura');
  v_semperfil uuid := tests.criar_usuario('sem@exemplo.test', null);
  v_pessoas bigint;
  v_bancos bigint;
  v_sem bigint;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725');
  perform tests.como(v_lei);
  select count(*) into v_pessoas from public.pessoa;
  select count(*) into v_bancos from public.banco;
  perform tests.como(v_semperfil);
  select count(*) into v_sem from public.pessoa;
  perform tests.como_servico();
  return next is(v_pessoas, 1::bigint, 'leitura enxerga pessoa');
  return next is(v_bancos, 20::bigint, 'leitura enxerga os 20 bancos da carga');
  return next is(v_sem, 0::bigint, 'usuário sem perfil não enxerga pessoa');
end $$;

create function tests.test_financeiro_edita_conta() returns setof text language plpgsql as $$
declare
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Titular PF', '52998224725') returning id into v_pf;
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, agencia, conta) values (%L, '001', '1234', '99999')$q$)$f$, v_fin, v_pf),
    'financeiro insere conta bancária');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_chave_pix (pessoa_id, tipo, chave) values (%L, 'cpf', '52998224725')$q$)$f$, v_fin, v_pf),
    'financeiro insere chave Pix');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Outro', '11144477735')$q$)$f$, v_fin),
    '42501', null, 'financeiro não insere pessoa');
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_telefone (pessoa_id, numero) values (%L, '11999990000')$q$)$f$, v_fin, v_pf),
    '42501', null, 'financeiro não insere telefone');
end $$;

create function tests.test_um_principal() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pf uuid;
  v_pf2 uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725') returning id into v_pf;
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Beltrano', '11144477735') returning id into v_pf2;
  perform tests.executar_como(v_op, format(
    $q$insert into public.pessoa_telefone (pessoa_id, numero, principal) values (%L, '11999990001', true)$q$, v_pf));
  return next throws_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_telefone (pessoa_id, numero, principal) values (%L, '11999990002', true)$q$)$f$, v_op, v_pf),
    '23505', null, 'dois telefones principais para a mesma pessoa são recusados');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_telefone (pessoa_id, numero, principal) values (%L, '11999990002', false)$q$)$f$, v_op, v_pf),
    'segundo telefone não principal é aceito');
  return next lives_ok(
    format($f$select tests.executar_como(%L, $q$insert into public.pessoa_telefone (pessoa_id, numero, principal) values (%L, '11999990003', true)$q$)$f$, v_op, v_pf2),
    'outra pessoa pode ter o seu telefone principal');
end $$;

create function tests.test_um_principal_demais_tabelas() returns setof text language plpgsql as $$
declare
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725') returning id into v_pf;
  insert into public.pessoa_endereco (pessoa_id, cidade, uf, principal) values (v_pf, 'Curitiba', 'PR', true);
  insert into public.pessoa_email (pessoa_id, email, principal) values (v_pf, 'a@exemplo.test', true);
  insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, principal) values (v_pf, '001', true);
  insert into public.pessoa_chave_pix (pessoa_id, tipo, chave, principal) values (v_pf, 'email', 'a@exemplo.test', true);

  return next throws_ok(
    format($f$insert into public.pessoa_endereco (pessoa_id, cidade, uf, principal) values (%L, 'Londrina', 'PR', true)$f$, v_pf),
    '23505', null, 'dois endereços principais recusados');
  return next throws_ok(
    format($f$insert into public.pessoa_email (pessoa_id, email, principal) values (%L, 'b@exemplo.test', true)$f$, v_pf),
    '23505', null, 'dois e-mails principais recusados');
  return next throws_ok(
    format($f$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, principal) values (%L, '341', true)$f$, v_pf),
    '23505', null, 'duas contas principais recusadas');
  return next throws_ok(
    format($f$insert into public.pessoa_chave_pix (pessoa_id, tipo, chave, principal) values (%L, 'cpf', '52998224725', true)$f$, v_pf),
    '23505', null, 'duas chaves Pix principais recusadas');
  return next throws_ok(
    format($f$insert into public.pessoa_chave_pix (pessoa_id, tipo, chave) values (%L, 'email', 'a@exemplo.test')$f$, v_pf),
    '23505', null, 'chave Pix (tipo, chave) repetida é recusada');
end $$;

create function tests.test_cep_e_documento_favorecido_normalizados() returns setof text language plpgsql as $$
declare
  v_pf uuid;
  v_cep text;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725') returning id into v_pf;
  insert into public.pessoa_endereco (pessoa_id, cep, cidade, uf) values (v_pf, '80.010-000', 'Curitiba', 'PR');
  select cep into v_cep from public.pessoa_endereco where pessoa_id = v_pf;
  return next is(v_cep, '80010000', 'CEP com máscara é gravado só com dígitos');
  return next throws_ok(
    format($f$insert into public.pessoa_endereco (pessoa_id, cep, cidade, uf) values (%L, '1234', 'Curitiba', 'PR')$f$, v_pf),
    '23514', null, 'CEP com tamanho errado é recusado');
  return next throws_ok(
    format($f$insert into public.pessoa_conta_bancaria (pessoa_id, banco_codigo, favorecido_documento) values (%L, '001', '1234')$f$, v_pf),
    '23514', null, 'documento do favorecido com tamanho errado é recusado');
end $$;

-- "Só admin apaga" verificado pela estrutura das políticas (o teste não executa remoções).
create function tests.test_politicas_exclusao_so_admin() returns setof text language plpgsql as $$
declare
  t text;
  v_n int;
  v_qual text;
begin
  foreach t in array array['pessoa', 'pessoa_endereco', 'pessoa_telefone', 'pessoa_email', 'banco',
                           'pessoa_conta_bancaria', 'pessoa_chave_pix'] loop
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
  foreach t in array array['pessoa', 'pessoa_endereco', 'pessoa_telefone', 'pessoa_email', 'banco',
                           'pessoa_conta_bancaria', 'pessoa_chave_pix'] loop
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
  foreach t in array array['pessoa', 'pessoa_endereco', 'pessoa_telefone', 'pessoa_email', 'banco',
                           'pessoa_conta_bancaria', 'pessoa_chave_pix'] loop
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
  foreach t in array array['pessoa', 'pessoa_endereco', 'pessoa_telefone', 'pessoa_email', 'banco',
                           'pessoa_conta_bancaria', 'pessoa_chave_pix'] loop
    return next ok(exists (select 1 from pg_trigger
                           where tgrelid = format('public.%I', t)::regclass
                             and tgname = 'trg_auditoria' and not tgisinternal),
      format('%s: auditoria ligada', t));
  end loop;
end $$;

create function tests.test_updated_by_carimbado() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_pf uuid;
  v_criado uuid;
  v_by uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Fulano', '52998224725') returning id into v_pf;
  perform tests.como(v_op);
  update public.pessoa set apelido = 'Fu' where id = v_pf;
  perform tests.como_servico();
  select updated_by into v_by from public.pessoa where id = v_pf;
  return next is(v_by, v_op, 'trigger carimba updated_by em pessoa');
  perform tests.executar_como(v_op, format(
    $q$insert into public.pessoa_telefone (pessoa_id, numero) values (%L, '11999990000')$q$, v_pf));
  select created_by into v_criado from public.pessoa_telefone where pessoa_id = v_pf;
  return next is(v_criado, v_op, 'created_by recebe auth.uid() por padrão');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
