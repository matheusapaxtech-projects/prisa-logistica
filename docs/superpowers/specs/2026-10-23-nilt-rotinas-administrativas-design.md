# NILT — Rotinas administrativas do dia a dia

Data: 2026-10-23 · Complementa `docs/superpowers/specs/2026-10-22-nilt-design.md` (o "design do NILT").

O design do NILT diz **o que** cada módulo guarda. Este documento diz **como a Prisa trabalha com ele todo dia**: quem faz o quê, em que ordem, o que o sistema confere sozinho, o que trava, e como a equipe sabe que terminou o dia.

> **Como este documento foi feito.** O usuário pediu para pular as perguntas e escrever direto. Tudo aqui vem do design do NILT, do estudo do ATUA (`re-atua-mais-frete/`, evidências EV-001 a EV-014, regras R-001 a R-021) e do que já existe no banco e no `web/`. O que não está nessas fontes é **decisão do designer (Claude)** e está marcado **[designer]**. O que depende da entrevista com a equipe está marcado **[entrevista]** e listado na seção 12.

---

## 1. Intenção

A Prisa tem cerca de 5 pessoas na operação para fazer tudo: cadastrar, liberar na gerenciadora, carregar, emitir CT-e e MDF-e, pagar o motorista, cuidar da frota própria, faturar e cobrar. Com tão pouca gente, o risco não é a falta de tela. O risco é **esquecer**: um MDF-e que fica aberto, um CT-e sem averbação, um saldo pago sem canhoto, uma fatura não emitida, uma CNH que venceu no meio da viagem.

Por isso o NILT trata as rotinas como **filas com dono**, não como menus. Cada rotina tem um gatilho, uma pessoa responsável, passos curtos, conferências automáticas e um "pronto quando". O que está pendente aparece sozinho numa tela de trabalho do dia, e nada some dali até alguém resolver ou justificar.

### O que é sucesso
- No fim do expediente, a tela **Hoje** está vazia ou cada item restante tem dono e motivo.
- Nenhum pagamento de saldo sai sem canhoto conferido; nenhum MDF-e passa do prazo aberto; todo CT-e autorizado está averbado.
- O fechamento do mês (resultado por viagem, por veículo e por cliente) sai do sistema, sem planilha paralela.
- Uma pessoa nova consegue fazer a rotina de outra seguindo a fila, sem depender de quem "sabe como faz".

### Anti-objetivos (fracassa mesmo funcionando)
- **Rotina que depende de alguém lembrar.** Se o sistema sabe que algo vence ou falta, ele mostra; não espera ser consultado.
- **Digitar duas vezes.** O que já está no cadastro, na NF-e ou no CT-e não é redigitado no contrato, no MDF-e ou na fatura.
- **Trava que a equipe contorna por fora.** Uma trava sem saída faz a equipe voltar para o WhatsApp e a planilha. Toda trava tem uma **exceção justificada e registrada**, exceto as que a lei não permite (seção 3.2).
- **Ficar sem conseguir pagar o motorista ou emitir documento num dia normal** por causa de uma regra do sistema.
- Herdar a complexidade do ATUA (seis caminhos para emitir uma carga, 71 telas de financeiro).

---

## 2. O fio condutor: a Viagem  **[designer]**

Todas as rotinas 3, 4, 5 e 7 giram em torno de uma única coisa: a **Viagem**. Ela nasce de um pedido do cliente e só morre quando o frete foi recebido do cliente e o saldo foi pago ao motorista. Cada rotina é a passagem de uma etapa para a seguinte, e cada fila da tela **Hoje** é "viagens paradas numa etapa".

```
 Pedido ──► Planejada ──► Liberada ──► Documentada ──► Em trânsito ──► Entregue ──► Encerrada
 (cliente)  (conjunto e   (cadastro e  (CT-e, MDF-e,   (adiantamento   (canhoto e   (MDF-e encerrado,
            motorista)    GR ok)       averbação,      e vale-pedágio  peso de      saldo pago)
                                       contrato/CIOT)  pagos)          chegada)
                                                                                      │
                                         Faturamento do CT-e (rotina 7) corre em paralelo a partir de Documentada
                                         e termina em Recebida.
```

| Etapa | Entra quando | Quem move | Rotina |
|---|---|---|---|
| Planejada | Conjunto e motorista escolhidos para um pedido | Operação | 3 |
| Liberada | Conferência de aptidão passou (cadastro + GR + regras do cliente) | Sistema, ao conferir | 1, 2 |
| Documentada | CT-e autorizado, averbado, MDF-e autorizado e, se for terceiro, contrato com CIOT | Operação | 4, 5 |
| Em trânsito | Adiantamento e vale-pedágio pagos ou dispensados; saída informada | Financeiro / Operação | 5 |
| Entregue | Canhoto recebido (foto ou papel) e peso de chegada lançado | Operação ou motorista pelo app | 3, 5 |
| Encerrada | MDF-e encerrado e saldo pago (ou contrato quitado sem saldo) | Operação / Financeiro | 4, 5 |
| Cancelada | Desistência antes de sair; documentos cancelados dentro do prazo | Operação | 3, 4 |

Estas são as etapas **administrativas** (documentos e dinheiro). Onde a carga está **fisicamente** é o **status de campo**, as 10 colunas do Quadro da operação definidas pelo usuário (3.5); as duas andam juntas e o cartão mostra as duas. A situação administrativa da viagem é **calculada pelo banco a partir dos fatos** (CT-e autorizado, MDF-e encerrado, saldo pago), não marcada à mão. Assim a etapa nunca mente. **[designer]**

