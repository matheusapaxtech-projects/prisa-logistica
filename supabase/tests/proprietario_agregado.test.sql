-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Marcação de agregado no proprietário. Só CPF fictício.

create function tests.test_agregado_padrao_falso() returns setof text language plpgsql as $$
declare
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Dono Teste', '52998224725') returning id into v_pf;
  insert into public.proprietario (pessoa_id) values (v_pf);
  return next is((select agregado from public.proprietario where pessoa_id = v_pf), false, 'proprietário nasce como não agregado');
end $$;

create function tests.test_agregado_desde_so_agregado() returns setof text language plpgsql as $$
declare
  v_pf uuid;
begin
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Dono Teste', '52998224725') returning id into v_pf;
  return next throws_ok(
    format($f$insert into public.proprietario (pessoa_id, agregado, agregado_desde) values (%L, false, '2026-01-10')$f$, v_pf),
    '23514', null, 'data de agregado sem a marcação é recusada');
  return next lives_ok(
    format($f$insert into public.proprietario (pessoa_id, agregado, agregado_desde) values (%L, true, '2026-01-10')$f$, v_pf),
    'agregado com data de início é aceito');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
