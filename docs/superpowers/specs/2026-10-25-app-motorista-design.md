# App do motorista e do agregado — especificação

Data: 2026-10-25. Branch: `feat/app-motorista`. Tecnologia do app: Expo (React Native), Android primeiro
(`PRODUCT.md`). Banco e login: o mesmo Supabase do NILT.

## Objetivo

O motorista (ou agregado) se cadastra pelo celular, avisa quando está livre e vê os fretes em que ele pode
entrar. A Prisa fica sabendo antes quem está disponível e apto, e contrata com mais acerto. **A contratação
continua sendo da operação.**

## Decisões do usuário (2026-10-25)

| Pergunta | Resposta |
|---|---|
| O motorista vê o valor do frete dele antes de demonstrar interesse? | Sim. Vê só o frete dele: nunca frete da empresa, margem ou CT-e. |
| "Tenho interesse" reserva a carga? | Não. É um aviso para a operação, que decide. |
| Agregado tem prioridade sobre terceiro? | Depende da qualificação do sistema: quem vê o frete é decidido pelas regras de aptidão, e a ordem dos interessados para a operação é a nota do ranking. |
| Gerenciadora de risco | Ainda não definida. Por enquanto a consulta é digitada pela operação (`feat/despacho-fila`). |
| Login | Código pelo WhatsApp (Twilio Verify, que o Supabase aceita). |

## Como o frete chega ao app

O pedido sozinho não tem o frete do motorista (ele sai da calculadora: piso ANTT + percentual). Por isso a
operação **publica uma oferta** do pedido: frete do motorista por tonelada, carrocerias aceitas, eixos
mínimos e raio de busca (300 km por padrão). Só oferta publicada aparece no app, e só para quem passa nas
regras abaixo.

## Regras para o frete aparecer para o motorista

1. Usuário com papel `motorista`, ligado ao cadastro dele.
2. Cadastro do motorista em situação **normal** (cadastro feito pelo app nasce **pendente** até a Prisa
   conferir).
3. Tem conjunto aberto e ele não tem nenhuma trava na aptidão (`aptidao_viagem`: CNH, CRLV, RNTRC,
   gerenciadora de risco, conjunto aprovado…).
4. Check-in "Estou livre" válido (livre até depois de agora).
5. Até o raio da oferta, do ponto do check-in até o local de coleta (linha reta × fator da UF, o mesmo da
   calculadora).
6. Carroceria do conjunto entre as aceitas pela oferta (oferta sem carroceria = qualquer uma).
7. Eixos do conjunto ≥ eixos mínimos da oferta.
8. Pedido aberto e com saldo.

Quando o frete não aparece, o app mostra **o que falta** para ele ser contratado (a mesma lista da aptidão).

## Segurança (LGPD e sigilo)

- O papel `motorista` não entra em `pode_ler()`: ele não lê nenhuma tabela do sistema direto. Tudo que vê
  passa por funções do banco que filtram pelo próprio motorista e devolvem só os campos permitidos.
- O app nunca usa a chave secreta.
- Termo de consentimento, política de privacidade e permissão de localização explicada (exigência das lojas).
- Excluir a conta pelo próprio app (exigência da Apple).

## Etapas

1. **Banco (esta branch):** papel `motorista`, vínculo usuário ↔ motorista, carroceria no veículo, oferta de
   frete, interesse, check-in pelo app, funções `fretes_para_mim`, `minhas_pendencias`,
   `registrar_checkin`, `registrar_interesse`, `desistir_interesse`. Testes pgTAP.
2. Sistema web: publicar oferta na fila de fretes, ver interessados pelo app no ranking, carroceria no
   cadastro do veículo e no ranking, criar o acesso do motorista.
3. Autocadastro pelo app (pessoa, motorista, veículos, conjunto e fotos dos documentos, tudo pendente) e a
   tela de aprovação no sistema.
4. App Expo: login, check-in com GPS, lista de fretes, interesse, pendências.
5. Avisos no celular (frete novo perto, documento vencendo, contratação) e publicação na Play Store.
6. Fase 2: fotos do checklist e do canhoto, rastreamento por GPS, ocorrências.

## Pontos em aberto


- Gerenciadora de risco e se terá integração.
- Lista de carrocerias usada pela Prisa (proposta inicial na migration).
