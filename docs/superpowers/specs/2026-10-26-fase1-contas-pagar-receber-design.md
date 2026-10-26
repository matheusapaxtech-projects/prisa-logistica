# Fase 1 — Contas a pagar e a receber (design)

Pedido de 2026-10-26: levar ao NILT tudo o que o sistema do sócio tem (`Relatório do Sistema PRISA.md`), em 8 fases, um
PR por fase, empilhados a partir do `main` (layout novo). Esta é a fase 1. As decisões marcadas **(escolha)** foram
tomadas sem perguntar, para o trabalho seguir; dá para mudar depois.

## Roteiro das 8 fases

| Fase | Assunto | Branch |
|---|---|---|
| 1 | Contas a pagar e a receber, dupla aprovação, parcelas 70/30, taxa do cartão-frete, centros de custo | `feat/financeiro-contas` |
| 2 | Tesouraria: painel de 30 dias, caixa por conta, conciliação, DRE, desconto de duplicatas, mútuo/capital/contratos | `feat/tesouraria` |
| 3 | Comercial: cotação salva que vira pedido, análise de crédito, trava de carregar fora do limite | `feat/comercial` |
| 4 | Gerenciadora de risco: fichas ligadas à trava de contratação | `feat/gerenciadora-risco` |
| 5 | CT-e pela Focus NFe (homologação), configuração fiscal, CT-e gera a conta a receber | `feat/cte-focus` |
| 6 | Compras e fornecedores; TI (equipamentos e licenças) | `feat/compras-ti` |
| 7 | RH/DP completo | `feat/rh` |
| 8 | Relatórios | `feat/relatorios` |

Cada fase: migrations novas (nunca edita as aplicadas), testes pgTAP, vitest, build, tipos regenerados e prints.
Desenvolvimento num Supabase local **separado** (`nilt_fases`, portas 573xx), para não mexer no banco local
compartilhado por outras sessões; o `rodar-local.mjs` aceita `NILT_DB_CONTAINER` para isso.

## O que o sócio tem (resumo do relatório)

- **Contas a pagar** (`/financeiro/pagar`): lançar conta; bloco da taxa da Pan Card (1% sobre o pago pelo cartão no mês,
  boleto pago pela conta corrente); filtros Em aberto / Falta aprovar / Vencidos / Pagos / Todos; total e agrupamento
  por centro de custo ou tipo de despesa; colunas descrição/favorecido, forma, vencimento, valor, aprovação.
  Segregação de funções: quem lança não aprova; sem aprovação o banco recusa o pagamento. Ao contratar o motorista
  nascem duas parcelas: 70% do frete + pedágio (paga com o embarque conferido) e 30% (vence no embarque + 3 dias, só
  é paga com a entrega conferida, antecipável). O pagamento marca a viagem como paga.
- **Contas a receber** (`/financeiro/receber`): lançar; filtros Em aberto / Vencidos / Antecipados / Recebidos / Todos;
  tabela com marcação "Antecipar"; simulador de antecipação no fomento (taxa ao mês e tarifa por título).
- **Centros de custo** (`/centros-de-custo`): departamentos (00) e subdepartamentos (00.00) que espelham o menu; cada
  despesa, receita e funcionário leva um; código imutável (renomear ou desativar); só o admin altera.

## Banco

### Centros de custo — `centro_custo`
- Chave = `codigo` (`00` departamento, `00.00` subdepartamento). O código nunca muda (gatilho recusa); o
  subdepartamento exige o departamento. Sem exclusão: desativa. Nome de 1 a 80 letras.
- Todos que leem o sistema veem; só o admin inclui, renomeia e desativa (RLS). Auditoria ligada.
- Carga inicial **(escolha)**: os códigos do menu do sócio (01 Administrativo … 04 Fiscal e seus módulos), que é a
  convenção dele ("cada módulo é também um centro de custo com o mesmo código").
