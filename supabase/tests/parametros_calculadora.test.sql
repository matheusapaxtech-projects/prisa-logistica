-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Alíquotas da calculadora de frete (migration 20261028000100).

-- Roda p_sql (que devolve jsonb) como o usuário e devolve o resultado (o mesmo de frete_antt_cte.test.sql).
create function tests.jsonb_como(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
begin
  perform tests.executar_como(p_uid, format($q$select set_config('tests.r', coalesce((%s)::text, ''), true)$q$, p_sql));
  return nullif(current_setting('tests.r'), '')::jsonb;
end $$;

create function tests.test_parametros_calculadora() returns setof text language plpgsql as $$
declare
  v_op uuid := tests.criar_usuario('op@exemplo.test', 'operacao');
  v_sem uuid := tests.criar_usuario('sem@exemplo.test', null);
  p jsonb;
begin
  p := tests.jsonb_como(v_op, 'public.parametros_calculadora()');
  return next is((p ->> 'pis_cofins')::numeric, 0.0365::numeric, 'operação recebe as alíquotas vigentes');
  return next is((p ->> 'pan_card_transferencias')::int, 2, 'com as transferências do Pan Card');
  return next ok(not (p ? 'observacao'), 'sem a observação da linha');
  return next is((tests.jsonb_como(v_op, '(select to_jsonb(count(*)) from public.parametro_fiscal)'))::int, 0,
    'a tabela continua fechada para a operação');
  return next ok(tests.jsonb_como(v_sem, 'public.parametros_calculadora()') is null, 'sem perfil não recebe nada');
  return next ok(tests.jsonb_como(v_op, 'public.parametros_calculadora(date ''2025-12-31'')') is null,
    'antes da primeira vigência não há parâmetros');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
