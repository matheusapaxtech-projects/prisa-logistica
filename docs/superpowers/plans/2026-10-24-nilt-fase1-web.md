# NILT Fase 1 — Sistema web (conversão do protótipo para Next.js): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o protótipo `prototipo/` no sistema web real do NILT em `web/`: Next.js com login, dados reais do Supabase do NILT, as mesmas 16 telas e o mesmo visual.

**Architecture:** Next.js (App Router) em `web/`. Leitura em Server Components com o cliente Supabase do servidor (RLS do usuário logado); gravação em Server Actions; regras de transação em funções do banco (RPC). O CSS do protótipo (`prototipo/assets/nilt.css`) é portado quase inteiro como camada de componentes, com os tokens no `@theme` do Tailwind v4, para manter o visual idêntico. Cada helper `N.desenhar.*` vira um componente React. Cada `.html` vira uma rota; `?aba=` continua como search param.

**Tech Stack:** Next.js 16.2.x (App Router, `proxy.ts`), React 19, TypeScript estrito, Tailwind CSS v4, `@supabase/ssr` + `@supabase/supabase-js`, `zod`, `lucide-react`, `next/font/google` (Overpass, Overpass Mono), Vitest + Testing Library, Playwright (smoke). Banco pelo MCP `supabase-nilt`.

**Spec:** `docs/superpowers/specs/2026-10-22-nilt-design.md`; visual: `DESIGN.md`, `.impeccable/surfaces/web.md`, `PRODUCT.md`; referência viva de cada tela: `prototipo/*.html` (abrir no navegador); regras do protótipo: `prototipo/CONVENCOES.md`; banco: `supabase/migrations/`, tipos `supabase/types/database.ts`.

## Global Constraints

- Banco: projeto `tkfpbpqbnasabtzatojk`, **somente** pelo MCP `supabase-nilt`. Nunca o conector Supabase do claude.ai. Mudança de esquema só por migration em `supabase/migrations/` + `apply_migration` com o mesmo nome; nunca editar migration aplicada.
- Nunca usar a chave secreta/service role no app. Só `NEXT_PUBLIC_SUPABASE_URL=https://tkfpbpqbnasabtzatojk.supabase.co` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (obtida com `get_publishable_keys`), em `web/.env.local` (gitignored). `web/.env.example` com os nomes e valores vazios.
- Visual idêntico ao protótipo: mesmas classes, tokens, textos, sinais e regras de cor de `DESIGN.md`. Interface 100% pt-BR.
- Nada de dados fictícios do `dados.js` em produção: tudo vem do banco. Para desenvolvimento, uma migration de seed **separada e marcada** (`supabase/seed/dev_dados_ficticios.sql`, rodada com `execute_sql` só no ambiente atual, nunca como migration) reproduz os dados do protótipo.
- Arquivos: bucket `documentos` privado; upload com `storage.from('documentos').upload`; abrir sempre via `registrar_visualizacao(id)` antes de `createSignedUrl(path, 60)`.
- Sem `git add -A`; commits por task com caminhos explícitos; nunca push.
- Não acessar o ATUA.

## Review Focus

- **Usuário logado sem perfil ou desativado:** vê uma tela "Sem acesso" com a explicação, nunca uma lista vazia que parece erro. Teste em Task 4 (`sem perfil redireciona para /sem-acesso`).
- **Sessão expirada no meio de um formulário:** a Server Action responde com erro claro ("Sua sessão expirou. Entre de novo; o que você digitou continua na tela.") e não perde os campos. Teste em Task 4.
- **Montagem de conjunto que o banco recusa:** a mensagem exata do banco aparece junto da peça; a tela não fica num estado meio salvo (tudo numa RPC). Teste em Task 1 (pgTAP) e Task 9 (unitário do mapeamento de erro).
- **CNPJ/CEP com a BrasilAPI fora do ar ou lenta:** timeout de 8 s, mensagem "A consulta não respondeu. Preencha à mão ou tente de novo." e o formulário continua editável. Teste em Task 3.
- **Operação tentando apagar ou ver arquivo restrito:** botão não aparece para quem não é admin, e se a ação for chamada mesmo assim o erro do RLS vira "Só o administrador pode fazer isso." Teste em Task 4 (`mensagemDeErro`).