- Centro desativado não recebe conta nova (as antigas continuam com ele).

### Tipo de despesa/receita — `fin_plano_conta`
Plano de contas em dois níveis (grupo · conta), que a fase 2 usa no DRE e na classificação do extrato. Grupos =
linhas do DRE do sócio: receita, impostos sobre a receita, custo do frete, despesas operacionais, resultado
financeiro, IRPJ/CSLL, fora do resultado. Cada conta diz se é de entrada, de saída ou das duas. Carga inicial
**(escolha)** com as contas que o relatório cita (frete de motoristas, pedágio, seguro, gerenciadora, INSS do TAC,
tarifa do cartão-frete, aluguel, contador…). Admin e financeiro veem; só o admin inclui e desativa.

### Contas a pagar — `fin_pagar`
Campos: número, descrição, favorecido (pessoa do cadastro ou nome livre), tipo de despesa, centro de custo, forma
(Pix, boleto, transferência, cartão-frete, cartão de crédito, débito automático, dinheiro, outro), vencimento, valor,
observação; origem (`manual`, `frete_adiantamento`, `frete_saldo`, `taxa_cartao`); viagem; quem lançou, quem
aprovou, quando pagou, de que conta, quem pagou; cancelamento com motivo; liberação de antecipação.

Situação (derivada, na view `v_fin_pagar`): cancelada → paga → falta aprovar → vencida → a vencer.

Regras no banco (não só na tela):
1. **Quem lança não aprova.** `fin_aprovar_pagar` recusa quando quem aprova é quem lançou **ou** quem alterou a conta
   por último (senão bastaria editar a conta de outra pessoa e aprovar).
2. **Sem aprovação, o banco recusa o pagamento** (`fin_pagar_conta`).
3. As colunas de aprovação, pagamento e cancelamento só mudam pelas funções (sem `grant update` nelas). Conta
   aprovada, paga ou cancelada não se edita; para corrigir, quem aprovou (ou o admin) desfaz a aprovação.
4. Lançar e editar: admin e financeiro, só contas `manual` (as parcelas do frete seguem a viagem; nelas só a forma,
   o centro de custo e a observação mudam).
5. Desfazer pagamento: só admin; nas parcelas do frete, só enquanto a viagem não passou da etapa (o adiantamento antes
   de "Em rota", o saldo antes de "Frete finalizado").
6. Sem exclusão: cancela com motivo. Auditoria em tudo.

### Parcelas do frete (70% / 30%)
Gatilho na `viagem` (inclusão e mudança de frete, pedágio, peso, cavalo, cancelamento): toda viagem com frete do
motorista, fora da frota própria, ganha duas contas a pagar, lançadas em nome de quem contratou:
- **Adiantamento**: 70% do frete + 100% do pedágio (vale-pedágio). Vence no dia da contratação e passa para o dia do
  embarque quando o peso de saída é informado. **Só é paga com o embarque conferido** (peso de saída na viagem).
- **Saldo**: os 30% restantes (a soma fecha no centavo). Vence 3 dias depois do embarque (antes do embarque, 3 dias
  depois da contratação). **Só é paga com a entrega conferida** (viagem em "Aguardando saldo (30%)"), ou antes disso se
  o admin liberar a antecipação com motivo **(escolha: "antecipável" = exceção liberada pelo admin)**.
- Frete total = o da `frete_da_viagem` (por tonelada × peso de saída ou previsto). Favorecido = proprietário (ANTT) do
  cavalo, ou o motorista. Forma padrão = cartão-frete **(escolha)**. Centro de custo `03.08` (Gestão de viagens e
  entregas) e conta "Frete de motoristas" **(escolha)**.
- Frete mudou: parcela não aprovada só atualiza; aprovada e não paga perde a aprovação (precisa aprovar de novo);
  paga não muda. Viagem cancelada: as parcelas não pagas são canceladas.
