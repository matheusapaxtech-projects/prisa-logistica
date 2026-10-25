# NILT — instruções para agentes

Leia `README.md` (mapa e como rodar) e `CONTRIBUTING.md` (fluxo, banco, regras de dados). Pontos que não podem
falhar:

- **Banco:** desenvolva e teste só no Supabase **local** (`npx supabase start`, `npx supabase db reset`,
  `node supabase/tests/rodar-local.mjs`). Não aplique migrations, seeds nem testes no projeto da nuvem
  `tkfpbpqbnasabtzatojk` (MCP `supabase-nilt`) sem a pessoa responsável pedir explicitamente.
- Migration aplicada não se edita: crie uma nova. Depois de mudar o banco, regenere `supabase/types/database.ts`.
- **ATUA é produção da Prisa e só leitura.** Nunca cadastre, edite ou apague nada nele.
- Só dados fictícios fora da produção (LGPD). O app nunca usa a chave secreta (service role).
- Next.js 16: leia `web/AGENTS.md` antes de escrever código no `web/`.
- Textos de tela em português do Brasil, para quem não é técnico. Visual pelo `DESIGN.md`.
