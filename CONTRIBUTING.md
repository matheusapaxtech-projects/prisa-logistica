# Como contribuir com o NILT

Para preparar a máquina, veja o [`README.md`](README.md) ("Começando"). Este guia explica como o trabalho entra no
projeto.

## Fluxo de trabalho

1. Atualize o `main` e crie uma branch a partir dele:
   - `feat/<assunto>` para algo novo (ex.: `feat/cte-antt`)
   - `fix/<assunto>` para uma correção
   - `chore/<assunto>` ou `docs/<assunto>` para manutenção e documentação
2. Faça commits pequenos, cada um com um motivo só.
3. Antes de abrir o PR, rode a checagem (abaixo).
4. Abra o PR para o `main`. Diga **o que muda para quem usa** e como conferir. O CI precisa passar.
5. Quem é responsável pelo projeto revisa e faz o merge. Se o PR muda o banco, ele também aplica a migration
   na nuvem (ver "Banco de dados").

Nada vai direto para o `main`.

## Commits

O formato é `tipo(escopo): o que mudou`, em português, no presente e em minúsculas:

```
feat(web): tela do Financeiro com resultado do mês
fix(banco): aptidão da viagem num lugar só
test(web): fluxo completo do quadro da operação
docs: regra do dinheiro sem cor
```

- **Tipos:** `feat`, `fix`, `test`, `docs`, `chore`, `refactor`
- **Escopos:** `web`, `banco`, ou a área (`pedidos`, `viagens`, `financeiro`…)

## Checagem antes do PR

```bash
cd web
npm run lint
npm run typecheck
npm test
cd ..
node supabase/tests/rodar-local.mjs   # se mexeu no banco
cd web && npm run test:e2e            # se mexeu num fluxo de tela
```

O CI (`.github/workflows/ci.yml`) roda lint, tipos, testes unitários, build e a suíte do banco num Supabase
local, em todo PR.

## Banco de dados

O banco inteiro é definido em `supabase/migrations/`. A regra principal: **uma migration já aplicada nunca é
editada.** Para corrigir algo, crie uma migration nova.

Para mudar o banco:

1. Crie o arquivo `supabase/migrations/<AAAAMMDD><NNNNNN>_<nome>.sql`, seguindo a numeração dos arquivos que já
   existem. O nome tem que ficar **depois** do último em ordem alfabética.
2. Aplique no banco local: `npx supabase db reset`. Isso recria tudo do zero, migrations e seeds.
3. Escreva ou atualize o teste em `supabase/tests/<area>.test.sql` (formato no
   [`README`](supabase/tests/README.md)) e rode `node supabase/tests/rodar-local.mjs`.
4. Regenere os tipos do TypeScript:
   ```bash
   npx supabase gen types typescript --local --schema public > supabase/types/database.ts
   ```
5. Toda tabela nova precisa de RLS ligado e de policies por papel (`admin`, `operacao`, `financeiro`, `leitura`).
   Funções `security definer` precisam de `grant`/`revoke execute` explícitos (ver "Privilégios padrão" no README
   dos testes).

**Nuvem:** só a pessoa responsável aplica migrations no projeto da nuvem (`tkfpbpqbnasabtzatojk`), depois do
merge. Elas foram aplicadas pelo MCP do Supabase, que grava versões com outra data. Por isso **não rode
`supabase db push` nem `supabase link`** contra a nuvem sem antes alinhar o histórico (`supabase migration repair`,
ver [`supabase/tests/README.md`](supabase/tests/README.md)).

## Regras de dados (importante)

- **Só dados fictícios fora da produção.** Nada de CPF, CNH, placa, extrato ou documento real em seeds, testes,
  prints, issues ou PRs. Os documentos são pessoais de terceiros (LGPD).
- **O ATUA é produção da Prisa e é só leitura.** Pode consultar, nunca cadastrar, editar nem apagar nada nele.
- **O app nunca usa a chave secreta (service role).** Toda leitura e escrita passa pelo login do usuário e pelo
  RLS.
- `.env.local`, `.env.test.local`, `web/test-results/` e `web/tests/e2e/.sessao/` nunca vão para o git. O rastro
  dos testes E2E pode conter senhas.

## Código

- **Next.js 16 mudou muito.** Antes de usar uma API do Next, confira a documentação que vem instalada em
  `web/node_modules/next/dist/docs/` (ver [`web/AGENTS.md`](web/AGENTS.md)).
- Nomes de arquivos, funções, variáveis e comentários em **português**, como no resto do código.
- Os textos de tela são em português do Brasil e para quem não é técnico: diga o que aconteceu e o que fazer.
- Visual: siga o [`DESIGN.md`](DESIGN.md) e os estilos que já existem em `web/src/styles/`.
- Cada tela fica em `web/src/app/(app)/<area>/`: `page.tsx` (tela), `consultas.ts` (leituras), `actions.ts`
  (gravações, Server Actions), `regras.ts` (validação pura, testada em `web/tests/unit/`).