---

## Estrutura de arquivos

```
supabase/migrations/20261024000100_apoio_telas.sql     Task 1
supabase/tests/apoio_telas.test.sql                      Task 1
supabase/seed/dev_dados_ficticios.sql                    Task 1
web/                                                     Task 2 (create-next-app)
  .env.example  vitest.config.ts  playwright.config.ts
  src/proxy.ts                                           Task 4
  src/app/layout.tsx  src/app/globals.css                Task 2
  src/styles/nilt.css                                    Task 2 (porta de prototipo/assets/nilt.css)
  src/styles/paginas/*.css                               Tasks 6-11 (porta dos CSS de grupo)
  src/lib/supabase/{server,client,proxy}.ts              Task 4
  src/lib/{formato,validacao,conjunto,erros,permissoes,consultas}.ts   Tasks 3-4
  src/app/api/{cnpj/[cnpj],cep/[cep]}/route.ts           Task 3
  src/components/{Shell,BuscaGlobal,Sinal,Placa,Engate,Capacidade,MarcoKm,Avatar,Abas,Campo,BarraSalvar,Dialogo,Toast,EstadoVazio,Historico,Documentos}.tsx   Task 5
  src/app/login/page.tsx  src/app/sem-acesso/page.tsx    Task 4
  src/app/(app)/layout.tsx  src/app/(app)/page.tsx       Tasks 5-6
  src/app/(app)/motoristas/{page,novo/page,[id]/page}.tsx        Task 7
  src/app/(app)/proprietarios/{page,novo/page,[id]/page}.tsx     Task 8
  src/app/(app)/veiculos/{page,novo/page,[id]/page}.tsx          Task 9
  src/app/(app)/conjuntos/{page,novo/page,[id]/page}.tsx         Task 10
  src/app/(app)/pendencias/page.tsx                              Task 10
  src/app/(app)/{usuarios,auditoria}/page.tsx                    Task 11
  tests/unit/*.test.ts   tests/e2e/*.spec.ts
```

Rotas: `motorista.html?id=p01` → `/motoristas/<uuid>`; `motorista-novo.html` → `/motoristas/novo`; idem para proprietários, veículos e conjuntos (`conjunto.html?novo=1` → `/conjuntos/novo`, "trocar peças" → `/conjuntos/<id>?editar=1`). Links internos do protótipo trocados por `next/link`.

---

### Task 1: Funções de apoio no banco

**Files:** Create `supabase/migrations/20261024000100_apoio_telas.sql`, `supabase/tests/apoio_telas.test.sql`, `supabase/seed/dev_dados_ficticios.sql`

**Interfaces — Produces:**
- Colunas: `pessoa.qualificacao_inss text check (qualificacao_inss in ('qualificado','nao_qualificado','com_pendencia'))`; `proprietario.frete_empresa_motorista_valor numeric(12,2)`, `proprietario.frete_empresa_motorista_percentual numeric(5,2)`.
- `public.v_vencimentos` (`security_invoker = true`): `tipo text` ('CNH','Consulta de risco','RNTRC','Seguro','IPVA', ou o nome do tipo de arquivo), `pessoa_id uuid null`, `veiculo_id uuid null`, `arquivo_id uuid null`, `data date`, `dias int` (= `data - current_date`). Fontes: `motorista.cnh_validade` e `gr_validade` (exceto cadastro cancelado), `proprietario.rntrc_validade`, `veiculo.seguro_validade` e `venc_ipva`, `arquivo.validade`; um documento que aparece no cadastro e como arquivo do mesmo tipo e dono sai uma vez só (fica a linha do cadastro).
- `public.listar_usuarios() returns table (user_id uuid, email text, nome text, papel app_papel, ativo boolean, ultimo_acesso timestamptz)` — `security definer`, `set search_path = public`; levanta `'só o administrador pode ver os usuários'` se `not eh_admin()`; inclui usuários de `auth.users` sem perfil (papel e nome nulos).
- `public.definir_perfil(p_user_id uuid, p_nome text, p_papel app_papel, p_ativo boolean) returns void` — `security definer`; só admin; upsert em `perfil_usuario`; levanta `'você não pode tirar o próprio acesso de administrador'` quando `p_user_id = auth.uid()` e (`p_papel <> 'admin'` ou `not p_ativo`).
- `public.salvar_conjunto(p_conjunto_id uuid, p_cavalo_id uuid, p_motorista_id uuid, p_itens uuid[]) returns uuid` — `security invoker` (RLS vale). Se `p_conjunto_id` não é nulo: encerra-o (`fim = now()`). Encerra também qualquer conjunto aberto do mesmo cavalo. Insere o novo conjunto e os itens com `posicao` = ordem do array. As validações de `validar_conjunto` rodam no fim da transação e as mensagens originais sobem intactas.
- `public.encerrar_conjunto(p_conjunto_id uuid) returns void` — `security invoker`; `fim = now()`; erro `'conjunto já encerrado'` se já tiver fim.
- Seed de desenvolvimento: os dados de `prototipo/assets/dados.js` e `prototipo/assets/paginas/*.js` convertidos em INSERTs com UUIDs fixos (`00000000-0000-4000-8000-0000000000NN`), documentos fictícios gerados pelo mesmo algoritmo, datas relativas a `current_date`; sem arquivos no Storage (linhas de `arquivo` apontando para caminhos que não existem são aceitas na demo).

