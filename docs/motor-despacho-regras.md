# Motor de despacho PRISA: o que o zip pede ao sistema

Fonte: `prisa-motor-despacho.zip` (pasta `motor/`), feito por outra pessoa. É uma biblioteca em TypeScript, sem dependências, que só faz contas: recebe dados e devolve resultados. Não acessa banco nem rede. Traz também um esquema SQL de referência e 17 testes conferidos com CT-e e relatórios Pan Card reais.

## As 9 rotinas

| # | Rotina | Função | O que faz |
|---|---|---|---|
| 1 | Check-in "Estou livre" | (dados) | O motorista aperta o botão no app e grava a posição, a hora e até quando está livre (padrão 24 h). Vale o check-in mais recente. Não é rastreamento contínuo. |
| 2 | Ranking de motoristas | `rankearMotoristas` | Filtra: bloqueado, sem check-in, check-in com mais de 24 h, CNH vencida ou RNTRC vazio, carroceria errada, mais de 300 km. Depois dá nota de 0 a 100: distância 40%, frescor do check-in 20%, ocupação 20%, custo por tonelada 10% e histórico 10%. |
| 3 | Composição de lote | `comporLote` | Escolhe os caminhões que levam o lote pelo menor custo total (piso ANTT + pedágio + INSS PF + km até o embarque) e reparte o peso entre eles. |
| 4 | Piso ANTT | `pisoAntt` | Tabela A, Portaria SUROC 22/2026. O frete do motorista no CIOT não pode ficar abaixo dele (Lei 15.485/2026). |
| 5 | Resultado do CT-e | `calcularCTe` | ICMS de 7%, 12% ou 0, PIS/COFINS 3,65%, INSS, retenções, Pan Card, desconto de duplicata, IRPJ/CSLL 2,28%, seguros RCTR-C e RC-DC, e a faixa da margem (abaixo de 8,5% até "excelente"). |
| 6 | Monitoramento da viagem | `analisarViagem` | Posição a cada 5 min ou 2 km, só durante a viagem. Cerca de 1,5 km no embarque e no destino, paradas, espera, previsão de chegada e alertas (sem sinal há 90 min, fora da rota, atraso). |
| 7 | Kanban de 13 etapas | `aplicarEvento`, `podeMover` | O cartão anda sozinho pelos eventos do app e trava quando falta documento (por exemplo, sair sem CIOT). |
| 8 | Quebra de peso e estadia | `verificarQuebra`, `estadiaDoisSentidos` | Compara o ticket da origem com o do destino usando a tolerância do contrato. Calcula a estadia depois de 5 h, a R$ 1,38 por t/h (Lei 11.442), cobrada do cliente e com parte repassada ao motorista. |
| 9 | Frete de retorno | `sugerirRetornos` | Para quem está terminando a viagem, sugere cargas a até 150 km do destino, com até 48 h de espera, de preferência voltando para perto da base do motorista. |

## O que já foi trazido para o sistema

**Piso ANTT e resultado do CT-e** (branch `feat/cte-antt`, migrations `20261027000100` e `20261027000200`). Os 4 casos de referência do motor batem ao centavo nos testes do banco (`supabase/tests/frete_antt_cte.test.sql`).

- **Pedido:** campo "Tipo de carga (ANTT)", com granel sólido como padrão.
- **Viagem:** km e pedágio, na nova viagem e em "Editar frete" na ficha (só enquanto a viagem está planejada).
- **Ficha da viagem:** bloco "Frete e piso ANTT" para todos. "Resultado do CT-e" só para admin e financeiro.
- **Travas ao iniciar a viagem:**
  - frete abaixo do piso é trava legal;
  - sem frete do motorista ou sem km é trava que o administrador libera com justificativa;
  - tipo de carga sem coeficiente vigente é só aviso;
  - frota própria não confere o piso.
- **No banco:** a tabela da ANTT (`antt_coeficiente`) e os parâmetros fiscais (`parametro_fiscal`) ficam com data de vigência. Portaria nova = linhas novas, sem migration.
- **Ainda não entram:**
  - seguro da carga, que precisa do valor da NF;
  - desconto de duplicata;
  - repasse do INSS;
  - retorno vazio obrigatório.

  As contas já existem em `calcular_cte`, mas a viagem ainda não tem esses dados.

**Kanban com as travas do motor** (branch `feat/kanban-travas`, migrations `20261029000200` e `20261029000300`): o Quadro ganhou "Descarregando" e "Aguardando saldo (30%)" e as travas de checklist do veículo, NF-e, CIOT, averbação do seguro, saldo pago e MDF-e/CIOT encerrados. Decisões em `docs/decisoes-autonomas.md`.

## Comparação com o nosso sistema hoje

### Kanban: o nosso Quadro já cobre a maior parte

| Etapa do zip | Nossa coluna (`status_campo`) |
|---|---|
| Aguardando motorista | Planejada (status nulo) |
| Deslocamento ao embarque | `transito` |
| Aguardando carregamento | `aguardando_carregamento` |
| Carregando | `em_carregamento` |
| Liberação para viagem | `aguardando_nf_pagamento` |
| Em rota | `em_rota` |
| Ocorrência em trânsito | `pausa` + `viagem_ocorrencia` (parecido, não igual) |
| Aguardando descarga | `aguardando_descarga` |
| **Descarregando** | **não existe** |
| Aguardando conferência | `aguardando_contagem` |
| Divergência na entrega | `resolucao_divergencia` |
| **Aguardando saldo (30%)** | **não existe** |
| Viagem encerrada | `frete_finalizado` |
| Cancelada (desfecho) | só existe no pedido (`situacao_pedido = cancelado`) |

### O que ainda não existe aqui

- Check-in de disponibilidade e o app do motorista
- Ranking de motoristas e composição de lote
- Tabela ANTT com vigência (`antt_coeficientes`)
- Cálculo do CT-e e faixa de margem
- Rastreamento (`posicoes`), cercas, estadia e previsão de chegada
- Travas de documento ao andar no quadro: CIOT, MDF-e, seguro averbado, vale-pedágio, 70% pago
- Quebra de peso entre os tickets de origem e destino
- Apólices de seguro
- Sugestão de frete de retorno

## Cuidados antes de usar

- **Não aplicar o `schema.sql` como está.** Ele cria `motoristas`, `veiculos` e `viagens` do jeito dele, e isso choca com as nossas tabelas `pessoa`, `motorista`, `veiculo`, `conjunto`, `pedido` e `viagem`. Ele serve de lista de campos para acrescentar às nossas tabelas.
- **A parte que dá para aproveitar direto é o código das contas** (`src/`). Como não tem dependências, roda no `web/` ou numa função do Supabase. Basta montar os dados no formato dos tipos dele (`tipos.ts`).
- **Pela regra do próprio README, quem grava é o servidor.** A tela pode calcular para mostrar, mas a mudança de etapa, o frete e o pagamento devem ser validados no banco (RPC), como já fazemos em `mover_viagem`.
- **Valores a confirmar** com o contador e com a operação: alíquotas do Lucro Presumido, valor atual da estadia, taxas reais da apólice, percentual de repasse da estadia e os pesos do ranking.
- **Privacidade:** margem, frete por tonelada e resultado do CT-e nunca aparecem no app do motorista.
