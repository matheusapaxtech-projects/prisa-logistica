# Decisões tomadas sem perguntar (para revisar)

Em 2026-10-24 o usuário pediu para eu seguir sozinho com três itens: rotas salvas, o resto do motor de despacho e as verificações automáticas no GitHub. Onde havia uma decisão, usei a opção recomendada e anotei aqui. Cada item tem uma branch e um PR próprios.

## 1. Rotas salvas da calculadora (branch `feat/rotas-salvas`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| Quem salva e atualiza | Admin e operação (`pode_editar`) | São os mesmos que já editam pedidos e viagens. |
| Quem apaga | Só o admin | É a regra de exclusão de todos os cadastros do NILT. |
| Onde fica a lista | Painel "Rotas salvas" dentro da calculadora, nos dois modos | Fica perto de onde a rota é usada; uma tela própria fica para depois, se a lista crescer. |
| Uma rota por trajeto | A chave é origem + pontos de passagem + destino, sem acento e sem diferença de maiúsculas | Salvar de novo o mesmo trajeto atualiza a rota, em vez de duplicar. |
| A volta | Serve para o km; o pedágio da volta vem da média da região | O pedágio pode ser diferente em cada sentido, como no modelo. |
| Pedágio para outro número de eixos | Convertido por eixo/km (pedágio ÷ km ÷ eixos da rota salva) | É a regra da calculadora original. |
| Nova viagem | Sugere o km da rota salva coleta → descarga; o pedágio é sugerido ao escolher o conjunto, pelos eixos dele, e não sobrescreve o que a pessoa digitou | A pessoa ainda pode mudar os dois campos. |

**Pendente:** os testes do banco (`supabase/tests/rota_salva.test.sql`) não rodaram no Supabase do NILT: a execução foi recusada. A tabela e a função já estão aplicadas lá. O fluxo foi conferido pelo teste de tela, que salva, usa e apaga uma rota fictícia.

## 2a. Kanban com as travas do motor (branch `feat/kanban-travas`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| Quadro do zip × nosso Quadro | Mantive o nosso Quadro e acrescentei as duas etapas que faltavam: **Descarregando** e **Aguardando saldo (30%)** | Os nomes e o fluxo do Quadro já são os da equipe; o zip tem 13 etapas, o nosso agora tem 12 colunas mais a Pausa. |
| Peso de chegada e canhoto | Pedidos ao sair de "Descarregando" (antes, ao sair de "Aguardando descarga") | No motor, a descarga começa em "Descarregando" e o comprovante vem no fim dela. |
| Checklist do veículo | Três itens confirmados no diálogo (carroceria, lona e amarração, CRLV/CNH/tacógrafo); grava a hora | É a trava "Checklist do veículo" do motor. As fotos ficam para o app do motorista. |
| Documentos para "Em rota" | Além de CT-e, MDF-e e pagamento de saída: chave da NF-e do cliente (modelo 55), número do CIOT (12 a 16 dígitos) e averbação do seguro | São as travas de "Em rota" do motor. |
| Saldo de 30% | Confirmado por admin, operação ou financeiro, como o pagamento de saída; só em "Aguardando saldo" | Mesmo padrão do pagamento de saída. |
| Finalizar | Exige saldo confirmado e MDF-e e CIOT encerrados (marcados no diálogo) | É a trava de "Viagem encerrada" do motor. |
| Caminhão em "Aguardando saldo" | Livre para outra viagem | Ele já descarregou; só falta pagar o saldo, que pode levar até 30 dias úteis. |
| Tempos-limite das etapas novas | Descarregando 2 h / 3 h; Aguardando saldo 48 h / 72 h | Prazos do motor (3 h e 72 h); o admin muda em "Tempos-limite". |
| "Ocorrência em trânsito" do motor | Não virou coluna: continua sendo Pausa + ocorrência | Já existe no Quadro com outro nome. |

Banco: migrations `20261029000200` e `20261029000300`, aplicadas no supabase-nilt. O teste do caminho completo (28 verificações) rodou e passou no banco; os arquivos `mover_viagem.test.sql`, `quadro.test.sql`, `iniciar_viagem.test.sql` e `pedido_viagem.test.sql` foram atualizados para o fluxo novo.

**Atenção:** viagens que estavam em "Aguardando descarga" agora passam por "Descarregando" antes da contagem; as que já estavam em contagem ou resolução vão para "Aguardando saldo" em vez de "Frete finalizado".
