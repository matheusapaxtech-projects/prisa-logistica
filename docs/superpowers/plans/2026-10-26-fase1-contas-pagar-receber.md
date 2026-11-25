# Fase 1 — Contas a pagar e a receber: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** contas a pagar com dupla aprovação imposta no banco, parcelas 70/30 do frete que marcam a viagem como paga, taxa do cartão-frete, contas a receber com simulador de antecipação e centros de custo.

**Architecture:** regras no Postgres (tabelas com privilégio por coluna, RLS, funções `security definer` para aprovar/pagar, gatilho na viagem para as parcelas); telas Next.js 16 no padrão `page.tsx` + `consultas.ts` + `actions.ts` + `regras.ts`, com helpers puros em `web/src/lib/contas.ts`.

**Tech Stack:** Supabase local (Postgres 17, pgTAP), Next.js 16.4 App Router, React 19, TypeScript, Tailwind 4 + CSS de `web/src/styles/`, Vitest, Playwright (prints).

**Spec:** `docs/superpowers/specs/2026-10-26-fase1-contas-pagar-receber-design.md`

## Global Constraints

- Banco só no Supabase local isolado: container `supabase_db_nilt_fases` (API 127.0.0.1:57321); nunca a nuvem `tkfpbpqbnasabtzatojk`.
- Migrations novas `20261101000100`…; nunca editar as aplicadas. Depois de mudar o banco: `bash <scratchpad>/gerar-tipos.sh` (regenera `supabase/types/database.ts`).
- Testes do banco: `NILT_DB_CONTAINER=supabase_db_nilt_fases node supabase/tests/rodar-local.mjs`.
- Toda tabela nova com RLS e policies por papel; função `security definer` com `revoke … from public, anon` e `grant … to authenticated` explícitos; `set search_path = ''`.
- Textos de tela e mensagens de erro em português simples, dizendo o problema e o que fazer. Código, nomes e comentários em português.
- Visual pelo `DESIGN.md`: dinheiro sem cor e com "−" (U+2212) na saída; vencida = ferrugem/círculo; falta aprovar = laranja/losango; vence em até 7 dias = mostarda; paga/aprovada = verde; cancelada = neutro; uma pílula noite por tela.
- Só dados fictícios (repositório público).
- Hoje = dia de Brasília (`(now() at time zone 'America/Sao_Paulo')::date` no banco, `hojeBrasilia()`/equivalente na web).

## Review Focus

1. Conta lançada por A e editada por B: nem A nem B aprovam; C aprova. (Task 2)
2. Viagem por tonelada com peso de saída diferente do previsto: as parcelas recalculam enquanto não aprovadas e a soma fecha no centavo (70% arredondado + resto). (Task 3)
3. Centro de custo ou tipo de despesa desativado depois de usado: as parcelas automáticas continuam nascendo (o gatilho não valida "ativo"), só o lançamento manual recusa. (Tasks 2 e 3)
4. Pagar o saldo de viagem cancelada ou já finalizada sem saldo confirmado: recusa clara. (Task 3)
5. Data de pagamento no futuro ou vazia: recusa. Título vencido não entra no simulador. (Tasks 2 e 6)

---

### Task 1: Centros de custo e plano de contas (banco)

**Files:**
- Create: `supabase/migrations/20261101000100_centros_custo_plano.sql`
- Test: `supabase/tests/centros_custo.test.sql`

**Interfaces — Produces:**
- `public.centro_custo(codigo text pk, nome text, ativo boolean, created_at, created_by, updated_at, updated_by)`; códigos `^[0-9]{2}(\.[0-9]{2})?$`; carga com os códigos do menu do sócio (01…04 e módulos, ex.: `01.01 Financeiro e tesouraria`, `03.08 Gestão de viagens e entregas`).
- `public.fin_grupo_plano` enum: `receita, imposto_receita, custo_frete, despesa_operacional, financeiro, ir_csll, fora_resultado`; `public.rotulo_grupo_plano(fin_grupo_plano) returns text`.
- `public.fin_plano_conta(id integer pk, grupo, nome, entrada boolean, saida boolean, ordem smallint, ativo boolean)`; ids fixos usados depois: 1 Frete (CT-e), 2 Outras receitas, 20 Frete de motoristas, 51 Tarifa do cartão-frete.

