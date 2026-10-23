# NILT — sistema web (fase 1)

TMS próprio da Prisa Logística: motoristas, proprietários, veículos, conjuntos, pendências,
documentos, usuários e auditoria. Next.js 16 (App Router) ligado ao banco Supabase do NILT
(projeto `tkfpbpqbnasabtzatojk`). O visual segue o protótipo aprovado (`../prototipo/`) e o
`../DESIGN.md`.

## Requisitos

- Node.js 24 (testado com 24.14) e npm.
- Acesso ao projeto Supabase do NILT (para pegar a URL e a chave publicável).
- Para os testes de ponta a ponta: o Chromium do Playwright (`npx playwright install chromium`).

## Como rodar

```bash
cd web
npm install
cp .env.example .env.local   # e preencha os dois valores
npm run dev                  # http://localhost:3000
```

`web/.env.local` (nunca vai para o git) tem só duas variáveis públicas:

| Variável | O que é |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://tkfpbpqbnasabtzatojk.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável do projeto (painel do Supabase → Project Settings → API Keys) |

O app **nunca** usa a chave secreta (service role): toda leitura e gravação passa pelo login do
usuário e pelas regras de acesso (RLS) do banco.

Outros comandos: `npm run build` (build de produção), `npm run start` (serve o build),
`npm run lint`.

## Testes

| Comando | O que roda |
|---|---|
| `npm test` | testes unitários (Vitest, `tests/unit/`) |
| `npm run test:e2e` | testes de ponta a ponta (Playwright, `tests/e2e/*.spec.ts`) contra o banco de desenvolvimento |
| `npm run test:prints` | prints de todas as rotas em 1440, 768 e 390 ao lado do protótipo (`tests/e2e/rotas.prints.ts`) |

- Os testes E2E precisam de `web/.env.test.local` (nunca vai para o git) com as credenciais dos
  usuários de teste: `E2E_EMAIL`/`E2E_SENHA` (administrador), `E2E_SEMPERFIL_EMAIL`/`E2E_SEMPERFIL_SENHA`
  (sem perfil) e `E2E_OPERACAO_EMAIL`/`E2E_OPERACAO_SENHA` (operação). Sem elas os testes se pulam.
- O Playwright sobe sozinho o servidor de produção (`npm run build && npm run start`) na porta 3000;
  se já houver um `npm run dev` aberto na 3000, ele é reaproveitado.
- O administrador de teste entra **uma vez** por execução (`tests/e2e/sessao.setup.ts`, sessão em
  `tests/e2e/.sessao/`, fora do git) e os specs reaproveitam essa sessão: o Supabase Auth limita os
  logins por IP e, com um login por teste, duas execuções seguidas recebiam HTTP 429.
- Os testes E2E são re-executáveis e não apagam nada: o que criam leva o prefixo `E2E ` no nome
  (ou modelo `E2E Teste` no veículo), CPF e placa aleatórios. Isso some com o script de limpeza
  abaixo.
- `npm run test:prints` fica fora da suíte padrão porque abre o protótipo por `file://`, que carrega
  os ícones (lucide) da internet. Os prints vão para `tests/e2e/prints/fase1/` (fora do git).
- Testes do banco (pgTAP): `../supabase/tests/README.md`.
- Quando um teste E2E falha, o Playwright grava o rastro em `web/test-results/` (fora do git). Esse
  rastro pode conter a senha dos usuários de teste digitada no login: apague a pasta depois de ver o
  erro e nunca a compartilhe.

## Primeiro administrador

1. No painel do Supabase, **Authentication → Users → Add user**: crie a conta (e-mail e senha) de
   quem vai administrar o NILT.
2. No SQL Editor do painel, abra `../supabase/criar-primeiro-admin.sql`, troque `<nome>` e `<email>`
   e execute.
3. Entre no sistema com essa conta. As próximas pessoas são criadas do mesmo jeito (passo 1) e
   aparecem em **Usuários** como "Sem acesso definido": o administrador escolhe o papel ali
   (admin, operação, financeiro ou leitura).

