import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { E2E_EMAIL, E2E_SENHA, entrar, prepararPrint } from "./apoio";

// Veículos (Task 9): lista, novo (placa desenhada ao vivo) e ficha com abas.
// Re-executável: o único veículo criado tem placa Mercosul aleatória (nunca "TST…") e modelo "E2E Teste";
// nada é apagado. O arrendado usado nas verificações é da seed (só leitura).
const PRINTS = path.join(__dirname, "prints");
const PROTOTIPO = (pagina: string) => pathToFileURL(path.join(__dirname, "..", "..", "..", "prototipo", pagina)).href;
const ID = (n: number) => `00000000-0000-4000-8000-000000000${n}`;
const RTU1F45 = ID(204); // seed: cavalo arrendado SEM contrato
const RTV6H10 = ID(216); // seed: carreta arrendada COM contrato
const BRA7G33 = ID(211); // seed: carreta em conjunto, não arrendada

const LETRAS = "ABCDEFGHJKLMNPRSUVWXYZ";
const sorteio = (s: string) => s[Math.floor(Math.random() * s.length)];
const digitos = (n: number) => Array.from({ length: n }, () => sorteio("0123456789")).join("");

/** Placa Mercosul válida aleatória (LLL#L##), nunca "TST…" (a das fixtures do banco). */
function placaAleatoria(): string {
  for (;;) {
    const p = `${sorteio(LETRAS)}${sorteio(LETRAS)}${sorteio(LETRAS)}${digitos(1)}${sorteio(LETRAS)}${digitos(2)}`;
    if (!p.startsWith("TST")) return p;
  }
}
/** Chassi de 17 caracteres sem I, O ou Q. */
const chassiAleatorio = () => Array.from({ length: 17 }, () => sorteio("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")).join("");

async function aba(page: Page, nome: string) {
  await page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: new RegExp(`^${nome}`) }).click();
}

