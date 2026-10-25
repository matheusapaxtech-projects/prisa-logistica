# NILT — Núcleo Integrado de Logística e Transporte

O NILT é o TMS próprio da **Prisa Logística e Transportes** e vai substituir o ATUA Mais Frete. Ele tem:
cadastros (motoristas, proprietários, veículos, conjuntos e documentos), clientes, pedidos, viagens, o quadro da
operação em tempo real e o financeiro (extrato OFX e resultado do mês).

- **Web:** Next.js 16 (App Router) + TypeScript + Tailwind 4, em [`web/`](web/)
- **Banco, login e arquivos:** Supabase (Postgres com RLS, Auth, Storage, Realtime), em [`supabase/`](supabase/)
- **Hospedagem:** Vercel (ainda não publicado)

## Mapa do repositório

| Pasta / arquivo | O que tem |
|---|---|
| [`web/`](web/) | o sistema web. Detalhes de uso, testes e decisões: [`web/README.md`](web/README.md) |
| [`supabase/migrations/`](supabase/migrations/) | o banco inteiro, em ordem: tabelas, regras de acesso (RLS), funções, views |
| [`supabase/tests/`](supabase/tests/) | testes do banco (pgTAP). Como rodar: [`supabase/tests/README.md`](supabase/tests/README.md) |
| [`supabase/seed/`](supabase/seed/) | dados fictícios de desenvolvimento e o script que os apaga |
| [`supabase/types/database.ts`](supabase/types/database.ts) | tipos TypeScript gerados a partir do banco |
| [`supabase/config.toml`](supabase/config.toml) | configuração do Supabase **local** (Docker) |
| [`PRODUCT.md`](PRODUCT.md) | para quem é o produto, o que ele faz e o que não faz |
| [`DESIGN.md`](DESIGN.md) | sistema visual: cores, tipografia, componentes e regras |
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | documentos de design de cada fase (o "porquê") |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | planos de implementação já executados |
| [`docs/design/`](docs/design/) | referências visuais e pesquisa (redesign) |
| [`prototipo/`](prototipo/) | protótipo HTML aprovado da fase 1 (abre direto no navegador) |
| [`entrevista/`](entrevista/) | entrevista com a operação sobre o uso do ATUA |

## Começando (em 10 minutos)

Você precisa de **Node.js 24** ([`.nvmrc`](.nvmrc)), **Docker Desktop** rodando e **Git**. O banco roda na sua
máquina: você não precisa de acesso ao Supabase da nuvem para desenvolver.

```bash
# 1. banco local: aplica todas as migrations e carrega os dados fictícios + usuários de teste
npx supabase start

# 2. app web
cd web
npm install
cp .env.example .env.local            # já vem com os valores do banco local
cp .env.test.example .env.test.local  # usuários de teste para os testes E2E
npm run dev                           # http://localhost:3000
```

Entre com `teste.admin@nilt.test` e a senha `nilt-local-123` (só existe no seu banco local).

| Endereço local | Para quê |
|---|---|
| http://localhost:3000 | o NILT |
| http://127.0.0.1:55323 | Supabase Studio: ver tabelas, rodar SQL |
| http://127.0.0.1:55324 | Mailpit: e-mails de login e recuperação de senha |

Comandos do dia a dia:

```bash
npx supabase db reset                  # recria o banco local do zero (migrations + seeds)
node supabase/tests/rodar-local.mjs    # testes do banco
cd web && npm test                     # testes unitários
cd web && npm run test:e2e             # testes de ponta a ponta (Playwright)
npx supabase stop                      # desliga o banco local
```

As portas do NILT ficam na faixa **553xx** para não brigar com outros projetos Supabase na mesma máquina.

## Ambientes

| Ambiente | Onde | Quem usa |
|---|---|---|
| **Local** | Docker na sua máquina (`supabase start`) | todo desenvolvimento e todos os testes |
| **Nuvem** | projeto Supabase `tkfpbpqbnasabtzatojk` | é o banco que vai para produção. Só o responsável aplica migrations nele |

Nunca rode testes, seeds nem migrations em teste na nuvem. Veja [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Para contribuir

Leia o [`CONTRIBUTING.md`](CONTRIBUTING.md): branches, commits, PRs, como mudar o banco e as regras de dados
(LGPD, ATUA só leitura).