Frota própria (motorista funcionário, sem CIOT) passa pelas mesmas etapas; o contrato de frete e o CIOT não se aplicam e as etapas de pagamento ao motorista são puladas (R-012/EV-012: "Frota Própria {Com CIOT; Sem CIOT}").

---

## 3. Peças que todas as rotinas usam  **[designer]**

### 3.1 Tela **Hoje**
É a primeira tela depois do login (substitui o início atual em `web/src/app/(app)/(inicio)`). Mostra, por fila, **quantos itens** e **o mais antigo**, filtrada pelo papel de quem entrou. Cada fila abre a lista já filtrada, e cada item leva direto à ação.

Filas (o número entre parênteses é a rotina):

| Fila | Mostra | Papel |
|---|---|---|
| Documentos vencendo ou vencidos (1) | CNH, ANTT, CRLV, GR, seguro: vencidos e vencendo em 30 dias | Operação |
| Cadastros pendentes (1) | Situação Cadastro = Pendente; arrendado sem contrato; arquivo sem validação | Operação |
| Viagens planejadas sem liberação (2) | O que falta: qual documento, qual GR, qual regra do cliente | Operação |
| Viagens a documentar (4) | Liberadas sem CT-e autorizado | Operação |
| Documentos com problema (4) | CT-e/MDF-e rejeitado, pendente há mais de 15 min, sem averbação | Operação |
| MDF-e abertos (4) | Abertos, do mais antigo; destaque a partir de 24 h após a entrega e a partir de 5 dias da emissão | Operação |
| Pagamentos de saída (5) | Adiantamento e vale-pedágio a pagar para viagens documentadas | Financeiro |
| Canhotos faltando (5) | Viagens com entrega prevista vencida e sem canhoto | Operação |
| Saldos a liberar (5) | Canhoto conferido, saldo calculado, aguardando aprovação/pagamento | Financeiro |
| Contratos bloqueados (5) | Bloqueio ativo com motivo e há quantos dias | Financeiro |
| A faturar (7) | CT-e autorizados ainda fora de fatura, por cliente, conforme a condição de pagamento | Financeiro |
| A receber vencido (7) | Títulos de crédito vencidos, por cliente | Financeiro |
| A pagar hoje (7) | Títulos de débito vencendo hoje e atrasados | Financeiro |
| Banco a conciliar (7) | Movimentos do OFX sem lançamento correspondente | Financeiro |
| Frota (6) | Manutenção vencida por km ou data; despesas importadas sem placa ou centro de custo | Frota/Operação |

O admin vê todas. A tela **Pendências** que já existe (`web/src/app/(app)/pendencias`, views `v_vencimentos` e `v_pendencias_documentos`) passa a ser a fila das rotinas 1 e 2 dentro da **Hoje**.

### 3.2 Trava, aviso e exceção
Cada conferência do sistema é de um destes três tipos:

- **Trava legal:** não tem exceção. Exemplos: emitir CT-e sem as NF-e; pagar contrato de terceiro sem CIOT; frete do motorista abaixo do piso da ANTT; cancelar CT-e fora do prazo da SEFAZ. A tela explica o porquê e o que fazer.
- **Trava da Prisa:** bloqueia, mas o **admin** pode liberar com **justificativa escrita**, que fica na auditoria e aparece no extrato da viagem. Exemplos: CNH vencida, GR vencida, arrendado sem contrato, saldo sem canhoto.
- **Aviso:** não bloqueia; aparece onde se trabalha e na fila. Exemplos: conjunto acima do CMT (já existe), documento vencendo em 30 dias, titular do Pix diferente do proprietário.

A classificação de cada regra está nas rotinas abaixo. Mudar uma regra de trava para aviso é uma configuração do admin, não um deploy. **[designer]**

A exceção é sempre registrada **no ato que ela libera** (a liberação da viagem, o pagamento do saldo), não na pessoa ou no documento: liberar uma viagem com CNH vencida não "conserta" a CNH para a próxima. Antes de existir Viagem (complemento da fase 1), a aptidão (4.4) só **mostra** o resultado; as travas passam a valer quando a viagem existir. **[designer]**

### 3.3 Separação de quem monta e quem paga
Dinheiro que sai para terceiro passa por **duas pessoas**: a operação monta (contrato, descontos, quebra, saldo calculado) e o financeiro aprova e paga. A mesma pessoa não aprova o que montou, a não ser o admin com justificativa. Com 5 pessoas isso é viável e evita o erro mais caro da transportadora: pagar errado o motorista. **[designer]**

### 3.4 Ritmo
| Quando | O quê |
|---|---|
| Começo do dia | Abrir **Hoje**; resolver rejeitados e MDF-e abertos; conferir pagamentos de saída do dia |
| Durante o dia | Pedidos → viagens → liberação → documentos → saída (rotinas 3, 4, 5) |
| Fim do dia | Nenhum CT-e sem averbação; nenhum documento pendente na SEFAZ; canhotos do dia lançados; retorno bancário importado |
| Semanal | Importar despesas dos cartões de frota; faturar clientes de faturamento semanal; revisar contratos bloqueados |
| Mensal | Fechamento: conciliação completa, faturas do mês, inutilizar numeração pulada, resultado por viagem, veículo e cliente; custos fixos da frota (IPVA, seguro, financiamento) |

Os horários e a divisão entre pessoas são **[entrevista]**. O sistema não impõe horário; só mostra o que está atrasado.

