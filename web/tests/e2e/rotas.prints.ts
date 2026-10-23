import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpfAleatorio, E2E_EMAIL, E2E_SENHA, prepararPrint } from "./apoio";

// Prints de todas as rotas em 1440, 768 e 390, cada um ao lado do protótipo no mesmo tamanho
// (`npm run test:prints`, fora da suíte padrão). Só lê dados: nada é criado nem apagado.
// Saída: tests/e2e/prints/fase1/<grupo>-<nome>-<largura>.png e ...-<largura>-prototipo.png.
// Referência fixa do protótipo: .taste-skill/inspect/final/.
const PRINTS = path.join(__dirname, "prints", "fase1");
const PROTOTIPO = (pagina: string) => {
  const [arquivo, consulta] = pagina.split("?");
  return pathToFileURL(path.join(__dirname, "..", "..", "..", "prototipo", arquivo)).href + (consulta ? `?${consulta}` : "");
};
const TAMANHOS = [
  [1440, 900],
  [768, 1024],
  [390, 844],
] as const;

/** Ids fixos da seed de desenvolvimento (pessoas 1xx = pNN, veículos 2xx = vNN, conjuntos 3xx = cNN do protótipo). */
const PESSOA = (n: string) => `00000000-0000-4000-8000-000000000${100 + Number(n)}`;
const VEICULO = (n: string) => `00000000-0000-4000-8000-000000000${200 + Number(n)}`;
const CONJUNTO = (n: string) => `00000000-0000-4000-8000-000000000${300 + Number(n)}`;

/** [grupo, nome, rota do app, página do protótipo (null = o protótipo não tem)] */
type Rota = [string, string, string, string | null];

const ROTAS: Rota[] = [
  ["inicio", "inicio", "/", "index.html"],

  ["motoristas", "lista", "/motoristas", "motoristas.html"],
  ["motoristas", "novo", "/motoristas/novo", "motorista-novo.html"],
  ["motoristas", "ficha", `/motoristas/${PESSOA("02")}`, "motorista.html?id=p02"],
  ...(
    [
      ["cnh", "02"],
      ["contatos", "01"],
      ["referencias", "03"],
      ["contas", "04"],
      ["documentos", "01"],
      ["gr", "07"],
      ["historico", "01"],
    ] as const
  ).map(([aba, p]): Rota => ["motoristas", `aba-${aba}`, `/motoristas/${PESSOA(p)}?aba=${aba}`, `motorista.html?id=p${p}&aba=${aba}`]),
  ["motoristas", "so-proprietario", `/motoristas/${PESSOA("12")}`, "motorista.html?id=p12"],
  ["motoristas", "nao-encontrado", "/motoristas/00000000-0000-4000-8000-000000000999", "motorista.html?id=p99"],

  ["proprietarios", "lista", "/proprietarios", "proprietarios.html"],
  ["proprietarios", "novo", "/proprietarios/novo", "proprietario-novo.html"],
  ["proprietarios", "ficha", `/proprietarios/${PESSOA("09")}`, "proprietario.html?id=p09"],
  ...["antt", "responsavel", "pagamento", "contatos", "contas", "documentos", "veiculos", "historico"].map(
    (aba): Rota => ["proprietarios", `aba-${aba}`, `/proprietarios/${PESSOA("09")}?aba=${aba}`, `proprietario.html?id=p09&aba=${aba}`],
  ),
  ["proprietarios", "nao-encontrado", "/proprietarios/abc", "proprietario.html?id=zzz"],

  ["veiculos", "lista", "/veiculos", "veiculos.html"],
  ["veiculos", "lista-arrendados", "/veiculos?filtro=arrendados", "veiculos.html?filtro=arrendados"],
  ["veiculos", "novo", "/veiculos/novo", "veiculo-novo.html"],
  ["veiculos", "ficha", `/veiculos/${VEICULO("04")}`, "veiculo.html?id=v04"],
  ...["proprietarios", "caracteristicas", "tag", "rastreamento", "frota", "arquivos", "conjunto", "historico"].map(
    (aba): Rota => ["veiculos", `aba-${aba}`, `/veiculos/${VEICULO("04")}?aba=${aba}`, `veiculo.html?id=v04&aba=${aba}`],
  ),
  ["veiculos", "carreta-conjunto", `/veiculos/${VEICULO("11")}?aba=conjunto`, "veiculo.html?id=v11&aba=conjunto"],
  ["veiculos", "nao-encontrado", "/veiculos/zzz", "veiculo.html?id=zzz"],

  ["conjuntos", "lista", "/conjuntos", "conjuntos.html"],
  ["conjuntos", "historico", "/conjuntos?aba=historico", "conjuntos.html?aba=historico"],
  ["conjuntos", "novo", "/conjuntos/novo", "conjunto.html?novo=1"],
  ["conjuntos", "ficha", `/conjuntos/${CONJUNTO("02")}`, "conjunto.html?id=c02"],
  ["conjuntos", "editar", `/conjuntos/${CONJUNTO("02")}?editar=1`, "conjunto.html?id=c02&editar=1"],
  ["conjuntos", "encerrado", `/conjuntos/${CONJUNTO("05")}`, "conjunto.html?id=c00"],
  ["conjuntos", "nao-encontrado", "/conjuntos/zzz", "conjunto.html?id=zzz"],

  ["pendencias", "pendencias", "/pendencias", "pendencias.html"],
  ["pendencias", "tipo", "/pendencias?tipo=conjunto_acima_cmt", "pendencias.html?tipo=conjunto_acima_cmt"],
  ["pendencias", "vencimentos", "/pendencias?aba=vencimentos", "pendencias.html?aba=vencimentos"],
  ["pendencias", "documentos", "/pendencias?aba=documentos", "pendencias.html?aba=documentos"],

  ["usuarios", "lista", "/usuarios", "usuarios.html"],
  ["auditoria", "lista", "/auditoria", "auditoria.html"],
];

