# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript no sistema web, Supabase (Postgres, Auth, Storage, RLS) como banco, login e arquivos, hospedagem na Vercel; app do motorista futuro em Expo (React Native). Proposto pelo designer e aprovado pelo usuário no documento de design (`docs/superpowers/specs/2026-10-22-nilt-design.md`). Banco da fase 1 em `supabase/migrations/`.

## Users

- **Equipe de operação da Prisa Logística e Transportes**, cerca de 5 pessoas, internas e externas. Usam o sistema **principalmente no computador**. Cadastram e mantêm motoristas, proprietários (pessoa física e empresa), veículos (cavalo, carreta, dolly) e conjuntos, conferem documentos e vencimentos. O cadastro é feito **com calma e completo, antes da primeira carga**, não na correria do carregamento.
- **Administrador** (o dono do projeto): define quem acessa e com qual papel (admin, operação, financeiro, leitura).
- **Motoristas**: usarão um app próprio em fase futura; não usam o sistema web.

## Product Purpose

O NILT — Núcleo Integrado de Logística e Transporte — é o TMS próprio da Prisa e vai substituir por completo o ATUA Mais Frete, que será desligado. A fase 1 entrega os cadastros: pessoa, motorista, proprietário, veículo, conjunto, documentos, permissões e auditoria. Fases seguintes: frota, gerenciadora de risco, operação com CT-e e MDF-e, contrato de frete, financeiro e app do motorista. Sucesso: a Prisa opera só no NILT e cancela o ATUA sem perder nenhum dado.

## Positioning

Feito em volta da operação real da Prisa, não de um TMS genérico: uma mesma pessoa pode ser motorista e proprietária; cada placa tem dono de documento (CRLV) e dono na ANTT, e o veículo arrendado é reconhecido sozinho; o conjunto é montado no cavalo na ordem física de engate (carreta, dolly, carreta) com o peso máximo de tração conferido; documentos têm tipo, validade e pendências visíveis. Tem todos os campos de cadastro do ATUA, com telas mais diretas.

## Operating Context

- Documentos do mundo do transporte rodoviário de cargas: CNH (registro, Renach, categoria, validade), CRLV (Renavam, chassi, exercício, CMT, PBT, tara), RNTRC/ANTT (TAC, ETC, CTC), comprovante de residência, referências pessoais e comerciais, contrato de arrendamento.
- Tipos de veículo com eixos no nome (cavalo simples ou trucado, carretas basculante, graneleiro, baú, sider, dolly); placa antiga e Mercosul; TAG de pedágio (Veloe, ConectCar, Move Mais, Taggy, Sem Parar via PAMCARD).
- CPF validado pelos dígitos; CNPJ consultado na BrasilAPI.
- O sistema antigo (ATUA) é uma interface PHP de tabelas densas com muitos campos; a equipe está acostumada a fichas com abas.

## Capabilities and Constraints

- Fase 1 só cadastros; nada de CT-e ou frota nas telas ainda.
- Financeiro (primeira parte): importação do extrato bancário em OFX, lançamentos classificados em receita e pagamento de frete (Roadcard), despesa, empréstimo e devolução, aporte e devolução de capital e transferência entre contas, com regras aprendidas pela descrição, e o resultado de cada mês. Só administrador e financeiro veem.
- Piso ANTT e resultado do CT-e (regras do motor de despacho, `docs/motor-despacho-regras.md`): o pedido tem o tipo de carga da Tabela A; a viagem tem km e pedágio. O frete do motorista abaixo do piso é trava legal no início da viagem; sem frete ou sem km é trava que o administrador libera com justificativa; frota própria não confere. Todos veem o piso; o resultado do CT-e (ICMS, PIS/COFINS, INSS, Pan Card, IRPJ/CSLL, margem e faixa) só administrador e financeiro. Tabela da ANTT e parâmetros fiscais ficam no banco com data de vigência.
- Calcular frete (`/calculadora`, da Calculadora de Frete PRISA): decide a contratação antes de haver pedido. Rota com km da rota medida pela Prisa ou estimado entre os municípios, pedágio estimado, frete mínimo ANTT, sugerido (mínimo + 40% + pedágio) e contratado lado a lado, checklist do CIOT e o veredito (pode contratar, negociar, ajustar, não contratar) com os limites em reais. Margem líquida mínima de 8,5%. Todos usam; impostos, margem e resultado do CT-e só administrador e financeiro. A ficha da viagem abre a calculadora preenchida. Modo "Lote de carga": o total do lote a um preço por tonelada, a composição de caminhões (5, 6, 7 e 9 eixos) com o frete do motorista começando no piso de cada um, "Distribuir o peso", o veredito do lote com o preço mínimo por tonelada e o custo mínimo por tonelada de cada tipo de caminhão na rota.
- Todos os campos de cadastro do ATUA existem no NILT (decisão do usuário).
- Regras no banco: RLS por papel, auditoria de toda alteração e de toda visualização de documento, bucket de documentos privado, arquivo restrito visível só ao admin.
- LGPD: documentos pessoais de terceiros; acesso restrito e registrado.
- Usuários são criados no painel do Supabase; o NILT atribui papel e ativa ou desativa.
- Em aberto: papéis definitivos (a entrevista com a equipe pode mudar), regras de cadastro duplo durante a transição do ATUA.

## Brand Commitments

- Nome: **NILT — Núcleo Integrado de Logística e Transporte**.
- A Prisa não tem identidade visual definida; o NILT tem identidade própria, criada do zero.
- Interface inteira em português do Brasil (datas dd/mm/aaaa, CPF, CNPJ, placa e telefone nos formatos brasileiros).

## Evidence on Hand

- Estudo de campos e regras do ATUA: `re-atua-mais-frete/` (evidências EV-001 a EV-014).
- Não há logo, fotos, depoimentos nem números de negócio; nada disso pode ser inventado.
- Dados de demonstração precisam ser fictícios e marcados como tal.

## Product Principles

1. Nenhum campo do ATUA se perde; o que muda é o caminho até ele.
2. A regra vive no banco; a tela explica a regra e nunca a contorna.
3. Pendência visível vale mais que alerta escondido: documento vencido, arrendado sem contrato e conjunto acima do CMT aparecem onde se trabalha.
4. Ficha completa com calma: telas de cadastro organizadas em seções e abas, sem pressa artificial.
5. Português claro do transporte: os nomes que a equipe usa (cavalo, carreta, dolly, CRLV, RNTRC), nunca jargão de sistema.

## Accessibility & Inclusion

WCAG 2.1 AA como mínimo (contraste, foco visível, navegação por teclado, rótulos em todos os campos). Uso principal em computador; precisa funcionar no celular sem quebrar.