### 3.5 Quadro da operação (kanban em tempo real)
Pedido do usuário (2026-10-23): um kanban para visualizar a operação em tempo real, **com as colunas definidas por ele, nesta ordem**. É a tela de acompanhamento da operação no campo; a **Hoje** (3.1) continua sendo a lista de tarefas de cada pessoa. As duas leem os mesmos dados.

**Colunas (do usuário)** e o que cada uma significa; regras de entrada e saída **[designer]**:

| # | Coluna | Significado | Entra quando | Sai para |
|---|---|---|---|---|
| 1 | **Trânsito** | Motorista se deslocando até o local de carga | Viagem Liberada (seção 2) e motorista avisa que partiu | Aguardando carregamento |
| 2 | **Aguardando carregamento** | Chegou no local de carga, na fila | Chegada informada (operação ou app) | Em carregamento |
| 3 | **Em carregamento** | Sendo carregado | Início do carregamento informado | Aguardando NF e pagamento |
| 4 | **Aguardando NF e pagamento** | Carregado; esperando as NF-e do cliente, a emissão de CT-e/MDF-e/contrato e o adiantamento e vale-pedágio | Fim do carregamento, com peso de saída | Em rota, **só** com a viagem Documentada e os pagamentos de saída resolvidos (rotinas 4 e 5; trava) |
| 5 | **Em rota** | Deslocamento até o destino | Liberação da coluna 4 | Pausa ou Aguardando descarga |
| 6 | **Pausa** | Parada programada ou não (almoço, banheiro, pernoite, abastecimento, problema) | Motorista ou operação informa a pausa, com motivo e se é programada | Volta para a coluna de onde veio (Trânsito ou Em rota) |
| 7 | **Aguardando descarga** | Chegou no destino, na fila | Chegada no destino informada | Aguardando contagem de divergência |
| 8 | **Aguardando contagem de divergência** | Descarregado; o destinatário confere peso/quantidade | Fim da descarga, com canhoto e peso de chegada | Frete finalizado (sem divergência) ou Resolução de divergência |
| 9 | **Resolução de divergência na carga** | Falta, sobra, quebra acima da tolerância ou avaria em tratamento | Contagem registrada com divergência | Frete finalizado, com a solução registrada (desconto no contrato, cobrança, sinistro) |
| 10 | **Frete finalizado** | Carga entregue e conferida | Contagem sem divergência ou divergência resolvida | Sai do quadro no dia seguinte; segue nas rotinas 4, 5 e 7 (encerrar MDF-e, saldo, fatura) |

**Pausa** **[designer]:** guarda tipo (almoço, banheiro, descanso/pernoite, abastecimento, manutenção, problema), programada ou não, início e fim. A soma das pausas fica na viagem e serve para a jornada do motorista e para explicar atrasos. Pausa não programada acima de um tempo configurável (padrão sugerido: 60 min) deixa o cartão vermelho e avisa a operação.

**Divergência** **[designer]:** a contagem registra peso/quantidade de chegada contra a saída e o resultado {Sem divergência; Falta; Sobra; Avaria}. A tolerância de quebra vem do contrato/proprietário (8.3): dentro dela, o cartão vai direto a Frete finalizado. A resolução alimenta o cálculo do saldo (8.3) e, se for avaria, abre ocorrência (6.4).

**O que fica fora do quadro:** pedidos ainda sem viagem e viagens Planejadas que ainda não liberaram ficam na **Hoje** (filas da rotina 3). O cartão entra no quadro na coluna Trânsito. **[designer]**

**Cartão da viagem** (o mínimo para decidir sem abrir) **[designer]**:
- Placa do cavalo, nome curto do motorista, cliente, origem → destino (cidade/UF).
- **Há quanto tempo está na coluna**; âmbar e depois vermelho quando passa do tempo-limite da coluna, configurável pelo admin.
- Sinais da parte administrativa: CT-e/MDF-e (falta, rejeitado, autorizado), averbação, CIOT, adiantamento pago, GR/SM, ocorrência aberta, contrato bloqueado, MDF-e aberto depois da entrega, saldo pago.
- Clicar abre a viagem com **o próximo passo** em destaque.

**Arrastar cartões:** a coluna é um **status de campo**, então arrastar para a coluna seguinte muda o status direto e grava quem e quando. Três passagens pedem dados e abrem um formulário curto: entrar em Pausa (tipo e se é programada), sair de Em carregamento (peso de saída), sair de Aguardando descarga (canhoto e peso de chegada). A saída de "Aguardando NF e pagamento" para "Em rota" respeita a trava. Se faltar algo, o cartão volta e a tela diz o quê. Voltar uma coluna é permitido com motivo (correção de clique errado), exceto depois de Em rota com documento emitido. **[designer]**

**Quem move:** a operação, pelo quadro; o motorista, pelo app (fase 6), com os botões "cheguei", "comecei a carregar", "saí", "pausa", "cheguei no destino". Até o app existir, a operação move a partir do que o motorista avisa por telefone ou WhatsApp.

**Tempo real:** quando alguém (operação, app, retorno da SEFAZ/PAMCARD) muda um fato, o cartão muda de coluna ou de sinal na tela de todos em poucos segundos, sem recarregar. Se a conexão cair, o quadro mostra "desatualizado desde hh:mm" e volta a sincronizar sozinho. **[designer; o mecanismo (ex.: Supabase Realtime) fica para o builder]**

**Filtros e visões:** por cliente, motorista, unidade operacional (Terceirização, Frota Própria, Prisa Apucarana), "só com problema" e "só minhas". Contador no topo de cada coluna. Com 10 colunas, no computador o quadro rola na horizontal com as colunas de espera (2, 4, 7, 8) estreitáveis; no celular, uma coluna por vez com abas no topo.

