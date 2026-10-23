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

### Onde e quando rodar (dados reais)

- Os testes rodam **no projeto vivo** (`supabase-nilt`), dentro de uma transação que termina em `rollback;`: nada do que criam persiste. Mesmo assim eles escrevem de verdade na transação, usam constantes fixas e disparam gatilhos/auditoria.
- Os dados de teste são fictícios e **fixos** (CPF 52998224725 e 11144477735, CNPJ 11222333000181, placas `TST…`). Como CPF, CNPJ e placa são colunas únicas, **se algum registro real (ou de homologação) usar esses valores, o teste falha por chave duplicada**.
- As asserções filtram pelos ids/documentos criados no próprio teste e as cargas de catálogo são conferidas por id (ex.: `tipo_veiculo` ids 1..38, `marca_veiculo` 1..42), então linhas novas de usuários reais não quebram a contagem. As asserções de segurança do tipo "sem perfil enxerga 0" continuam sem filtro de propósito (devem valer para a tabela inteira).
- Depois que existirem dados reais, prefira rodar a suíte numa **branch do Supabase** (`create_branch`) ou numa pilha local (`supabase start`), nunca no projeto de produção com dados que possam colidir.

### Fluxo canônico de upload de documentos

1. Gerar o id do arquivo (uuid) na aplicação.
2. Inserir a linha em `public.arquivo` com esse `id` e `storage_path` = `pessoa/<pessoa_id>/<id>-<nome>` (ou `veiculo/<veiculo_id>/<id>-<nome>`).
3. Enviar o objeto ao bucket `documentos` exatamente nesse caminho.
4. Para ler: `registrar_visualizacao(arquivo_id)` e só então gerar o link temporário.

A ordem é essa porque, depois da migration 0801, quem não é admin só enxerga um objeto do Storage se existir a linha correspondente em `arquivo` (o comentário da migration 0800 descreve a ordem inversa e está desatualizado; ela já foi aplicada e não foi editada). Verificar o envio autenticado como `operacao` na fase de UI.

### Privilégios padrão (migration 0901)

Tabelas, funções e sequências novas criadas pelo `postgres` em `public` nascem sem acesso para `anon` (e funções sem `execute` para `PUBLIC`). `authenticated` e `service_role` continuam recebendo os padrões do Supabase em `public` (`authenticated` sem truncate/references/trigger/maintain nas tabelas). Funções `security definer` que usuários logados não devem chamar precisam de `revoke execute ... from authenticated` explícito; as que precisam, de `grant execute ... to authenticated` explícito (não dependa do default).

### Migrations: versões remotas x arquivos

O `apply_migration` do MCP carimba a migration no servidor com a data/hora da aplicação (ex.: `20261023043544`), enquanto os arquivos em `supabase/migrations/` usam nomes sequenciais (`20261023000901_...`). As versões **não coincidem**. Antes de qualquer `supabase db push` ou outro uso do CLI, rode `supabase migration repair` (marcando como `reverted` as versões remotas e como `applied` as dos arquivos) para alinhar o histórico; sem isso o CLI tentará reaplicar tudo.

Exceção conhecida: `arquivos.test.sql` (`test_update_nao_desmarca_restrito`) executa `update public.arquivo ... ` **sem filtro de coluna de propósito** (é exatamente o caso que testa), então ele altera, dentro da transação revertida, todas as linhas de `arquivo` visíveis ao papel `operacao`. Nada persiste, mas com muitos dados reais isso trava/visita essas linhas e dispara auditoria até o `rollback`: mais um motivo para rodar a suíte numa branch.
