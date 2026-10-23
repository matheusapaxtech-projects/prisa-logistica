# NILT — Núcleo Integrado de Logística e Transporte

Documento de design

Data: 2026-10-22 · Status: rascunho para aprovação
Base de conhecimento do sistema atual: `re-atua-mais-frete/` (estudo do ATUA Mais Frete; leia `REPORT.html` ou os arquivos citados abaixo).

## 1. Intenção

A Prisa Logística e Transportes usa hoje o TMS **ATUA Mais Frete** (`prisa.atua.com.br`). A empresa quer um **sistema próprio, o NILT (Núcleo Integrado de Logística e Transporte)**, que substitua o ATUA por completo, para depois **desligar o ATUA de vez**. Não há prazo; o ritmo é definido pela qualidade de cada parte.

O sistema novo precisa:
- ter **todos os campos que o ATUA tem** nos cadastros (decisão do usuário: "todos os campos do cadastro do atua tem que ter no sistema novo");
- cobrir cadastros, operação, **CT-e e MDF-e**, contrato de frete, **custos de frota, pneus, centro de custo**, **gerenciadora de risco** e financeiro (decisão do usuário);
- ter um **app para o motorista** acompanhar a viagem (decisão do usuário).

"Simplificado" passou a significar telas mais diretas e fluxos mais curtos, não menos dados.

### Quem usa
- Cerca de **5 pessoas** da operação, equipe interna e externa (usuário). A equipe externa usa fora do escritório, provavelmente pelo celular (a confirmar na entrevista).
- **Motoristas**, pelo app.

### O que é sucesso
- A Prisa opera um mês inteiro só no sistema novo, com CT-e, MDF-e e pagamento de motorista funcionando, e o ATUA pode ser cancelado.
- Nenhum dado necessário fica preso no ATUA (cadastros migrados, XML fiscais guardados).

### Anti-objetivos (o que faria o projeto fracassar mesmo funcionando)
- Emitir um CT-e ou MDF-e errado em produção por falta de teste.
- Perder o histórico fiscal: XML de CT-e e MDF-e precisam ficar guardados por pelo menos 5 anos.
- Expor documentos pessoais (CNH, comprovantes, contas bancárias) de motoristas e proprietários.
- Ficar sem conseguir pagar o motorista (CIOT, adiantamento, saldo) no dia da virada.
- Tocar ou alterar dados do ATUA durante a construção. O ATUA é produção e é só leitura até ser desligado.

## 2. Restrições

- **Fiscal:** CT-e (modelo 57), MDF-e, RPS/NFS-e e, provavelmente, NF-e própria. Já é exigido o cálculo de **IBS / CBS** da reforma tributária além do ICMS (`re-atua-mais-frete/evidence/EV-013`).
- **Guarda fiscal:** XML autorizados guardados por 5 anos ou mais.
- **CIOT:** pagamento de motorista autônomo exige CIOT por administradora habilitada; hoje é a **PAMCARD**.
- **LGPD:** documentos pessoais guardados com acesso restrito e registro de quem viu e alterou.
- **ATUA:** é produção. Qualquer novo estudo é **somente leitura e em ritmo humano**: o ATUA bloqueia a navegação por volume de requisições (incidente L-001 no estudo).
- **Dados reais** nunca entram em código, testes ou documentação; use dados fictícios.

## 3. Decisões já tomadas

### Do usuário
- Substituir o ATUA inteiro e desligá-lo; sem data-limite.
- Todos os campos dos cadastros do ATUA existem no sistema novo.
- Módulos dentro do sistema: cadastros, CT-e, MDF-e, contrato de frete, frota (custos, pneus, centro de custo), gerenciadora de risco, financeiro, app do motorista.
- CPF validado só pelos dígitos verificadores; CNPJ consultado na **BrasilAPI** (base pública).
- Caminhão arrendado: registrar o proprietário real e anexar o **contrato de arrendamento no veículo**.
- Capacidade de carga: dois conceitos, cada um bem definido (ver 5.3).
- Ordem do conjunto: "decida o melhor" (ver 5.4).
- Arquitetura da seção 4 aprovada ("está ótimo").