**Pronto quando:** a operação abre o quadro e sabe, sem perguntar a ninguém, onde está cada carga, qual está parada e há quanto tempo.

### 3.6 Avisos fora da tela
Na fase em que cada rotina entra, o sistema manda um resumo diário por e-mail para cada papel com o que ficou na fila. Mensagem por WhatsApp fica para quando o app do motorista existir. **[designer]**

---

## 4. Rotina 1 — Cadastros e documentos

**Já existe (fase 1):** pessoa, motorista, proprietário, veículo, conjunto, arquivos com tipo e validade, pendências, auditoria. Esta rotina acrescenta o uso diário e os cadastros que faltam para operar.

### 4.1 Motorista ou agregado novo
- **Gatilho:** um motorista novo vai carregar pela Prisa.
- **Quem:** Operação. Com calma e antes da primeira carga (PRODUCT.md).
- **Passos:** pessoa (CPF validado; CNPJ pela BrasilAPI) → motorista (CNH completa, referências) → proprietário (RNTRC com enquadramento, dados de pagamento) → veículos → conjunto → arquivos com validade → validação dos arquivos por uma segunda pessoa.
- **Pronto quando:** Situação Cadastro = Normal e Situação Dados = Habilitado. O motorista aparece como **Apto** (4.4).
- **Arquivos enviados pelo motorista** (fase do app): entram como "aguardando validação" e caem na fila Cadastros pendentes.

### 4.2 Documentos vencendo
- **Gatilho:** sistema, diariamente. Faixas: vencido; vence em até 15 dias; vence em até 30 dias.
- **Quem:** Operação pede o documento novo ao motorista/proprietário, anexa e valida.
- **Regra:** documento vencido de motorista, veículo ou proprietário é **trava da Prisa** para liberar viagem (4.4). Vencendo é aviso.

### 4.3 Troca de conjunto e de motorista
- **Gatilho:** carreta trocada, motorista novo no cavalo.
- **Passos:** encerrar o conjunto atual e abrir o novo (o histórico já existe). Viagens planejadas com o conjunto antigo mostram aviso para revisar.
- **Trava legal:** não trocar o conjunto de uma viagem **Documentada**; isso exige CT-e substituto ou carta de correção conforme o caso (rotina 4).

### 4.4 Aptidão para viajar (nova)
Uma conferência única, usada na liberação da viagem (rotina 3) e visível no cadastro:

| Item | Tipo |
|---|---|
| Motorista: cadastro Normal, CNH válida e de categoria compatível (E para articulado) | Trava da Prisa |
| Cada placa do conjunto: CRLV do exercício, cadastro Normal | Trava da Prisa |
| Proprietário Documento (ANTT): RNTRC válido | Trava legal para contrato com CIOT |
| Veículo arrendado com contrato anexado | Trava da Prisa |
| Conta bancária ou Pix do proprietário cadastrados | Trava da Prisa só para contrato de terceiro |
| Titular da conta/Pix diferente do proprietário | Aviso |
| Conjunto acima do CMT | Aviso (já existe) |
| GR válida para o cliente da viagem | Rotina 2 |

O resultado é **Apto**, **Apto com avisos** ou **Não apto: [lista do que falta]**.

### 4.5 Cadastros que faltam para operar
Entram antes da rotina 3, com todos os campos do ATUA (decisão já registrada no design do NILT, seção 3), estudados no ATUA em ritmo lento:
- **Cliente** (papel novo da Pessoa): remetente, destinatário, tomador; condição de pagamento, forma de faturamento (por CT-e, semanal, quinzenal, mensal), e-mails para XML/PDF e para cobrança, exigências de GR (rotina 2).
- **Local** de coleta e descarga (endereço, janela de atendimento, contato).
- **Seguradora e apólice** (hoje Tokio Marine), com dados de averbação.
- **Posto/fornecedor** (pagamento de contrato em posto, despesas de frota).
- **Gerenciadora de risco** (rotina 2).
- **Produto** transportado (para CT-e e para regras de GR e seguro).

---

## 5. Rotina 2 — Gerenciadora de risco (GR)

Hoje o ATUA só guarda a "Situação GR" no motorista (EV-007). O NILT guarda **cada consulta**.

### 5.1 Consulta de motorista e veículo
- **Gatilho:** viagem planejada para um cliente que exige GR, e não há consulta válida para aquele motorista + conjunto naquela gerenciadora.
- **Quem:** Operação.
- **Passos:** escolher a gerenciadora → registrar a consulta (protocolo, data, resultado {Liberado; Pendente; Recusado}, validade) → anexar o comprovante. Integração automática só depois de saber quais GR e se têm API (design do NILT, 5.5).
- **Pronto quando:** consulta Liberada e dentro da validade para motorista e para cada placa exigida.
- **Validade:** cada gerenciadora tem sua regra (por dias ou por viagem), configurada no cadastro da gerenciadora. **[entrevista]**

### 5.2 Regras por cliente
No cadastro do cliente: qual gerenciadora, se exige rastreador, se exige monitoramento (SM), valor máximo de carga sem escolta, outras exigências em texto. A aptidão da viagem (4.4) confere essas regras. **Trava da Prisa.**

### 5.3 Monitoramento da viagem (SM)
- **Gatilho:** cliente ou gerenciadora exige SM.
- **Passos:** registrar a solicitação (número, gerenciadora, rota, início e previsão) antes da saída. O ATUA já tem esses campos no extrato do CT-e (EV-013, Rastreamento).
- **Trava da Prisa:** viagem que exige SM não passa a Em trânsito sem o número da SM.