- [ ] **Step 1: Testes que falham** (`apoio_telas.test.sql`, mesmo formato de `supabase/tests/README.md`): `test_vencimentos_sem_duplicar` (CNH vencida no cadastro + arquivo CNH vencido do mesmo motorista → 1 linha); `test_listar_usuarios_so_admin` (operação → `throws_ok` com a mensagem; admin → inclui um usuário sem perfil); `test_definir_perfil_nao_tira_proprio_admin`; `test_salvar_conjunto_rodotrem` (cavalo + carreta + dolly + carreta → 1 conjunto aberto, 3 itens nas posições 1-3; o conjunto anterior do cavalo fica com `fim`); `test_salvar_conjunto_dolly_ponta` (`throws_ok` com 'dolly não pode ser a primeira nem a última peça' e nada gravado); `test_encerrar_conjunto_duas_vezes`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Escrever e aplicar a migration (`apoio_telas`).
- [ ] **Step 4:** Rodar; todos `ok`. Rodar também todos os testes antigos de `supabase/tests/`: nenhum `not ok`. `get_advisors` security e performance sem alerta novo.
- [ ] **Step 5:** Rodar o seed com `execute_sql`; conferir com `select count(*)` que há 12 pessoas, 15 veículos e 4 conjuntos abertos. Regenerar `supabase/types/database.ts` com `generate_typescript_types`.
- [ ] **Step 6:** Commit `feat(db): funções de apoio às telas, vencimentos e seed de desenvolvimento`.

### Task 2: Projeto Next.js, tokens e estilos

**Files:** Create `web/` (via `npx create-next-app@16.2 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`), `web/src/styles/nilt.css`, `web/src/app/globals.css`, `web/src/app/layout.tsx`, `web/.env.example`, `web/vitest.config.ts`

- [ ] **Step 1:** Criar o app. Instalar `@supabase/ssr @supabase/supabase-js zod lucide-react` e de dev `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test`. Confirmar versões com `npx ctx7@latest docs /vercel/next.js/v16.2.9 "<pergunta>"` quando houver dúvida de API.
- [ ] **Step 2:** `globals.css`: `@import "tailwindcss";` + `@theme` com os tokens do frontmatter de `DESIGN.md` (cores, raios, espaços, fontes como `--font-sans: var(--font-overpass)` e `--font-mono: var(--font-overpass-mono)`) + `@import "../styles/nilt.css"`. `nilt.css` = cópia de `prototipo/assets/nilt.css` com `var(--font)`/`var(--mono)` apontando para as variáveis do `next/font`, sem mudar classes nem valores.
- [ ] **Step 3:** `layout.tsx`: `lang="pt-BR"`, `Overpass` (400, 500, 600, 700) e `Overpass_Mono` (400, 500, 600) de `next/font/google` com `variable`, `metadata.title.template = "%s · NILT"`.
- [ ] **Step 4:** Uma página temporária que renderiza `<span class="sinal sinal-normal">Normal</span>` e uma `.placa`; `npm run dev`, abrir no navegador e comparar com `prototipo/index.html`: mesma fonte e mesmas cores (print das duas lado a lado).
- [ ] **Step 5:** `npm run build` e `npm run lint` sem erro. Commit `chore(web): projeto Next.js do NILT com tokens e estilos do protótipo`.