- [ ] **Step 1: testes** `centros_custo.test.sql`: `test_codigo_imutavel` (update de codigo → throws), `test_sub_exige_departamento` (insert `98.01` sem `98` → throws), `test_so_admin_altera` (financeiro insert → throws 42501/RLS; admin insert/rename ok), `test_sem_exclusao` (admin delete → 0 linhas), `test_carga_inicial` (`03.08` e `01.01` existem ativos), `test_plano_leitura` (operação vê 0 linhas de `fin_plano_conta`; financeiro vê > 0).
- [ ] **Step 2:** rodar `… rodar-local.mjs centros_custo` → falha (tabela não existe).
- [ ] **Step 3:** migration (tabelas, gatilho de proteção, RLS, auditoria, cargas).
- [ ] **Step 4:** `npx supabase db reset --workdir <scratchpad>/sb` e rodar o teste → passa.
- [ ] **Step 5:** commit `feat(banco): centros de custo e plano de contas`.

### Task 2: Contas a pagar e a receber (banco)

**Files:**
- Create: `supabase/migrations/20261101000200_contas_pagar_receber.sql`
- Test: `supabase/tests/contas_pagar.test.sql`, `supabase/tests/contas_receber.test.sql`

**Interfaces — Produces:**
- enum `public.fin_forma`: `pix, boleto, transferencia, cartao_frete, cartao_credito, debito_automatico, dinheiro, outro`.
- `public.fin_pagar` (spec, "Contas a pagar") + `editado_por uuid`, `competencia date`, `parte_pedagio numeric`. Insert/update pela API só nas colunas `descricao, favorecido_id, favorecido_nome, plano_id, centro_custo, forma, vencimento, valor, observacao`.
- `public.v_fin_pagar` (security_invoker): colunas da tabela + `plano_nome, plano_grupo, centro_nome, viagem_numero, aberta, vencida, situacao` (`cancelada|paga|vencida|falta_aprovar|a_vencer`).
- `public.fin_receber` + `public.v_fin_receber` (`situacao`: `cancelada|recebida|vencida|a_vencer`, `cliente_nome`, `cliente_documento`).
- RPCs (todas `returns void` salvo indicado):
  `fin_aprovar_pagar(p_id uuid)`, `fin_desaprovar_pagar(p_id uuid)`,
  `fin_pagar_conta(p_id uuid, p_data date, p_conta uuid default null, p_forma fin_forma default null)`,
  `fin_desfazer_pagamento(p_id uuid)` (admin), `fin_cancelar_pagar(p_id uuid, p_motivo text)`,
  `fin_liberar_antecipacao(p_id uuid, p_motivo text)` (admin, só `frete_saldo`),
  `fin_taxa_cartao(p_mes date) returns table(total_pago numeric, pagamentos integer, pct numeric, por_transferencia numeric, valor_pct numeric, valor_transferencias numeric, taxa numeric, conta_id uuid, conta_numero bigint, conta_valor numeric, conta_situacao text)`,
  `fin_lancar_taxa_cartao(p_mes date) returns uuid`,
  `fin_receber_conta(p_id uuid, p_data date, p_conta uuid default null)`, `fin_desfazer_recebimento(p_id uuid)`, `fin_cancelar_receber(p_id uuid, p_motivo text)`,
  `fin_indicadores_contas(p_mes date) returns jsonb` = `{ pagar: {aberto_qtd, aberto_valor, vencidas_qtd, vencidas_valor, aprovar_qtd, aprovar_valor, pago_mes_qtd, pago_mes_valor}, receber: {aberto_qtd, aberto_valor, vencidas_qtd, vencidas_valor, em30_qtd, em30_valor, recebido_mes_qtd, recebido_mes_valor} }`.

