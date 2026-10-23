---
name: NILT
description: Núcleo Integrado de Logística e Transporte — o sistema da Prisa sinalizado como uma rodovia brasileira.
colors:
  frame: "#eef1ef"
  sheet: "#ffffff"
  raised: "#f5f7f6"
  active: "#e2e7e4"
  border: "#e1e5e2"
  rule: "#edf0ee"
  control: "#c5ccc7"
  ink: "#1e2327"
  muted: "#535b57"
  faint: "#656c68"
  verde: "#0b6b3a"
  verde-forte: "#08552e"
  verde-claro: "#e3f1e8"
  verde-tinta: "#0a4426"
  laranja: "#d9580d"
  laranja-claro: "#fdebdd"
  laranja-tinta: "#873505"
  amarelo: "#f2b705"
  amarelo-claro: "#fdf3cb"
  amarelo-tinta: "#5c4500"
  amarelo-borda: "#c99700"
  vermelho: "#c8102e"
  vermelho-claro: "#fbe3e6"
  vermelho-tinta: "#8a0b1f"
  perigo-borda: "#e7b3bb"
  azul: "#1f5fa8"
  azul-claro: "#e3edf8"
  azul-tinta: "#163f73"
  placa-azul: "#1a4fa0"
  neutro-marca: "#8a928d"
  neutro-tinta: "#383f3b"
typography:
  display:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: "64px"
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  headline-ficha:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  title-dialogo:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  title:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  kpi:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
  meta:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  small:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  sinal:
    fontFamily: "Overpass, Segoe UI, system-ui, sans-serif"
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
  chip: "4px"
  control: "6px"
  card: "8px"
  toast: "10px"
  dialogo: "14px"
  sheet: "16px"
  pill: "9px"
  round: "50%"
spacing:
  sheet-inset: "8px"
  campo-gap: "16px"
  gap: "24px"
  pad: "24px"
  pad-celular: "16px"
  bloco-x: "20px"
  sidebar: "228px"
  topbar: "48px"
  control-h: "32px"
  field-h: "38px"
  row-h: "48px"
  toque: "44px"
components:
  button-primary:
    backgroundColor: "{colors.verde}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-h}"
  button-primary-hover:
    backgroundColor: "{colors.verde-forte}"
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

**Creative North Star: "A rodovia sinalizada"**

O NILT é sinalizado como uma rodovia brasileira. Cada situação de cadastro tem a cor e a forma da placa que a equipe da Prisa já obedece na estrada: retângulo verde de orientação para o que está normal, losango laranja de obras para o que está pendente, losango amarelo de advertência para o que vence, círculo vermelho de regulamentação para o que está bloqueado ou vencido, quadrado azul de serviços para informação. A navegação é placa de orientação (o item atual é uma placa verde com filete branco por dentro), a placa do veículo aparece desenhada como a placa física, o vencimento é um marco de quilômetro com barra no comprimento exato dos dias restantes, e o conjunto é desenhado engatado na ordem física (cavalo, carreta, dolly, carreta).

A estrutura é uma moldura em L tingida de asfalto claro (menu à esquerda e barra superior) com o trabalho numa folha branca recuada 8px, de raio 16, borda de 1px e sem sombra. A densidade é de sistema de operação: corpo de 14px, linhas de tabela de 48px, formulários em grade estrita de 12 colunas, fichas com abas como a equipe já conhece do ATUA. Tudo é plano e quieto; a cor só aparece quando carrega significado, e por isso uma tela calma tem pouca cor e uma tela com problema mostra o problema de longe.

O sistema recusa o painel de TMS de categoria: menu azul-marinho, cartões de KPI com ícone de caminhão, mapa decorativo, gradientes, sombra em coisa parada.

**Key Characteristics:**
- Cor com significado fixo, sempre acompanhada de forma (nunca só cor).
- Moldura em L de asfalto claro + folha branca recuada, plana, sem sombra.
- Uma família tipográfica (Overpass); Overpass Mono só para códigos.
- Objetos do transporte desenhados como são: placa, conjunto engatado, marco de km, placas de advertência.
- Movimento só como resposta: nada entra animado.
- Português do transporte em toda a interface.

