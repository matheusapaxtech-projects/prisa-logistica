---
name: NILT
description: Núcleo Integrado de Logística e Transporte — o sistema da Prisa, com o visual "rapport" (fundo quente, vidro, pílulas, cartões sólidos) e a cor com significado fixo das placas da rodovia.
colors:
  frame: "#e8e6de"
  sheet: "#fbf8f2"
  raised: "#f3eee4"
  active: "#e7e0d3"
  border: "#e4ddd0"
  rule: "#ebe5da"
  control: "#cdc5b6"
  ink: "#161818"
  muted: "#55574f"
  faint: "#66675f"
  verde: "#2c5a4d"
  verde-forte: "#234a3f"
  verde-claro: "#e1ebe4"
  verde-tinta: "#1f4237"
  laranja: "#e38b3d"
  laranja-claro: "#f8e7d4"
  laranja-tinta: "#7a3c0b"
  amarelo: "#e7c14b"
  amarelo-claro: "#f7edc8"
  amarelo-tinta: "#574300"
  amarelo-borda: "#b8901a"
  vermelho: "#b9381a"
  vermelho-claro: "#f6e1d9"
  vermelho-tinta: "#8a2a12"
  perigo-borda: "#e2b0a2"
  azul: "#2f5f8a"
  azul-claro: "#e2eaf1"
  azul-tinta: "#1d3f5e"
  placa-azul: "#1a4fa0"
  noite: "#161818"
  circulo: "#f5f3eb"
  fundo-pessego: "#eddbce"
  fundo-creme: "#ece4cd"
  fundo-salvia: "#e3e8de"
  painel: "rgba(250, 246, 238, 0.68)"
  neutro-marca: "#8a8a82"
  neutro-tinta: "#3d3e39"
typography:
  display:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: "64px"
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  headline-ficha:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  title-dialogo:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  title:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  kpi:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
  meta:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  small:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  sinal:
    fontFamily: "Outfit, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
  codigo:
    fontFamily: "Overpass Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0"
    fontFeature: "\"tnum\""
  placa:
    fontFamily: "Overpass Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0.06em"
  placa-grande:
    fontFamily: "Overpass Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "0.08em"
rounded:
  chip: "999px"
  control: "999px"
  campo: "12px"
  card: "18px"
  painel: "24px"
  toast: "999px"
  dialogo: "26px"
  sheet: "28px"
  pill: "999px"
  round: "50%"
spacing:
  sheet-inset: "12px"
  campo-gap: "16px"
  gap: "20px"
  pad: "28px"
  pad-celular: "16px"
  bloco-x: "22px"
  sidebar: "236px"
  topbar: "64px"
  control-h: "36px"
  field-h: "42px"
  row-h: "52px"
  toque: "44px"
components:
  button-primary:
    backgroundColor: "{colors.noite}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-h}"
  button-primary-hover:
    backgroundColor: "#2a2c2b"
    textColor: "{colors.sheet}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-h}"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-texto:
    backgroundColor: "transparent"
    textColor: "{colors.azul}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "{spacing.control-h}"
  button-texto-hover:
    backgroundColor: "{colors.azul-claro}"
  button-perigo:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.vermelho-tinta}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-h}"
  button-perigo-hover:
    backgroundColor: "{colors.vermelho-claro}"
  button-disabled:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.faint}"
  campo:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "{spacing.field-h}"
  campo-readonly:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 10px"
    height: "32px"
  nav-item-atual:
    backgroundColor: "{colors.verde}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
  sinal-normal:
    backgroundColor: "{colors.verde-claro}"
    textColor: "{colors.verde-tinta}"
    typography: "{typography.sinal}"
    rounded: "{rounded.chip}"
    height: "22px"
    padding: "0 8px 0 7px"
  sinal-pendente:
    backgroundColor: "{colors.laranja-claro}"
    textColor: "{colors.laranja-tinta}"
  sinal-vencendo:
    backgroundColor: "{colors.amarelo-claro}"
    textColor: "{colors.amarelo-tinta}"
  sinal-bloqueado:
    backgroundColor: "{colors.vermelho-claro}"
    textColor: "{colors.vermelho-tinta}"
  sinal-info:
    backgroundColor: "{colors.azul-claro}"
    textColor: "{colors.azul-tinta}"
  sinal-neutro:
    backgroundColor: "{colors.active}"
    textColor: "{colors.neutro-tinta}"
  placa:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.placa}"
    rounded: "{rounded.chip}"
    height: "30px"
    width: "92px"
  placa-grande:
    typography: "{typography.placa-grande}"
    rounded: "{rounded.control}"
    height: "46px"
    width: "150px"
  bloco:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.card}"
    padding: "16px 20px 20px"
  folha:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.pad}"
  barra-salvar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.toast}"
    padding: "10px 12px 10px 16px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.toast}"
    padding: "10px 14px"
  dialogo:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialogo}"
    width: "520px"
  aba-atual:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "10px 0 12px"