const arquivo = (grupo: string, nome: string, largura: number, prototipo = false) =>
  path.join(PRINTS, `${grupo}-${nome}-${largura}${prototipo ? "-prototipo" : ""}.png`);

/** Página do app pronta para o print: sem esqueleto de carregamento, rede parada e fontes carregadas. */
async function printApp(page: Page, rota: string, saida: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main[aria-busy=true]")).toHaveCount(0);
  await prepararPrint(page);
  await page.screenshot({ path: saida, fullPage: true });
}

/** Protótipo por file:// (lucide vem do unpkg). A aba pedida em `?aba=` é aberta também pelo clique. */
async function printPrototipo(page: Page, pagina: string, saida: string) {
  await page.goto(PROTOTIPO(pagina));
  await page.waitForLoadState("networkidle");
  const aba = new URLSearchParams(pagina.split("?")[1] ?? "").get("aba");
  if (aba) {
    const botao = page.locator(`[data-aba="${aba}"]`).first();
    if (await botao.count()) await botao.click();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: saida, fullPage: true });
}

test.describe("prints logado (administrador de teste)", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  for (const [grupo, nome, rota, prototipo] of ROTAS) {
    test(`${grupo} ${nome}`, async ({ page }) => {
      for (const [largura, altura] of TAMANHOS) {
        await page.setViewportSize({ width: largura, height: altura });
        await printApp(page, rota, arquivo(grupo, nome, largura));
        if (prototipo) await printPrototipo(page, prototipo, arquivo(grupo, nome, largura, true));
      }
    });
  }

  test("shell: menu do celular aberto (390)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await printApp(page, "/", arquivo("shell", "menu-aberto", 390));
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.waitForTimeout(400); // a sidebar desliza (transição de 260 ms)
    await page.screenshot({ path: arquivo("shell", "menu-aberto", 390) });
    await page.goto(PROTOTIPO("index.html"));
    await page.waitForLoadState("networkidle");
    await page.locator(".btn-menu, [aria-label='Abrir menu']").first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: arquivo("shell", "menu-aberto", 390, true) });
  });

  test("proprietários novo: pessoa física e empresa pela Receita", async ({ page }) => {
    const cpf = cpfAleatorio().replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    for (const [largura, altura] of TAMANHOS) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [nome, rotulo, doc, campo, botao] of [
        ["pf", "Pessoa física", cpf, "#cpf", null],
        ["pj", "Empresa", "00000000000191", "#cnpj", "#btn-receita"],
      ] as const) {
        // Só preenche para o print: nada é salvo (o CNPJ é de empresa real).
        await page.goto("/proprietarios/novo");
        await page.locator(".tipo-opcao", { hasText: rotulo }).click();
        await page.locator(campo).fill(doc);
        if (botao) {
          await page.locator(botao).click();
          await expect(page.locator("#nome")).not.toHaveValue("", { timeout: 30_000 });
        } else await expect(page.locator("#nome")).toBeVisible();
        await page.locator("#rntrc").fill("123456789");
        await prepararPrint(page);
        await page.screenshot({ path: arquivo("proprietarios", `novo-${nome}`, largura), fullPage: true });

        await page.goto(PROTOTIPO("proprietario-novo.html"));
        await page.locator(".tipo-opcao", { hasText: rotulo }).click();
        await page.locator(campo).fill(doc);
        if (botao) {
          await page.locator(botao).click();
          await expect(page.locator("#pj-nome")).not.toHaveValue("", { timeout: 30_000 });
        }
        await page.locator("#rntrc").fill("123456789");
        await page.waitForTimeout(400);
        await page.screenshot({ path: arquivo("proprietarios", `novo-${nome}`, largura, true), fullPage: true });
      }
    }
  });
});

test.describe("prints sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login", async ({ page }) => {
    for (const [largura, altura] of TAMANHOS) {
      await page.setViewportSize({ width: largura, height: altura });
      await printApp(page, "/login", arquivo("login", "login", largura));
      await printPrototipo(page, "login.html", arquivo("login", "login", largura, true));
    }
  });

  test("sem acesso (usuário sem perfil)", async ({ page }) => {
    const { E2E_SEMPERFIL_EMAIL: email, E2E_SEMPERFIL_SENHA: senha } = process.env;
    test.skip(!email || !senha, "Faltam E2E_SEMPERFIL_* em web/.env.test.local.");
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/sem-acesso$/, { timeout: 20_000 });
    for (const [largura, altura] of TAMANHOS) {
      await page.setViewportSize({ width: largura, height: altura });
      await printApp(page, "/sem-acesso", arquivo("sem-acesso", "sem-acesso", largura));
    }
  });
});