## Colors

Uma rampa única de neutros puxada para o verde do asfalto, e cinco cores de sinal que valem exatamente o que valem na estrada.

### Primary
- **Verde placa de orientação** (#0b6b3a): normal, habilitado, ativo; e a ação principal (`btn-primario`, uma por tela), o item atual do menu, o foco, a aba selecionada, o cursor de texto, a capacidade dentro do CMT. Hover da ação principal em **Verde fundo de placa** (#08552e). Fundo de sinal e de opção marcada em **Verde claro** (#e3f1e8) com texto em **Verde tinta** (#0a4426).

### Secondary
- **Laranja de obras** (#d9580d): pendente, em cadastro, aguardando motorista. Aparece como losango (sinal, placa de advertência da tela Início). Fundo claro #fdebdd, tinta #873505.
- **Amarelo de advertência** (#f2b705): vence em até 30 dias. Só como preenchimento (losango, barra do marco, placa de km) com tinta escura em cima; nunca como cor de texto. Fundo claro #fdf3cb, tinta #5c4500, filete do losango pequeno #c99700.
- **Vermelho de regulamentação** (#c8102e): cancelado, vencido, bloqueado, erro, excesso de CMT, contagem de pendências no menu. Aparece como círculo vazado. Fundo claro #fbe3e6, tinta #8a0b1f, borda do botão de perigo #e7b3bb.

### Tertiary
- **Azul de serviços** (#1f5fa8): informação, arrendado, links e botões de texto. Fundo claro #e3edf8, tinta #163f73.
- **Azul da placa Mercosul** (#1a4fa0): exclusivo da faixa "BRASIL" da placa desenhada. Não é cor de interface.

### Neutral
- **Asfalto claro** (#eef1ef): a moldura em L (fundo do body, menu, barra superior).
- **Folha** (#ffffff): a folha de trabalho, blocos, campos, diálogos.
- **Acostamento** (#f5f7f6): hover de linha e de botão, campo somente leitura, botão desativado, prévia do conjunto.
- **Asfalto pisado** (#e2e7e4): estado pressionado/selecionado (segmento ativo, linha marcada no montador), fundo do sinal neutro.
- **Borda** (#e1e5e2): borda da folha, dos blocos e dos campos.
- **Filete** (#edf0ee): divisórias internas (linhas de tabela, seções de formulário, trilho vazio do marco).
- **Meio-fio** (#c5ccc7): borda de controle (botão secundário, select da barra de ferramentas, segmento), borda tracejada de estado vazio, barra de rolagem.
- **Tinta** (#1e2327): texto, contorno da placa e das peças do conjunto, barra de salvar, toast.
- **Tinta apagada** (#535b57) para texto secundário e **Tinta fraca** (#656c68) para placeholder, travessão de ausente e desativado; ambas passam AA sobre a folha.
- **Sinal neutro** (#8a928d marca, #383f3b texto): sem consulta, parado, vendido, devolvido.

### Named Rules
**A Regra do Significado Fixo.** Verde é normal e ação principal; laranja é pendente; amarelo é vencendo; vermelho é bloqueado, vencido e erro; azul é informação. Nenhuma dessas cores é usada para decorar, agrupar ou diferenciar categorias.

**A Regra Forma + Cor.** Toda situação tem forma própria além da cor: retângulo (normal), losango (pendente, vencendo), círculo vazado (bloqueado), quadrado (informação), ponto redondo cinza (neutro). Quem não distingue cor ainda lê a placa.

**A Regra do Amarelo com Tinta Escura.** O amarelo de advertência é sempre fundo ou preenchimento, com tinta #1e2327 ou #5c4500 por cima. Texto amarelo sobre branco não existe.

**A Regra da Exceção do Avatar.** O avatar de iniciais é a única cor fora dos sinais: tom pálido derivado do nome (fundo hsl(h 45% 90%), letra hsl(h 40% 28%)), só identidade, nunca situação.

## Typography

**Display Font:** Overpass (com Segoe UI, system-ui, sans-serif)
**Body Font:** Overpass
**Label/Mono Font:** Overpass Mono (com ui-monospace, Cascadia Mono, Consolas) — só para códigos

**Character:** Overpass descende da Highway Gothic das placas norte-americanas: é a letra de sinalização em tom de sistema, legível de longe e calma de perto. A versão mono dá às placas e aos documentos a cara de coisa carimbada.

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
**A Regra de Uma Família.** Overpass em tudo, pesos 400, 500, 600 e 700. Nenhuma segunda família de texto.

**A Regra do Mono para Código.** Overpass Mono aparece só em identificadores (placa, CPF, CNPJ, RNTRC, Renavam, atalho de teclado). Nunca para números de quantidade, datas ou títulos.

**A Regra dos Números Alinhados.** Toda quantidade, data, contagem e peso usa algarismos tabulares; colunas numéricas encostam à direita.

**A Regra do Ponto com Ar.** O separador " · " da Overpass encosta na palavra seguinte; o build o envolve em `.ponto` com margem (0.32em / 0.42em). Todo texto com " · " passa por isso.

## Layout

**Shell.** Grade de duas colunas: menu de 228px + folha fluida; duas linhas: barra superior de 48px + conteúdo. O menu é fixo na altura da janela (sticky). A barra superior leva a busca global centralizada (até 548px, atalho "/") e o selo "Dados fictícios" à direita. A folha encosta no menu e na barra, recuada 8px da direita e de baixo; por dentro, padding de 24px e largura máxima de 1440px.

**Grade interna.** 12 colunas com gap de 24px para blocos (`c3`…`c12`). Formulários em `.secao`: rótulo e explicação numa coluna de 260px à esquerda, campos numa grade de 12 colunas à direita (gap 16px vertical × 24px horizontal), larguras `f2`…`f12` conforme o tamanho real do dado. Seções separadas por filete, 24px acima e abaixo.

**Ritmo.** 24px entre blocos e abaixo do título; 16px entre barra de ferramentas e tabela; 8px entre campo e rótulo; 4px entre título e linha de apoio. Controles de 32px, campos de 38px, linhas de tabela de 48px, linha de marco de 52px.

**Padrões de tela.** Lista: título + linha cinza com o total e o achado, ações à direita (no máximo um secundário + a principal), abas por situação com contagem, barra de ferramentas, tabela sem caixa. Ficha: migalha + sinais de situação + ações; resumo em bloco; abas com `?aba=` na URL; formulário por aba com uma barra de salvar. Novo cadastro: começa pelo documento (CPF, CNPJ, placa) e confere duplicidade antes de pedir o resto.

**Responsivo.**
- **≤1100px:** o menu vira gaveta (até 300px ou 86vw) que desliza da esquerda sobre um véu de tinta 32%; aparece o botão de menu; a folha ocupa a largura com recuo de 8px dos dois lados; blocos da grade passam a largura total; seção de formulário empilha rótulo sobre campos; placas de advertência em 2 colunas; colunas de tabela secundárias viram segunda linha.
- **≤900px:** o login empilha a placa de entrada sobre o formulário.
- **≤640px:** padding e gap caem para 16px; título quebra e as ações ocupam a linha inteira; todo campo vai a largura total; colunas marcadas `some-celular` somem e o conteúdo vai para `.linha2`; o trilho do marco some e ficam só os dias; abas rolam na horizontal com máscara de esmaecimento à direita; alvos de toque sobem para 44px.

## Elevation & Depth

O sistema é plano. A profundidade vem da tonalidade (moldura de asfalto atrás, folha branca na frente) e de bordas de 1px; nada que está parado tem sombra. Sombra só existe em superfícies temporárias que flutuam sobre o trabalho e somem.

### Shadow Vocabulary
- **Menu suspenso** (`box-shadow: 0 0 0 1px rgba(30,35,39,0.09), 0 12px 32px rgba(30,35,39,0.12)`): resultados da busca global, menu "Novo cadastro".
- **Barra de salvar** (`box-shadow: 0 6px 18px rgba(30,35,39,0.16)`): só enquanto há alteração não salva; no montador de conjunto, a versão leve `0 4px 12px rgba(30,35,39,0.07)`.
- **Toast** (`box-shadow: 0 10px 30px rgba(30,35,39,0.25)`).
- **Diálogo** (`box-shadow: 0 0 0 1px rgba(30,35,39,0.08), 0 24px 60px rgba(30,35,39,0.22)`), com véu `rgba(30,35,39,0.32)`.
- **Gaveta do menu** (véu `0 0 0 100vmax rgba(30,35,39,0.32)`), só abaixo de 1100px.

Filetes internos feitos com `box-shadow: inset` (borda branca dentro da placa verde da marca, da placa de km normal; anel branco em volta dos eixos) são desenho de placa, não elevação.

### Named Rules
**A Regra do Plano em Repouso.** Folha, blocos, tabelas, campos e sinais não têm sombra. Se a superfície não vai sumir sozinha, ela não flutua.

## Shapes

Cantos suavemente arredondados e escalonados pelo tamanho: sinal e placa 4px, botão e controle 6px, bloco e campo 8px, barra de salvar, toast e menu suspenso 10px, diálogo 14px, folha 16px. Contagem do menu é pílula (9px), avatar é círculo. Bordas de 1px na interface; 1.5px a 2px nos desenhos do mundo (placa, peças do conjunto, placa de km), em tinta, como contorno de placa real.

As formas de sinal são normativas: retângulo de canto 2px, losango (quadrado girado 45°, canto 1px no sinal, 5px na placa de advertência), círculo vazado de traço 2px (sinal) ou 5px (placa de advertência). O tracejado significa "ainda não existe": vaga de peça no conjunto, estado vazio, dolly, caminhão-fantasma do montador vazio.

## Components

### Buttons
Firmes e baixos, sem ícone em caixa colorida.
- **Shape:** canto de controle (6px), altura 32px (38px no `btn-grande`, 44px no celular e no login), padding 0 14px, texto 600 14px, ícone Lucide 16px traço 1.8.
- **Primário:** verde placa com texto branco; um por tela; hover em verde fundo de placa.
- **Secundário:** folha com borda meio-fio e texto tinta; hover acostamento.
- **Texto:** sem borda nem fundo, texto azul de serviços, padding 0 8px; hover em azul claro.
- **Perigo:** folha, texto vermelho tinta, borda #e7b3bb; hover vermelho claro.
- **Desativado:** acostamento, texto tinta fraca, borda padrão, cursor proibido; opacidade 1 (o botão não fica translúcido).
- **Retorno:** ao pressionar, `scale(0.97)` em 160ms ease-out. Hover só em dispositivos com ponteiro fino.

### Sinais de situação
Chip de 22px, canto 4px, texto 600 12px, com a forma da placa à esquerda (9px). Seis variantes: normal (retângulo verde), pendente (losango laranja), vencendo (losango amarelo com filete #c99700), bloqueado (círculo vermelho vazado), info (quadrado azul), neutro (ponto cinza). Gerado por `N.desenhar.sinal(situacao)`, que mapeia cada situação do banco (habilitado, cancelado, ag_motorista, arrendado, sinistro, vendido…) para uma das seis. Uma marca de situação por linha de tabela. A data de validade em linha usa a mesma lógica (`.val-vencendo`, `.val-vencido`, `.val-pendente`): a data só ganha forma e cor quando vence em até 30 dias ou já venceu.

### Placa do veículo
Desenho da placa física: 92×30px, contorno de tinta 1.5px, canto 4px, faixa "BRASIL" de 7px no azul Mercosul, letras em Overpass Mono 600 15px. Placa antiga (padrão cinza) detectada pelo formato: fundo #e8eaea, sem faixa, contorno #6b7270. Versão grande 150×46px para o cabeçalho da ficha do veículo. Gerada por `N.desenhar.placa(placa, grande)`; a placa é o título do objeto veículo.

### Placas de advertência (Início)
Faixa de cinco placas, uma por tipo de pendência, cada uma levando à lista filtrada. **Losango** 40px girado 45°, preenchido de laranja (pendente) ou amarelo (vencendo), com contorno duplo tinta + cor e a contagem em 700 17px tinta. **Círculo proibido** 44px, aro vermelho de 5px sobre branco, para documentos vencidos e conjunto acima do CMT. Contagem zero vira forma vazia em cinza com "nada pendente". Divisórias de filete entre placas; hover acostamento.

### Marco de quilômetro (vencimentos)
Linha de 52px: quem e o quê à esquerda, trilho de 8px no meio, dias à direita (600 16px + legenda). O trilho tem o comprimento exato dos dias restantes dentro da janela (90 dias por padrão): verde acima de 30 dias, amarelo até 30, e vencido vira um toco vermelho de 4px com "Vencido / venceu há N dias" em vermelho tinta. Gerado por `N.desenhar.marco(vencimento, janela)`. Na ficha do motorista, a **placa de km** destaca a validade da CNH e da gerenciadora: quadro de contorno 2px com o número em 700 28px; verde com filete branco quando normal, amarelo com contorno tinta quando vencendo, contorno vermelho quando vencido.

### Conjunto engatado
O conjunto é desenhado como o caminhão: peças lado a lado ligadas por um acoplamento de 18×2px em tinta. **Cavalo** em tinta com texto branco e canto dianteiro de 10px; **carreta** branca (mínimo 132px) com a capacidade em toneladas; **dolly** em acostamento com borda tracejada; **vaga** tracejada em meio-fio. Abaixo de cada peça, os eixos como rodas (círculos de 10px em tinta com anel branco) e a placa em mono 12px cinza. Versão grande (52px de altura) na ficha e no montador; caminhão-fantasma tracejado no montador vazio. Gerado por `N.desenhar.engate(cavalo, itens)`, com `role="img"` e rótulo com as placas.

### Capacidade
Trilho de 10px: preenchimento verde até o limite do CMT do cavalo; o que passa do CMT continua em vermelho além do fim. Legenda em 13px: "36,6 t de carga" e "limite 56,2 t", ou "passa X t do CMT" em vermelho tinta. Sem CMT informado, uma frase cinza no lugar do trilho. Gerado por `N.desenhar.capacidade(conjunto)`.

### Tabelas
Sem caixa em volta. Cabeçalho 12px cinza, caixa normal, peso 400, 36px. Linhas de 48px separadas por filete, sem zebra; primeira e última coluna sem padding lateral. Identidade na coluna mais larga, em 600, com `.linha2` de 13px cinza abaixo. Números `num` à direita, tabulares. A linha inteira abre a ficha (`tr[data-href]`, focável, Enter abre); hover acostamento em 120ms.

### Abas e fichas
Abas como texto 14px 500 cinza com 24px de espaço, a selecionada em tinta 600 com sublinhado verde de 2px que passa 4px de cada lado; contagem em cinza após o nome ("Contatos 2"). Filete de 1px sob a fileira. A aba vive em `?aba=` (vira segmento de rota). Ficha: migalha + sinais no topo, bloco de resumo em `kv` (chave cinza → valor), depois abas com um formulário por aba.

### Inputs / Fields
- **Style:** rótulo acima (500 14px), campo de 38px, folha, borda #e1e5e2, canto 8px, padding 0 12px; placeholder em tinta fraca; "(opcional)" em cinza 400 dentro do rótulo.
- **Hover:** borda meio-fio.
- **Focus:** borda verde + halo `0 0 0 3px rgba(11,107,58,0.16)`, sem outline.
- **Erro:** borda vermelha e mensagem 12px vermelho tinta abaixo que diz o problema e a correção ("CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento."). Validação no blur; depois de inválido, revalida a cada tecla.
- **Válido:** borda verde (CPF, CNPJ, placa conferidos).
- **Somente leitura:** fundo acostamento, texto cinza, ajuda explicando quem pode mudar.
- **Máscaras:** CPF, CNPJ, telefone, CEP e placa formatam ao digitar.
- **Campo com ação:** botão colado à direita (consultar CNPJ, mostrar senha), cantos internos retos.
- **Opções:** escolhas curtas como botões de 38px; marcada em verde claro com borda verde e texto verde tinta 600. Escolha com explicação (papel do usuário) vira cartão de opção com rádio verde. Liga/desliga é chave de 36×20px, verde quando ligada.
- **Busca e filtros da lista:** campo de 32px com lupa, select de 32px, total à direita ("8 motoristas"); segmento para janelas (30/60/90 dias) com o ativo em asfalto pisado.

### Navigation
Menu em placa de orientação sobre a moldura: marca (placa verde 34×26px com filete branco e seta para cima + "NILT / Prisa Logística"), itens de 32px com ícone Lucide 16px cinza, texto 14px tinta, canto 8px, hover tinta a 5%. Item atual é placa verde: fundo verde, texto branco 600, canto 6px e filete branco de 1px por dentro (outline −3px). Grupo "Administração" como rótulo 12px cinza. Contagem de pendências como pílula vermelha; no item atual ela inverte para branco com número vermelho. Usuário e "Sair" no pé. Abaixo de 1100px, gaveta.

### Barra de salvar
Um modelo de salvar por tela. A barra escura (tinta, texto branco, canto 10px) gruda 8px acima do fim da janela e só aparece quando algo foi alterado. "Descartar" como botão de texto verde-pálido (#cfe8d9); "Salvar" como botão branco com texto verde tinta. Se há campo inválido, não salva: avisa por toast e põe o foco no primeiro campo marcado.

### Diálogos
`<dialog>` nativo, até 520px (100vw − 32px no celular), canto 14px, véu de tinta 32%. Cabeçalho 18px 600, corpo com 16px entre itens, pé com ações à direita. Abre com fade + `scale(0.97 → 1)` em 200ms ease-out.

### Toasts
Canto inferior direito (24px), tinta com texto branco, canto 10px, ícone 16px verde-pálido (#8fd3ab). Entram de 12px abaixo em 300ms ease-out, ficam 3,2s e saem descendo 8px. Usados para confirmação ("Alterações salvas") e para o motivo de uma ação recusada.

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
Curto e de resposta; nada entra animado ao carregar.
- Clique em botão: `scale(0.97)`, 160ms, ease-out forte `cubic-bezier(0.23, 1, 0.32, 1)`.
- Hover de cor (botão, menu, linha, aba, opção): 120–150ms ease.
- Menu suspenso: opacidade + transform, 150ms ease-out.
- Diálogo: 200ms ease-out. Barra de salvar: 200ms ease-out. Chave liga/desliga: 160ms ease-out.
- Toast: 300ms ease-out na entrada e na saída.
- Gaveta do menu: 260ms ease-out.
- `prefers-reduced-motion: reduce` zera transições e animações (o giro do login para).

## Do's and Don'ts

### Do:
- **Do** use cada cor de sinal só para o seu significado: verde normal e ação principal, laranja pendente, amarelo vencendo (até 30 dias), vermelho bloqueado/vencido/erro, azul informação.
- **Do** dê sempre forma junto com a cor: retângulo, losango, círculo vazado, quadrado, ponto.
- **Do** use o amarelo só como preenchimento, com tinta escura por cima.
- **Do** mantenha uma ação principal verde por tela; o resto é secundário ou texto.
- **Do** desenhe os objetos do transporte com os helpers (`N.desenhar.placa`, `sinal`, `engate`, `capacidade`, `marco`, `avatar`) em vez de recriá-los.
- **Do** escreva placa, CPF, CNPJ, RNTRC e Renavam em Overpass Mono; todo número em algarismos tabulares, alinhado à direita em tabela.
- **Do** ponha o rótulo acima do campo, marque o opcional e escreva erros que dizem o problema e a correção.
- **Do** mostre a pendência onde se trabalha: sinal na linha, aviso no bloco, placa de advertência no Início.
- **Do** mantenha o quadro no estado vazio, com uma frase; zero é "0", ausente é "—".
- **Do** use 44px de alvo de toque abaixo de 640px.
- **Do** respeite `prefers-reduced-motion`.

### Don't:
- **Don't** use cor fora do significado fixo (exceção única: o tom pálido do avatar, só identidade).
- **Don't** use gradientes.
- **Don't** ponha sombra em coisa parada; sombra só em menu suspenso, barra de salvar, toast, diálogo e gaveta.
- **Don't** ponha ícone dentro de quadrado colorido.
- **Don't** ponha rótulo pequeno acima de título (eyebrow) nem numere seções (01/02).
- **Don't** use borda lateral colorida para marcar situação.
- **Don't** escreva cabeçalho de tabela em caixa alta nem use listras zebradas.
- **Don't** use emoji; ícones são Lucide, 16px, traço 1.6, um conjunto só.
- **Don't** anime a entrada de conteúdo.
- **Don't** escreva texto amarelo sobre branco.
- **Don't** use Overpass Mono fora de códigos nem uma segunda família de texto.
- **Don't** faça o painel de TMS de categoria: menu azul-marinho, cartão de KPI com ícone de caminhão, mapa decorativo.

## Conversão para Next.js e Tailwind

O protótipo foi escrito para virar Next.js (App Router) + Tailwind; os nomes acima são os nomes de destino.

- **Tokens → `@theme` (Tailwind v4) em `app/globals.css`.** Cores como `--color-<nome>` (`--color-verde: #0b6b3a`, `--color-laranja-claro: #fdebdd`, `--color-ink: #1e2327`…), gerando `bg-verde`, `text-verde-tinta`, `border-border`. Raios como `--radius-chip/control/card/toast/dialogo/sheet`. Fontes via `next/font/google` (Overpass 400–700, Overpass Mono 400–600) expostas como `--font-sans` e `--font-mono`. Tamanhos como `--text-headline: 22px` com `--text-headline--line-height: 28px`, idem `title`, `body`, `meta`, `small`. Medidas do shell (`sidebar`, `topbar`, `sheet-inset`, `control-h`, `field-h`, `row-h`) como `--spacing-*`. Easings como `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` e `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`. Breakpoints: `--breakpoint-celular: 640px`, `--breakpoint-tablet: 1100px` (usar `max-*` para replicar o build, que é desktop primeiro).
- **Valores literais que viram token.** `#c99700` → `amarelo-borda`, `#e7b3bb` → `perigo-borda`, `#8a928d` → `neutro-marca`, `#383f3b` → `neutro-tinta`; as sombras temporárias → `--shadow-menu`, `--shadow-barra`, `--shadow-toast`, `--shadow-dialogo`.
- **Shell.** `montarShell()` → `app/(app)/layout.tsx` (Sidebar, Topbar com BuscaGlobal, Folha); o login → `app/(auth)/login/page.tsx`, sem shell.
- **Desenhos → componentes React.** `desenhar.placa` → `<Placa placa grande?>`; `sinal` → `<Sinal situacao>` com o mapa de situações do banco; `engate` → `<ConjuntoEngatado cavalo itens>`; `capacidade` → `<Capacidade conjunto>`; `marco` → `<MarcoKm vencimento janela>`; `avatar` → `<Avatar nome>`. Placas de advertência → `<PlacaAdvertencia forma n>`.
- **Comportamento.** `?aba=` → segmento de rota da ficha; `form[data-salvar]` + barra → um hook de formulário sujo com `<BarraSalvar>`; `data-mascara` / `data-valida` → máscaras e validadores em `lib/` (espelhando as funções do banco); `N.fmt.*` → `lib/formato.ts`; `dados.js` → consultas ao Supabase com os mesmos nomes de campo.
- **Ao converter, mantenha** as regras de significado fixo, forma + cor, plano em repouso e uma família. Utilitários Tailwind não substituem os componentes do mundo: uma placa é sempre `<Placa>`, nunca um `div` com classes soltas.