Ao criar a conta no passo 1, deixe marcado **Auto Confirm User**: sem isso a pessoa não consegue
entrar (a tela de entrada avisa "Seu e-mail ainda não foi confirmado…").

## Senha esquecida e troca de senha

- **Trocar a própria senha:** logado, clique no ícone de chave ao lado do nome, no canto de baixo do
  menu ("Trocar senha"). Abre `/nova-senha`.
- **Esqueceu a senha:** o administrador abre **Authentication → Users** no painel do Supabase, escolhe
  a pessoa e usa **Send password recovery**. Ela recebe um e-mail; o link passa por
  `/auth/confirm` (que abre a sessão) e cai em `/nova-senha`. Link vencido ou já usado mostra
  "Esse link não vale mais" com o que fazer. Cada link vale uma vez e por pouco tempo.

Configuração necessária no painel do Supabase (uma vez; sem ela o link do e-mail não funciona):

1. **Authentication → URL Configuration**: em **Site URL**, o endereço do sistema (ex.:
   `https://nilt.prisalogistica.com.br`; em desenvolvimento, `http://localhost:3000`). Em
   **Redirect URLs**, acrescente o mesmo endereço seguido de `/**` (e `http://localhost:3000/**`
   para desenvolvimento).
2. **Authentication → Emails → Templates → Reset Password**: troque o link do modelo por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (por exemplo
   `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Criar uma senha nova</a>`),
   e, se quiser, o assunto e o texto em português.
3. Para os e-mails chegarem de verdade (o servidor de e-mail padrão do Supabase manda poucos por
   hora e só para a equipe do projeto), configure um SMTP próprio em **Authentication → Emails →
   SMTP Settings**.

Observação: alguns serviços de e-mail corporativo "abrem" os links para checar vírus antes da
pessoa; isso pode gastar o link. Se acontecer, peça um link novo.

## Antes de usar com dados reais (limpeza do ambiente)

O projeto Supabase atual é o mesmo que vai para produção, e hoje ele tem dados fictícios:

- **Seed de desenvolvimento** (`../supabase/seed/dev_dados_ficticios.sql`): os dados do protótipo
  (12 pessoas, 15 veículos, 5 conjuntos, 27 documentos…), com ids fixos `00000000-0000-4000-8000-…`.
- **PDFs fictícios no Storage**, um para cada documento da seed, enviados por
  `node scripts/dev-seed-storage.mjs` (dentro de `web/`).
- **O que os testes E2E criaram** (pessoas "E2E …", veículos "E2E Teste", conjuntos montados nos
  veículos da seed).
- **Três usuários de teste**, que precisam ser apagados:

  | Usuário | Id | Papel |
  |---|---|---|
  | `teste.admin@nilt.test` | `e2e00000-0000-4000-8000-000000000001` | admin |
  | `teste.semperfil@nilt.test` | `e2e00000-0000-4000-8000-000000000002` | sem perfil |
  | `teste.operacao@nilt.test` | `e2e00000-0000-4000-8000-000000000003` | operação |

Para limpar, nesta ordem:

1. Crie o primeiro administrador real (seção acima) e confira que ele entra.
2. Dentro de `web/`: `node scripts/dev-seed-storage.mjs --limpar` — remove do Storage os PDFs da
   seed e os documentos anexados pelos testes (usa o administrador de teste, por isso vem antes).
3. No SQL Editor do Supabase, abra `../supabase/seed/limpar_dados_ficticios.sql` e rode o arquivo
   inteiro: só a **parte 1** (prévia, só leitura) executa, porque a **parte 2** vem comentada. Confira
   as contagens (bloqueios em 0, pelo menos 1 administrador real ativo). Depois selecione só a parte 2,
   de `begin;` até `commit;`, e rode a seleção (uma transação: apaga tudo ou nada; para com erro se
   ainda houver arquivo no Storage, se não houver administrador real ativo, se um conjunto real usar
   motorista fictício ou se algum cadastro real depender de um registro fictício).
4. Apague `web/.env.test.local`: as credenciais deixam de valer.

## Como o sistema se comporta (decisões aceitas)

