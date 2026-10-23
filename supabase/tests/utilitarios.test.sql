-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
create function tests.test_cpf_valido() returns setof text language plpgsql as $$
begin
  return next ok(public.cpf_valido('52998224725'), 'cpf válido sem máscara');
  return next ok(public.cpf_valido('529.982.247-25'), 'cpf válido com máscara');
  return next ok(public.cpf_valido('11144477735'), 'segundo cpf fictício válido');
  return next ok(not public.cpf_valido('52998224724'), 'dígito verificador errado');
  return next ok(not public.cpf_valido('11111111111'), 'todos iguais');
  return next ok(not public.cpf_valido('123'), 'tamanho errado');
  return next ok(not public.cpf_valido(null), 'null é inválido');
end $$;

create function tests.test_cnpj_valido() returns setof text language plpgsql as $$
begin
  return next ok(public.cnpj_valido('11222333000181'), 'cnpj válido sem máscara');
  return next ok(public.cnpj_valido('11.222.333/0001-81'), 'cnpj válido com máscara');
  return next ok(not public.cnpj_valido('11222333000180'), 'dígito verificador errado');
  return next ok(not public.cnpj_valido('00000000000000'), 'todos iguais');
  return next ok(not public.cnpj_valido('1122233300018'), 'tamanho errado');
  return next ok(not public.cnpj_valido(null), 'null é inválido');
end $$;

create function tests.test_normaliza_documento() returns setof text language plpgsql as $$
begin
  return next is(public.so_digitos('529.982.247-25'), '52998224725', 'remove máscara do cpf');
  return next is(public.so_digitos('11.222.333/0001-81'), '11222333000181', 'remove máscara do cnpj');
  return next is(public.so_digitos(null), null, 'null entra, null sai');
end $$;

create function tests.test_placa() returns setof text language plpgsql as $$
begin
  return next is(public.normalizar_placa('abc-1234'), 'ABC1234', 'normaliza placa antiga');
  return next ok(public.placa_valida('ABC1D23'), 'placa mercosul válida');
  return next ok(public.placa_valida('abc-1234'), 'placa antiga com hífen válida');
  return next ok(not public.placa_valida('AB12345'), 'formato inválido');
  return next ok(not public.placa_valida(null), 'null é inválida');
end $$;

create function tests.test_fn_set_updated_at() returns setof text language plpgsql as $$
declare
  v_uid uuid := tests.criar_usuario('upd@exemplo.test', null);
  v_by uuid;
  v_em timestamptz;
begin
  create table tests.t_upd (id int primary key, updated_at timestamptz, updated_by uuid);
  grant all on tests.t_upd to authenticated;
  create trigger t_upd_set_updated_at before insert or update on tests.t_upd
    for each row execute function public.fn_set_updated_at();

  insert into tests.t_upd (id) values (1);
  select updated_at, updated_by into v_em, v_by from tests.t_upd where id = 1;
  return next ok(v_em is not null, 'carimba updated_at');
  return next is(v_by, null, 'sem usuário logado, updated_by é null');

  perform tests.executar_como(v_uid, 'insert into tests.t_upd (id) values (2)');
  select updated_by into v_by from tests.t_upd where id = 2;
  return next is(v_by, v_uid, 'updated_by recebe auth.uid()');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