- Nome do sistema: **NILT — Núcleo Integrado de Logística e Transporte**.
- **Tabela de frete não é construída no NILT:** a Prisa já tem outro projeto que faz isso (usuário). O NILT consome os valores desse projeto; a forma de integração está em aberto (seção 9).

### Do designer (Claude), aprovadas junto com a arquitetura
- Stack, hospedagem, API fiscal e ordem das fases da seção 4.
- Regras de capacidade e de ordem do conjunto da seção 5.

### Do designer (Claude), depois da revisão do builder (para o usuário conferir)
- **Cadastros ainda não estudados** que alimentam o CT-e (clientes, rotas, seguradoras, postos) entram no NILT com todos os campos do ATUA; são estudados no ATUA, em ritmo lento, antes da fase 4.
- **Critério de confiável na operação em paralelo:** um mês inteiro de CT-e reproduzido no NILT em homologação com os mesmos valores do ATUA.
- **Contratos de frete em aberto na virada** são quitados no ATUA; o ATUA fica ativo depois da virada só para isso, até não restar contrato aberto.

## 4. Arquitetura

### 4.1 Peças

| Peça | Tecnologia | Função |
|---|---|---|
| Sistema web da operação | Next.js (App Router) + TypeScript, na Vercel | Todas as telas da operação; funciona no computador e no celular |
| Banco e autenticação | Supabase (Postgres, Auth, Storage, RLS) | Dados, login por usuário, permissões, arquivos |
| Arquivos | Supabase Storage, buckets privados | CNH, CRLV, comprovantes, contratos, canhotos, XML fiscais |
| App do motorista | Expo (React Native), Android primeiro | Câmera, localização, notificações; mesmo backend |
| Emissão fiscal | API de emissão homologada (ex.: Focus NFe, TecnoSpeed, PlugNotas) | CT-e, MDF-e, NFS-e, NF-e; o certificado A1 fica com o fornecedor |
| Tarefas em segundo plano | A definir pelo builder (ex.: Supabase Edge Functions, cron, fila) | Consultar status na SEFAZ, retorno bancário, vencimentos, notificações |

O sistema **não** fala direto com a SEFAZ.

### 4.2 Integrações

| Integração | Para quê | Situação |
|---|---|---|
| BrasilAPI | Consultar CNPJ e preencher razão social e endereço | Pública |
| PAMCARD | CIOT, adiantamento, saldo, vale-pedágio, TAG | Precisa confirmar API e contrato (Q-009) |
| ATM ou Tokio Marine | Averbação do seguro da carga por CT-e | Precisa confirmar (Q-010) |
| Bancos (Itaú e outros) | Remessa e retorno (CNAB), extrato OFX | Arquivos |
| Projeto de tabela de frete da Prisa (existente) | Valor do frete por rota, carga e veículo, usado no cálculo do CT-e e do contrato de frete | Forma de integração em aberto |
| Gerenciadora de risco | Consulta de motorista e veículo, monitoramento de viagem | Quais GR: a entrevista vai dizer |
| API fiscal | Emissão e eventos de CT-e, MDF-e, NFS-e | Escolher fornecedor (Q-008) |

### 4.3 Ambientes
- **Teste** (banco e API fiscal em homologação da SEFAZ) e **produção**, separados.
- A operação e o fiscal rodam **em paralelo com o ATUA** em homologação até serem confiáveis, antes de qualquer documento real.

### 4.4 Segurança e LGPD
- Login individual para cada pessoa da operação; o motorista entra no app com conta própria e vê só os dados dele.
- Permissões por papel (ex.: operação, financeiro, administrador; os papéis exatos saem da entrevista).
- Regras de acesso no banco (RLS), não só na tela.
- Registro de auditoria: quem criou, alterou e visualizou documentos e cadastros.
- Arquivos sempre privados, servidos por link temporário.