### 5.4 Vencimento
Consultas com validade entram na fila de documentos vencendo (rotina 1). Recusa em uma GR deixa o motorista **Não apto** para os clientes dessa GR, com o motivo visível só para Operação e admin (LGPD). **[designer]**

---

## 6. Rotina 3 — Operação: do pedido à entrega

O ATUA tem seis caminhos (lote, ordem, minuta, coleta, agendamento, embarque). O NILT começa com **um** **[designer]**:

```
Pedido do cliente  ─►  1..N Viagens  ─►  Ordem de carregamento (documento para o motorista)
```

- **Pedido** = o que o cliente contratou: remetente, destinatário, tomador, locais, produto, peso ou quantidade total, janela, valor do frete da empresa (vindo do projeto de tabela de frete), exigências.
- Um pedido gera **várias viagens** quando a carga é grande ou tem cadência (é o "lote de carregamento" do ATUA). Cada viagem consome uma parte do peso do pedido; o pedido mostra quanto falta carregar.
- A **ordem de carregamento** é o PDF/mensagem que vai para o motorista e para o local de coleta, gerado da viagem. Não é cadastro à parte.

Se a entrevista mostrar que a Prisa usa outro caminho do ATUA de verdade (ex.: agendamento importado de cliente), ele entra como **forma de criar pedido**, sem mudar o resto. **[entrevista]**

### 6.1 Receber o pedido
- **Gatilho:** cliente manda a carga (e-mail, telefone, portal do cliente).
- **Quem:** Operação.
- **Passos:** criar o pedido; o frete empresa vem da tabela de frete pela rota, produto e tipo de veículo; o usuário pode ajustar com motivo. Enquanto a integração com o projeto de tabela de frete não estiver definida (design do NILT, seção 9), o frete empresa é **digitado** no pedido, com a origem do valor marcada ("manual" ou "tabela"), para a integração entrar depois sem mudar a tela. **[designer]**
- **Pronto quando:** pedido com partes, locais, peso e frete.

### 6.2 Planejar a viagem
- **Passos:** escolher o **conjunto** (o motorista vem junto, do conjunto atual) → definir frete motorista (sugestão: tabela ou último valor da rota; nunca abaixo do piso ANTT, rotina 5) → o sistema roda a aptidão (4.4 e 5.2).
- **Pronto quando:** viagem **Liberada**. Se Não apto, a viagem fica Planejada na fila com o que falta.

### 6.3 Carregar e sair
- Status de campo = colunas do Quadro (3.5): **Trânsito → Aguardando carregamento → Em carregamento → Aguardando NF e pagamento → Em rota**, com **Pausa** a qualquer momento do deslocamento. Informados pela operação ou pelo motorista no app. (O ATUA tem só: Emitida, No Local Car., Carregado, Em Trânsito, Finalizado.)
- Ao "Carregado", a operação recebe as NF-e do cliente (XML ou chave) e segue para a rotina 4.
- **Em rota** só é aceito com a viagem Documentada e pagamentos de saída resolvidos (rotina 5).

### 6.4 Ocorrências
Atraso, avaria, recusa, sinistro, parada não prevista: registro com tipo, descrição, foto e resolução. Ocorrência aberta aparece na viagem e no extrato do CT-e. Ocorrência de avaria ou sinistro avisa o financeiro (pode virar desconto ou prejuízo, rotina 5).

### 6.5 Entrega
- **Passos** (colunas 7 a 10 do Quadro): chegada no destino (Aguardando descarga) → descarga → **canhoto** (foto pelo app ou upload) e **peso de chegada** (Aguardando contagem de divergência) → contagem sem divergência ou divergência resolvida (Frete finalizado).
- **Pronto quando:** canhoto anexado e conferido por alguém da operação (legível, assinado, NF certa) e peso de chegada lançado. A viagem fica **Entregue** e libera o cálculo do saldo (rotina 5) e o encerramento do MDF-e (rotina 4).

---

## 7. Rotina 4 — Fiscal: CT-e, averbação e MDF-e

Emissão sempre pela API fiscal homologada (design do NILT, 4.1); o NILT nunca fala direto com a SEFAZ. Tudo roda primeiro em **homologação, em paralelo com o ATUA**, até um mês de CT-e bater (design do NILT, seção 3).

**Durante o paralelo** **[designer]**: pedidos e viagens são lançados **de verdade** no NILT (é o que alimenta o Quadro e a Hoje); o CT-e, o MDF-e e o contrato **oficiais** continuam saindo do ATUA. Na viagem, a operação informa a **chave do CT-e e do MDF-e do ATUA** (colar ou ler o código de barras do DACTE), e essa chave é o fato que leva a viagem a Documentada. O CT-e de homologação do NILT é gerado da mesma viagem só para comparar valores com o do ATUA; todo documento fiscal guarda o **ambiente** (homologação ou produção) e documento de homologação nunca move etapa nem entra em fatura. Na virada, a chave deixa de ser informada e passa a vir da emissão do NILT. O custo do paralelo é uma digitação por viagem (a chave), aceita para ter o quadro real.