test.describe("veículos", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("lista: abas, filtro ?filtro=arrendados, busca e linha abre a ficha", async ({ page }) => {
    await entrar(page);
    await page.goto("/veiculos");
    await expect(page.getByRole("heading", { level: 1, name: "Veículos" })).toBeVisible();
    await expect(page.locator("#achado")).toContainText(/\d+ veículos? cadastrados?/);
    await expect(page.getByRole("row", { name: /^Placa RTU1F45/ })).toBeVisible();

    // ?filtro=arrendados: só os arrendados, com o sinal e o dono da ANTT
    await page.goto("/veiculos?filtro=arrendados");
    const abas = page.getByRole("navigation", { name: "Filtrar por tipo de veículo" });
    await expect(abas.getByRole("link", { name: /^Arrendados/ })).toHaveAttribute("aria-current", "page");
    const linhas = page.locator("#linhas tr");
    const n = await linhas.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) await expect(linhas.nth(i).locator(".sinal-info")).toHaveText("Arrendado");
    await expect(page.getByRole("row", { name: /^Placa RTU1F45/ })).toContainText("ANTT:");

    // clicar na aba grava ?filtro= e a busca guarda ?q=
    await abas.getByRole("link", { name: /^Cavalos/ }).click();
    await expect(page).toHaveURL(/filtro=cavalos/);
    await page.getByRole("searchbox", { name: /Buscar por placa/ }).fill("bra2e");
    await expect(page).toHaveURL(/q=bra2e/);
    await expect(page.locator("#linhas tr")).toHaveCount(1);
    await expect(page.getByRole("row", { name: /^Placa BRA2E19/ })).toBeVisible();
    await page.getByRole("searchbox", { name: /Buscar por placa/ }).fill("zzzzzz");
    await expect(page.locator(".sem-linhas")).toContainText("Nenhum veículo com esses filtros.");
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/veiculos$/);

    await page.getByRole("row", { name: /^Placa BRA7G33/ }).click();
    await expect(page).toHaveURL(new RegExp(`/veiculos/${BRA7G33}$`));
  });

  test("arrendado (posse ≠ ANTT): sinal Arrendado e pendência do contrato", async ({ page }) => {
    await entrar(page);
    await page.goto(`/veiculos/${RTU1F45}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("RTU1F45");
    const sinais = page.locator("#sinais");
    await expect(sinais.locator(".sinal-info")).toHaveText("Arrendado");
    await expect(sinais).toContainText("Sem contrato de arrendamento");
    await expect(page.getByRole("link", { name: "Anexar contrato" }).first()).toBeVisible();

    // Proprietários: posse ≠ ANTT lado a lado e o aviso de contrato
    await aba(page, "Proprietários");
    await expect(page.locator(".donos.diferentes")).toBeVisible();
    await expect(page.locator(".arrendamento")).toContainText("Falta o contrato de arrendamento.");

    // Documentos: o contrato esperado e ainda não anexado
    await aba(page, "Documentos");
    await expect(page.getByText("Contrato de arrendamento", { exact: false }).first()).toBeVisible();
    await expect(page.locator("[data-painel=arquivos]")).toContainText("ainda não anexado: obrigatório para veículo arrendado");

    // O mesmo veículo aparece como pendência de documentos no banco (a tela de Pendências lê a mesma view).
    // Arrendado COM contrato: sinal sim, pendência não.
    await page.goto(`/veiculos/${RTV6H10}`);
    await expect(page.locator("#sinais .sinal-info")).toHaveText("Arrendado");
    await expect(page.locator("#sinais")).not.toContainText("Sem contrato de arrendamento");
    await aba(page, "Proprietários");
    await expect(page.locator(".arrendamento .upload.com-arquivo")).toContainText("CONTRATO");
  });

  test("id que não é código válido ou que não existe mostra 'não encontrado'", async ({ page }) => {
    await entrar(page);
    for (const id of ["zzz", "00000000-0000-4000-8000-0000000009ff"]) {
      await page.goto(`/veiculos/${id}`);
      await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex");
      await expect(page.getByRole("heading", { level: 1, name: "Veículo não encontrado" })).toBeVisible();
      await expect(page.locator(".titulo .sub")).toContainText(`Não há veículo com o código “${id}”.`);
      await expect(page.getByRole("link", { name: "Ver todos os veículos" })).toBeVisible();
    }
  });

  test("ficha: ?aba= troca o painel e o que foi digitado numa aba não se perde ao trocar", async ({ page }) => {
    await entrar(page);
    await page.goto(`/veiculos/${BRA7G33}`);
    const abas = page.getByRole("navigation", { name: "Partes da ficha" });
    for (const [nome, id, visivel] of [
      ["Características", "caracteristicas", "PBT (t)"],
      ["TAG e seguro", "tag", /^Número da TAG/],
      ["Rastreamento", "rastreamento", /^Número do rastreador/],
      ["Frota", "frota", /^Nº da frota/],
      ["Proprietários", "proprietarios", /^Proprietário da posse/],
      ["CRLV", "crlv", /^Renavam/],
    ] as [string, string, string | RegExp][]) {
      await abas.getByRole("link", { name: new RegExp(`^${nome}`) }).click();
      await expect(page).toHaveURL(id === "crlv" ? /aba=crlv/ : new RegExp(`aba=${id}`));
      await expect(abas.getByRole("link", { name: new RegExp(`^${nome}`) })).toHaveAttribute("aria-current", "page");
      await expect(page.getByLabel(visivel)).toBeVisible();
    }
    // aba inexistente cai na primeira; carreta tem Conjunto, não tem a aba de CMT
    await page.goto(`/veiculos/${BRA7G33}?aba=nada`);
    await expect(abas.getByRole("link", { name: "CRLV" })).toHaveAttribute("aria-current", "page");
    await expect(abas.getByRole("link", { name: /^Conjunto/ })).toBeVisible();

    // digita no modelo, vai para a Frota e volta: o texto continua e a barra de salvar também
    const modelo = page.getByLabel("Modelo", { exact: true });
    const original = await modelo.inputValue();
    await modelo.fill(`${original} X`);
    await expect(page.getByText(/Alterações não salvas em BRA7G33/)).toBeVisible();
    await aba(page, "Frota");
    await expect(page.getByLabel(/^Nº da frota/)).toBeVisible();
    await aba(page, "CRLV");
    await expect(modelo).toHaveValue(`${original} X`);
    await expect(page.getByText(/Alterações não salvas em BRA7G33/)).toBeVisible();
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(modelo).toHaveValue(original);
    await expect(page.getByText(/Alterações não salvas/)).toBeHidden();
  });

  test("capacidade: calculada pelo PBT e tara, ou informada à mão (sem gravar)", async ({ page }) => {
    await entrar(page);
    await page.goto(`/veiculos/${BRA7G33}?aba=caracteristicas`);
    const cap = page.getByLabel("Capacidade de carga (t)");
    const auto = page.getByLabel("Calcular pelo PBT e tara");
    await expect(auto).toBeChecked();
    await expect(cap).toHaveValue("36,6");
    await expect(page.locator("#cap-expl")).toContainText("Calculada: PBT 45,0 t menos tara 8,4 t dá 36,6 t.");

    await page.getByLabel("Tara (t)", { exact: true }).fill("9,0");
    await expect(cap).toHaveValue("36,0");
    await auto.uncheck();
    await cap.fill("40,0");
    await expect(page.locator("#cap-expl")).toContainText("Informada à mão: 40,0 t. Pelo PBT e tara daria 36,0 t");
    await expect(page.locator("#cap-expl .passa")).toContainText("tara mais capacidade passa do PBT em 4,0 t");
    await expect(page.locator(".balanca-trilho .seg.excede")).toBeVisible();
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(cap).toHaveValue("36,6");
    await expect(auto).toBeChecked();
  });

  test("novo: placa inválida é barrada; placa Mercosul aleatória cria o veículo, e a ficha salva", async ({ page }) => {
    await entrar(page);
    await page.goto("/veiculos/novo");
    const placa = page.locator("#placa");
    const resto = page.getByLabel("Renavam"); // o fieldset #resto desliga todos os campos de baixo
    await expect(resto).toBeDisabled();
    await expect(page.getByRole("button", { name: "Criar veículo" })).toBeDisabled();

    // a placa é desenhada enquanto se digita e a posição errada é apontada
    await placa.fill("ab1");
    await expect(page.locator("#previa .placa b")).toContainText("AB1");
    await expect(page.locator("#campo-placa .erro")).toHaveText("A 3ª posição precisa ser letra. Use ABC1234 ou ABC1D23.");
    await expect(page.locator("#previa")).toContainText("faltam 4 caracteres");
    await placa.fill("ABC1234");
    await expect(page.locator("#previa .placa")).toHaveClass(/antiga/);
    await expect(page.locator("#previa")).toContainText("Placa antiga (cinza)");
    await placa.fill("ABC1D");
    await expect(page.locator("#placa-msg")).toHaveText("Próximo: número.");
    await expect(resto).toBeDisabled();

    // placa já cadastrada: avisa e leva à ficha, sem liberar o resto
    await placa.fill("RTU1F45");
    await expect(page.locator("#existe")).toContainText("RTU1F45 já está cadastrada.");
    await expect(page.getByRole("link", { name: "Abrir a ficha" })).toHaveAttribute("href", `/veiculos/${RTU1F45}`);
    await expect(resto).toBeDisabled();

    // placa nova: libera os campos
    const nova = placaAleatoria();
    await placa.fill(nova.toLowerCase());
    await expect(placa).toHaveValue(nova);
    await expect(page.locator("#previa .placa")).toHaveAttribute("aria-label", `Placa ${nova}`);
    await expect(resto).toBeEnabled();
    await expect(page.locator("#falta")).toContainText("Para criar, falta: tipo, Renavam, chassi, marca, modelo");

    // erros de campo, com as mensagens do protótipo
    await page.getByLabel("Renavam").fill("123");
    await page.getByLabel("Renavam").blur();
    await expect(page.locator(".campo", { has: page.getByLabel("Renavam") }).locator(".erro")).toHaveText("Renavam tem 11 dígitos; faltam 8.");
    await page.getByLabel("Chassi").fill("9BWZZZ377VT00IOQ1");
    await page.getByLabel("Chassi").blur();
    await expect(page.locator(".campo", { has: page.getByLabel("Chassi") }).locator(".erro")).toHaveText(
      "Chassi não tem as letras I, O ou Q. Confira se é 1 ou 0.",
    );

    await page.getByLabel("Tipo do veículo").selectOption({ label: "CARRETA GRANELEIRO TRUCADA - 3 EIXOS" });
    await expect(page.locator("#tipo-resumo")).toContainText("Categoria");
    await expect(page.locator("#tipo-resumo")).toContainText("PBT e tara dão a capacidade de carga");
    await page.getByLabel("Renavam").fill(digitos(11));
    await page.getByLabel("Chassi").fill(chassiAleatorio());
    await page.getByLabel("Marca").selectOption({ label: "RANDON" });
    await page.getByLabel("Modelo", { exact: true }).fill("E2E Teste");
    await page.getByLabel("Ano de fabricação").fill("2022");
    await page.getByLabel("Ano do modelo").fill("2024");
    await expect(page.locator(".campo", { has: page.getByLabel("Ano do modelo") }).locator(".erro")).toBeHidden();
    await page.getByLabel("Ano do modelo").fill("2023");
    await expect(page.locator("#falta")).toHaveText("Para criar, falta: proprietário da posse.");

    // proprietário por busca (nome, CPF ou CNPJ)
    const posse = page.getByLabel("Proprietário da posse (CRLV)");
    await posse.click();
    await posse.fill("TSC");
    await page.getByRole("option", { name: /TSC Transportes/ }).click();
    await expect(posse).toHaveValue(/TSC Transportes \(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\)/);
    await expect(page.locator("#arrendado")).toBeHidden();
    await expect(page.locator("#falta")).toHaveText("Tudo certo para criar. O cadastro nasce pendente até a ficha ser conferida.");
    await page.screenshot({ path: path.join(PRINTS, "veiculos-novo-preenchido.png"), fullPage: true });

    await page.getByRole("button", { name: "Criar veículo" }).click();
    await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]{36}(\?criado=1)?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nova);
    await expect(page.getByText(`Veículo ${nova} criado. Complete a ficha com calma.`)).toBeVisible();
    await expect(page.locator("#sinais")).toContainText("Cadastro pendente");
    await expect(page.locator("#sinais")).toContainText("CRLV não anexado");
    await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue("E2E Teste");
    const urlFicha = page.url().split("?")[0];

    // mesma placa de novo: já cadastrada
    await page.goto(`/veiculos/novo?placa=${nova}`);
    await expect(page.locator("#existe")).toContainText(`${nova} já está cadastrada.`);

    // ficha: PBT e tara calculam a capacidade; gravar e reabrir
    await page.goto(`${urlFicha}?aba=caracteristicas`);
    await page.getByLabel("PBT (t)").fill("45,0");
    await page.getByLabel("Tara (t)", { exact: true }).fill("8,0");
    await expect(page.getByLabel("Capacidade de carga (t)")).toHaveValue("37,0");
    await expect(page.locator("#cap-expl")).toContainText("Calculada: PBT 45,0 t menos tara 8,0 t dá 37,0 t.");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("PBT (t)")).toHaveValue("45,0");
    await expect(page.getByLabel("Capacidade de carga (t)")).toHaveValue("37,0");
    await expect(page.getByLabel("Calcular pelo PBT e tara")).toBeChecked();

    // capacidade informada à mão fica gravada (o banco deixa de calcular)
    await page.getByLabel("Calcular pelo PBT e tara").uncheck();
    await page.getByLabel("Capacidade de carga (t)").fill("30,5");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Calcular pelo PBT e tara")).not.toBeChecked();
    await expect(page.getByLabel("Capacidade de carga (t)")).toHaveValue("30,5");

    // erro do servidor aparece sem limpar o que foi digitado
    await page.getByLabel("PBT (t)").fill("abc");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".aviso[role=alert]")).toContainText("PBT: Use só números, com vírgula nos decimais.");
    await expect(page.getByLabel("PBT (t)")).toHaveValue("abc");
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByLabel("PBT (t)")).toHaveValue("45,0");

    // observação (aba CRLV) também grava, e o histórico do administrador mostra a alteração
    await aba(page, "CRLV");
    await page.getByLabel("Observação (opcional)", { exact: true }).fill("E2E: veículo de teste");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas")).toBeVisible();
    await aba(page, "Histórico");
    await expect(page.locator(".linha-tempo")).toContainText("Alterou");
  });

  test("prints 1440 e 390 de cada rota", async ({ page }) => {
    test.setTimeout(120_000);
    await entrar(page);
    const rotas: [string, string, string | null][] = [
      ["lista", "/veiculos", "veiculos.html"],
      ["lista-arrendados", "/veiculos?filtro=arrendados", "veiculos.html?filtro=arrendados"],
      ["novo", "/veiculos/novo", "veiculo-novo.html"],
      ["ficha", `/veiculos/${RTU1F45}`, "veiculo.html?id=v04"],
      ["ficha-conjunto", `/veiculos/${BRA7G33}?aba=conjunto`, null],
      ["nao-encontrado", "/veiculos/zzz", "veiculo.html?id=zzz"],
    ];
    for (const largura of [1440, 390]) {
      await page.setViewportSize({ width: largura, height: largura === 1440 ? 900 : 844 });
      for (const [nome, url, proto] of rotas) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await prepararPrint(page);
        await page.screenshot({ path: path.join(PRINTS, `veiculos-${nome}-${largura}.png`), fullPage: true });
        if (proto) {
          const [arq, q] = proto.split("?");
          await page.goto(PROTOTIPO(arq) + (q ? `?${q}` : ""));
          await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(PRINTS, `veiculos-${nome}-prototipo-${largura}.png`), fullPage: true });
        }
      }
    }
  });
});