- [ ] **Step 1: testes** `contas_pagar.test.sql`: `test_quem_lanca_nao_aprova` (A lança → A aprova throws "Quem lançou"); `test_quem_edita_nao_aprova` (A lança, B edita → B throws, C aprova ok); `test_pagar_sem_aprovacao` (throws "Sem aprovação"); `test_colunas_protegidas` (financeiro `update fin_pagar set aprovado_em = now()` → throws 42501); `test_aprovada_nao_edita` (update descricao depois de aprovar → throws); `test_operacao_nao_ve` (operação select = 0, insert throws); `test_data_futura` (pagar com amanhã → throws); `test_cancelar_exige_motivo`; `test_desfazer_pagamento_so_admin`; `test_centro_inativo` (insert manual com centro inativo → throws); `test_taxa_cartao` (2 contas pagas com cartão-frete no mês, 1000 + 500 → `taxa` = 15,00 + 1,00; lançar duas vezes = mesma conta; aprovada → lançar de novo throws). `contas_receber.test.sql`: `test_lanca_recebe_desfaz`, `test_cancelar`, `test_operacao_nao_ve`, `test_indicadores` (valores do `fin_indicadores_contas` batem com 3 contas criadas).
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** migration (tipos, tabelas, privilégios por coluna, gatilhos de proteção/validação, RLS, views, RPCs, auditoria).
- [ ] **Step 4:** reset + testes → passam.
- [ ] **Step 5:** commit `feat(banco): contas a pagar e a receber com dupla aprovação`.

### Task 3: Parcelas do frete e viagem paga (banco)

**Files:**
- Create: `supabase/migrations/20261101000300_parcelas_frete.sql`
- Modify: `supabase/tests/mover_viagem.test.sql` (fixture: viagem antiga, sem parcelas)
- Test: `supabase/tests/parcelas_frete.test.sql`

**Interfaces — Produces:**
- `viagem.pagamento_no_financeiro boolean` (e no fim do `v_quadro`).
- gatilho `trg_viagem_parcelas` → `fin_sincronizar_parcelas(p_viagem uuid)` (interna, sem grant).
- `confirmar_pagamento_saida` / `confirmar_saldo` recusam com `pagamento_no_financeiro`.
- `viagem_parcelas(p_viagem uuid) returns table(origem text, numero bigint, valor numeric, parte_pedagio numeric, vencimento date, situacao text, pago_em date, antecipacao_liberada boolean)` para `pode_ler()`.

- [ ] **Step 1: testes** `parcelas_frete.test.sql`: `test_nascem_duas` (frete total 10000, pedágio 500 → adiantamento 7500,00 com parte_pedagio 500, saldo 3000,00; lancado_por = quem inseriu; forma cartão-frete; centro 03.08; plano 20); `test_por_tonelada_centavos` (92 R$/t × 37,05 t = 3408,60 → 2386,02 + 1022,58); `test_sem_frete_ou_frota_propria` (0 parcelas); `test_frete_muda` (antes de aprovar: atualiza; aprovada: perde aprovação; paga: não muda); `test_cancelar_viagem` (não pagas → canceladas); `test_adiantamento_exige_embarque` (pagar sem peso_saida throws; com peso → ok e viagem.pagamento_saida_em preenchido + evento `pagamento_saida`); `test_vencimentos_no_embarque` (peso_saida informado → adiantamento vence hoje, saldo hoje+3); `test_saldo_exige_entrega` (throws antes de `aguardando_saldo`; com antecipação liberada pelo admin → ok; marca saldo_pago_em); `test_confirmacao_manual_recusada` (`confirmar_pagamento_saida` throws "pago pelo financeiro"); `test_viagem_parcelas_operacao` (operação lê as 2 linhas pela função).
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** migration; ajustar a fixture do `mover_viagem.test.sql` (apaga as parcelas e zera `pagamento_no_financeiro`, comentando que simula viagem anterior ao contas a pagar).
- [ ] **Step 4:** reset + suíte inteira → passa.
- [ ] **Step 5:** commit `feat(banco): parcelas 70/30 do frete e viagem paga pelo financeiro`.

### Task 4: Sementes, usuário financeiro de teste e tipos

**Files:**
- Modify: `supabase/seed/local_usuarios.sql` (+ `teste.financeiro@nilt.test`, id `e2e00000-0000-4000-8000-000000000004`, papel financeiro), `web/.env.test.example` (+ `E2E_FINANCEIRO_EMAIL/SENHA`), `supabase/config.toml` (`sql_paths` + `./seed/dev_financeiro_ficticio.sql`), `supabase/seed/limpar_dados_ficticios.sql`, `supabase/types/database.ts`
- Create: `supabase/seed/dev_financeiro_ficticio.sql` (conta bancária fictícia "999", frete nas viagens da seed → parcelas em vários estados, contas manuais de favorecidos fictícios, contas a receber dos clientes da seed)