- **Fichas:** os campos simples (dados pessoais, CNH, ANTT, CRLV…) são gravados pela barra
  "Salvar alterações". Os itens de lista — contatos (endereço, telefone, e-mail), referências,
  contas, chaves Pix e documentos — são **gravados na hora**, em cada diálogo de inclusão, sem
  esperar o "Salvar".
- **Consulta de CEP e CNPJ:** BrasilAPI primeiro; se ela falhar, ViaCEP (CEP) e ReceitaWS (CNPJ).
  Cada provedor tem até 8 segundos, então a consulta pode levar até 16 segundos antes de dizer
  "A consulta não respondeu". "Não encontrado" só aparece quando todos os provedores dizem que o
  CEP/CNPJ não existe.
- **Documentos restritos** (ex.: contrato de arrendamento, CNH marcada como restrita) só abrem para
  o administrador, mas **contam como anexados** para as pendências de todo mundo: a operação não vê
  o arquivo, e também não vê uma pendência falsa de "sem contrato" / "sem CNH".
- Um documento só conta como anexado depois que o arquivo chegou ao Storage (um envio que falhou
  aparece como "envio falhou" e a pendência continua).
- Abrir um documento sempre registra quem viu e quando (Auditoria → "Quem viu documentos").
- **Conjuntos:** "Trocar peças" encerra o conjunto e abre outro (fica no histórico); "Trocar
  motorista" muda o motorista no próprio conjunto (a troca fica só na Auditoria). Um cavalo com
  conjunto aberto não aparece livre no montador: mude pela ficha do conjunto.
- A regra de 18 anos na data de nascimento vale no cadastro novo de motorista, não na ficha.

## Limitações conhecidas

- **Listas grandes:** as listas de veículos, motoristas e proprietários e as contagens carregam
  todos os registros (a de veículos mostra até 300 linhas); com milhares de cadastros será preciso
  levar filtros e contagens para o banco.
- **Duas pessoas na mesma ficha:** o "Salvar" regrava todos os campos simples da ficha; quem salvar
  por último prevalece.
- **Auditoria:** a tela carrega até 500 eventos por filtro e ainda não tem índice por data (fica
  mais lenta com o tempo); o histórico da ficha mostra até 200 alterações.
- **Busca de proprietário** no veículo diferencia acentos ("Ivai" não acha "Ivaí").
- **CNPJ alfanumérico** (novo formato da Receita a partir de 2026) ainda não é aceito, nem no app nem
  no banco.
- **Leitura direta do Storage:** um usuário logado que use a API do Supabase por fora do sistema
  consegue baixar um documento sem passar pelo registro de "quem viu" (fechar isso exige uma Edge
  Function com a chave secreta).
- **Montagem simultânea do mesmo cavalo:** em uma colisão de menos de um segundo entre duas pessoas,
  um conjunto pode ser encerrado pelo outro (fica visível no histórico).
- **Senha vazada:** a proteção contra senhas vazadas do Supabase Auth (aviso do painel) está
  desligada; dá para ligar nas opções de senha do provedor Email, em Authentication no painel
  (recurso dos planos pagos).
- Na seed de desenvolvimento, "desde" de alguns conjuntos aparece um dia antes (data gravada à
  meia-noite UTC); dados reais não têm esse efeito.

## O que fica para depois

- **Deploy na Vercel:** só com a confirmação do responsável. Configure as duas variáveis
  `NEXT_PUBLIC_SUPABASE_*` no projeto da Vercel e ajuste a URL do site em Authentication →
  URL Configuration no Supabase (ver "Senha esquecida e troca de senha").
- **Supabase CLI:** as migrations foram aplicadas pelo MCP, que grava versões com a data da
  aplicação (diferentes dos nomes em `../supabase/migrations/`). Antes de qualquer
  `supabase db push` ou outro comando do CLI, rode `supabase migration repair` para alinhar o
  histórico (detalhes em `../supabase/tests/README.md`), senão o CLI tenta reaplicar tudo.
- App do motorista (Expo) e as fases seguintes (frota, risco, CT-e, financeiro).
