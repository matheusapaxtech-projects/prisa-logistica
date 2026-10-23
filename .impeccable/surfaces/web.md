---
version: 1
slug: "web"
primary_target: "web"
related_targets: []
---

# Surface brief: NILT web, fase 1 (cadastros)

Scope: sistema web inteiro da fase 1 (login, início, motoristas, proprietários, veículos, conjuntos, pendências, usuários, auditoria). Mode: Operate. Desktop primeiro, funciona no celular.
Audience/job: 5 pessoas da operação da Prisa cadastrando com calma, completo, antes da primeira carga; conferindo documentos e vencimentos.
Constraints: PRODUCT.md; taste app style framed-sheet (seed 255535763) como estrutura de shell; regras de app da taste e craft-floor da impeccable.

## Direction contract
THESIS: O NILT é sinalizado como uma rodovia brasileira: cada situação tem a cor da placa que a equipe já obedece na estrada, e a navegação é placa de orientação. Recusa o painel de TMS de categoria (sidebar azul-marinho, cards de KPI com ícone de caminhão, mapa decorativo).
OWN-WORLD: Moldura em L tingida de asfalto claro (#eef1ef), folha branca. Verde-placa #0B6B3A é normal e ação principal; laranja-obras #D9580D pendente; amarelo #F2B705 só como fundo claro com tinta escura para vencendo; vermelho #C8102E bloqueado/vencido/erro; azul-serviços #1F5FA8 informação. Overpass em tudo; Overpass Mono para placa, CPF, CNPJ, RNTRC, Renavam. Raises: rampa única de neutros (da folha de exposição); duração desenhada no comprimento exato (labanotação); uma família só (anuário); capacidade que não transborda (j-card); grade de células estrita nos formulários (Crouwel); código como manchete do objeto (Factory).
STORY: A pessoa abre uma ficha, vê em cores de estrada o que falta e o que vence, completa os campos na ordem do documento físico e monta o conjunto como o caminhão engatado.
FIRST VIEWPORT: Início: título "Início" 22px; à esquerda, a faixa de pendências como placas de advertência (contagens por tipo, cada uma levando à lista); ao lado, "Vencendo" como marcos de quilômetro (dias restantes, barra no comprimento exato); abaixo, conjuntos abertos desenhados engatados. Ação principal verde: "Novo cadastro".
FORM: sinalização rodoviária DNIT, posição 5 da lista ordenada; seed 82fba0e2.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