### 7.1 Emitir o CT-e
- **Gatilho:** viagem Liberada e NF-e do cliente recebidas.
- **Quem:** Operação.
- **Passos:** a partir da viagem → importar NF-e (XML ou chave) → o sistema preenche partes, conjunto, motorista, os dois proprietários (R-015), frete (R-016) e impostos (R-017) → **pré-conferência** local (CFOP, alíquota por UF, partes obrigatórias, tomador, totais) → enviar.
- **Travas legais:** sem NF-e; remetente/origem diferentes entre NF-e do mesmo CT-e (dica do ATUA, EV-012); partes sem CNPJ/CPF ou IE válidos para a operação.
- **Pronto quando:** CT-e **Autorizado**, DACTE gerado, XML guardado, e-mail ao tomador enviado.
- **Rejeição:** fica na fila Documentos com problema com a mensagem da SEFAZ **traduzida em português claro** e o campo a corrigir. Corrigir e reenviar sem redigitar. **[designer]**

### 7.2 Averbar o seguro
- **Gatilho:** CT-e autorizado.
- **Quem:** sistema, automático (se a seguradora/ATM aceitar integração, Q-010); senão, arquivo gerado no fim do dia para envio manual, com confirmação do protocolo.
- **Trava da Prisa:** a viagem não passa a **Documentada** sem protocolo de averbação. CT-e sem averbação no fim do dia é o item mais vermelho da tela Hoje.
- Cancelamento de CT-e gera o cancelamento da averbação.

### 7.3 Emitir o MDF-e
- **Gatilho:** CT-e(s) da viagem autorizados.
- **Passos:** gerar a partir dos CT-e da viagem (veículo, motorista, UF de carregamento e descarga, percurso) → autorizar.
- **Trava legal:** não emitir novo MDF-e para o mesmo veículo e mesma UF de carregamento com outro aberto; o sistema mostra qual está aberto e oferece encerrar.

### 7.4 Encerrar o MDF-e
- **Gatilho:** viagem **Entregue** (descarga feita).
- **Quem:** Operação, no mesmo passo de conferir o canhoto. **[designer]**
- **Pronto quando:** MDF-e Encerrado. Fila MDF-e abertos com destaque após 24 h da entrega e após 5 dias da emissão, para não perder o prazo da legislação. **[designer: o prazo exato confirma o contador, Q-011]**

### 7.5 Corrigir, cancelar, complementar
| Situação | Caminho | Tipo |
|---|---|---|
| Erro em campo que não muda valor, partes nem data | Carta de correção | Aviso explica o que a CC-e não pode corrigir |
| Desistência ou erro antes de a carga circular | Cancelar CT-e, dentro do prazo da SEFAZ | Trava legal fora do prazo |
| Erro de valor ou de tomador depois do prazo | Anulação + substituto | Exige confirmação do admin **[designer]** |
| Valor a mais (diária, pedágio, frete) | CT-e complementar | — |
| Número pulado | Inutilização, no fechamento mensal | — |

Cancelar CT-e com contrato de frete pede o que fazer com o contrato (cancelar o CIOT, devolver adiantamento) antes de seguir.

### 7.6 Fim do dia fiscal
Conferência automática ao fim do dia: nenhum CT-e/MDF-e "Pendente" na SEFAZ, todo CT-e autorizado com averbação, todo XML guardado e enviado. O que falhar vira item na **Hoje** do dia seguinte com o nome de quem emitiu.

---

## 8. Rotina 5 — Contrato de frete e pagamento do motorista

Vale para motorista terceiro e agregado (com CIOT). Frota própria sem CIOT pula esta rotina; adiantamentos ao funcionário entram na rotina 6.

### 8.1 Montar o contrato
- **Gatilho:** CT-e autorizado de viagem com terceiro/agregado. O contrato é criado **junto** com o CT-e (o ATUA tem "Emite Contrato de Frete: Sim/Não" na emissão, EV-012).
- **Quem:** Operação.
- **Passos:** frete motorista (da viagem) → conferência do **piso da ANTT** (eixos, tipo de carga, km; **trava legal**) → descontos (INSS e SEST/SENAT para proprietário PF conforme cadastro, taxa adm., outros) → acréscimos → vale-pedágio → adiantamento (sugestão: o limite do cadastro do proprietário) → saldo previsto → CIOT pela PAMCARD.
- **Trava legal:** contrato sem CIOT não pode ser pago.
- **Pronto quando:** contrato com CIOT e adiantamento definido. A viagem pode ficar **Documentada**.

### 8.2 Pagar a saída
- **Gatilho:** viagem Documentada.
- **Quem:** Financeiro aprova (seção 3.3) e paga pela PAMCARD (ou pelo meio cadastrado).
- **Passos:** conferir o contrato → pagar adiantamento → comprar/carregar o vale-pedágio (obrigatório por lei quando há praça de pedágio na rota).
- **Pronto quando:** adiantamento pago (ou zero) e vale-pedágio emitido. A viagem pode **Sair**.

### 8.3 Calcular o saldo
- **Gatilho:** viagem **Entregue** (canhoto conferido + peso de chegada).
- **Quem:** sistema calcula; Operação confere.
- **Cálculo:** saldo = frete motorista − adiantamento − descontos + acréscimos − **quebra** (peso de saída − peso de chegada acima da tolerância, pelas regras de quebra do cadastro do proprietário e do contrato, EV-013) ± **diária** (horas de espera acima do combinado, pago ao motorista e, se for o caso, cobrado do cliente por CT-e complementar).
- **Pronto quando:** saldo conferido pela operação.

### 8.4 Pagar o saldo
- **Quem:** Financeiro aprova e agenda; paga na data (à vista ou parcelado, conforme o contrato).
- **Trava da Prisa:** sem canhoto conferido não há pagamento do saldo. Exceção do admin com justificativa (ex.: canhoto extraviado com declaração do cliente).
- **Pronto quando:** saldo pago e contrato **Quitado**. Com MDF-e encerrado, a viagem fica **Encerrada**.

