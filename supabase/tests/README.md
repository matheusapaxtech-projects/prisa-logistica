# Testes do banco (pgTAP)

### Como os testes rodam (vale para todas as tasks)

Cada arquivo de teste é executado com **uma** chamada `execute_sql` do `supabase-nilt`, cujo `query` é o conteúdo de `_helpers.sql` seguido do conteúdo do arquivo. Formato de todo arquivo de teste:

```sql
begin;
-- (conteúdo de _helpers.sql é colado antes desta linha pelo executor)
create function tests.test_<nome>() returns setof text language plpgsql as $$
begin
  return next <assertiva pgTAP>;
end $$;
-- ... mais funções test_*
select * from runtests('tests'::name, '^test_');
rollback;
```

Passou: nenhuma linha começa com `not ok` e a última linha não contém `Looks like you failed`. Falhou: qualquer `not ok`.

### Convenção adotada para `begin;` (decisão do repositório)

O `begin;` precisa vir **antes** do `create schema tests;` dos helpers. Por isso:

- `_helpers.sql` **começa com `begin;`** (abre a transação, cria o schema `tests` e as funções auxiliares).
- Os arquivos `*.test.sql` **não** têm `begin;`: contêm só as funções `tests.test_*`, o `select * from runtests(...)` e terminam com `rollback;`.
- O `query` enviado ao `execute_sql` é, portanto: `_helpers.sql` + `<arquivo>.test.sql`, nessa ordem, sem nada entre eles.

Assim tudo (schema `tests`, usuários de teste, dados) é desfeito pelo `rollback;` final.

### Helpers (`_helpers.sql`)

- `tests.criar_usuario(p_email text, p_papel text) returns uuid`: insere em `auth.users`; se `p_papel` não for nulo, cria também o perfil em `public.perfil_usuario` (só funciona depois da Task 3; antes use `null`).
- `tests.como(p_uid uuid)`: passa a agir como o usuário (papel `authenticated` + claims JWT; `auth.uid()` devolve `p_uid`).
- `tests.como_servico()`: volta ao papel `postgres`.
- `tests.executar_como(p_uid uuid, p_sql text)`: roda `p_sql` como o usuário e sempre volta ao papel `postgres`. Use para DML/consultas do usuário: o pgTAP grava resultados em tabelas temporárias do `postgres`, então `ok()/is()/lives_ok()` não devem rodar com o papel `authenticated` ativo. Alternativa: guardar o valor em variável, chamar `tests.como_servico()` e só então fazer a assertiva. `throws_ok` de SQL que falha volta sozinho ao papel anterior.