### Task 3: Bibliotecas puras e consultas externas

**Files:** Create `web/src/lib/formato.ts`, `validacao.ts`, `conjunto.ts`, `web/src/app/api/cnpj/[cnpj]/route.ts`, `web/src/app/api/cep/[cep]/route.ts`; Test `web/tests/unit/{formato,validacao,conjunto,brasilapi}.test.ts`

**Interfaces — Produces:** port 1:1 de `prototipo/assets/nilt.js`: `formato.{cpf,cnpj,doc,telefone,cep,data,dataHora,relativo,t,m,kb,dias}`, `validacao.{cpf,cnpj,placa,normalizarPlaca,mercosul,soDigitos}`, `mascaras.{cpf,cnpj,telefone,cep,placa,digitos}`; `conjunto.validar(cavalo: Veiculo, itens: Veiculo[], abertos: ConjuntoAberto[]): { posicao: number | null; mensagem: string }[]` com as 7 mensagens exatas do banco (`validar_conjunto`), e `conjunto.capacidade(cavalo, itens) → { cmt_t, tara_total_t, capacidade_total_t, limite_t, excede_cmt }` (mesma conta de `v_conjunto_capacidade`). Rotas: `GET /api/cnpj/:cnpj` → JSON do formato de `N.consultarCnpj` (BrasilAPI v1, `AbortSignal.timeout(8000)`, 404 → `{erro:'CNPJ não encontrado na Receita.'}`, timeout → `{erro:'A consulta não respondeu. Preencha à mão ou tente de novo.'}`); `GET /api/cep/:cep` idem com BrasilAPI CEP v2.

- [ ] **Step 1: Testes que falham:** CPF `52998224725` válido, `52998224724` inválido, `111.111.111-11` inválido; CNPJ `11222333000181` válido; `normalizarPlaca('abc-1234') === 'ABC1234'`, `mercosul('ABC1D23')`; `formato.dias(-1) === 'venceu ontem'`, `formato.t(37.2) === '37,2 t'`; conjunto: dolly na posição 1 → mensagem 'dolly não pode ser a primeira nem a última peça'; rodotrem do protótipo (cavalo CMT 91, tara 9,9; carretas 45/7,8; dolly 3,1) → `capacidade_total_t 74.4`, `limite_t 62.4`, `excede_cmt true`; rota CNPJ com `fetch` mockado: 404 e timeout devolvem as mensagens acima.
- [ ] **Step 2:** `npx vitest run` → falha. **Step 3:** implementar. **Step 4:** passa. **Step 5:** Commit `feat(web): formato, validação, regras do conjunto e consultas BrasilAPI`.

### Task 4: Autenticação, papéis e erros

**Files:** Create `web/src/lib/supabase/{server,client,proxy}.ts`, `web/src/proxy.ts`, `web/src/lib/permissoes.ts`, `web/src/lib/erros.ts`, `web/src/app/login/page.tsx` (+ `actions.ts`), `web/src/app/sem-acesso/page.tsx`; Test `web/tests/unit/erros.test.ts`, `web/tests/e2e/auth.spec.ts`

**Interfaces — Produces:** `createClient()` (server, `cookies()` com `getAll/setAll`), `createBrowserClient()`; `proxy.ts` com `updateSession` no padrão da documentação do Supabase (`getClaims()` logo após `createServerClient`, redireciona para `/login` sem sessão; matcher exclui `_next`, `api/cep`, `api/cnpj`, arquivos estáticos); `getPerfil(): Promise<{ userId; nome; papel: 'admin'|'operacao'|'financeiro'|'leitura'; ativo } | null>` (lê `perfil_usuario` do usuário); `exigirPerfil()` (sem perfil ou inativo → `redirect('/sem-acesso')`); `pode(perfil, acao: 'editar'|'editarFinanceiro'|'admin')`; `mensagemDeErro(e: PostgrestError | Error): string` (RLS/42501 → 'Só o administrador pode fazer isso.' ou 'Seu papel não permite essa alteração.'; 23505 → 'Já existe um cadastro com esse documento.'; JWT expirado → 'Sua sessão expirou. Entre de novo; o que você digitou continua na tela.'; mensagens de `raise exception` do banco passam como estão).
- Login: porta de `prototipo/login.html` (mesmo layout e textos); `signInWithPassword` numa Server Action com `useActionState`; erro 'E-mail ou senha incorretos. Confira e tente de novo.'; sair = `signOut` + redirect.