### 8.5 Bloqueio
Qualquer pessoa da operação ou do financeiro pode **bloquear** o pagamento de um contrato com motivo (avaria, documento faltando, divergência). Bloqueado não aparece em "Saldos a liberar"; aparece em "Contratos bloqueados" com a idade do bloqueio. Desbloquear exige motivo.

---

## 9. Rotina 6 — Frota própria

Vale para os veículos com unidade operacional "Frota Própria" (EV-014: Terceirização, Frota Própria, Prisa Apucarana). O estudo de Frota e Oficina no ATUA está incompleto (EV-014, telas não lidas); esta rotina será detalhada depois desse estudo e da entrevista. O mínimo para funcionar:

### 9.1 Despesas
- **Importação** semanal dos cartões de frota (combustível, pedágio, manutenção): Ticket Log, TruckPag, Pro Frotas e outros que a Prisa usar **[entrevista]**. Cada linha casa com placa pela placa ou número de frota; o que não casar vai para a fila.
- **Lançamento manual** de nota de oficina, peça, pneu: placa, centro de custo, unidade operacional, anexo da nota (R-021).
- **Pronto quando:** toda despesa tem placa (ou "administrativo"), centro de custo e anexo.

### 9.2 Manutenção
- Plano por veículo: itens por km ou por data (troca de óleo, revisão, lonas, tacógrafo). O km vem do abastecimento importado.
- Fila de manutenção vencendo/vencida. Ordem de serviço com peças, mão de obra e custo, que vira despesa.
- Veículo em manutenção fica **Parado** (Situação Operacional já existe) e sai da sugestão de conjunto.

### 9.3 Pneus
Cadastro por número de fogo, posição no veículo, movimentação (rodízio, recapagem, descarte com motivo), km rodado por pneu. **[entrevista: a Prisa controla pneu individual hoje?]**

### 9.4 Motorista funcionário
Adiantamento/vale de viagem e acerto de viagem (o ATUA tem "Acerto Viagem" e "Emissão Vale/Adiantamento"): despesas da viagem prestadas pelo motorista contra o vale.

### 9.5 Mensal
Custos fixos (IPVA, seguro, financiamento, rastreador) rateados por mês; **custo por km** e **resultado por veículo** (receita das viagens − custos).

---

## 10. Rotina 7 — Financeiro

O ATUA tem 71 telas de financeiro e várias listagens vazias (EV-014); só **Antecipação de Valor** (105 registros), bancos e caixas aparecem em uso. O NILT começa pelo que fecha o ciclo da viagem e acrescenta o resto conforme a entrevista (Q-012). **[designer]**

### 10.1 Faturar
- **Gatilho:** CT-e autorizado. Conforme a condição do cliente: fatura por CT-e na hora, ou agrupada no período (semanal, quinzenal, mensal).
- **Quem:** Financeiro.
- **Passos:** a fila "A faturar" agrupa os CT-e por tomador e período → gerar fatura → boleto (CNAB do banco) ou Pix → enviar fatura + DACTE + XML ao e-mail de cobrança do cliente → registrar o protocolo de entrega quando o cliente exige.
- **Pronto quando:** todo CT-e autorizado e não cancelado está em uma fatura. CT-e cancelado sai da fatura sozinho (com aviso se ela já foi enviada).

### 10.2 Receber
- Retorno bancário (CNAB) ou conciliação (OFX) baixa os títulos pagos.
- **Cobrança:** título vencido entra em "A receber vencido" com dias de atraso e histórico de contatos. Cliente com títulos vencidos acima de um limite gera **aviso** ao criar pedido novo para ele.
- **Antecipação de recebíveis** (em uso no ATUA): registrar a antecipação de títulos de um cliente, a taxa e o saldo, e baixar os títulos quando o cliente pagar ao banco/factoring. **[entrevista: com quem e como a Prisa antecipa]**

### 10.3 Pagar
- **Contrato de frete:** vem da rotina 5 já aprovado; aqui só aparece no fluxo de caixa e na conciliação.
- **Fornecedores e despesas:** títulos de débito com vencimento, anexo e centro de custo; pagamento por remessa bancária ou manual; o mesmo princípio de duas pessoas (3.3) para valores acima de um limite configurado pelo admin. **[designer]**

### 10.4 Conciliar
- **Diária:** importar o OFX (ou retorno) de cada conta; o sistema sugere o casamento por valor e data; o que não casa fica na fila.
- **Pronto quando:** saldo do banco = saldo do sistema por conta.

### 10.5 Fechar o mês
Checklist do fechamento, com o sistema marcando o que já está ok:
1. Todas as contas conciliadas até o último dia.
2. Todos os CT-e do mês faturados ou com motivo.
3. Nenhum MDF-e aberto do mês; numeração inutilizada.
4. Contratos de frete do mês quitados ou com motivo (bloqueio, canhoto faltando).
5. Despesas da frota do mês com placa e centro de custo.
6. Relatórios: **resultado por CT-e/viagem** (R-019: frete empresa − frete motorista − impostos − pedágio − comissão − outros custos), **por veículo**, **por cliente**, e fluxo de caixa realizado × previsto.
7. Exportação para o contador (XML do mês, relação de CT-e, títulos). Formato **[entrevista / contador, Q-011]**.

---

## 11. Papéis

Os papéis já existem no banco (`app_papel`: admin, operacao, financeiro, leitura). Mapeamento **[designer]**:

