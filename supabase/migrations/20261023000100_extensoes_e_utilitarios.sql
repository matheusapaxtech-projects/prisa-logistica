-- Migration 0100: extensões e utilitários de validação/normalização.

create extension if not exists pgtap with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Remove tudo que não é dígito. null entra, null sai.
create function public.so_digitos(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p, '[^0-9]', '', 'g')
$$;

-- CPF: 11 dígitos, não todos iguais, dois dígitos verificadores (módulo 11).
-- null -> false.
create function public.cpf_valido(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := public.so_digitos(p);
  soma int;
  dv int;
  i int;
begin
  if d is null or length(d) <> 11 or d ~ '^(.)\1{10}$' then
    return false;
  end if;

  soma := 0;
  for i in 1..9 loop
    soma := soma + substr(d, i, 1)::int * (11 - i);
  end loop;
  dv := (soma * 10) % 11;
  if dv = 10 then dv := 0; end if;
  if dv <> substr(d, 10, 1)::int then
    return false;
  end if;

  soma := 0;
  for i in 1..10 loop
    soma := soma + substr(d, i, 1)::int * (12 - i);
  end loop;
  dv := (soma * 10) % 11;
  if dv = 10 then dv := 0; end if;
  return dv = substr(d, 11, 1)::int;
end $$;

-- CNPJ: 14 dígitos, não todos iguais, dois dígitos verificadores (módulo 11, pesos do CNPJ).
-- null -> false.
create function public.cnpj_valido(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := public.so_digitos(p);
  pesos1 constant int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 constant int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma int;
  dv int;
  i int;
begin
  if d is null or length(d) <> 14 or d ~ '^(.)\1{13}$' then
    return false;
  end if;

  soma := 0;
  for i in 1..12 loop
    soma := soma + substr(d, i, 1)::int * pesos1[i];
  end loop;
  dv := soma % 11;
  dv := case when dv < 2 then 0 else 11 - dv end;
  if dv <> substr(d, 13, 1)::int then
    return false;
  end if;

  soma := 0;
  for i in 1..13 loop
    soma := soma + substr(d, i, 1)::int * pesos2[i];
  end loop;
  dv := soma % 11;
  dv := case when dv < 2 then 0 else 11 - dv end;
  return dv = substr(d, 14, 1)::int;
end $$;

-- Placa: maiúsculas, só letras e dígitos. null -> null.
create function public.normalizar_placa(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(upper(p), '[^A-Z0-9]', '', 'g')
$$;

-- Placa antiga (ABC1234) ou Mercosul (ABC1D23). null -> false.
create function public.placa_valida(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(public.normalizar_placa(p) ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', false)
$$;

-- Trigger genérico de carimbo de atualização (tabelas com updated_at/updated_by).
create function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