---

# Design System: NILT

## Overview

**Creative North Star: "A rodovia sinalizada, no vidro quente"**

O NILT continua sinalizado como uma rodovia brasileira: cada situação tem a cor e a forma da placa que a equipe da Prisa já obedece na estrada. Desde outubro de 2026 essa sinalização mora num visual inspirado no template "rapport" (referência em `docs/design/rapport/`): fundo em gradiente quente (pêssego, creme, sálvia) com grão leve, painéis de vidro creme translúcido, um menu escuro flutuante de cantos muito redondos, controles em pílula e cartões sólidos coloridos.

A cor ainda carrega significado e nunca decora: o cartão sólido verde está no prazo, o mostarda está perto do limite (âmbar), o laranja está pendente, o ferrugem passou do limite, está bloqueado ou vencido. Uma tela calma é quase toda vidro creme; uma tela com problema acende cartões de longe. A ação principal deixou de ser verde: é a pílula preta (noite), uma por tela.

O movimento faz parte da linguagem: a página entra desfocada e fica nítida em cascata, números contam até o valor, a pílula do menu desliza até o item atual, o cartão do Quadro voa até a coluna nova, diálogos crescem com mola sobre o fundo desfocado e o aviso sobe de baixo como uma pílula escura.

O sistema continua recusando o painel de TMS de categoria: menu azul-marinho, ícone de caminhão em quadrado colorido, mapa decorativo, cor sem significado.

**Key Characteristics:**
- Cor com significado fixo, sempre acompanhada de forma (nunca só cor), agora em cartões sólidos.
- Fundo quente em gradiente + painéis de vidro + menu escuro flutuante.
- Pílulas para tudo que se clica; cartões de 18px, painéis de 24px, diálogos de 26px.
- Uma família de texto (Outfit); Overpass Mono só para códigos e placas.
- Objetos do transporte desenhados como são: placa, conjunto engatado, marco de km, losango e círculo de advertência.
- Movimento de resposta e de entrada, curto, com mola, e sempre desligável por "reduzir movimento".
- Português do transporte em toda a interface.

## Colors

Uma rampa única de neutros puxada para o verde do asfalto, e cinco cores de sinal que valem exatamente o que valem na estrada.