- **O pagamento marca a viagem**: pagar o adiantamento grava `pagamento_saida_em` (o que a passagem para "Em rota"
  exige); pagar o saldo grava `saldo_pago_em` (o que "Frete finalizado" exige), com o evento na linha do tempo.
- Com parcelas no financeiro, a confirmação manual no Quadro (`confirmar_pagamento_saida`, `confirmar_saldo`) é
  recusada pelo banco: quem paga é o financeiro. Viagens antigas, sem parcelas, continuam com a confirmação manual.
  A viagem ganha `pagamento_no_financeiro` (e o `v_quadro` também) para a tela mostrar "o financeiro paga" em vez do
  botão. `viagem_parcelas(viagem)` mostra as duas parcelas a quem lê viagens (sem abrir o financeiro inteiro).

### Taxa do cartão-frete (Pan Card)
`fin_taxa_cartao(mes)`: soma o que foi pago com a forma cartão-frete no mês e calcula a taxa com o
`parametro_fiscal` vigente: 1% (`pan_card_pct`) + R$ 0,50 por transferência (`pan_card_transferencia`, o mesmo da
calculadora). `fin_lancar_taxa_cartao(mes)` cria (ou atualiza, enquanto não aprovada) **uma** conta por mês: boleto
para "Pan Card (cartão-frete)", vence dia 10 do mês seguinte **(escolha)**, conta "Tarifa do cartão-frete", centro
`01.01`.

### Contas a receber — `fin_receber`
Cliente (do cadastro de clientes), título (ex.: "CT-e 1234"), forma, vencimento, valor, tipo de receita, centro de
custo, viagem (opcional), observação; recebimento (data, conta, quem); cancelamento com motivo. Situação: cancelada →
recebida → vencida → a vencer. Lançar, editar, receber, desfazer e cancelar: admin e financeiro. A fase 2 acrescenta
"antecipada" (desconto de duplicatas); a fase 5 faz o CT-e gerar a conta sozinho.

## Telas

- **Financeiro** ganha as abas "A pagar" e "A receber" (as abas viram um componente só, `financeiro/abas.tsx`).
- **`/financeiro/pagar`**: indicadores (em aberto, vencidas, falta aprovar, pago no mês); bloco da taxa do cartão-frete
  do mês com "Lançar a taxa"; abas Em aberto / Falta aprovar / Vencidas / Pagas / Todas; agrupar por centro de custo ou
  tipo de despesa com subtotal; tabela com descrição/favorecido, forma, vencimento, valor, aprovação e ações (aprovar,
  pagar, editar, desfazer aprovação, cancelar, liberar antecipação, desfazer pagamento). Botão principal "Lançar conta
  a pagar".
- **`/financeiro/receber`**: indicadores (em aberto, vencidas, a receber em 30 dias, recebido no mês); abas Em aberto /
  Vencidas / Recebidas / Todas; marcar títulos para o **simulador de antecipação** (taxa ao mês e tarifa por título →
  deságio, tarifas, líquido e custo efetivo; só simula, o registro é da fase 2). Botão "Lançar conta a receber".
- **`/centros-de-custo`**: árvore de departamentos e subdepartamentos com situação e uso; admin cria, renomeia,
  desativa e reativa. Link no trilho (admin) e na tela de contas a pagar.
- **Quadro e ficha da viagem**: com parcelas, no lugar do botão de confirmar pagamento aparece quem paga e a situação
  da parcela; a ficha mostra as duas parcelas.

Cores pelo DESIGN.md: dinheiro sem cor; vencida = ferrugem (círculo); falta aprovar = laranja (losango); vence em até
7 dias = mostarda; paga/aprovada = verde; cancelada = neutro.

## Fora desta fase
Conciliação com o extrato e o pagamento virar lançamento do caixa (fase 2); registrar a antecipação no fomento
(fase 2); guias de retenção, compras e folha virando contas a pagar (fases 6 e 7).
