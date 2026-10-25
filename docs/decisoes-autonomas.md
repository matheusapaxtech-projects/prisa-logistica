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