## 5. Módulos

A referência completa de campos de cada tela do ATUA está na base de conhecimento. O sistema novo replica **todos** os campos de cadastro; nas demais telas, replica o que a Prisa usa (a entrevista e o estudo definem).

### 5.1 Pessoa, motorista e proprietário
Referência: `re-atua-mais-frete/evidence/EV-007`, `EV-008`; regras R-001 a R-004, R-009, R-010.
- **Uma entidade Pessoa** com papéis: motorista e/ou proprietário. Endereços, telefones (com WhatsApp), e-mails, contas bancárias, chaves Pix e arquivos pertencem à Pessoa e são compartilhados entre os papéis.
- Pessoa física (CPF) ou jurídica (CNPJ).
- **CPF:** validação local dos dígitos. **CNPJ:** consulta na BrasilAPI ao digitar, preenchendo os dados; o usuário pode corrigir.
- **Motorista:** dados pessoais, CNH completa (registro, formulário, segurança, Renach, categoria, validade, 1ª habilitação), referências (Pessoal ou Comercial, com telefone e data), comprovante de residência.
- **Proprietário:** RNTRC/ANTT com enquadramento (TAC só para PF; ETC, CTC, ETC equiparado) e validade; dados extras de pagamento (taxa adm., limite de adiantamento, regra de peso). Para PJ, **responsável com telefone de contato** (pedido do usuário; no ATUA é só texto livre).
- **Dados bancários do proprietário PJ** no CNPJ dele; o sistema avisa quando o titular da conta ou Pix não bate com o CPF/CNPJ do proprietário.
- Proprietário PF: documentos e comprovante de residência do proprietário, além dos do motorista quando forem pessoas diferentes.
- **Arquivos** com tipo (lista do ATUA: ANTT, CNH, COMP. RESIDÊNCIA, CONTRATO, CRV / DUT, DOC PESSOAL, FOTO, FOTO CONJUNTO etc.), validade, quem validou e quando.
- Situações: Cadastro {Cancelado; Pendente; Normal}, Dados {Vencido; Habilitado} conforme vencimentos, GR (gerenciadora de risco).

### 5.2 Veículo
Referência: `EV-001`, `EV-006`, `EV-010`; regras R-005 a R-008, R-012.
- Uma placa por veículo: cavalo, carreta, dolly ou outro. Todos os campos do CRLV, tipo (lista com eixos no nome; categoria Caminhão/Cavalo, Carreta, Outros), marca, modelo, anos, Renavam, chassi, cidade de emplacamento.
- **Dois proprietários por placa:** Proprietário Posse (CRLV) e Proprietário Documento (ANTT). Quando diferentes, o veículo é **arrendado**: marcar a **Situação Operacional = Arrendado** e exigir o **arquivo CONTRATO** anexado ao veículo.
- Configuração do cavalo: **toco (simples, 2 eixos) ou trucado (3 eixos)**, derivada do tipo.
- Tipos de carreta: basculante, graneleiro, baú, sider, slider, grade baixa, porta-contêiner, prancha, tanque e os demais do ATUA.
- **TAG de pedágio:** número e operadora.
- Seguro, rastreador (empresa, modelo, número, tipo), carroceria (assoalho, medidas).
- Dados de frota própria (do "Veículo Agregado" do ATUA): número de frota, vencimentos de IPVA e seguro, potência, tanque, tara, aquisição, km inicial, médias, centro de custo e unidade operacional, Situação Operacional {Ag. Motorista; Apreendido; Arrendado; Ativo; A Venda; Devolvido; Parado; Sinistro; Vendido}.

### 5.3 Capacidade (decisão do designer)
- **CMT (t):** capacidade máxima de tração, no cavalo, vinda do CRLV. Limite do conjunto inteiro.
- **Peso bruto total (t)** e **tara (t)** em cada placa.
- **Capacidade de carga (t)** de cada carreta = peso bruto − tara. Calculada e editável.
- **Capacidade do conjunto** = soma das capacidades das carretas. Aviso quando passar de CMT − soma das taras.