- [ ] **Step 1:** Testes de `mensagemDeErro` (códigos acima) → falham; implementar; passam.
- [ ] **Step 2:** Usuário de teste só para desenvolvimento local: criar com `execute_sql` no `auth.users`/`auth.identities` (e-mail `teste.admin@nilt.test`, senha gerada aleatória de 24 caracteres) com perfil `admin`; gravar e-mail e senha só em `web/.env.test.local` (gitignored) como `E2E_EMAIL`/`E2E_SENHA`. Registrar no relatório que esse usuário precisa ser apagado antes de produção.
- [ ] **Step 3:** `auth.spec.ts` (Playwright, `npm run dev`): sem sessão `/` → `/login`; login errado mostra a mensagem; login certo → `/`; usuário sem perfil → `/sem-acesso`.
- [ ] **Step 4:** Commit `feat(web): login, sessão no proxy, papéis e mensagens de erro`.

### Task 5: Componentes e shell

**Files:** Create os componentes da Estrutura; `web/src/app/(app)/layout.tsx`; Test `web/tests/unit/componentes.test.tsx`

**Interfaces — Produces** (cada um gera exatamente o HTML/classe do helper correspondente em `prototipo/assets/nilt.js`): `<Sinal situacao texto? />`, `<Placa placa grande? />`, `<Engate cavalo itens destacar? />`, `<Capacidade c />`, `<MarcoKm dias janela? />`, `<Avatar nome />`, `<Abas abas={{id,rotulo,n?}[]} ativa />` (links `?aba=`), `<Campo label opcional? ajuda? erro? mascara? valida? {...inputProps} />` (client), `<BarraSalvar pendente onDescartar />` (client), `<Dialogo>`, `toast()` + `<Toaster />`, `<EstadoVazio>`, `<Historico tabela registroId />` (server; só admin), `<Documentos pessoaId|veiculoId podeEditar />` (lista, upload, abrir com `registrar_visualizacao` + signed URL, conferir). `Shell` = sidebar + topbar do `montarShell()` com `<BuscaGlobal />` (client, chama uma Server Action `buscar(termo)` que consulta `pessoa` e `veiculo` com `ilike`/dígitos, máx. 8) e badge de pendências calculado no servidor (mesma regra do protótipo: pendências sem `arquivo_vencido` + `v_vencimentos` com `dias < 0` + conjuntos com `excede_cmt`). Separador " · " via componente `<Ponto />` em vez do `separarPontos`.

- [ ] **Step 1:** Testes: `Sinal` com 'pendente' tem classe `sinal-pendente`; `Placa` 'ABC1234' tem classe `antiga`; `Engate` com rodotrem renderiza 4 peças e 3 acoplamentos; `MarcoKm` com 10 dias usa amarelo e com 60 dias verde; `Campo` com `valida="cpf"` mostra 'CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.' no blur de um CPF errado.
- [ ] **Step 2:** Implementar; testes passam; `layout.tsx` chama `exigirPerfil()` e monta o `Shell`.
- [ ] **Step 3:** Commit `feat(web): componentes do mundo da sinalização e shell`.

### Tasks 6 a 11: telas (uma por task; mesma receita)

Para cada tela: (a) abrir o `.html` do protótipo e copiar a marcação para JSX trocando os `N.desenhar.*` pelos componentes da Task 5; (b) trocar cada leitura de `D.*` por consulta Supabase no Server Component, com os mesmos nomes de campo (mapeamentos: `marca` → `marca_veiculo.nome` via `marca_id`; `tag_operadora` → `operadora_tag.nome`; `tipo` de arquivo → `tipo_arquivo.nome`; `usuario`/`resumo` da auditoria → derivar de `usuario_id` (`perfil_usuario.nome`) e de `dados_antes`/`dados_depois`); (c) cada gravação vira Server Action com validação `zod` igual à do protótipo, `revalidatePath` e `mensagemDeErro`; (d) estados vazio, erro, carregando (`loading.tsx` com barras do tamanho real) e "não encontrado" (`notFound()` + página no estilo do protótipo); (e) teste Playwright do fluxo principal com o usuário de teste; (f) print em 1440 e 390 comparado ao protótipo — diferença visível é defeito.

