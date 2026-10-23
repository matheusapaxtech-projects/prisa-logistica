# Protótipo HTML do NILT — convenções

Protótipo navegável da fase 1 (cadastros) em HTML, CSS e JavaScript puros, feito para ser convertido depois em Next.js + Supabase. Abra `index.html` no navegador.

## Leia antes de construir uma tela
1. `PRODUCT.md` (raiz) e `.impeccable/surfaces/web.md` (contrato de direção: mundo da sinalização rodoviária).
2. `index.html` — tela de referência: copie a estrutura do `<head>`, a ordem dos scripts e o padrão `window.pagina = function (N) {...}`.
3. `assets/nilt.css` — tokens e componentes. **Não edite** (nem `nilt.js`, nem `dados.js`): são compartilhados. Estilo só da sua tela vai em `assets/paginas/<grupo>.css`, que você cria.
4. `assets/dados.js` — dados fictícios com os nomes de campo do banco. Precisa de mais dados? Crie no script da sua página, também fictícios, com os mesmos nomes de campo.
5. Regras de tela de sistema da skill taste: `C:\Users\User\.claude\skills\design-taste-frontend\references\app-screens.md` §7 (tabelas), §8 (formulários), §11 (estados), §12 (celular), §13 (regras da casa). E `C:\Users\User\.claude\skills\impeccable\reference\craft-floor.md`.
6. Campos que precisam existir (todos os do ATUA): `re-atua-mais-frete/evidence/EV-006` (veículo), `EV-007` (motorista e abas de pessoa), `EV-008` (proprietário PF e PJ), `EV-010` (veículo agregado e conjunto). Colunas do banco: `docs/superpowers/plans/2026-10-22-nilt-fase1-cadastros.md` (Tasks 5 a 9).

## Significado fixo das cores (nunca use para outra coisa)
- `sinal-normal` verde (retângulo): normal, habilitado, ativo. Verde também é a ação principal (`btn-primario`, uma por tela).
- `sinal-pendente` laranja de obras (losango): pendente, em cadastro, aguardando.
- `sinal-vencendo` amarelo (losango): vence em até 30 dias.
- `sinal-bloqueado` vermelho (círculo): cancelado, vencido, bloqueado, erro.
- `sinal-info` azul (quadrado): informação, arrendado, links.
- `sinal-neutro` cinza: sem consulta, parado, desativado.
Helpers: `N.desenhar.sinal(situacao)`, `N.desenhar.placa(placa, grande)`, `N.desenhar.engate(cavalo, itens)`, `N.desenhar.capacidade(conjunto)`, `N.desenhar.marco(vencimento)`, `N.desenhar.avatar(nome)`; formato `N.fmt.*` (cpf, cnpj, doc, telefone, cep, data, dataHora, relativo, t, m, kb, dias); validação `N.valida.*`; `N.consultarCnpj`, `N.consultarCep` (BrasilAPI de verdade); `N.toast(msg)`; `N.param('id')`; `N.esc(texto)`; `N.linkPessoa(pessoa)`; `N.separarPontos(elemento)` depois de re-renderizar algo que tenha " · ".

## Padrões de tela
- **Lista**: `.titulo` com h1 (noun) + uma linha cinza com o total e o achado; à direita, no máximo um secundário e a ação principal. `.abas` por situação com contagem (`<span class="n">`), `.ferramentas` (busca, filtros, total "8 motoristas"), `table.tabela` sem caixa em volta: identidade na coluna mais larga, números `num` alinhados à direita, uma marca de situação por linha, `tr[data-href]` para abrir a ficha. Abaixo de 640px, as colunas secundárias viram segunda linha (`.linha2`) e as demais levam `some-celular`.
- **Ficha**: `.migalha` (pai em cinza / atual como `<h1>`) + sinais de situação + ações à direita; `.abas[data-abas]` com `button[data-aba]` e painéis `[data-painel]` (o nilt.js liga tudo e guarda `?aba=` na URL). Dentro de cada aba, `form[data-salvar]` com `.secao` (rótulo e explicação à esquerda, `.campos` em grade de 12 colunas à direita, campos `.f3/.f4/.f6/...`) e uma `.barra-salvar` (aparece ao editar; `data-descartar` / `data-confirmar`). Um modelo de salvar por tela.
- **Novo cadastro**: começa pelo documento (CPF, CNPJ ou placa), confere se já existe e oferece abrir o existente ou ligar o papel (a mesma pessoa pode ser motorista e proprietária). Depois, os dados mínimos para criar, e manda para a ficha completa.
- **Campos**: rótulo acima (`label for`), 38px, máscara com `data-mascara="cpf|cnpj|telefone|cep|placa"`, validação com `data-valida="cpf|cnpj|placa"`. Opcional marcado com `<span class="opcional">(opcional)</span>`. Erros dizem o problema e a correção.
- **Estados**: vazio mantém o quadro e uma frase (`.vazio-bloco`); zero é "0"; ausente é `—` em `.dash`; erro dentro do bloco com "Tentar de novo".
- **Histórico** (só admin vê): linha do tempo de `D.auditoria` filtrada pelo registro.
- Ícones: Lucide (`<i data-lucide="nome"></i>`), 16px, um conjunto só. Nada de emoji.
- Movimento: nada entra animado. Só retorno de clique (já no `.btn`), menus e diálogos curtos. Respeitar `prefers-reduced-motion`.
- Proibido: gradientes, sombras em coisas paradas, ícone em quadrado colorido, rótulo pequeno acima de título (eyebrow), números de seção 01/02, borda lateral colorida, cabeçalho de tabela em caixa alta, listras zebradas, cor fora do significado fixo.

## Conferir antes de entregar
```
node C:/Users/User/.claude/skills/design-taste-frontend/scripts/inspect.mjs prototipo/<pagina>.html --app --allow font-not-dealt --out .taste-skill/inspect/<pagina>
```
0 FAIL. Cada WARN corrigido ou com uma frase de defesa. Abra os prints (1440, 768, 390) e corrija o que estiver errado. No máximo três rodadas.

## Conversão para Next.js (depois)
`assets/nilt.css` → tokens do Tailwind (`@theme`) e CSS de componentes; o shell do `nilt.js` → `app/(app)/layout.tsx`; cada `.html` → uma rota; `dados.js` → consultas ao Supabase com os mesmos nomes de campo; `N.desenhar.*` → componentes React; `?aba=` → segmento de rota.