### Primary
- **Noite** (#161818): a ação principal (`btn-primario`, pílula preta com texto branco, uma por tela; hover #2a2c2b), o menu lateral, a barra de salvar, o aviso rápido, a opção marcada e o foco (contorno de 2px).
- **Verde floresta** (#2c5a4d): normal, no prazo, habilitado. Cartão sólido do Quadro dentro do tempo, painel do anel de documentos conferidos, sinal "normal". Fundo claro #e1ebe4, tinta #1f4237.

### Secondary
- **Laranja** (#e38b3d): pendente, em cadastro, aguardando. Cartão sólido com texto tinta (#161818); losango no sinal e nas placas. Fundo claro #f8e7d4, tinta #7a3c0b.
- **Mostarda** (#e7c14b): vence em até 30 dias, perto do tempo-limite (âmbar). Sempre preenchimento com tinta escura (#2a2208 ou #574300) em cima; nunca cor de texto. Também é o destaque do aviso ("Desfazer"), do "Salvar" da barra e do anel de progresso. Fundo claro #f7edc8, filete #b8901a.
- **Ferrugem** (#b9381a): cancelado, vencido, bloqueado, erro, passou do tempo-limite, excesso de CMT, contagem de pendências no menu. Cartão sólido com texto branco; círculo vazado no sinal. Fundo claro #f6e1d9, tinta #8a2a12.

### Tertiary
- **Azul** (#2f5f8a): informação, arrendado, links. Fundo claro #e2eaf1, tinta #1d3f5e.
- **Azul da placa Mercosul** (#1a4fa0): exclusivo da faixa "BRASIL" da placa desenhada.

### Neutral
- **Fundo** (#e8e6de) com três gradientes radiais: pêssego #eddbce no canto superior esquerdo, creme #ece4cd no alto, sálvia #e3e8de no canto inferior direito; grão de ruído a 28% por cima (tira as faixas). Fixo na rolagem.
- **Vidro** (rgba(250,246,238,0.68), borda branca a 78%): blocos, colunas do Quadro, tabelas. Sem `backdrop-filter` nos painéis parados (o fundo atrás é liso; desfocar não muda nada e custa GPU).
- **Folha clara** (#fbf8f2): diálogos, menus suspensos, campos (#fff).
- **Círculo** (#f5f3eb): ícone dos indicadores, pílula do item atual do menu.
- **Creme elevado** (#f3eee4), **creme pisado** (#e7e0d3), **borda** (#e4ddd0), **filete** (#ebe5da), **meio-fio** (#cdc5b6).
- **Tinta** (#161818) para texto; **tinta apagada** (#55574f) e **tinta fraca** (#66675f) passam AA sobre o vidro.
- **Sinal neutro** (#8a8a82 marca, #3d3e39 texto).

### Named Rules
**A Regra do Significado Fixo.** Verde é normal; laranja é pendente; mostarda é vencendo ou perto do limite; ferrugem é bloqueado, vencido, passou do limite e erro; azul é informação; noite é a ação principal. Nenhuma dessas cores é usada para decorar, agrupar ou diferenciar categorias (no Quadro, a cor do cartão é o tempo-limite, nunca a coluna).

**A Regra Forma + Cor.** Toda situação tem forma própria além da cor: retângulo (normal), losango (pendente, vencendo), círculo vazado (bloqueado), quadrado (informação), ponto redondo cinza (neutro). Quem não distingue cor ainda lê a placa.

**A Regra do Amarelo com Tinta Escura.** O mostarda é sempre fundo ou preenchimento, com tinta escura por cima (branco sobre mostarda dá 1,7:1 e é proibido). Texto amarelo sobre claro não existe. O laranja também leva tinta escura; ferrugem e verde levam branco.

**A Regra da Exceção do Avatar.** O avatar de iniciais é a única cor fora dos sinais: tom pálido derivado do nome (fundo hsl(h 45% 90%), letra hsl(h 40% 28%)), só identidade, nunca situação.

## Typography

**Display Font:** Outfit (com Segoe UI, system-ui, sans-serif)
**Body Font:** Outfit
**Label/Mono Font:** Overpass Mono (com ui-monospace, Cascadia Mono, Consolas) — só para códigos e placas

**Character:** Outfit é uma sans geométrica de traço limpo, a mesma família de voz do template: títulos grandes em peso 500 com espaçamento apertado (−0,02em), números grandes em 600 tabulares. A Overpass Mono segue nas placas e documentos, que continuam com cara de coisa carimbada.

Escala atual (o resto da hierarquia abaixo vale com estes ajustes): título de tela 36px 500 (30px no celular), título de ficha 28px, título de diálogo 20px 600, cabeçalho de bloco 17px 500, número de cartão 40px 600 (32px no celular), indicador 24px 600, corpo 14px.

### Hierarchy
- **Display** (700, 64px, 64px, 0.02em): só o nome "NILT" na placa de entrada do login (44px a 900px, 34px no celular).
- **Headline** (600, 22px, 28px): título de tela de lista e do Início, um por tela.
- **Headline de ficha** (600, 20px, 28px): o nome do registro como último elo da migalha ("Motoristas / Cláudio Bertoli Neto"); o pai fica em 16px 500 cinza.
- **Título de diálogo** (600, 18px, 24px).
- **Title** (600, 16px, 24px): cabeçalho de bloco, rótulo de seção de formulário, cabeçalho de grupo.
- **KPI** (700, 28px, 32px, tabular): número dentro da placa de quilômetro da ficha. Contagens da placa de advertência usam 700 17px.
- **Body** (400, 14px, 20px): texto corrido, células de tabela, campos, botões (600).
- **Label** (500, 14px, 18px): rótulo de campo, acima do campo; aba (500, a selecionada 600).
- **Meta** (400, 13px, 18px): segunda linha de célula, explicações curtas, legendas de capacidade e de marco. É o tamanho secundário mais usado no build.
- **Small** (400, 12px, 16px): cabeçalho de tabela (cinza, caixa normal), ajuda e erro de campo, grupo do menu.
- **Sinal** (600, 12px): texto dentro dos sinais de situação.
- **Código** (Overpass Mono 400, 13px, tabular): CPF, CNPJ, RNTRC, Renavam, chassi.
- **Placa** (Overpass Mono 600, 15px, 0.06em; grande 24px, 0.08em): só dentro da placa desenhada.

### Named Rules
**A Regra de Uma Família.** Outfit em tudo, pesos 400, 500, 600 e 700. Nenhuma segunda família de texto.

**A Regra do Mono para Código.** Overpass Mono aparece só em identificadores (placa, CPF, CNPJ, RNTRC, Renavam, atalho de teclado). Nunca para números de quantidade, datas ou títulos.

**A Regra dos Números Alinhados.** Toda quantidade, data, contagem e peso usa algarismos tabulares; colunas numéricas encostam à direita.

**A Regra do Dinheiro sem Cor.** Valor em reais é tabular e à direita; saída leva o sinal tipográfico "−" (U+2212) na frente do "R$" ("−R$ 1.234,56"), nunca vermelho: cor é situação, e um mês com saída não está "bloqueado". Linha de soma em 600 com filete meio-fio acima.

**A Regra do Ponto com Ar.** O separador " · " da Overpass encosta na palavra seguinte; o build o envolve em `.ponto` com margem (0.32em / 0.42em). Todo texto com " · " passa por isso.

## Layout

**Shell.** Topo com marca, seções em pílulas e busca/usuário; trilho escuro fixo à esquerda (a página recua 92px para ele). Não há folha branca: a página fica direto sobre o fundo quente, com padding de 28px à direita e largura máxima de 1480px, e cada bloco é um painel de vidro.

**Grade interna.** 12 colunas com gap de 24px para blocos (`c3`…`c12`). Formulários em `.secao`: rótulo e explicação numa coluna de 260px à esquerda, campos numa grade de 12 colunas à direita (gap 16px vertical × 24px horizontal), larguras `f2`…`f12` conforme o tamanho real do dado. Seções separadas por filete, 24px acima e abaixo.

**Ritmo.** 24px entre blocos e abaixo do título; 16px entre barra de ferramentas e tabela; 8px entre campo e rótulo; 4px entre título e linha de apoio. Controles de 32px, campos de 38px, linhas de tabela de 48px, linha de marco de 52px.

**Padrões de tela.** Lista: título + linha cinza com o total e o achado, ações à direita (no máximo um secundário + a principal), abas por situação com contagem, barra de ferramentas, tabela sem caixa. Ficha: migalha + sinais de situação + ações; resumo em bloco; abas com `?aba=` na URL; formulário por aba com uma barra de salvar. Novo cadastro: começa pelo documento (CPF, CNPJ, placa) e confere duplicidade antes de pedir o resto.

**Responsivo.**
- **≤1100px:** o menu vira gaveta (até 300px ou 86vw) que desliza da esquerda sobre um véu de tinta 32%; aparece o botão de menu; a folha ocupa a largura com recuo de 8px dos dois lados; blocos da grade passam a largura total; seção de formulário empilha rótulo sobre campos; placas de advertência em 2 colunas; colunas de tabela secundárias viram segunda linha.
- **≤900px:** o login empilha a placa de entrada sobre o formulário.
- **≤640px:** padding e gap caem para 16px; título quebra e as ações ocupam a linha inteira; todo campo vai a largura total; colunas marcadas `some-celular` somem e o conteúdo vai para `.linha2`; o trilho do marco some e ficam só os dias; abas rolam na horizontal com máscara de esmaecimento à direita; alvos de toque sobem para 44px.

## Elevation & Depth

A profundidade vem de três camadas: o fundo quente atrás, os painéis de vidro no meio e os cartões sólidos na frente. Sombras são longas e suaves, puxadas para o marrom do fundo, nunca cinza-azuladas.

### Shadow Vocabulary
- **Painel** (`inset 0 1px 0 rgba(255,255,255,.6), 0 18px 40px -26px rgba(60,40,20,.28)`): blocos, colunas, tabelas, busca.
- **Cartão** (`0 10px 24px -14px rgba(22,24,24,.45)`): cartões sólidos, menu lateral, ícones de indicador. No hover sobe 2 a 3px e a sombra cresce.
- **Flutuante** (`0 28px 60px -18px rgba(22,24,24,.45)`): diálogo, aviso, barra de salvar, menus suspensos, gaveta do menu.
- **Véu do diálogo**: `rgba(40,32,24,.22)` com `backdrop-filter: blur(10px)` (a única superfície desfocada por trás).

### Named Rules
**A Regra do Desfoque Único.** Só o véu do diálogo desfoca o que está atrás. Painéis parados são translúcidos sem desfoque; nada de vidro sobre vidro. Com "reduzir transparência" (Chrome/Edge), os painéis ficam sólidos e o véu escurece sem desfocar.

## Shapes

Tudo que se clica é pílula (botão, aba, filtro, opção, sinal, busca, aviso, barra de salvar) ou círculo (botão só de ícone, avatar, ícone de indicador). Superfícies escalonam pelo tamanho: campo 12px, cartão 18px, painel 24px, diálogo 26px, menu lateral 28px. Bordas de 1px na interface (brancas a 78% nos painéis); 1.5px a 2px nos desenhos do mundo (placa, peças do conjunto), em tinta.

As formas de sinal continuam normativas: retângulo (normal), losango (pendente, vencendo), círculo vazado (bloqueado), quadrado (informação), ponto (neutro). Nos cartões sólidos a forma vai no canto, desenhada na cor do texto do cartão. O tracejado significa "ainda não existe" ou "zero": vaga de peça, estado vazio, cartão de pendência zerado.

## Components

### Buttons
Pílulas, sem ícone em caixa colorida.
- **Shape:** 999px, altura 36px (44px no `btn-grande` e no celular), padding 0 16px, texto 500 14px, ícone Lucide 16px traço 1.8.
- **Primário:** noite (#161818) com texto branco; um por tela; hover #2a2c2b.
- **Secundário:** vidro branco a 62% com borda de tinta a 14%; hover branco.
- **Texto:** sem fundo, texto tinta sublinhado leve (25%); hover fundo de tinta a 6%.
- **Perigo:** texto ferrugem tinta, borda ferrugem a 35%; hover ferrugem claro.
- **Desativado:** fundo tinta a 5%, texto tinta fraca, sem borda.
- **Retorno:** ao pressionar, `scale(0.96)` em 160ms ease-out. Hover só com ponteiro fino.
- **Dentro de cartão sólido:** secundário vira pílula branca a 90%; texto herda a cor do cartão.

### Sinais de situação
Pílula de 24px, texto 500 12px, com a forma da placa à esquerda (9px). Seis variantes: normal (retângulo verde), pendente (losango laranja), vencendo (losango amarelo com filete #c99700), bloqueado (círculo vermelho vazado), info (quadrado azul), neutro (ponto cinza). Gerado por `N.desenhar.sinal(situacao)`, que mapeia cada situação do banco (habilitado, cancelado, ag_motorista, arrendado, sinistro, vendido…) para uma das seis. Uma marca de situação por linha de tabela. A data de validade em linha usa a mesma lógica (`.val-vencendo`, `.val-vencido`, `.val-pendente`): a data só ganha forma e cor quando vence em até 30 dias ou já venceu.

### Placa do veículo
Desenho da placa física: 92×30px, contorno de tinta 1.5px, canto 4px, faixa "BRASIL" de 7px no azul Mercosul, letras em Overpass Mono 600 15px. Placa antiga (padrão cinza) detectada pelo formato: fundo #e8eaea, sem faixa, contorno #6b7270. Versão grande 150×46px para o cabeçalho da ficha do veículo. Gerada por `N.desenhar.placa(placa, grande)`; a placa é o título do objeto veículo.

### Painel do Início (o "Overview" do template)
Título "Início" com a frase do dia embaixo e, na mesma linha, os indicadores (círculo creme com ícone, número que conta, selo): viagens no quadro (selo ferrugem "N no vermelho" ou verde "tudo no prazo"), toneladas transportadas no mês e conjuntos rodando. Logo abaixo, a grade do template:
- **Toneladas transportadas** (o painel "Revenue"): número grande que conta, legenda, curva das toneladas por mês (peso de saída das viagens finalizadas) que se desenha ao aparecer e se transforma ao trocar 6/12 meses (seletor em pílula com fundo que desliza), linha tracejada da média do período, dica que segue o cursor e tabela escondida para leitor de tela. Nada de meta inventada: a referência é a média real.
- **Paradas há mais tempo** (os "Hot deals"): até seis cartões noite, vermelho primeiro, depois âmbar, cada grupo do mais antigo na coluna. No alto a coluna e a forma da situação num círculo; a rota em destaque; o tempo grande embaixo com número e placa; o avatar do motorista.
- **Documentos conferidos** (o "Team quota"): painel verde com o anel mostarda que cresce.
- **Situação das viagens** (a "Stage mix"): total que conta, barra de segmentos que crescem com mola (verde no prazo, mostarda perto do limite, ferrugem passou, noite finalizadas) e a lista com forma, nome, quantidade e porcentagem.

### Cartões de situação (Início)
Duas faixas de cinco cartões sólidos (Operação e Pendências), cada um levando à lista filtrada. O cartão tem a cor da situação (ferrugem + círculo para bloqueado/vencido, laranja + losango para pendente, mostarda + losango para atenção), o nome e a explicação no alto e o número grande (40px 600) embaixo, que conta até o valor ao aparecer. Zero vira cartão de vidro apagado com a forma tracejada. Hover sobe 3px. Os losangos e círculos desenhados de placa (40–44px) continuam no cabeçalho dos grupos em Pendências.

### Marco de quilômetro (vencimentos)
Linha de 52px: quem e o quê à esquerda, trilho de 8px no meio, dias à direita (600 16px + legenda). O trilho tem o comprimento exato dos dias restantes dentro da janela (90 dias por padrão): verde acima de 30 dias, amarelo até 30, e vencido vira um toco vermelho de 4px com "Vencido / venceu há N dias" em vermelho tinta. Gerado por `N.desenhar.marco(vencimento, janela)`. Na ficha do motorista, a **placa de km** destaca a validade da CNH e da gerenciadora: quadro de contorno 2px com o número em 700 28px; verde com filete branco quando normal, amarelo com contorno tinta quando vencendo, contorno vermelho quando vencido.

### Conjunto engatado
O conjunto é desenhado como o caminhão: peças lado a lado ligadas por um acoplamento de 18×2px em tinta. **Cavalo** em tinta com texto branco e canto dianteiro de 10px; **carreta** branca (mínimo 132px) com a capacidade em toneladas; **dolly** em acostamento com borda tracejada; **vaga** tracejada em meio-fio. Abaixo de cada peça, os eixos como rodas (círculos de 10px em tinta com anel branco) e a placa em mono 12px cinza. Versão grande (52px de altura) na ficha e no montador; caminhão-fantasma tracejado no montador vazio. Gerado por `N.desenhar.engate(cavalo, itens)`, com `role="img"` e rótulo com as placas.

### Capacidade
Trilho de 10px: preenchimento verde até o limite do CMT do cavalo; o que passa do CMT continua em vermelho além do fim. Legenda em 13px: "36,6 t de carga" e "limite 56,2 t", ou "passa X t do CMT" em vermelho tinta. Sem CMT informado, uma frase cinza no lugar do trilho. Gerado por `N.desenhar.capacidade(conjunto)`.

### Tabelas
Sobre um painel de vidro (24px) quando estão soltas na página; dentro de bloco, sem caixa própria. Cabeçalho 12px cinza, caixa normal, peso 400. Linhas de 52px separadas por filete, sem zebra. Identidade em 500 com `.linha2` cinza abaixo. Números à direita, tabulares. A linha inteira abre a ficha; hover branco a 60%.

### Abas e fichas
Abas como pílulas sobre um trilho de tinta a 6% (4px de folga): texto 500 14px cinza; a selecionada é pílula branca com sombra leve e texto tinta; contagem em cinza após o nome. A aba vive em `?aba=`. Ficha: migalha + sinais no topo, bloco de resumo em `kv`, depois abas com um formulário por aba.

### Inputs / Fields
- **Style:** rótulo acima (500 14px), campo de 42px, branco, borda de tinta a 12%, canto 12px, padding 0 12px; placeholder em tinta fraca; "(opcional)" em cinza 400 dentro do rótulo.
- **Hover:** borda meio-fio.
- **Focus:** borda tinta + halo `0 0 0 3px rgba(22,24,24,0.1)`, sem outline.
- **Erro:** borda vermelha e mensagem 12px vermelho tinta abaixo que diz o problema e a correção ("CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento."). Validação no blur; depois de inválido, revalida a cada tecla.
- **Válido:** borda verde (CPF, CNPJ, placa conferidos).
- **Somente leitura:** fundo acostamento, texto cinza, ajuda explicando quem pode mudar.
- **Máscaras:** CPF, CNPJ, telefone, CEP e placa formatam ao digitar.
- **Campo com ação:** botão colado à direita (consultar CNPJ, mostrar senha), cantos internos retos.
- **Opções:** escolhas curtas como pílulas brancas; a marcada é pílula noite com texto branco. Escolha com explicação (papel do usuário) vira cartão de opção com rádio verde. Liga/desliga é chave de 36×20px, verde quando ligada.
- **Busca e filtros da lista:** campo de 32px com lupa, select de 32px, total à direita ("8 motoristas"); segmento para janelas (30/60/90 dias) com o ativo em asfalto pisado.

### Navigation
Como no template: **topo** com a marca à esquerda (quadrado noite de 38px com a seta branca + "NILT"), as **seções em pílulas no centro** (Início, Quadro, Pedidos, Viagens, Clientes, Pendências) e, à direita, a busca global em pílula de vidro e o avatar do usuário (anel branco; nome e papel no rótulo). O item atual é uma **pílula noite com texto branco que desliza** de uma seção para a outra (Motion, `layoutId`, mola 420/36). A contagem de pendências é uma pílula ferrugem dentro de "Pendências".

À esquerda, o **trilho escuro** (pílula noite de 54px, centrado na altura, fixo): só ícones de 18px em círculos de 40px para Motoristas, Proprietários, Veículos, Conjuntos, Usuários e Auditoria (admin), e no pé Trocar senha e Sair. O nome aparece como dica (pílula noite à direita) no hover e no foco. Item atual: círculo creme com ícone tinta.

Abaixo de 1100px as seções somem do topo e o trilho vira a **gaveta** (até 290px, canto 28px) com tudo e com os nomes, aberta pelo botão de menu.

### Barra de salvar
Pílula noite (999px, sombra flutuante) que gruda 8px acima do fim da janela e só aparece quando algo foi alterado. "Descartar" como texto branco a 80%; "Salvar" como pílula mostarda com tinta escura. Se há campo inválido, não salva: avisa e põe o foco no primeiro campo marcado.

### Diálogos
`<dialog>` nativo, até 520px, canto 26px, fundo #fbf8f2, sombra flutuante. O véu escurece pouco (marrom a 22%) e desfoca a página (10px). Abre crescendo de 0.94 com mola (340ms, `cubic-bezier(0.34, 1.36, 0.64, 1)`); o véu entra em 220ms. Cabeçalho 20px 600, pé com ações à direita.

### Toasts
Pílula noite embaixo, no centro, com uma bolinha verde (ou ferrugem no erro) e o ícone branco à esquerda. Sobe de 28px com mola (Motion), no máximo dois empilhados, fica 3,2s (6s quando tem botão). Pode levar uma ação em pílula mostarda ("Desfazer"): só ofereça quando desfazer é uma operação simples que o banco aceita sem pedir dados (no Quadro, voltar de coluna exige motivo, então não há Desfazer).

### Quadro da operação
Colunas de vidro (286px, canto 24px; as de espera estreitam para 60px com o rótulo em pé) com ponto noite, nome e contador em pílula. O cartão segue a anatomia dos cartões de negócio do template: no alto o tempo na coluna (com a forma do sinal quando âmbar ou vermelho) e o botão "…" redondo (Mover); a rota grande; cliente e motorista; os sinais; embaixo o número da viagem grande (abre a página da viagem), a placa e o avatar do motorista. O cartão é sólido na cor do tempo-limite (verde no prazo, mostarda no âmbar, ferrugem no vermelho), com transição de cor de 450ms.

Ao trocar de coluna (arrastando, pelo "Mover" ou pelo tempo real), o cartão voa até a nova posição e os vizinhos se reacomodam (Motion, `layoutId` por viagem). Arrastando, a origem fica apagada e menor, as colunas permitidas ganham contorno tracejado, a coluna sob o ponteiro ganha contorno tinta e sobe 2px, e as proibidas apagam.

**Ficha rápida:** clicar no cartão (fora do número e dos botões) faz o cartão **crescer e virar a ficha** (mesma `layoutId`, mola 300/32) sobre o véu desfocado: desde quando está na coluna, a rota, cliente e motorista, o tempo grande, a situação, a barra das seis etapas (Trânsito, Carregamento, NF e pagamento, Em rota, Descarga, Finalizado) que avança com mola, coluna/placa/cliente, os sinais e as saídas "Abrir a viagem" (pílula vazada) e "Mover" (pílula branca; leva ao menu de destinos com as regras do banco). Esc ou clique fora fecha.

Acima do quadro, na linha do título, indicadores que contam: viagens na tela, perto do tempo-limite (losango mostarda) e passaram do tempo-limite (círculo ferrugem).

### Avisos e estados
- **Aviso em bloco:** faixa com canto 8px no fundo claro da cor do sinal e texto na tinta correspondente, ícone 18px, frase que explica a regra (arrendado sem contrato, CPF de proprietário diferente na ANTT).
- **Vazio:** mantém o quadro e uma frase, numa caixa tracejada meio-fio de 44px, com ação de texto opcional à direita.
- **Zero e ausente:** zero é "0"; ausente é "—" em tinta fraca.
- **Carregando:** barras de 12px em filete no lugar do conteúdo; no login, ícone girando 900ms linear dentro do botão.
- **Erro de consulta:** dentro do bloco, com "Tentar de novo".

### Avatar
Círculo de 28px (24px a 40px conforme o contexto) com até duas iniciais em 600 12px, tom pálido derivado do nome (ver A Regra da Exceção do Avatar). Usuário sem nome: avatar vazio tracejado. Gerado por `N.desenhar.avatar(nome)`.

### Placa de entrada (login)
A tela de login, sem shell, mostra uma placa de orientação verde (canto 16px, filete branco de 3px a 14px da borda) com o sinal do NILT, o nome em display e três destinos com setas de direção ("Motoristas e proprietários", "Veículos e conjuntos", "Documentos e vencimentos") em 600 22px, como numa placa de saída; o formulário fica numa folha branca ao lado.

### Movimento
Curto, com mola, e com significado. Biblioteca: Motion (`motion/react`), com `<MotionConfig reducedMotion="user">` no shell.
- Entrada da página: cada bloco do `<main>` vem de `translateY(10px)` + `blur(6px)` para nítido em 420ms ease-out, em cascata de 50ms (blocos da grade, 50ms a mais). Só no que monta: recargas do tempo real não repetem.
- Números: contam até o valor com mola (`<Numero>`), ao aparecer e a cada mudança.
- Pílula do menu: desliza entre itens (mola 420/36).
- Cartão do Quadro: voa até a coluna nova (mola 380/34); cor em 450ms.
- Anel de progresso: cresce em 1,1s ease-out.
- Clique em botão: `scale(0.96)`, 160ms. Hover de cor: 150ms. Hover de cartão: sobe 2–3px em 220ms.
- Diálogo: mola 340ms; véu 220ms. Aviso: mola 420/30. Gaveta do menu: 300ms ease-out.
- `prefers-reduced-motion: reduce` zera transições e animações do CSS e o Motion tira deslocamento e layout; os números aparecem sem contar.

## Do's and Don'ts

### Do:
- **Do** use cada cor só para o seu significado: verde normal, laranja pendente, mostarda vencendo/perto do limite, ferrugem bloqueado/vencido/erro, azul informação, noite ação principal.
- **Do** dê sempre forma junto com a cor, inclusive nos cartões sólidos (forma no canto).
- **Do** ponha tinta escura sobre mostarda e laranja; branco sobre verde e ferrugem.
- **Do** mantenha uma ação principal (pílula noite) por tela.
- **Do** use painéis de vidro para agrupar e cartões sólidos só para o que tem situação.
- **Do** use `<Numero>` para contagens que o olho acompanha (indicadores, cartões de situação).
- **Do** desenhe os objetos do transporte com os componentes (`<Placa>`, `<Sinal>`, `<Engate>`, `<Capacidade>`, `<MarcoKm>`, `<Avatar>`).
- **Do** escreva placa, CPF, CNPJ, RNTRC e Renavam em Overpass Mono; todo número em algarismos tabulares.
- **Do** ponha o rótulo acima do campo e escreva erros que dizem o problema e a correção.
- **Do** respeite `prefers-reduced-motion` e `prefers-reduced-transparency`.

### Don't:
- **Don't** use cor sem significado (exceção: o tom pálido do avatar e o fundo quente).
- **Don't** colora cartão ou coluna por etapa ou categoria.
- **Don't** empilhe vidro sobre vidro nem ponha `backdrop-filter` em painel parado.
- **Don't** ponha branco sobre mostarda ou texto amarelo sobre claro.
- **Don't** ponha ícone dentro de quadrado colorido (o ícone vai em círculo creme).
- **Don't** anime algo que se repete a cada recarga do tempo real (só o que monta ou muda de valor).
- **Don't** ofereça "Desfazer" quando a volta pede dados ou motivo ao banco.
- **Don't** escreva cabeçalho de tabela em caixa alta nem use listras zebradas.
- **Don't** use emoji; ícones são Lucide, um conjunto só.
- **Don't** use uma segunda família de texto nem Overpass Mono fora de códigos.
- **Don't** faça o painel de TMS de categoria: menu azul-marinho, ícone de caminhão em caixa colorida, mapa decorativo.

## Conversão para Next.js e Tailwind

O protótipo foi escrito para virar Next.js (App Router) + Tailwind; os nomes acima são os nomes de destino.

- **Tokens → `@theme` (Tailwind v4) em `app/globals.css`.** Cores como `--color-<nome>` (`--color-verde: #2c5a4d`, `--color-laranja-claro: #f8e7d4`, `--color-ink: #161818`…), gerando `bg-verde`, `text-verde-tinta`, `border-border`. Raios como `--radius-chip/control/card/toast/dialogo/sheet`. Fontes via `next/font/google` (Outfit 400–700, Overpass Mono 400–600) expostas como `--font-sans` e `--font-mono`. Tamanhos como `--text-headline: 22px` com `--text-headline--line-height: 28px`, idem `title`, `body`, `meta`, `small`. Medidas do shell (`sidebar`, `topbar`, `sheet-inset`, `control-h`, `field-h`, `row-h`) como `--spacing-*`. Easings como `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` e `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`. Breakpoints: `--breakpoint-celular: 640px`, `--breakpoint-tablet: 1100px` (usar `max-*` para replicar o build, que é desktop primeiro).
- **Valores literais que viram token.** `#c99700` → `amarelo-borda`, `#e7b3bb` → `perigo-borda`, `#8a928d` → `neutro-marca`, `#383f3b` → `neutro-tinta`; as sombras temporárias → `--shadow-menu`, `--shadow-barra`, `--shadow-toast`, `--shadow-dialogo`.
- **Shell.** `montarShell()` → `app/(app)/layout.tsx` (Sidebar, Topbar com BuscaGlobal, Folha); o login → `app/(auth)/login/page.tsx`, sem shell.
- **Desenhos → componentes React.** `desenhar.placa` → `<Placa placa grande?>`; `sinal` → `<Sinal situacao>` com o mapa de situações do banco; `engate` → `<ConjuntoEngatado cavalo itens>`; `capacidade` → `<Capacidade conjunto>`; `marco` → `<MarcoKm vencimento janela>`; `avatar` → `<Avatar nome>`. Placas de advertência → `<PlacaAdvertencia forma n>`.
- **Comportamento.** `?aba=` → segmento de rota da ficha; `form[data-salvar]` + barra → um hook de formulário sujo com `<BarraSalvar>`; `data-mascara` / `data-valida` → máscaras e validadores em `lib/` (espelhando as funções do banco); `N.fmt.*` → `lib/formato.ts`; `dados.js` → consultas ao Supabase com os mesmos nomes de campo.
- **Ao converter, mantenha** as regras de significado fixo, forma + cor, desfoque único e uma família. Utilitários Tailwind não substituem os componentes do mundo: uma placa é sempre `<Placa>`, nunca um `div` com classes soltas.