- **Task 6 — Início** (`/`): placas de advertência (5 tipos), vencimentos (`v_vencimentos`, 90 dias, 5 linhas), cadastros (contagens), conjuntos rodando (`v_conjunto_capacidade`). Teste: as contagens das placas batem com `v_pendencias_documentos` + `v_vencimentos` + `excede_cmt`.
- **Task 7 — Motoristas** (`/motoristas`, `/novo`, `/[id]` com abas Dados pessoais, CNH, Contatos, Referências, Contas e Pix, Documentos, Gerenciadora de risco, Histórico). Novo: CPF → procura `pessoa` pelo CPF; existe e é motorista → link; só proprietário → "Cadastrar também como motorista" (insere em `motorista`); novo → insere `pessoa` + `motorista` (se o segundo falhar, mostra o erro e a pessoa fica pendente para completar). Teste: criar motorista com CPF `52998224725` e ver na lista; CPF inválido bloqueia.
- **Task 8 — Proprietários** (`/proprietarios`, `/novo` com PF/PJ e `/api/cnpj`, `/[id]` com abas Dados, ANTT, Responsável, Pagamento, Contatos, Contas e Pix, Documentos, Veículos, Histórico). TAC desabilitado para PJ. Teste: PJ com CNPJ real `00000000000191` preenche razão social (rede real; pular com `test.skip` se offline).
- **Task 9 — Veículos** (`/veiculos` com abas e `?filtro=arrendados`, `/novo` com a placa desenhada ao vivo, `/[id]` com abas CRLV, Proprietários, Características, TAG e seguro, Rastreamento, Frota, Documentos, Conjunto, Histórico). Capacidade calculada (PBT − tara) com opção de informar. Teste: veículo com posse ≠ ANTT aparece com sinal Arrendado e pendência de contrato.
- **Task 10 — Conjuntos e Pendências** (`/conjuntos` abertos + histórico, `/conjuntos/novo` montador, `/conjuntos/[id]` detalhe e `?editar=1`; `/pendencias` abas Pendências, Vencimentos, Documentos com `?tipo=`). Montador valida ao vivo com `conjunto.validar` e salva com `salvar_conjunto`; encerrar com `encerrar_conjunto`; a mensagem do banco, se vier, aparece junto da peça. Teste: montar rodotrem válido; tentar dolly na ponta mostra a mensagem e não salva.
- **Task 11 — Usuários e Auditoria** (`/usuarios` com `listar_usuarios` e `definir_perfil`, aviso de criar no painel do Supabase; `/auditoria` com filtros na URL, agrupada por dia, visualizações destacadas). Não admin → frase "Só o administrador vê esta tela." Teste: admin muda papel de um usuário; tentar tirar o próprio admin mostra a mensagem do banco.

Cada task termina com `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, o spec Playwright da tela verde e commit `feat(web): tela de <nome>`.

### Task 12: Verificação final

- [ ] **Step 1:** `npm run build` sem erro e sem warning de tipo; `npx vitest run` e `npx playwright test` verdes.
- [ ] **Step 2:** Prints Playwright de todas as rotas em 1440, 768 e 390 em `web/tests/e2e/prints/` e comparação lado a lado com os prints do protótipo em `.taste-skill/inspect/final/`; corrigir diferenças.
- [ ] **Step 3:** `get_advisors` security e performance sem alertas.
- [ ] **Step 4:** `web/README.md`: como rodar (`npm install`, `.env.local`, `npm run dev`), como criar o primeiro admin (`supabase/criar-primeiro-admin.sql`), o usuário de teste a apagar, e o que fica para depois (deploy na Vercel com confirmação do usuário).
- [ ] **Step 5:** Commit `chore(web): verificação final da fase 1`.

## Fora deste plano
- Deploy na Vercel (só com confirmação do usuário).
- App do motorista (Expo).
- Fases 2 em diante (frota, risco, CT-e, financeiro).