- [ ] **Step 1:** escrever as sementes; `db reset`; conferir contagens (`select situacao, count(*) from v_fin_pagar group by 1`) com pelo menos uma de cada situação.
- [ ] **Step 2:** regenerar tipos; `npm run typecheck` passa.
- [ ] **Step 3:** commit `chore(banco): sementes fictícias do contas a pagar/receber e tipos`.

### Task 5: Base da web (helpers, abas do Financeiro, trilho)

**Files:**
- Create: `web/src/lib/contas.ts`, `web/tests/unit/contas.test.ts`, `web/src/app/(app)/financeiro/abas.tsx`, `web/src/styles/paginas/contas.css`
- Modify: `web/src/app/(app)/financeiro/page.tsx`, `web/src/app/(app)/financeiro/retencoes/page.tsx` (usar `AbasFinanceiro`), `web/src/components/shell-cliente.tsx` (item "Centros de custo" para admin e financeiro)

**Interfaces — Produces (`@/lib/contas`):**
- `type FormaPagamento`; `FORMAS: { id: FormaPagamento; rotulo: string }[]`; `rotuloForma(f)`.
- `type SituacaoPagar = "cancelada" | "paga" | "vencida" | "falta_aprovar" | "a_vencer"`; `type SituacaoReceber = "cancelada" | "recebida" | "vencida" | "a_vencer"`; `ROTULO_SITUACAO_PAGAR`, `ROTULO_SITUACAO_RECEBER`.
- `diasAte(vencimento: string, hoje: string): number`.
- `agrupar<T extends { valor: number }>(itens: T[], chave: (t: T) => { id: string; rotulo: string }): { id: string; rotulo: string; itens: T[]; total: number }[]` (ordem por id; totais em centavos).
- `somarValores(itens: { valor: number }[]): number` (soma em centavos).
- `simularAntecipacao(titulos: { id: string; valor: number; vencimento: string }[], taxaMesPct: number, tarifaPorTitulo: number, hoje: string): { linhas: { id: string; valor: number; dias: number; desagio: number; tarifa: number; liquido: number }[]; bruto: number; desagio: number; tarifas: number; liquido: number; prazoMedio: number; custoEfetivoMesPct: number | null }` — deságio simples `valor × taxa/100 × dias/30`, arredondado por título; prazo médio ponderado pelo valor; custo efetivo = `(bruto/liquido − 1) / (prazoMedio/30) × 100` (null sem títulos).
- `AbasFinanceiro({ ativa, mes }: { ativa: "resultado" | "pagar" | "receber" | "lancamentos" | "regras" | "retencoes"; mes?: string })`.

- [ ] **Step 1: testes** `contas.test.ts`: soma em centavos (`0.1 + 0.2` → `0.3`); `agrupar` com subtotais; `diasAte` (mesmo dia 0, amanhã 1); simulação (título 10000 em 30 dias, 2% a.m., tarifa 5 → deságio 200, líquido 9795, custo efetivo ≈ 2,09%); sem títulos → zeros e `custoEfetivoMesPct` null.
- [ ] **Step 2:** rodar `npx vitest run tests/unit/contas.test.ts` → falha; implementar; passa.
- [ ] **Step 3:** abas e trilho; `npm run typecheck` e `npm run lint` passam.
- [ ] **Step 4:** commit `feat(web): base do contas a pagar/receber (helpers, abas e menu)`.

### Task 6: Tela de contas a pagar (`/financeiro/pagar`)

**Files:** `web/src/app/(app)/financeiro/pagar/{page.tsx, consultas.ts, actions.ts, regras.ts, tabela-pagar.tsx, dialogo-conta.tsx, dialogo-pagar.tsx, taxa-cartao.tsx, loading.tsx, error.tsx}`; testes `web/tests/unit/contas-pagar.test.ts`.

**Interfaces — Consumes:** Task 2 (views/RPCs), Task 5 (`@/lib/contas`, `AbasFinanceiro`, `contas.css`).
**Produces:** URL `?filtro=aberto|aprovar|vencidas|pagas|todas` (padrão `aberto`), `?agrupar=centro|tipo|nenhum` (padrão `centro`), `?mes=aaaa-mm` (abas Pagas/Todas e bloco da taxa).

