# Referência visual: template "rapport" (vídeo de 27 s)

Extraído quadro a quadro de `rapport.mp4` (1280×720, 60 fps). As cores abaixo foram medidas nos pixels, não estimadas.
Quadros guardados nesta pasta: `01-visao-geral.png`, `02-quadro-arraste.png`, `03-dialogo-novo.png`, `04-ficha-cliente.png`, `05-cartao-vira-modal.png`.

## 1. Tokens

### Cores medidas
| Papel | Cor | Onde aparece |
|---|---|---|
| Fundo, canto sup. esquerdo | `#eddbce` (pêssego) | gradiente do fundo |
| Fundo, centro | `#ece4cd` (creme) | gradiente do fundo |
| Fundo, laterais/baixo | `#e8e6de` (sálvia quente) | gradiente do fundo |
| Painel | `#f4eee4` / `#f4f0e2` | blocos "Revenue", "Hot deals" (creme translúcido) |
| Círculo de ícone | `#f5f3eb` | ícone ao lado de cada KPI |
| Mostarda | `#e7c14b` – `#f0c64a` | cartão da 1ª etapa |
| Verde floresta | `#2c5a4d` | cartão da 2ª etapa, "Team quota", modal |
| Verde selo | `#395e53` | pílula "+5% vs last month" |
| Verde claro | `#84b293` sobre `#eaefe7` | alvo "Won" |
| Ferrugem | `#c4411d` | cartão da 3ª etapa, linha do gráfico (`#aa4727`) |
| Quase preto | `#161818` | 4ª etapa, trilho lateral, pílula da navegação, botão principal |

### Forma
- Painel: raio ~22 px, sem borda dura (filete branco 1 px a 60 %), sombra muito difusa.
- Cartão colorido: raio ~16 px, padding ~14 px, título 15 px/600, valor 20 px/600 embaixo à esquerda, avatares sobrepostos embaixo à direita, botão "…" redondo vazado no canto.
- Tudo que é botão é **pílula** ou **círculo** (32–36 px). Ação principal preta com texto branco.
- Dois trilhos de navegação: **pílulas no topo** (a atual é preta) e **trilho vertical flutuante preto** à esquerda com ícones (busca, novo, favoritos, agenda…).

### Tipo
- Uma sans geométrica (parecida com **Outfit** / Urbanist). Título da página em **duas linhas**, ~36 px, peso 500, entrelinha apertada ("Sales / Overview").
- Números grandes ~34 px/600 com algarismos tabulares; rótulo pequeno cinza ao lado.
- KPIs em linha ao lado do título: círculo com ícone + valor + legenda + selo pílula.

## 2. Catálogo de animações (o que acontece no vídeo)

| # | Momento | O que se vê | Como fazer |
|---|---|---|---|
| A1 | Troca de página | Tela antiga desfoca e some; a nova entra de **desfocado → nítido**, título primeiro, blocos em cascata | `blur(8px)→0` + `opacity` + `translateY(8px)`, 350 ms, atraso 40 ms por bloco |
| A2 | Navegação do topo | A pílula preta **desliza** até o item clicado | elemento compartilhado (`layoutId`) |
| A3 | Números | Valores **contam** até o novo número ao entrar e ao trocar 6M/12M | contador com mola, `tabular-nums` |
| A4 | Gráfico | Linha **se desenha**, área em gradiente aparece; ao trocar período a curva se transforma; tooltip segue o cursor | `stroke-dashoffset` + interpolação do `path` |
| A5 | Arrastar cartão | Cartão **levanta** (escala ~1.04, sombra, leve giro), coluna de destino ganha contorno; ao soltar os outros **se reacomodam** e o cartão **muda de cor** para a da coluna | layout animation + transição de `background-color` |
| A6 | Aviso | Pílula preta embaixo, centro: "✓ Movido para Negotiation · **Desfazer**" (botão mostarda) | entra de baixo com mola |
| A7 | Diálogo "New deal" | Fundo **desfoca** (backdrop-filter) e escurece pouco; diálogo cresce 0.96→1 | `backdrop-filter: blur(12px)` |
| A8 | Cartão → ficha | O cartão da grade **se expande** e vira a ficha (mesmo elemento); ao avançar a etapa a ficha **troca de cor** (mostarda → verde) e a barra de etapas anda | elemento compartilhado + cor animada |
| A9 | Lista de clientes | Cartões entram em cascata desfocados | igual A1 |
| A10 | Controles segmentados | "Weighted / Total", "6M / 12M", "Board / List": fundo branco desliza | `layoutId` |
| A11 | Anel de meta | Arco amarelo do "24 %" cresce | `stroke-dasharray` |

## 3. Choque com o DESIGN.md atual do NILT

O template quebra estas regras escritas hoje:
1. **"Don't use gradientes"** → o fundo inteiro é gradiente.
2. **"A Regra do Plano em Repouso"** (sombra só no que some) → os painéis têm sombra difusa.
3. **"Movimento só como resposta: nada entra animado"** → A1, A3, A4, A9, A11 são animações de entrada.
4. **"A Regra do Significado Fixo"** → no template a cor marca a **etapa** (categoria), não a situação.
5. **Uma família (Overpass)** → o template usa outra sans geométrica.
6. Folha branca recuada em moldura de asfalto → vira fundo quente com painéis flutuantes.

O que **combina** sem esforço: a paleta do template já é quase a do NILT (verde, laranja, amarelo, preto), as pílulas, os cartões do Quadro da operação (`app/(app)/quadro/`) que já são um kanban com arraste, e o diálogo de passagem.
