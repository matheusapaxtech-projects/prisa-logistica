-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Acesso do motorista ao app (migration 20261107000300): liberar, entrar com o celular verificado, revogar.
-- Só documentos fictícios (CPF 11144477735) e celulares de teste.

create function tests.motorista() returns uuid language plpgsql as $$
declare
  v uuid;
begin
  insert into public.pessoa (tipo, nome, apelido, cpf, situacao_cadastro)
  values ('pf', 'Motorista Teste', 'Zé', '11144477735', 'normal') returning id into v;
  insert into public.motorista (pessoa_id, situacao_cadastro) values (v, 'normal');
  return v;
end $$;

-- Usuário do Auth que entrou pelo código no celular p_cel (verificado).
create function tests.usuario_celular(p_cel text) returns uuid language plpgsql as $$
declare
  v uuid := gen_random_uuid();
begin
  insert into auth.users (id, phone, phone_confirmed_at, aud, role) values (v, p_cel, now(), 'authenticated', 'authenticated');
  return v;
end $$;

create function tests.test_liberar_e_ativar() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_fin uuid := tests.criar_usuario('fin@exemplo.test', 'financeiro');
  v_m uuid := tests.motorista();
  v_u uuid := tests.usuario_celular('5543999998888');
  v_cel text;
begin
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_fin, format('select public.liberar_acesso_app(%L, %L)', v_m, '43999998888')),
                        '42501', null, 'financeiro não libera o app');
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_op, format('select public.liberar_acesso_app(%L, %L)', v_m, '4333334444')),
                        'P0001', null, 'telefone fixo é recusado');
  perform tests.como(v_op);
  v_cel := public.liberar_acesso_app(v_m, '(43) 99999-8888');
  perform tests.como_servico();
  return next is(v_cel, '5543999998888', 'celular guardado só com dígitos e o 55');

  perform tests.como(v_u);
  return next is(public.ativar_acesso_app(), v_m, 'o celular liberado ativa o acesso');
  return next is(public.meu_motorista(), v_m, 'o usuário passa a ser o motorista');
  return next is(public.ativar_acesso_app(), v_m, 'ativar de novo não duplica');
  perform tests.como_servico();
  return next is((select nome from public.perfil_usuario where user_id = v_u), 'Zé', 'o perfil usa o apelido');
end $$;

create function tests.test_celular_nao_liberado() returns setof text language plpgsql as $$
declare
  v_u uuid := tests.usuario_celular('5543988887777');
begin
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_u, 'select public.ativar_acesso_app()'),
                        '42501', 'este celular não está liberado no app da Prisa. Fale com a operação.', 'celular sem liberação não entra');
end $$;

create function tests.test_revogar() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_m uuid := tests.motorista();
  v_u uuid := tests.usuario_celular('5543999998888');
begin
  perform tests.como(v_op);
  perform public.liberar_acesso_app(v_m, '43999998888');
  perform tests.como(v_u);
  perform public.ativar_acesso_app();
  perform tests.como(v_op);
  perform public.revogar_acesso_app(v_m);
  perform tests.como(v_u);
  return next is(public.meu_motorista(), null::uuid, 'revogado: o usuário deixa de ser motorista na hora');
  perform tests.como_servico();
  return next throws_ok(format('select tests.executar_como(%L, %L)', v_u, 'select public.ativar_acesso_app()'),
                        '42501', null, 'revogado não reativa sozinho');
end $$;

create function tests.test_trocar_celular() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_m uuid := tests.motorista();
  v_u1 uuid := tests.usuario_celular('5543999998888');
  v_u2 uuid := tests.usuario_celular('5543977776666');
begin
  perform tests.como(v_op);
  perform public.liberar_acesso_app(v_m, '43999998888');
  perform tests.como(v_u1);
  perform public.ativar_acesso_app();
  perform tests.como(v_op);
  perform public.liberar_acesso_app(v_m, '43977776666');
  perform tests.como(v_u1);
  return next is(public.meu_motorista(), null::uuid, 'celular trocado: o número antigo perde o acesso');
  perform tests.como(v_u2);
  return next is(public.ativar_acesso_app(), v_m, 'o número novo entra');
  perform tests.como_servico();
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