- [ ] **Step 1: testes** de `regras.ts` (zod): valor "1.234,56" → 1234.56; valor 0 → erro "Informe um valor maior que zero."; vencimento vazio → erro; descrição > 200 → erro; favorecido vazio → erro.
- [ ] **Step 2:** implementar regras, consultas (filtro no SQL; nomes por `nomes_usuarios`), ações (`lancarConta`, `editarConta`, `aprovar`, `desaprovar`, `pagar`, `desfazerPagamento`, `cancelar`, `liberarAntecipacao`, `lancarTaxaCartao`, todas por `comSessao` + `revalidatePath("/financeiro/pagar")`), página e componentes.
- [ ] **Step 3:** conferir no navegador (admin lança; financeiro aprova; admin paga) e rodar vitest/lint/typecheck.
- [ ] **Step 4:** commit `feat(web): tela de contas a pagar`.

### Task 7: Tela de contas a receber (`/financeiro/receber`)

**Files:** `web/src/app/(app)/financeiro/receber/{page.tsx, consultas.ts, actions.ts, regras.ts, tabela-receber.tsx, dialogo-conta.tsx, dialogo-receber.tsx, simulador.tsx, loading.tsx, error.tsx}`; testes `web/tests/unit/contas-receber.test.ts`.

**Produces:** `?filtro=aberto|vencidas|recebidas|todas`, `?mes=`. Simulador: títulos marcados (não vencidos) + taxa ao mês (padrão 2,0%) e tarifa por título (padrão R$ 5,00) → linhas e totais de `simularAntecipacao`; texto "Só simula: registrar a antecipação no fomento chega na próxima etapa."

- [ ] **Step 1: testes** de `regras.ts` (cliente obrigatório, título 1–120, valor > 0, vencimento).
- [ ] **Step 2:** implementar; conferir no navegador; vitest/lint/typecheck.
- [ ] **Step 3:** commit `feat(web): tela de contas a receber com simulador de antecipação`.

### Task 8: Tela de centros de custo (`/centros-de-custo`)

**Files:** `web/src/app/(app)/centros-de-custo/{page.tsx, consultas.ts, actions.ts, regras.ts, lista-centros.tsx, dialogo-centro.tsx, loading.tsx, error.tsx}`, `web/src/styles/paginas/centros.css`; testes `web/tests/unit/centros-custo.test.ts`.

- [ ] **Step 1: testes** de `regras.ts`: código "01" e "01.05" válidos; "1.5", "001", "01.5" inválidos com mensagem; sub "07.01" exige "07" na lista.
- [ ] **Step 2:** implementar (árvore, uso por centro = contas a pagar abertas; admin: novo, renomear, desativar/reativar; os demais só leem; quem não é admin nem financeiro vê o aviso de acesso).
- [ ] **Step 3:** commit `feat(web): tela de centros de custo`.

### Task 9: Quadro e ficha da viagem com as parcelas

**Files:** `web/src/app/(app)/quadro/*` (onde aparece "Confirmar pagamento de saída/saldo"), `web/src/app/(app)/viagens/[id]/*` (bloco "Pagamento ao motorista"), `web/src/lib/quadro.ts`/`viagens/regras.ts` se precisarem do campo novo; testes unitários afetados.

- [ ] **Step 1:** com `pagamento_no_financeiro`, o botão de confirmar dá lugar a "Pago pelo financeiro (Contas a pagar)" + situação; para admin/financeiro, link para `/financeiro/pagar?filtro=aberto`.
- [ ] **Step 2:** ficha da viagem: bloco com as duas parcelas (`viagem_parcelas`): valor, vencimento, situação.
- [ ] **Step 3:** vitest/lint/typecheck; commit `feat(web): quadro e viagem mostram as parcelas do financeiro`.

### Task 10: Verificação, prints e PR

- [ ] suíte do banco, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` passando.
- [ ] `web/tests/e2e/fase1.prints.ts` (1440 e 390): pagar (aberto, aprovar, vencidas, pagas, agrupado por tipo), receber (com simulador aberto), centros de custo, ficha da viagem com parcelas, Quadro. Prints num branch `prints` e no corpo do PR.
- [ ] revisão do branch inteiro por um revisor novo; corrigir; PR para `main`.