### 5.4 Conjunto (decisão do designer)
Referência: `EV-010`, R-011.
- O conjunto pertence ao **cavalo**. As peças seguem a **ordem física de engate**: posição 1 = carreta que engata no cavalo; depois dolly; depois a carreta seguinte.
- Validação: dolly nunca na primeira nem na última posição; dois dollies nunca seguidos.
- Histórico: cada combinação guarda início e fim; uma é o **conjunto atual**. O motorista atual fica ligado ao conjunto.
- O CT-e leva cavalo, até 3 carretas (dolly incluso), motorista e os dois proprietários (R-015).

### 5.5 Gerenciadora de risco
- Registrar consulta de motorista e veículo por gerenciadora, resultado, validade e vencimento (Situação GR).
- Monitoramento da viagem (SM), quando a GR exigir.
- Regras por cliente (ex.: exigências mínimas) — definidas pela entrevista.
- Integração automática só depois de saber quais GR e se oferecem API; até lá, registro manual com anexo do resultado.

### 5.6 Operação: pedido, ordem e viagem
Referência: `EV-012`.
- Pedido do cliente → ordem de carregamento ou lote → viagem com conjunto e motorista → CT-e, MDF-e e contrato de frete.
- O ATUA tem Lote de Carregamento, Ordem de Carregamento, Minuta, Coleta, Agendamento e Embarque. O sistema novo começa pelo fluxo que a Prisa realmente usa (entrevista, seção 06) e não precisa replicar os seis.

### 5.7 CT-e, MDF-e e fiscal
Referência: `EV-011`, `EV-012`, `EV-013`; regras R-013 a R-017, R-019.
- Emissão a partir da ordem ou lote, com as NF-e do cliente; modelo CT-e 57 ou RPS/NFS-e.
- Todas as partes: remetente, expedidor, recebedor, destinatário, tomador, redespacho.
- Valor do frete vem do projeto de tabela de frete da Prisa; o NILT aplica a tarifa (total, por unidade, por tonelada, por km, por quantidade), ICMS (isento, incluso, somado), pedágio (sem, incluso, cobrado, pago na TAG), ad valorem, seguro, GRIS, TDA, TDE, TRT e outros.
- Impostos: ICMS (base, alíquota, CST, ST) e **IBS / CBS**; tabelas de CFOP, alíquotas por UF e operação fiscal.
- Ciclo de vida: autorizar, consultar, cancelar, anular, substituir, complementar, inutilizar, carta de correção; situação SEFAZ {Rejeitado; Pendente; Autorizado; Cancelado; Denegado; Inutilizado}.
- MDF-e: gerar a partir dos CT-e, autorizar, encerrar, cancelar; aviso de MDF-e aberto.
- Averbação do seguro de cada CT-e.
- DACTE e DAMDFE em PDF; envio de XML e PDF por e-mail.
- Guarda dos XML por 5 anos ou mais, com busca por chave.
- **Resultado por CT-e:** frete empresa, frete motorista, impostos, comissão, margem (R-019).

### 5.8 Contrato de frete e pagamento do motorista
Referência: `EV-013`, R-018.
- Contrato ligado ao CT-e: CIOT pela administradora (PAMCARD), adiantamento e saldo em parcelas, descontos, acréscimos, vale-pedágio, quebra de peso, diária, bloqueio de pagamento, retorno do canhoto libera o saldo.
- Frete mínimo pelo piso da ANTT (eixos, tipo de carga, custo por km).
- Descontos de INSS e SEST/SENAT para proprietário PF.

