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

## 2b. Quebra de peso e estadia (branch `feat/quebra-estadia`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| Onde fica a tolerância de quebra | No cliente (tomador), aba "Faturamento e exigências"; partida 0,30% | O motor diz que vem do contrato de cada cliente; em grãos é comum 0,25% a 0,5%. |
| Pesos da quebra | Peso de saída × peso de chegada que o Quadro já pede | São os tickets de balança da origem e do destino. |
| Quebra acima da tolerância | O diálogo da contagem avisa, marca "Falta" (ou "Sobra") e preenche a descrição; a pessoa confirma | Não bloqueia sozinho: a contagem continua sendo decisão da operação. |
| Horas de estadia | Pela linha do tempo do Quadro: carga = Aguardando carregamento + Em carregamento; descarga = Aguardando descarga + Descarregando | Sem o app do motorista não há cerca de GPS; as colunas do Quadro são o que temos. |
| Valores da estadia | 5 h grátis, R$ 1,38 por t/h, repasse de 100% ao motorista, numa tabela com vigência (`parametro_operacional`) que só o admin muda | Valores de partida do motor; o valor legal corrigido e o percentual de repasse precisam ser confirmados. |
| Quem vê | Todos que leem a viagem veem a quebra, as horas, o valor a cobrar e o repasse | São dados operacionais; a margem não aparece. |

Banco: migration `20261029000400`, aplicada no supabase-nilt. `quebra_estadia.test.sql` (14 verificações) rodou e passou no banco, com o caso de quebra do motor (32 t → 31,74 t, 0,3%: 0,26 t, excedente 0,164 t).

**Pendente de confirmar:** o valor da estadia por t/h vigente e o percentual de repasse ao motorista.

## 2c. Disponibilidade, ranking e composição do lote (branch `feat/despacho-ranking`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| Check-in "Estou livre" | Sem o app do motorista, a operação registra na tela **Motoristas livres** (`/disponiveis`) o que ele avisa: cidade e por quanto tempo está livre (12 h, 24 h, 2 dias, 3 dias) | É o check-in do motor, com a posição pela cidade em vez do GPS. Quando o app existir, ele grava na mesma tabela. |
| Onde aparece | Atalho no Quadro e no painel "Despacho" da ficha do pedido; sem pílula nova no menu | O menu do topo já está cheio; o despacho acontece no pedido. |
| Quem é candidato | O motorista de cada conjunto aberto (eixos e capacidade das peças) | O NILT planeja a viagem pelo conjunto. |
| RNTRC e PF/PJ | Os do dono na ANTT do cavalo | É quem é contratado no CIOT. |
| Fica de fora | Cadastro do motorista fora do normal, já em viagem, sem disponibilidade ou vencida, sem RNTRC, CNH vencida no embarque, a mais de 300 km | Filtros do motor, mais "já em viagem", que o NILT sabe pelo Quadro. A carroceria não entra: o cadastro do veículo não tem esse campo. |
| Nota | Pesos do motor: distância 40%, frescor 20%, ocupação 20%, custo por tonelada 10%, histórico 10% | Valores de partida do motor; a confirmar com a operação. |
| Embarque | Coleta prevista às 8 h; sem data ou com data passada, daqui a 12 h | O pedido só guarda a data. |
| Lote sugerido | Só quando o saldo passa da capacidade de um caminhão; motorista no piso; margem do lote só para admin e financeiro | Mesma regra de sigilo da calculadora. |
| Planejar viagem | Abre a nova viagem já com o conjunto e o peso sugeridos; nada é criado sozinho | A operação confirma frete, km e pedágio. |

Banco: migration `20261029000500` (tabela `motorista_disponibilidade` e view `v_motorista_livre`), aplicada no supabase-nilt. Ranking e composição testados contra o cenário do motor (150 t em 3 caminhões de 9 eixos, R$ 24.681).

**Observação técnica:** o servidor de desenvolvimento que estava aberto (de outra conversa) ficou com o código antigo em cache e dava erro na ficha do pedido. O código foi conferido num build de produção próprio, onde os testes de tela passaram.

## 2d. Previsão de chegada e frete de retorno (branch `feat/retorno-previsao`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| Monitoramento (rotina 6) | Só a previsão de chegada, sem GPS: saída = hora em que a viagem entrou em "Em rota"; 60 km/h, 30 min a cada 5h30 e 11 h de descanso a cada 13 h | Cercas, paradas e desvio de rota precisam das posições do app do motorista, que ainda não existe. |
| Atraso | Contra o fim do dia da entrega prevista do pedido (18 h de Brasília) | O pedido só guarda a data da entrega. |
| Frete de retorno (rotina 9) | Na ficha da viagem que já saiu e ainda não descarregou: até 5 pedidos abertos com saldo a até 150 km do destino, embarcando até 48 h depois de descarregar, com a nota do motor | É quando o motor manda rodar ("sempre que uma viagem entra em Em rota"). |
| Pedido sem coleta prevista | Conta como pronto para embarcar assim que o caminhão descarrega | A carga espera o caminhão. |
| Capacidade do caminhão | A do conjunto da viagem; sem ela, 37 t | Para a ocupação na nota. |

**Correção feita no caminho (também no PR #4):** a ação que move a viagem no Quadro não repassava ao banco o checklist, a NF-e, o CIOT, a averbação e os encerramentos, e o banco recusava a passagem. O teste de fluxo completo do Quadro achou o defeito; a correção tem teste de unidade próprio.

**Testes de tela:** a suíte inteira passou rodando um teste por vez (65 passaram, 3 pulados por falta de dados). Em paralelo, alguns testes que gravam no mesmo banco se atrapalham entre si; isso já acontecia antes.

## 3. Verificações automáticas e `.claude/` (branch `chore/ci`)

| Decisão | O que escolhi | Por quê |
|---|---|---|
| O que o GitHub roda | Lint, tipos e testes de unidade do `web/`, a cada PR e a cada push na `main` | São os que não precisam do banco vivo. |
| Testes do banco e de tela | Continuam fora do GitHub | Precisam do Supabase do NILT e dos usuários de teste; levar segredos para o GitHub é decisão sua. |
| `.claude/` | Inteira no `.gitignore` | Só tem configurações desta máquina (permissões, launch apontando para um worktree local e os worktrees). |