| Rotina | Operação | Financeiro | Admin | Leitura |
|---|---|---|---|---|
| 1 Cadastros | faz | vê | faz, libera exceção | vê sem documentos restritos |
| 2 GR | faz | vê | faz | vê situação, não o motivo |
| 3 Operação | faz | vê | faz | vê |
| 4 Fiscal | faz | vê, baixa XML | faz, aprova anulação | vê |
| 5 Contrato | monta, confere saldo, bloqueia | aprova, paga, bloqueia | tudo, com justificativa se for o mesmo que montou | vê |
| 6 Frota | lança, importa | vê custos | faz | vê |
| 7 Financeiro | vê faturas dos seus clientes | faz | faz | vê relatórios |

Se a entrevista mostrar uma pessoa só no fiscal ou na frota, entra um papel novo; a tela **Hoje** já filtra por papel. **[entrevista]**

---

## 12. O que a entrevista precisa confirmar

**Decisões do usuário (2026-10-23), depois da revisão do builder:**
- **A. Kanban antecipado** (usuário: "sim, antecipa o kanban"): a próxima entrega é pedido + viagem + Quadro da operação + tela Hoje, logo depois do complemento da fase 1; frota e GR vêm depois (seção 13).
- **B. Um CNPJ só** (usuário). Prisa Apucarana e as demais são **unidades operacionais** para custo e filtro, não emitentes. Uma série de CT-e e de MDF-e; nada de empresa/filial nas chaves.
- **C. Admin no dia a dia:** sem resposta ainda. Padrão do designer até lá: usar o papel admin que já existe, que pode ser dado a mais de uma pessoa da operação; nenhum papel novo é criado agora. **[designer]**

Os itens abaixo não bloqueiam escrever o plano da próxima fase, mas cada um muda detalhes da rotina. Por importância:

1. **Quem faz o quê hoje** entre as ~5 pessoas, e se a mesma pessoa monta e paga o contrato (afeta 3.3 e seção 11).
2. **Qual caminho do ATUA a Prisa usa para emitir** (lote, ordem, agendamento...) e se um pedido costuma gerar muitas viagens (afeta seção 6).
3. **Quais gerenciadoras de risco**, a validade de cada consulta e quais clientes exigem SM (afeta seção 5).
4. **Condições de faturamento** dos principais clientes e como a antecipação de recebíveis é feita (afeta 10.1 e 10.2).
5. **Proporção de frota própria x agregados x terceiros** e se pneu e manutenção são controlados hoje (afeta o tamanho da rotina 6).
6. **Regras de quebra e diária** praticadas (tolerância, cobrança do cliente) (afeta 8.3).
7. Horários e ritmo reais do dia (afeta 3.4 e o resumo diário).

Perguntas externas já abertas e que condicionam as rotinas 4, 5 e 7: Q-008 (API fiscal), Q-009 (PAMCARD), Q-010 (averbação), Q-011 (contador), Q-012 (uso do financeiro).

---

## 13. Ordem de entrega das rotinas

Segue a ordem de fases do design do NILT (seção 6), com estes acréscimos **[designer]**:

| Fase do NILT | Entrega desta spec |
|---|---|
| 1 Cadastros (feita) + complemento | Tela **Hoje** com as filas da rotina 1; aptidão (4.4); trava/aviso/exceção (3.2) |
| **Próxima entrega (antecipada, decisão A)** | Cadastros mínimos de cliente e local (4.5) para criar pedido; pedido e viagem (6.1, 6.2, 6.4, 6.5); **Quadro da operação (3.5)** com as 10 colunas e tempo real; para liberar "Em rota", a chave do CT-e/MDF-e do ATUA (seção 7, paralelo) e a confirmação "adiantamento e vale-pedágio pagos no ATUA" (quem e quando), já que o contrato ainda não está no NILT; filas da rotina 3 na tela Hoje. Sem emissão fiscal, contrato ou GR do NILT ainda: a aptidão só confere cadastro (4.4); GR entra como aviso manual |
| 2 Frota | Rotina 6 (9.1 e 9.2 primeiro; pneus e acerto depois do estudo) |
| 3 GR | Rotina 2 e a parte de GR da aptidão |
| antes da 4 | Cadastros de 4.5 (cliente, local, seguradora, posto, produto) |
| 4 Operação e fiscal | Rotinas 4 e 5 (CT-e, MDF-e, averbação, contrato, CIOT) sobre a viagem que já existe, em homologação em paralelo com o ATUA; o Quadro passa a ler os documentos do NILT |
| 5 Financeiro | Rotina 7 |
| 6 App do motorista | Botões que movem o cartão no Quadro (3.5), pausa, canhoto (6.5), envio de documentos (4.1) |

A tela **Hoje** cresce a cada fase: cada rotina entregue traz suas filas. Por decisão do usuário (A), o Quadro vem antes de frota e GR.

---

## 14. O que fica para o builder

- Modelo de dados de pedido, viagem, contrato, título, despesa e das filas (view, tabela de tarefas ou eventos).
- Como a situação da viagem é derivada dos fatos (view, coluna gerada ou trigger), mantendo a regra no banco (PRODUCT.md, princípio 2).
- Mecanismo das conferências diárias e do resumo por e-mail.
- Formato da configuração de travas (seção 3.2) e dos limites (cobrança, aprovação dupla).
- Tradução das rejeições da SEFAZ e o layout de cada fila.
- Testes de cada trava legal e de cada trava da Prisa, incluindo a exceção do admin com justificativa auditada.