### 5.9 Frota, oficina e pneus
Referência: `EV-014` (estudo parcial; Frota e Oficina ainda não lidas).
- Custos por veículo (combustível, manutenção, pneus, IPVA, seguro, financiamento), com **centro de custo e unidade operacional** (Terceirização, Frota Própria, Prisa Apucarana).
- Importação de despesas de cartões de frota (o ATUA aceita Ticket Log, TruckPag, Pro Frotas e outros).
- Pneus: cadastro, posição, movimentação, descarte. Ordem de serviço, peças, estoque, checklist.
- O detalhe depende da entrevista (seção 10) e do estudo pendente da Frota no ATUA.

### 5.10 Financeiro
Referência: `EV-014`.
- Contas a pagar (títulos de débito, pagamento de contrato de frete, remessa e retorno bancário) e a receber (fatura de CT-e, boletos, protocolo, títulos de crédito, inadimplência).
- Caixa, bancos, antecipação de valores (105 registros no ATUA: em uso), conciliação OFX.
- O escopo exato depende da entrevista (seção 09; Q-012).

### 5.11 App do motorista
- Ver a viagem: carga, destino, endereços com mapa, documentos (CT-e, MDF-e, contrato), valores (frete, adiantamento, saldo) e situação do pagamento.
- Fazer: enviar fotos de documentos para cadastro, avisar chegada no carregamento e na descarga, enviar foto do canhoto, registrar ocorrência, compartilhar localização.
- Ver vencimentos dos próprios documentos.
- Lista final de funções: entrevista, seção 13.

## 6. Ordem de construção

Cada fase termina testada e em uso antes da próxima.

1. **Cadastros:** Pessoa, motorista, proprietário, veículo, conjunto, arquivos, permissões e auditoria.
2. **Frota:** custos, centro de custo, pneus, manutenção.
3. **Gerenciadora de risco:** consultas e validade.
4. **Operação e fiscal:** pedido/ordem/viagem, CT-e, MDF-e, contrato de frete, averbação, PAMCARD. Roda em paralelo com o ATUA em homologação.
5. **Financeiro.**
6. **App do motorista**, liberado em partes conforme as fases ficam prontas.
7. **Migração e desligamento:** importar cadastros do ATUA, guardar XML fiscais, operar um mês só no sistema novo, cancelar o ATUA.

Em paralelo, desde o início: escolher a API fiscal (Q-008), falar com a PAMCARD (Q-009), com a corretora/ATM (Q-010) e com o contador (Q-011), porque esses prazos não dependem do código.

## 7. Migração de dados
- Cadastros (pessoas, motoristas, proprietários, veículos, conjuntos) exportados do ATUA por relatório ou planilha e importados no sistema novo, com conferência.
- XML de CT-e e MDF-e já emitidos guardados no sistema novo (ou em arquivo) por 5 anos.
- Histórico financeiro: a definir pela entrevista (seção 16).
- Nada de automação pesada contra o ATUA: exportações feitas pela própria equipe ou em ritmo humano.

## 8. Fora do escopo (por enquanto)
- Documentos internacionais (CRT, MIC) e RH do ATUA, a menos que a entrevista mostre uso.
- Portal do cliente.
- Integração automática com gerenciadora de risco antes de saber quais são usadas.

## 9. Perguntas abertas que não bloqueiam a fase 1
- Como o NILT conversa com o projeto de tabela de frete existente (API, mesmo banco, importação) e quais dados ele devolve.
- Q-008 a Q-012 em `re-atua-mais-frete/questions.md` (fornecedor fiscal, PAMCARD, averbação, regras fiscais, uso do financeiro).
- Respostas da entrevista (`entrevista/`), esperadas em breve, que definem o detalhe das fases 2 a 6.

## 10. O que fica para o builder
- Modelo de dados detalhado (tabelas, chaves, índices), respeitando a entidade Pessoa com papéis e todos os campos do ATUA.
- Organização do código, componentes e biblioteca de UI.
- Mecanismo de tarefas em segundo plano.
- Escolha final do fornecedor da API fiscal, depois de comparar preço, cobertura (CT-e, MDF-e, NFS-e, IBS/CBS) e qualidade.
- Testes, pipeline de deploy e monitoramento.
