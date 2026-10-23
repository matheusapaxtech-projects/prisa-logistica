# NILT — Quadro da operação (entrega antecipada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente e locais, pedido, viagem e o Quadro da operação (kanban em tempo real com as 10 colunas do usuário), com a passagem para "Em rota" travada pela chave do CT-e/MDF-e do ATUA e pela confirmação do pagamento de saída, e as filas da operação na tela Início.

**Architecture:** As regras ficam no banco: a coluna de cada viagem (`status_campo`) só muda por funções RPC (`iniciar_viagem`, `mover_viagem`, `cancelar_viagem`, `confirmar_pagamento_saida`), que registram cada passagem em `viagem_evento`. O web lê views `security_invoker` (`v_quadro`, `v_pedido_saldo`, `v_viagem_planejada`) em Server Components e grava por Server Actions com `comSessao`. O Quadro é um Client Component que recarrega `v_quadro` a cada mudança recebida pelo Supabase Realtime na tabela `viagem`.

**Tech Stack:** Postgres/Supabase (RLS, pgTAP, Realtime), Next.js 16 App Router, React 19, TypeScript estrito, Tailwind v4 com o CSS do NILT, zod, lucide-react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-nilt-rotinas-administrativas-design.md` (seções 2, 3.2, 3.5, 4.4, 4.5, 6 e 7 "Durante o paralelo"; linha "Próxima entrega" da seção 13). Base: `docs/superpowers/specs/2026-10-22-nilt-design.md`, `PRODUCT.md`, `DESIGN.md`.

## Global Constraints

- Banco: projeto `tkfpbpqbnasabtzatojk`, **somente** pelo MCP `supabase-nilt`. Mudança de esquema só por migration nova em `supabase/migrations/` + `apply_migration` com o mesmo nome; nunca editar migration aplicada. Depois de cada migration: `generate_typescript_types` → `supabase/types/database.ts`.
- Testes do banco seguem `supabase/tests/README.md` (`_helpers.sql` + arquivo, uma chamada `execute_sql`, termina em `rollback;`). Datas de "hoje" sempre em Brasília (`tests.hoje()` nos testes; `(now() at time zone 'America/Sao_Paulo')::date` no SQL).
- Toda tabela nova: RLS ligado; `select` com `pode_ler()`; escrita com `pode_editar()` salvo onde a task diz outra coisa; `select public.auditar('public.<tabela>')`; privilégios explícitos como em `20261023000700_conjunto.sql` (anon sem nada; authenticated sem truncate/references/trigger).
- Funções RPC: `security definer`, `set search_path = ''`, tudo qualificado, `grant execute ... to authenticated` explícito; mensagens de erro em português claro (viram texto da tela via `mensagemDeErro`).
- Nunca usar a chave service role no app. Nunca acessar o ATUA. Dados de teste e de seed fictícios e fixos (CPF 52998224725 e 11144477735, CNPJ 11222333000181, placas `TST…`).
- Um CNPJ só: nada de empresa/filial em nenhuma tabela.
- Os nomes das colunas do Quadro são do usuário e aparecem **exatamente** assim, nesta ordem: `Trânsito`, `Aguardando carregamento`, `Em carregamento`, `Aguardando NF e pagamento`, `Em rota`, `Pausa`, `Aguardando descarga`, `Aguardando contagem de divergência`, `Resolução de divergência na carga`, `Frete finalizado`.
- Visual: `DESIGN.md` e os componentes de `web/src/components/` (Dialogo, Sinal, Placa, Abas, EstadoVazio, Toast, BarraSalvar). Interface 100% pt-BR, datas dd/mm/aaaa, horário de Brasília.
- Formulários seguem o contrato de `web/src/lib/acao.ts` (inputs não controlados, `useActionState`, envio por `onSubmit` + `startTransition`).
- Commits por task com caminhos explícitos (sem `git add -A`); nunca push.

## Review Focus

- **Duas pessoas movem o mesmo cartão ao mesmo tempo (ou o quadro está atrasado):** `mover_viagem` recebe a coluna de origem que a tela via; se a viagem já mudou, recusa com "a viagem já está em \"<coluna atual>\"; o quadro foi atualizado" e a tela recarrega sem gravar nada. Teste em Task 4 (`test_mover_com_origem_desatualizada`) e Task 10 (`recarrega quando o banco recusa por origem desatualizada`).
- **Conexão cai (equipe externa no celular):** o Quadro mostra "Desatualizado desde hh:mm", nunca finge estar em dia, e ao reconectar recarrega sozinho. Teste em Task 6 (`estadoConexao`).
- **Chave errada colada:** chave da NF-e (modelo 55), dígito trocado, chave com espaços/pontos copiada do DACTE. Espaços e pontos são aceitos (só dígitos contam); modelo errado e dígito verificador errado são recusados dizendo qual chave. Teste em Task 4 (`test_chave_dfe_valida`) e Task 6 (`chaveDfeValida`).
- **Cavalo ou motorista já em outra viagem ativa:** `iniciar_viagem` recusa, sem exceção possível, dizendo o número da outra viagem e a coluna dela. Teste em Task 3 (`test_iniciar_com_cavalo_em_outra_viagem`).
- **Virada do dia:** "Frete finalizado" mostra só o que finalizou hoje **em Brasília**; das 21h à meia-noite (BRT) o UTC já é amanhã e o cartão não pode sumir antes da hora. Teste em Task 5 (`test_quadro_finalizado_some_no_dia_seguinte_brasilia`).

---

## Estrutura de arquivos

```
supabase/migrations/20261025000100_cliente_e_locais.sql        Task 1
supabase/migrations/20261025000200_pedido_viagem.sql           Task 2
supabase/migrations/20261025000300_iniciar_viagem.sql          Task 3
supabase/migrations/20261025000400_mover_viagem.sql            Task 4
supabase/migrations/20261025000500_quadro.sql                  Task 5
supabase/tests/cliente.test.sql            Task 1
supabase/tests/pedido_viagem.test.sql      Task 2
supabase/tests/iniciar_viagem.test.sql     Task 3
supabase/tests/mover_viagem.test.sql       Task 4
supabase/tests/quadro.test.sql             Task 5
supabase/seed/dev_dados_ficticios.sql      Task 5 (acrescentar) + limpar_dados_ficticios.sql
supabase/types/database.ts                 Tasks 1–5 (gerado)
web/src/lib/quadro.ts                      Task 6  (regras puras do Quadro, espelho do banco)
web/src/lib/conexao.ts                     Task 6  (estado da conexão em tempo real)
web/tests/unit/quadro.test.ts              Task 6
web/src/components/shell-cliente.tsx       Task 7  (menu)
web/src/app/(app)/clientes/**              Task 7
web/src/app/(app)/pedidos/**               Task 8
web/src/app/(app)/viagens/**               Task 9
web/src/app/(app)/quadro/**                Task 10, Task 11
web/src/app/(app)/(inicio)/**              Task 11
web/tests/unit/{clientes,pedidos,viagens,quadro-tela,inicio}.test.ts(x)   Tasks 7–11
web/tests/e2e/quadro.spec.ts               Task 12
```

---

### Task 1: Banco — cliente e locais de coleta/descarga

Cliente é um papel da Pessoa (como motorista e proprietário). Local de coleta/descarga **reaproveita** `pessoa_endereco` com `tipo = 'coleta_descarga'` (o enum já existe); só ganha dois campos.

**Files:**
- Create: `supabase/migrations/20261025000100_cliente_e_locais.sql`
- Test: `supabase/tests/cliente.test.sql`

**Interfaces:**
- Produces: enum `public.condicao_faturamento ('por_cte','semanal','quinzenal','mensal')`; tabela `public.cliente (pessoa_id uuid pk → pessoa(id) on delete restrict, condicao_faturamento not null default 'por_cte', email_xml text, email_cobranca text, exige_gr boolean not null default false, gerenciadora text, exige_sm boolean not null default false, exigencias text, colunas de auditoria como em conjunto)`; colunas novas `pessoa_endereco.janela_atendimento text`, `pessoa_endereco.contato_local text`.

- [ ] **Step 1: Escrever `supabase/tests/cliente.test.sql`** com:
  - `test_operacao_cria_cliente`: como `operacao`, insere pessoa PJ (CNPJ 11222333000181) + `cliente`; `is(count, 1)`.
  - `test_leitura_nao_cria_cliente`: como `leitura`, `throws_ok` no insert em `cliente` (RLS, código `42501`).
  - `test_local_coleta_descarga`: como `operacao`, insere `pessoa_endereco` com `tipo='coleta_descarga'`, `janela_atendimento='seg a sex 7h–17h'`, `contato_local='portaria'`; `is(janela_atendimento, 'seg a sex 7h–17h')`.
  - `test_cliente_auditado`: depois do insert, existe linha em `public.auditoria` com a tabela `cliente`.
  - `test_pessoa_com_cliente_nao_apaga`: como `admin`, `throws_ok` em `delete from pessoa` de quem é cliente (`23503`).
- [ ] **Step 2: Rodar o teste** (`execute_sql` com `_helpers.sql` + arquivo). Esperado: `not ok` (tabela não existe).
- [ ] **Step 3: Escrever a migration** com o enum, a tabela, `updated_at` trigger (`fn_set_updated_at`), RLS (select `pode_ler`, insert/update `pode_editar`, delete `eh_admin`), `auditar`, privilégios, e os dois `alter table public.pessoa_endereco add column`.
- [ ] **Step 4: `apply_migration` com o nome `cliente_e_locais` e rodar o teste.** Esperado: todos `ok`.
- [ ] **Step 5: `generate_typescript_types` → `supabase/types/database.ts`.**
- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261025000100_cliente_e_locais.sql supabase/tests/cliente.test.sql supabase/types/database.ts
git commit -m "feat(banco): cliente e locais de coleta e descarga"
```

---

### Task 2: Banco — pedido, viagem, eventos, pausas e canhoto

**Files:**
- Create: `supabase/migrations/20261025000200_pedido_viagem.sql`
- Test: `supabase/tests/pedido_viagem.test.sql`

**Interfaces:**
- Consumes: `cliente`, `pessoa_endereco` (Task 1); `conjunto`, `veiculo`, `motorista`, `arquivo`, `tipo_arquivo`.
- Produces:
  - enums `public.tipo_tarifa ('total','por_tonelada')`, `public.origem_frete ('manual','tabela')`, `public.situacao_pedido ('aberto','cancelado')`, `public.status_campo ('transito','aguardando_carregamento','em_carregamento','aguardando_nf_pagamento','em_rota','pausa','aguardando_descarga','aguardando_contagem','resolucao_divergencia','frete_finalizado')` (nesta ordem), `public.resultado_contagem ('sem_divergencia','falta','sobra','avaria')`, `public.tipo_pausa ('almoco','banheiro','descanso_pernoite','abastecimento','manutencao','problema','outro')`.
  - `public.pedido`: `id uuid pk`, `numero bigint generated always as identity unique`, `tomador_id`, `remetente_id`, `destinatario_id` (todos `uuid not null → cliente(pessoa_id)`), `local_coleta_id`, `local_descarga_id` (`uuid not null → pessoa_endereco(id)`), `produto text not null`, `peso_total_kg numeric(12,1) not null check > 0`, `coleta_prevista date`, `entrega_prevista date`, `frete_empresa_valor numeric(12,2) not null check >= 0`, `frete_empresa_tipo tipo_tarifa not null default 'por_tonelada'`, `frete_empresa_origem origem_frete not null default 'manual'`, `situacao situacao_pedido not null default 'aberto'`, `observacao text`, auditoria.
  - `public.viagem`: `id uuid pk`, `numero bigint identity unique`, `pedido_id → pedido (restrict)`, `conjunto_id → conjunto`, `cavalo_id → veiculo`, `motorista_id → motorista(pessoa_id)` (todos not null), `peso_previsto_kg numeric(12,1) not null check > 0`, `frete_motorista_valor numeric(12,2)`, `frete_motorista_tipo tipo_tarifa`, `status_campo status_campo` (nulo = Planejada), `status_desde timestamptz`, `iniciada_em`, `iniciada_por`, `liberacao_justificativa text`, `liberacao_aptidao jsonb`, `peso_saida_kg numeric(12,1)`, `chave_cte char(44)`, `chave_mdfe char(44)`, `pagamento_saida_em`, `pagamento_saida_por`, `peso_chegada_kg numeric(12,1)`, `divergencia resultado_contagem`, `divergencia_descricao text`, `resolucao text`, `finalizada_em timestamptz`, `cancelada_em`, `cancelada_por`, `cancelamento_motivo text`, `observacao text`, auditoria.
  - `public.viagem_evento (id bigint identity pk, viagem_id → viagem cascade, de status_campo, para status_campo, em timestamptz not null default now(), por uuid default auth.uid(), motivo text, dados jsonb not null default '{}')`.
  - `public.viagem_pausa (id uuid pk, viagem_id → viagem cascade, tipo tipo_pausa not null, programada boolean not null, coluna_origem status_campo not null check in ('transito','em_rota'), inicio timestamptz not null default now(), fim timestamptz check (fim is null or fim > inicio))` + índice único parcial: uma pausa aberta por viagem.
  - enum `public.tipo_ocorrencia ('atraso','avaria','recusa','sinistro','parada_nao_prevista','outro')`; `public.viagem_ocorrencia (id uuid pk, viagem_id → viagem cascade, tipo tipo_ocorrencia not null, descricao text not null, aberta_em timestamptz not null default now(), aberta_por uuid default auth.uid(), resolvida_em timestamptz, resolvida_por uuid, resolucao text, check ((resolvida_em is null) = (resolucao is null)))`; RLS select `pode_ler`, insert/update `pode_editar`, delete `eh_admin`; auditada (spec 6.4).
  - `arquivo.viagem_id uuid → viagem cascade`; `arquivo_um_dono` passa a `num_nonnulls(pessoa_id, veiculo_id, viagem_id) = 1`; `tipo_arquivo.aplica_viagem boolean not null default false` (o check `aplica_algum` passa a incluir viagem); tipo novo `(15, 'CANHOTO', aplica_pessoa false, aplica_veiculo false, aplica_viagem true)` e `OUTROS` (14) passa a `aplica_viagem true`. Caminho no Storage: `viagem/<viagem_id>/<arquivo_id>-<nome>`; estender as policies de Storage e qualquer validação de tipo×dono das migrations 0800/0801 para o prefixo e o dono `viagem`.
- Regras desta task:
  - Privilégios de coluna em `viagem`: `revoke update on public.viagem from authenticated; grant update (conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, frete_motorista_valor, frete_motorista_tipo, observacao) on public.viagem to authenticated`. Todo o resto só muda pelas RPCs das Tasks 3 e 4.
  - Trigger `validar_viagem` (before insert/update): `cavalo_id` e `motorista_id` iguais aos do `conjunto_id`; conjunto aberto (`fim is null`) no insert e na troca; troca de `conjunto_id` só com `status_campo is null` ("o conjunto só muda antes de a viagem começar").
  - Trigger `validar_pedido` (before insert/update): `local_coleta_id` é endereço do remetente com tipo `coleta_descarga`; `local_descarga_id` idem do destinatário.
  - `viagem_evento` e `viagem_pausa`: só `select` para `pode_ler()`; nenhum insert/update/delete para `authenticated` (as RPCs gravam).

- [ ] **Step 1: Escrever `supabase/tests/pedido_viagem.test.sql`** com:
  - `test_pedido_local_de_outro_cliente`: `throws_ok` com local de coleta que não é do remetente.
  - `test_viagem_copia_do_conjunto`: insert de viagem com motorista diferente do conjunto → `throws_ok`.
  - `test_viagem_conjunto_encerrado`: insert com conjunto `fim` preenchido → `throws_ok`.
  - `test_operacao_nao_muda_status_direto`: como `operacao`, `update viagem set status_campo='em_rota'` → `throws_ok` (`42501`).
  - `test_operacao_nao_grava_evento`: como `operacao`, insert em `viagem_evento` → `throws_ok`.
  - `test_canhoto_na_viagem`: como `operacao`, insert em `arquivo` com `viagem_id` e tipo 15 → `lives_ok`; com `viagem_id` e `pessoa_id` juntos → `throws_ok`.
  - `test_ocorrencia_resolvida_exige_texto`: `resolvida_em` sem `resolucao` → `throws_ok` (`23514`).
  - `test_uma_pausa_aberta`: como serviço, duas pausas abertas na mesma viagem → `throws_ok` (`23505`).
- [ ] **Step 2: Rodar.** Esperado: falha.
- [ ] **Step 3: Escrever a migration** (enums, tabelas, índices das FKs, triggers, RLS, `auditar` em `pedido`, `viagem`, `viagem_pausa`; privilégios).
- [ ] **Step 4: `apply_migration` (`pedido_viagem`), rodar este teste e `arquivos.test.sql` + `pendencias_arquivos.test.sql`.** Esperado: tudo `ok`.
- [ ] **Step 5: Gerar tipos.**
- [ ] **Step 6: Commit** (`feat(banco): pedido, viagem, eventos, pausas e canhoto`) com os três arquivos.

---

### Task 3: Banco — aptidão, iniciar e cancelar viagem

**Files:**
- Create: `supabase/migrations/20261025000300_iniciar_viagem.sql`
- Test: `supabase/tests/iniciar_viagem.test.sql`

**Interfaces:**
- Produces:
  - `public.aptidao_viagem(p_conjunto uuid, p_tomador uuid default null) returns table (codigo text, nivel text, mensagem text)` — `security invoker`, `stable`, `grant execute to authenticated`. `nivel ∈ ('trava_legal','trava','aviso')`. Uma linha por problema; nenhuma linha = Apto.
  - `public.iniciar_viagem(p_viagem uuid, p_justificativa text default null) returns void`.
  - `public.cancelar_viagem(p_viagem uuid, p_motivo text) returns void`.
  - `public.rotulo_status_campo(p public.status_campo) returns text` (`immutable`): devolve os nomes exatos das colunas (Global Constraints); `null` → `'Planejada'`.
- Regras de `aptidao_viagem` (spec 4.4; hoje = Brasília):

| codigo | nivel | quando |
|---|---|---|
| `conjunto_encerrado` | trava_legal | conjunto com `fim` |
| `sem_motorista` | trava_legal | `conjunto.motorista_id` nulo |
| `cavalo_em_viagem` / `motorista_em_viagem` | trava_legal | existe outra viagem não cancelada com o mesmo cavalo/motorista e `status_campo` não nulo e diferente de `frete_finalizado`; mensagem com `#numero` e `rotulo_status_campo` dela |
| `motorista_cadastro` | trava | `pessoa.situacao_cadastro <> 'normal'` |
| `cnh_ausente` / `cnh_vencida` | trava | `cnh_validade` nula / `< hoje` |
| `cnh_categoria` | trava | conjunto com itens e `cnh_categoria not in ('e','ae')`; sem itens e `not in ('c','d','e','ac','ad','ae')` |
| `cnh_vencendo` | aviso | `cnh_validade <= hoje + 30` |
| `veiculo_cadastro` | trava | alguma placa do conjunto com `situacao_cadastro <> 'normal'` (mensagem com a placa) |
| `crlv_exercicio` | trava / aviso | `exercicio_doc` nulo ou `< ano − 1` → trava; `= ano − 1` → aviso **[decisão do plano]** |
| `arrendado_sem_contrato` | trava | placa do conjunto em `v_pendencias_documentos` com `tipo_pendencia = 'veiculo_arrendado_sem_contrato'` |
| `acima_cmt` | aviso | `v_conjunto_capacidade.excede_cmt` |
| `cliente_exige_gr` / `cliente_exige_sm` | aviso | `cliente.exige_gr` / `exige_sm` do tomador (GR ainda é manual nesta entrega) |

- Regras de `iniciar_viagem`: `pode_editar()`; `select ... for update`; viagem não cancelada e `status_campo is null`; roda a aptidão com o tomador do pedido; qualquer `trava_legal` → erro com as mensagens juntas; `trava` sem justificativa (nula ou só espaços) → erro `'viagem não apta: <mensagens>'`; `trava` com justificativa e sem `eh_admin()` → erro `'Só o administrador pode liberar com exceção.'`. Sucesso: `status_campo='transito'`, `status_desde=now()`, `iniciada_em/por`, `liberacao_justificativa`, `liberacao_aptidao` (as linhas como jsonb), evento `(null → transito, motivo = justificativa, dados = aptidão)`.
- Regras de `cancelar_viagem`: `pode_editar()`; motivo obrigatório; só com `status_campo` nulo ou em `transito`…`aguardando_nf_pagamento` (antes de Em rota); fecha pausa aberta; grava `cancelada_*` e evento `(status → null, motivo)`.

- [ ] **Step 1: Escrever `supabase/tests/iniciar_viagem.test.sql`** (fixtura: motorista CNH E válida, cavalo + carreta normais, CRLV do ano, cliente sem exigências) com:
  - `test_apto_inicia_em_transito`: `iniciar_viagem` → `status_campo = 'transito'`, 1 evento `para='transito'`.
  - `test_cnh_vencida_trava_sem_justificativa`: `throws_ok(..., 'viagem não apta: ...')` (use `throws_like` com `'viagem não apta%CNH%'`).
  - `test_operacao_com_justificativa_nao_libera`: `throws_ok` com `'Só o administrador pode liberar com exceção.'`.
  - `test_admin_libera_com_justificativa`: `lives_ok`; `liberacao_justificativa` gravada; evento com `motivo`.
  - `test_iniciar_com_cavalo_em_outra_viagem`: segunda viagem do mesmo cavalo → `throws_like '%#<numero>%Trânsito%'`, mesmo como admin com justificativa.
  - `test_categoria_b_com_carreta`: aptidão contém `cnh_categoria` nível `trava`.
  - `test_crlv_ano_anterior_aviso`: `exercicio_doc = ano−1` → `crlv_exercicio` nível `aviso`.
  - `test_cliente_exige_gr_aviso`: tomador `exige_gr` → linha `cliente_exige_gr` `aviso`; viagem inicia.
  - `test_cancelar_em_rota_recusa`: viagem forçada (como serviço) para `em_rota` → `cancelar_viagem` `throws_ok`.
  - `test_cancelar_exige_motivo`.
- [ ] **Step 2: Rodar.** Esperado: falha.
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: `apply_migration` (`iniciar_viagem`) e rodar.** Esperado: tudo `ok`.
- [ ] **Step 5: Gerar tipos.**
- [ ] **Step 6: Commit** (`feat(banco): aptidão, iniciar e cancelar viagem`).

---

### Task 4: Banco — mover viagem, chaves e pagamento de saída

**Files:**
- Create: `supabase/migrations/20261025000400_mover_viagem.sql`
- Test: `supabase/tests/mover_viagem.test.sql`

**Interfaces:**
- Consumes: `rotulo_status_campo` (Task 3).
- Produces:
  - `public.chave_dfe_valida(p_chave text, p_modelo text) returns boolean` (`immutable`): tira tudo que não é dígito; exige 44 dígitos; `substr(chave, 21, 2) = p_modelo`; dígito verificador módulo 11 (pesos 2..9 da direita para a esquerda sobre os 43 primeiros; `dv = 11 − soma % 11`, e 10 ou 11 viram 0).
  - `public.confirmar_pagamento_saida(p_viagem uuid) returns void`: `tem_papel('admin','operacao','financeiro')`; viagem não cancelada e antes de `em_rota`; grava `pagamento_saida_em/por`; evento com `de = para = status atual`, `dados = {"tipo":"pagamento_saida"}`.
  - `public.mover_viagem(p_viagem uuid, p_de public.status_campo, p_para public.status_campo, p_dados jsonb default '{}') returns void`: `pode_editar()`; `for update`; se `status_campo is distinct from p_de` → erro `'a viagem já está em "<rótulo atual>"; o quadro foi atualizado'`.
- Passagens permitidas (qualquer outra → erro `'não é possível passar de "<de>" para "<para>"'`). Chaves de `p_dados` em `snake_case`:

| de → para | exige em `p_dados` | grava |
|---|---|---|
| transito → aguardando_carregamento | — | |
| aguardando_carregamento → em_carregamento | — | |
| em_carregamento → aguardando_nf_pagamento | `peso_saida_kg > 0` | `peso_saida_kg` |
| aguardando_nf_pagamento → em_rota | `chave_cte` válida modelo `57`, `chave_mdfe` válida modelo `58`, e `pagamento_saida_em` já preenchido | chaves só com dígitos |
| transito / em_rota → pausa | `pausa_tipo`, `pausa_programada` | nova `viagem_pausa` com `coluna_origem = p_de` |
| pausa → coluna_origem da pausa aberta | — | fecha a pausa (`fim = now()`) |
| em_rota → aguardando_descarga | — | |
| aguardando_descarga → aguardando_contagem | `peso_chegada_kg > 0` e já existe `arquivo` tipo 15 da viagem | `peso_chegada_kg` |
| aguardando_contagem → frete_finalizado | `divergencia = 'sem_divergencia'` | `divergencia`, `finalizada_em` |
| aguardando_contagem → resolucao_divergencia | `divergencia ∈ (falta, sobra, avaria)` e `divergencia_descricao` não vazia | as duas |
| resolucao_divergencia → frete_finalizado | `resolucao` não vazia | `resolucao`, `finalizada_em` |
| aguardando_carregamento → transito; em_carregamento → aguardando_carregamento; aguardando_nf_pagamento → em_carregamento (voltar) | `motivo` não vazio | |

- Mensagens exatas das recusas de dado: `'informe o peso de saída'`, `'chave do CT-e inválida'`, `'chave do MDF-e inválida'`, `'falta confirmar o adiantamento e o vale-pedágio'`, `'informe o tipo da pausa'`, `'informe o peso de chegada'`, `'falta o canhoto'`, `'descreva a divergência'`, `'descreva a resolução'`, `'informe o motivo para voltar a viagem'`.
- Toda passagem: `status_campo = p_para`, `status_desde = now()`, evento `(p_de → p_para, motivo, dados = p_dados)`.

- [ ] **Step 1: Escrever `supabase/tests/mover_viagem.test.sql`** com:
  - `test_chave_dfe_valida`: uma chave fictícia modelo 57 com DV correto calculado no próprio teste → `true`; a mesma com espaços e pontos → `true`; com o último dígito trocado → `false`; mesma estrutura com modelo `55` pedindo `57` → `false`; 43 dígitos → `false`.
  - `test_caminho_completo`: de `transito` até `frete_finalizado` passando por todas as colunas (inclui pausa e volta a `em_rota`); `is(status_campo,'frete_finalizado')`; com a viagem iniciada por `iniciar_viagem` e o pagamento confirmado no caminho, `is(count(eventos), 11)` (1 início + 1 pagamento + 9 passagens).
  - `test_mover_com_origem_desatualizada`: `p_de='transito'` com a viagem em `aguardando_carregamento` → `throws_like '%já está em "Aguardando carregamento"%'`; nada muda.
  - `test_em_rota_sem_pagamento`: chaves válidas e sem `confirmar_pagamento_saida` → `throws_ok 'falta confirmar o adiantamento e o vale-pedágio'`.
  - `test_em_rota_com_chave_nfe`: `chave_cte` modelo 55 → `'chave do CT-e inválida'`.
  - `test_pausa_volta_para_origem`: pausa a partir de `transito`; `pausa → em_rota` recusa; `pausa → transito` aceita e fecha a pausa.
  - `test_pausa_no_carregamento_recusa`.
  - `test_contagem_sem_canhoto`: `'falta o canhoto'`.
  - `test_voltar_exige_motivo` e `test_voltar_depois_de_em_rota_recusa` (`em_rota → aguardando_nf_pagamento` → não é possível passar).
  - `test_financeiro_confirma_pagamento_mas_nao_move`: como `financeiro`, `confirmar_pagamento_saida` ok; `mover_viagem` → `throws_ok` (permissão).
- [ ] **Step 2: Rodar.** Esperado: falha.
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: `apply_migration` (`mover_viagem`) e rodar.** Esperado: tudo `ok`.
- [ ] **Step 5: Gerar tipos.**
- [ ] **Step 6: Commit** (`feat(banco): mover viagem pelas colunas do quadro`).

---

### Task 5: Banco — views do Quadro, tempos-limite, tempo real e seed

**Files:**
- Create: `supabase/migrations/20261025000500_quadro.sql`
- Test: `supabase/tests/quadro.test.sql`
- Modify: `supabase/seed/dev_dados_ficticios.sql`, `supabase/seed/limpar_dados_ficticios.sql`

**Interfaces:**
- Produces:
  - `public.quadro_limite (chave text pk, minutos_ambar integer, minutos_vermelho integer, check (minutos_vermelho > minutos_ambar))`; RLS select `pode_ler`, update `eh_admin`, sem insert/delete para `authenticated`; auditada. Carga **[decisão do plano; o admin muda depois]**: `aguardando_carregamento 120/240`, `em_carregamento 120/240`, `aguardando_nf_pagamento 120/240`, `aguardando_descarga 120/240`, `aguardando_contagem 240/1440`, `resolucao_divergencia 1440/2880`, `pausa_nao_programada 30/60`, `pausa_programada 60/120`. Sem linha (Trânsito, Em rota, Frete finalizado) = nunca muda de cor.
  - `public.v_quadro` (`security_invoker`): `viagem_id, numero, status_campo, status_desde, cavalo_placa, motorista_nome` (apelido da pessoa ou primeiro nome), `cliente_nome` (tomador: apelido ou nome), `origem_cidade, origem_uf, destino_cidade, destino_uf` (dos locais do pedido), `unidade_operacional_id` (do cavalo), `iniciada_por, pausa_tipo, pausa_programada, pausa_inicio` (pausa aberta), `tem_chaves boolean, pagamento_saida boolean, tem_canhoto boolean, divergencia, ocorrencias_abertas integer`. Só viagens não canceladas com `status_campo` não nulo e, se `frete_finalizado`, só as com `finalizada_em` no dia de hoje em Brasília.
  - `public.v_pedido_saldo` (`security_invoker`): `pedido_id, numero, situacao, tomador_id, peso_total_kg, peso_alocado_kg` (soma de `coalesce(peso_saida_kg, peso_previsto_kg)` das viagens não canceladas), `saldo_kg, viagens integer`.
  - `public.v_viagem_planejada` (`security_invoker`): viagens não canceladas com `status_campo` nulo: `viagem_id, numero, pedido_id, pedido_numero, cavalo_placa, motorista_nome, cliente_nome, travas integer, avisos integer, aptidao jsonb` (lateral `aptidao_viagem(conjunto_id, tomador_id)`; `travas` conta `trava` + `trava_legal`).
  - `alter publication supabase_realtime add table public.viagem;`
- [ ] **Step 1: Escrever `supabase/tests/quadro.test.sql`** com:
  - `test_quadro_mostra_viagem_em_rota` e `test_quadro_esconde_planejada_e_cancelada`.
  - `test_quadro_finalizado_some_no_dia_seguinte_brasilia`: viagem com `finalizada_em = ((tests.hoje() - 1) + time '23:30') at time zone 'America/Sao_Paulo'` não aparece; com `(tests.hoje() + time '00:10') at time zone 'America/Sao_Paulo'` aparece.
  - `test_quadro_pausa_aberta`: `pausa_tipo` e `pausa_programada` preenchidos.
  - `test_saldo_do_pedido`: pedido 30000 kg com viagens de 12000 (prevista) e 11800 (saída, prevista 12000) e uma cancelada → `saldo_kg = 6200`.
  - `test_planejada_conta_travas`: motorista com CNH vencida → `travas >= 1`.
  - `test_operacao_nao_muda_limite` e `test_admin_muda_limite`.
  - `test_viagem_na_publicacao_realtime`: `ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='viagem'))`.
- [ ] **Step 2: Rodar.** Esperado: falha.
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: `apply_migration` (`quadro`) e rodar este teste e os das Tasks 1–4.** Esperado: tudo `ok`.
- [ ] **Step 5: Gerar tipos.**
- [ ] **Step 6: Acrescentar ao seed fictício** 2 clientes (um com `exige_gr`), 2 locais de coleta e 2 de descarga, 2 pedidos, e viagens que deixem pelo menos um cartão em cada uma das 10 colunas mais 2 planejadas (uma apta, uma com CNH vencida), usando as RPCs como serviço. Acrescentar a limpeza correspondente em `limpar_dados_ficticios.sql` (ordem: eventos/pausas/arquivos de viagem → viagem → pedido → cliente).
- [ ] **Step 7: Commit** (`feat(banco): views do quadro, tempos-limite e tempo real`).

---

### Task 6: Web — regras puras do Quadro e estado da conexão

**Files:**
- Create: `web/src/lib/quadro.ts`, `web/src/lib/conexao.ts`
- Test: `web/tests/unit/quadro.test.ts`

**Interfaces:**
- Produces (`web/src/lib/quadro.ts`, sem servidor):
  - `type StatusCampo = Database["public"]["Enums"]["status_campo"]`.
  - `const COLUNAS: readonly { status: StatusCampo; rotulo: string; espera: boolean }[]` — as 10, na ordem, rótulos exatos; `espera: true` em `aguardando_carregamento`, `aguardando_nf_pagamento`, `aguardando_descarga`, `aguardando_contagem` (colunas estreitáveis).
  - `rotuloDe(s: StatusCampo | null): string` (`null` → `"Planejada"`).
  - `destinosPermitidos(de: StatusCampo, origemDaPausa?: StatusCampo): StatusCampo[]` — mesma tabela da Task 4, sem as voltas.
  - `colunaAnterior(de: StatusCampo): StatusCampo | null` — só para as três voltas permitidas.
  - `type Formulario = "peso_saida" | "documentos" | "pausa" | "chegada" | "contagem" | "resolucao" | "motivo" | null`; `formularioDaPassagem(de: StatusCampo, para: StatusCampo): Formulario`.
  - `type Nivel = "normal" | "ambar" | "vermelho"`; `nivelDoTempo(minutos: number, limite: { minutos_ambar: number | null; minutos_vermelho: number | null } | undefined): Nivel`; `chaveDoLimite(c: { status_campo: StatusCampo; pausa_programada: boolean | null }): string` (pausa → `pausa_programada`/`pausa_nao_programada`, senão o próprio status).
  - `somenteDigitos(s: string): string`; `chaveDfeValida(chave: string, modelo: "57" | "58"): boolean` — mesma regra da Task 4.
  - `type Cartao = Database["public"]["Views"]["v_quadro"]["Row"]`; `type Filtros = { cliente?: string; motorista?: string; unidade?: number; soProblema?: boolean; minhasDe?: string }`; `filtrarCartoes(c: Cartao[], f: Filtros, nivelDe: (c: Cartao) => Nivel): Cartao[]` (`soProblema` = nível ≠ normal, ou pausa não programada, ou divergência, ou `ocorrencias_abertas > 0`).
  - `agruparPorColuna(c: Cartao[]): Record<StatusCampo, Cartao[]>` (mais antigo primeiro por `status_desde`).
- Produces (`web/src/lib/conexao.ts`): `type EstadoConexao = { tipo: "conectando" } | { tipo: "ao_vivo"; atualizadoEm: Date } | { tipo: "desatualizado"; desde: Date }`; `proximoEstado(atual: EstadoConexao, evento: { tipo: "inscrito" | "erro" | "fechado" | "recarregou"; em: Date }): EstadoConexao` — erro/fechado vindo de `ao_vivo` vira `desatualizado` com `desde = atualizadoEm`; `inscrito` vira `ao_vivo` só depois de `recarregou`; `textoConexao(e: EstadoConexao): string` → `"Ao vivo"`, `"Conectando…"`, `"Desatualizado desde 14:32"` (hh:mm de Brasília).

- [ ] **Step 1: Escrever `web/tests/unit/quadro.test.ts`:**
```ts
expect(COLUNAS.map((c) => c.rotulo)).toEqual([
  "Trânsito", "Aguardando carregamento", "Em carregamento", "Aguardando NF e pagamento", "Em rota",
  "Pausa", "Aguardando descarga", "Aguardando contagem de divergência",
  "Resolução de divergência na carga", "Frete finalizado",
]);
expect(destinosPermitidos("em_rota")).toEqual(["pausa", "aguardando_descarga"]);
expect(destinosPermitidos("pausa", "transito")).toEqual(["transito"]);
expect(destinosPermitidos("aguardando_contagem")).toEqual(["resolucao_divergencia", "frete_finalizado"]);
expect(colunaAnterior("em_rota")).toBeNull();
expect(formularioDaPassagem("aguardando_nf_pagamento", "em_rota")).toBe("documentos");
expect(formularioDaPassagem("transito", "aguardando_carregamento")).toBeNull();
expect(nivelDoTempo(119, { minutos_ambar: 120, minutos_vermelho: 240 })).toBe("normal");
expect(nivelDoTempo(120, { minutos_ambar: 120, minutos_vermelho: 240 })).toBe("ambar");
expect(nivelDoTempo(240, { minutos_ambar: 120, minutos_vermelho: 240 })).toBe("vermelho");
expect(nivelDoTempo(9999, undefined)).toBe("normal");
expect(chaveDfeValida(CHAVE_57_VALIDA, "57")).toBe(true);           // fixture fictícia montada no teste
expect(chaveDfeValida(CHAVE_57_VALIDA.replace(/(\d{4})/g, "$1 "), "57")).toBe(true);
expect(chaveDfeValida(CHAVE_57_VALIDA, "58")).toBe(false);
expect(chaveDfeValida(trocarUltimoDigito(CHAVE_57_VALIDA), "57")).toBe(false);
```
  Mais: `filtrarCartoes` com `soProblema` devolve só o vermelho/âmbar e a pausa não programada; `agruparPorColuna` ordena pelo mais antigo; `estadoConexao`: `ao_vivo` + `erro` às 14:32 → `textoConexao` = `"Desatualizado desde 14:32"` (com `atualizadoEm` 14:32 BRT); `desatualizado` + `inscrito` continua `desatualizado`; + `recarregou` → `ao_vivo`.
- [ ] **Step 2: `cd web && npx vitest run tests/unit/quadro.test.ts`.** Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `quadro.ts` e `conexao.ts`.**
- [ ] **Step 4: Rodar de novo.** Esperado: PASS.
- [ ] **Step 5: Commit** (`feat(web): regras do quadro e estado da conexão`).

---

### Task 7: Web — Clientes

Mesmo padrão de `web/src/app/(app)/proprietarios` (lista, novo começando pelo CPF/CNPJ com a consulta da BrasilAPI e a checagem de duplicidade, ficha com abas), reaproveitando `_pessoa`.

**Files:**
- Create: `web/src/app/(app)/clientes/{page.tsx,consultas.ts,actions.ts,loading.tsx,error.tsx}`, `clientes/novo/page.tsx`, `clientes/[id]/{page.tsx,loading.tsx,error.tsx,not-found.tsx}`, `clientes/[id]/aba-locais.tsx`, `clientes/[id]/aba-faturamento.tsx`
- Modify: `web/src/components/shell-cliente.tsx` (menu: `Início`, `Quadro` (`/quadro`, ícone `Columns3`), `Pedidos` (`/pedidos`, `ClipboardList`), `Viagens` (`/viagens`, `Route`), `Clientes` (`/clientes`, `Store`), depois os itens atuais)
- Test: `web/tests/unit/clientes.test.ts`

**Interfaces:**
- Consumes: tabela `cliente`, `pessoa_endereco` (Task 1); `comSessao`, `_pessoa/*`.
- Produces: `salvarCliente(antes, form: FormData): Promise<ResultadoAcao<string>>` (cria pessoa se preciso + `cliente`; devolve `pessoa_id`), `salvarFaturamento(antes, form)`, `salvarLocal(antes, form)` (endereço `tipo='coleta_descarga'`, com `janela_atendimento` e `contato_local`), `apagarLocal(id: string)`; `listarLocais(cliente: Banco, pessoaId: string): Promise<Local[]>` em `clientes/consultas.ts` (usado pela Task 8).
- Abas da ficha: `Dados` (o bloco de pessoa existente), `Locais` (coleta e descarga), `Faturamento e exigências` (condição, e-mails, exige GR + gerenciadora, exige SM, exigências).

- [ ] **Step 1: Testes unitários** do esquema zod de `salvarFaturamento` (`email_xml` inválido → mensagem "E-mail inválido"; `exige_gr` sem `gerenciadora` → "Informe a gerenciadora") e de `salvarLocal` (sem cidade/UF → recusa; CEP formatado `86800-000` vira `86800000`).
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar telas e ações.**
- [ ] **Step 4: Rodar `npx vitest run` e `npx tsc --noEmit`.** Esperado: PASS, sem erros de tipo.
- [ ] **Step 5: Conferir no navegador** (`npm run dev`, login de desenvolvimento): criar um cliente PJ pelo CNPJ, um local de coleta, marcar "exige GR".
- [ ] **Step 6: Commit** (`feat(web): tela de Clientes e menu da operação`).

---

### Task 8: Web — Pedidos

**Files:**
- Create: `web/src/app/(app)/pedidos/{page.tsx,consultas.ts,actions.ts,loading.tsx,error.tsx}`, `pedidos/novo/page.tsx`, `pedidos/[id]/{page.tsx,loading.tsx,error.tsx,not-found.tsx}`, `pedidos/formulario-pedido.tsx`, `pedidos/[id]/nova-viagem.tsx`
- Test: `web/tests/unit/pedidos.test.ts`

**Interfaces:**
- Consumes: `listarLocais` (Task 7), `v_pedido_saldo` (Task 5), `conjunto` + `v_conjunto_capacidade`.
- Produces: `salvarPedido(antes, form): Promise<ResultadoAcao<string>>`, `cancelarPedido(id: string, motivo: string)` (só sem viagem iniciada), `criarViagem(antes, form): Promise<ResultadoAcao<string>>` (pedido, conjunto aberto, peso previsto, frete do motorista; cavalo e motorista vêm do conjunto; devolve o id da viagem e redireciona para `/viagens/<id>`).
- Lista: abas `A planejar` (aberto com `saldo_kg > 0`), `Atendidos` (aberto com `saldo_kg <= 0`), `Cancelados`; colunas: nº, tomador, origem → destino, produto, peso total, saldo, coleta prevista.
- Formulário: tomador, remetente, destinatário (busca de clientes), local de coleta (locais do remetente), local de descarga (locais do destinatário), produto, peso total (kg), coleta e entrega previstas, frete da empresa (valor + "por tonelada" ou "total"; `frete_empresa_origem` sempre `manual` e escrito "valor digitado" na ficha).
- Ficha: resumo, saldo a carregar, lista de viagens com a coluna atual (`rotuloDe`), botão **Nova viagem** (diálogo: conjunto aberto com placa, carretas e motorista; peso previsto sugerido = `min(saldo, capacidade do conjunto em kg)`; frete do motorista).

- [ ] **Step 1: Testes unitários:** esquema do pedido (peso `30.000` → 30000; remetente sem local → "Escolha o local de coleta"); `pesoSugerido(saldoKg: number, capacidadeT: number | null): number` (capacidade 37 t e saldo 30000 → 30000; capacidade 25 t → 25000; capacidade nula → saldo).
- [ ] **Step 2: Rodar.** FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npx vitest run` + `npx tsc --noEmit`.** PASS.
- [ ] **Step 5: Navegador:** criar pedido de 30.000 kg e uma viagem de 25.000 kg; o saldo mostra 5.000 kg.
- [ ] **Step 6: Commit** (`feat(web): pedidos e criação de viagem`).

---

### Task 9: Web — Viagens (lista e ficha)

**Files:**
- Create: `web/src/app/(app)/viagens/{page.tsx,consultas.ts,actions.ts,loading.tsx,error.tsx}`, `viagens/[id]/{page.tsx,loading.tsx,error.tsx,not-found.tsx}`, `viagens/[id]/aptidao.tsx`, `viagens/[id]/linha-do-tempo.tsx`, `viagens/[id]/canhoto.tsx`
- Test: `web/tests/unit/viagens.test.ts`

**Interfaces:**
- Consumes: `v_viagem_planejada`, `v_quadro`, `viagem_evento`, `viagem_pausa`; RPCs `iniciar_viagem`, `cancelar_viagem`, `confirmar_pagamento_saida`; fluxo de upload de `documentos-acoes.ts` (estender para dono `viagem` e tipo `CANHOTO`, caminho `viagem/<viagem_id>/<arquivo_id>-<nome>`, mesma ordem do README: linha em `arquivo` → objeto no Storage).
- Produces: `iniciarViagem(viagemId: string, justificativa?: string): Promise<ResultadoAcao>`, `cancelarViagem(viagemId: string, motivo: string)`, `confirmarPagamentoSaida(viagemId: string)`, `enviarCanhoto(viagemId: string, form: FormData): Promise<ResultadoAcao<string>>`, `registrarOcorrencia(antes, form)`, `resolverOcorrencia(ocorrenciaId: string, resolucao: string)` — reusadas pela Task 10.
- Lista: abas `Planejadas` (com selo Apta / N travas / avisos), `No quadro`, `Finalizadas`, `Canceladas`.
- Ficha: resumo (pedido, conjunto, motorista, coluna atual e há quanto tempo), **próximo passo** em destaque (Planejada → "Iniciar trânsito"; Aguardando NF e pagamento → "Confirmar pagamento de saída" e "Informar chaves"; Aguardando descarga → "Enviar canhoto"), bloco de aptidão (travas e avisos com as mensagens do banco), linha do tempo dos eventos (quem, quando, motivo), pausas, canhoto, **ocorrências** (registrar com tipo, descrição e foto opcional como arquivo `OUTROS` da viagem; resolver com texto; avaria ou sinistro mostra o aviso "Avise o financeiro: pode virar desconto ou prejuízo.").
- Iniciar com travas: para quem não é admin, o botão fica desabilitado com "Só o administrador pode liberar com exceção."; para admin, abre diálogo que exige justificativa. `trava_legal` nunca oferece exceção.

- [ ] **Step 1: Testes unitários:** `proximoPasso(v: { status_campo: StatusCampo | null; pagamento_saida: boolean; tem_canhoto: boolean }): string | null` (`null` → "Iniciar trânsito"; `aguardando_nf_pagamento` sem pagamento → "Confirmar pagamento de saída"; com pagamento → "Informar chaves do CT-e e MDF-e"; `aguardando_descarga` sem canhoto → "Enviar canhoto"); `podeLiberarComExcecao(aptidao, papel)` (`trava_legal` → false para todos; `trava` → só `admin`).
- [ ] **Step 2: Rodar.** FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npx vitest run` + `npx tsc --noEmit`.** PASS.
- [ ] **Step 5: Navegador:** iniciar uma viagem apta; tentar iniciar a da CNH vencida como operação (bloqueia) e como admin (pede justificativa); enviar um canhoto.
- [ ] **Step 6: Commit** (`feat(web): lista e ficha de viagens`).

---

### Task 10: Web — Quadro da operação

**Files:**
- Create: `web/src/app/(app)/quadro/{page.tsx,consultas.ts,actions.ts,loading.tsx,error.tsx}`, `quadro/quadro-cliente.tsx` (Client Component: estado, tempo real, filtros), `quadro/coluna.tsx`, `quadro/cartao.tsx`, `quadro/dialogos-passagem.tsx`, `quadro/filtros.tsx`
- Modify: CSS de componentes do NILT (mesmo arquivo onde estão `.placa`/`.sinal`) para `.quadro`, `.quadro-coluna`, `.quadro-cartao`
- Test: `web/tests/unit/quadro-tela.test.tsx`

**Interfaces:**
- Consumes: `lib/quadro.ts`, `lib/conexao.ts` (Task 6); `v_quadro`, `quadro_limite` (Task 5); ações da Task 9; `createBrowserClient` (`lib/supabase/client.ts`).
- Produces: `moverViagem(viagemId: string, de: StatusCampo, para: StatusCampo, dados: Record<string, unknown>): Promise<ResultadoAcao>` em `quadro/actions.ts`; `carregarQuadro(cliente: Banco): Promise<{ cartoes: Cartao[]; limites: Limite[] }>` em `quadro/consultas.ts` (usado pela Task 11).
- Comportamento:
  - **Colunas** na ordem de `COLUNAS`, cada uma com contador; no computador rolam na horizontal; colunas de espera podem ser estreitadas (lembrado por `localStorage`, com `try/catch`). No celular (≤640px), uma coluna por vez, com `Abas` no topo mostrando o contador.
  - **Cartão:** placa do cavalo (`Placa`), motorista, cliente, origem → destino, tempo na coluna ("há 2 h 15 min", atualizado a cada 60 s), cor pelo `nivelDoTempo` com `chaveDoLimite`; sinais: chaves (CT-e/MDF-e informados), pagamento de saída, canhoto, pausa (tipo, programada ou não), divergência, ocorrência aberta (com a quantidade). Clicar abre `/viagens/<id>`.
  - **Arrastar:** HTML5 drag and drop só para `destinosPermitidos`; colunas proibidas ficam apagadas durante o arraste. Soltar chama `formularioDaPassagem`: `null` → move direto; senão abre o diálogo (peso de saída; chaves + situação do pagamento; tipo de pausa + programada; peso de chegada + canhoto; resultado da contagem + descrição; resolução). **Alternativa sem arrastar** (teclado, toque e leitor de tela): botão "Mover" no cartão abre a lista dos destinos permitidos e, se houver, "Voltar para <coluna anterior>" (pede motivo).
  - **Recusa do banco:** a mensagem aparece num `Toast`, o cartão volta; se a mensagem for a de origem desatualizada, o quadro recarrega.
  - **Tempo real:** canal `postgres_changes` (`event: '*'`, `schema: 'public'`, `table: 'viagem'`); a cada mudança recarrega `v_quadro` (agrupando mudanças em 300 ms); também recarrega ao voltar o foco da janela. Estado da conexão por `proximoEstado`; `textoConexao` no topo do quadro, com sinal âmbar quando desatualizado.
  - **Filtros:** cliente, motorista, unidade operacional, "Só com problema", "Só as minhas" (`iniciada_por = usuário`); na URL (`?cliente=&motorista=&unidade=&problema=1&minhas=1`).
  - **Permissões:** `leitura` e `financeiro` veem, não arrastam e não veem "Mover" (`pode(perfil,'editar')`); `financeiro` vê "Confirmar pagamento de saída" no cartão em Aguardando NF e pagamento.
- [ ] **Step 1: Testes de componente** (`quadro-tela.test.tsx`, Testing Library): renderiza as 10 colunas com os rótulos exatos e contadores; cartão vermelho quando `status_desde` passou do limite; "Mover" de um cartão em Em rota lista só "Pausa" e "Aguardando descarga"; perfil `leitura` não vê "Mover"; `recarrega quando o banco recusa por origem desatualizada` (ação mockada devolvendo a mensagem → função de recarga chamada uma vez); texto "Desatualizado desde 14:32" quando o canal reporta erro.
- [ ] **Step 2: Rodar.** FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npx vitest run` + `npx tsc --noEmit` + `npm run lint`.** PASS.
- [ ] **Step 5: Navegador, duas janelas logadas:** arrastar um cartão numa janela e ver mudar na outra em poucos segundos; desligar a rede (DevTools offline) e ver "Desatualizado desde"; religar e ver voltar "Ao vivo"; em 390px, uma coluna por vez.
- [ ] **Step 6: Commit** (`feat(web): quadro da operação em tempo real`).

---

### Task 11: Web — Tempos-limite e filas da operação no Início

**Files:**
- Create: `web/src/app/(app)/quadro/tempos-limite.tsx` (diálogo, só admin)
- Modify: `web/src/app/(app)/quadro/actions.ts` (+ `salvarLimites`), `web/src/app/(app)/(inicio)/consultas.ts`, `web/src/app/(app)/(inicio)/page.tsx`
- Test: `web/tests/unit/inicio.test.tsx` (acrescentar), `web/tests/unit/quadro-tela.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `carregarQuadro` (Task 10), `v_pedido_saldo`, `v_viagem_planejada`.
- Produces: `salvarLimites(antes, form): Promise<ResultadoAcao>` (`comSessao(..., { somenteAdmin: true })`); em `(inicio)/consultas.ts`, `resumoOperacao(cliente: Banco): Promise<{ pedidosAPlanejar: number; planejadasAptas: number; planejadasComTrava: number; cartoesVermelhos: number; pausasNaoProgramadas: number }>`.
- Tempos-limite: botão "Tempos-limite" no Quadro só para admin; diálogo com uma linha por chave de `quadro_limite` (rótulo da coluna; pausa em duas linhas "Pausa programada"/"Pausa não programada"), âmbar e vermelho em minutos; vermelho > âmbar validado na tela e no banco.
- Início: novo bloco **Operação** acima das advertências de cadastro, com cinco placas que levam a: `/pedidos?aba=a_planejar`, `/viagens?aba=planejadas` (aptas), `/viagens?aba=planejadas&trava=1`, `/quadro?problema=1` (vermelhos), `/quadro?problema=1` (pausas não programadas). Valor zero aparece apagado, como as placas atuais.
- [ ] **Step 1: Testes:** `resumoOperacao` com cliente Supabase mockado conta certo (dois vermelhos, uma pausa não programada); Início renderiza "Pedidos a planejar" com o número e o link; operação não vê "Tempos-limite"; `salvarLimites` com vermelho ≤ âmbar devolve "O vermelho precisa ser maior que o âmbar.".
- [ ] **Step 2: Rodar.** FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: `npx vitest run` + `npx tsc --noEmit`.** PASS.
- [ ] **Step 5: Commit** (`feat(web): tempos-limite do quadro e filas da operação no início`).

---

### Task 12: E2E do fluxo completo

**Files:**
- Create: `web/tests/e2e/quadro.spec.ts`
- Modify: `web/tests/e2e/apoio.ts` (helpers de pedido/viagem, se preciso)

**Interfaces:**
- Consumes: tudo acima; sessões salvas de `tests/e2e/.sessao/`.

- [ ] **Step 1: Escrever `quadro.spec.ts`** (dados fictícios do seed): como admin, criar pedido → nova viagem → iniciar → no Quadro, mover pelo botão "Mover" até "Aguardando NF e pagamento" (informando peso de saída) → confirmar pagamento → informar chaves fictícias válidas → "Em rota" → "Pausa" (almoço, programada) → voltar a "Em rota" → "Aguardando descarga" → enviar canhoto (PNG fictício) com peso de chegada → "Aguardando contagem de divergência" → "Sem divergência" → cartão em "Frete finalizado". Conferir a linha do tempo na ficha com 11 passagens. Segundo teste: duas páginas abertas no Quadro; mover na primeira; `expect(page2.getByText(...)).toBeVisible({ timeout: 5000 })` na coluna nova.
- [ ] **Step 2: `cd web && npx playwright test tests/e2e/quadro.spec.ts`.** Esperado: PASS.
- [ ] **Step 3: Rodar a suíte inteira** (`npx vitest run`, `npx playwright test`) e todos os `supabase/tests/*.test.sql`. Esperado: tudo verde.
- [ ] **Step 4: Commit** (`test(web): fluxo completo do quadro da operação`).
