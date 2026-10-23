import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpfAleatorio, E2E_EMAIL, E2E_SENHA, entrar, prepararPrint } from "./apoio";

// Motoristas (Task 7): lista, novo (CPF → pessoa → motorista) e ficha com abas.
// Re-executável: cria um motorista com CPF válido aleatório e nome "E2E …" (nada é apagado);
// o resto só lê a seed.
const PRINTS = path.join(__dirname, "prints");
const PROTOTIPO = (pagina: string) => pathToFileURL(path.join(__dirname, "..", "..", "..", "prototipo", pagina)).href;
const EDSON = "00000000-0000-4000-8000-000000000101"; // seed: motorista normal, também proprietário
const CLAUDIO = "00000000-0000-4000-8000-000000000102"; // seed: o p02 dos prints do protótipo
const GERSON_CPF = "27614038517"; // seed: só proprietário

const futuro = (dias: number) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);
const fmtCpf = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

test.describe("motoristas", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("lista: abas, busca e filtro guardados na URL", async ({ page }) => {
    await entrar(page);
    await page.goto("/motoristas");
    await expect(page.getByRole("heading", { level: 1, name: "Motoristas" })).toBeVisible();
    await expect(page.locator("main:not([aria-busy]) .titulo .sub")).toContainText(/\d+ motoristas? cadastrados?/);
    const abas = page.getByRole("tablist", { name: "Situação do motorista" });
    await expect(abas.getByRole("tab", { name: /^Todos/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row", { name: /Edson Ramos Figueira/ })).toBeVisible();

    await page.getByRole("searchbox", { name: "Buscar por nome, apelido ou CPF" }).fill("edinho");
    await expect(page.getByRole("row", { name: /Edson Ramos Figueira/ })).toBeVisible();
    await expect(page.locator("#tabela tbody tr")).toHaveCount(1);
    await expect(page).toHaveURL(/q=edinho/);

    await page.getByRole("searchbox", { name: "Buscar por nome, apelido ou CPF" }).fill("");
    await abas.getByRole("tab", { name: /^Pendentes/ }).click();
    await expect(page).toHaveURL(/situacao=pendente/);
    for (const sinal of await page.locator("#tabela tbody .sinal").allTextContents()) expect(sinal).toBe("Pendente");

    await page.getByRole("searchbox", { name: "Buscar por nome, apelido ou CPF" }).fill("zzzz nada");
    await expect(page.locator(".lista-vazia")).toContainText("Nenhum motorista com “zzzz nada” nesta aba.");

    // A linha abre a ficha.
    await page.goto("/motoristas?q=318.265");
    await page.getByRole("row", { name: /Edson Ramos Figueira/ }).click();
    await expect(page).toHaveURL(new RegExp(`/motoristas/${EDSON}$`));
  });

  test("novo: CPF inválido bloqueia com a mensagem do protótipo", async ({ page }) => {
    await entrar(page);
    await page.goto("/motoristas/novo");
    const cpf = page.getByLabel("CPF", { exact: true });
    await cpf.fill("111.444.777-36");
    await expect(page.locator(".campo", { has: cpf }).locator(".erro")).toHaveText(
      "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
    );
    await expect(page.getByLabel("Nome completo")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Criar motorista" })).toBeDisabled();
    await expect(page.getByText("Confira o CPF para liberar os campos.")).toBeVisible();

    // Incompleto + Verificar: diz quantos dígitos faltam.
    await cpf.fill("111.444");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.locator(".campo", { has: cpf }).locator(".erro")).toHaveText("Faltam 5 dígitos no CPF.");
  });

  test("novo: CPF de quem já é motorista abre a ficha; de proprietário liga o papel", async ({ page }) => {
    await entrar(page);
    await page.goto("/motoristas/novo");
    await page.getByLabel("CPF", { exact: true }).fill("318.265.904-98");
    await expect(page.locator(".achado-pessoa")).toContainText("Edson Ramos Figueira");
    await expect(page.locator(".achado-pessoa")).toContainText("Já é motorista");
    await expect(page.getByRole("link", { name: "Abrir ficha do motorista" })).toHaveAttribute("href", `/motoristas/${EDSON}`);
    await expect(page.getByRole("button", { name: "Criar motorista" })).toBeHidden();

    await page.getByLabel("CPF", { exact: true }).fill(fmtCpf(GERSON_CPF));
    await expect(page.locator(".achado-pessoa")).toContainText("Cadastrado como proprietário");
    await expect(page.getByRole("button", { name: "Cadastrar também como motorista" })).toBeEnabled();
    await expect(page.getByLabel("Nome completo")).toBeHidden();
    await expect(page.getByLabel("Número de registro")).toBeEnabled();
  });

  test("novo: cria motorista com CPF aleatório e ele aparece na lista", async ({ page }) => {
    const cpf = cpfAleatorio();
    const nome = `E2E Motorista ${cpf.slice(0, 6)}`;
    await entrar(page);
    await page.goto("/motoristas/novo");
    await page.getByLabel("CPF", { exact: true }).fill(fmtCpf(cpf));
    await expect(page.getByText("CPF válido e ainda não cadastrado.")).toBeVisible();

    // Validação do servidor com as mensagens do protótipo, sem perder o que foi digitado.
    await page.getByLabel("Nome completo").fill("E2E");
    await page.getByRole("button", { name: "Criar motorista" }).click();
    await expect(page.getByText("Informe o nome completo, com sobrenome.")).toBeVisible();
    await expect(page.getByText("O registro da CNH tem 11 dígitos. Confira na carteira.")).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toHaveValue("E2E");

    await page.getByLabel("Nome completo").fill(nome);
    await page.getByLabel("Nascimento").fill("1988-04-12");
    await page.getByLabel("Telefone celular").fill("43999887766");
    await page.getByLabel("Número de registro").fill(cpfAleatorio());
    await page.getByLabel("Categoria").selectOption("e");
    await page.getByLabel("Validade").fill(futuro(400));
    await page.getByRole("button", { name: "Criar motorista" }).click();

    await expect(page).toHaveURL(/\/motoristas\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
    await expect(page.locator(".sinais")).toContainText("Cadastro pendente");
    const ficha = page.url();

    // Inclusões da ficha (grava na hora), no motorista recém-criado.
    await page.goto(`${ficha}?aba=contatos`);
    await page.getByRole("button", { name: "Adicionar endereço" }).click();
    const dlg = page.getByRole("dialog", { name: "Adicionar endereço" });
    await dlg.getByRole("button", { name: "Adicionar endereço" }).click();
    await expect(dlg.getByText("Informe a rua ou avenida.")).toBeVisible();
    await expect(dlg.getByText("Informe a cidade.")).toBeVisible();
    await expect(dlg.getByText("Escolha a UF.")).toBeVisible();
    await dlg.getByLabel("Rua ou avenida").fill("Rua E2E");
    await dlg.getByLabel("Número").fill("10");
    await dlg.getByLabel("Cidade").fill("Londrina");
    await dlg.getByLabel("UF").selectOption("PR");
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "motoristas-dialogo-endereco-1440.png") });
    await dlg.getByRole("button", { name: "Adicionar endereço" }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByRole("row", { name: /Rua E2E, 10/ })).toContainText("Londrina/PR");
    await expect(page.getByRole("row", { name: /Rua E2E, 10/ })).toContainText("Principal");
    await expect(page.getByRole("row", { name: /\(43\) 99988-7766/ })).toContainText("WhatsApp");

    await page.goto(`${ficha}?aba=referencias`);
    await page.getByRole("button", { name: "Adicionar referência" }).click();
    const ref = page.getByRole("dialog", { name: "Adicionar referência" });
    await ref.getByLabel("Nome da referência").fill("E2E Transportes");
    await ref.getByLabel("Telefone").fill("4333221100");
    await ref.getByRole("button", { name: "Adicionar referência" }).click();
    await expect(page.getByRole("row", { name: /E2E Transportes/ })).toContainText("(43) 3322-1100");

    await page.goto(`${ficha}?aba=contas`);
    await page.getByRole("button", { name: "Adicionar conta" }).click();
    const conta = page.getByRole("dialog", { name: "Adicionar conta bancária" });
    await conta.getByLabel("Banco").selectOption("104");
    await conta.getByLabel("Agência").fill("1234");
    await conta.getByLabel("Conta", { exact: true }).fill("55667");
    await conta.getByRole("button", { name: "Adicionar conta" }).click();
    await expect(page.getByRole("row", { name: /Caixa Econômica Federal/ })).toContainText("o próprio motorista");
    await page.getByRole("button", { name: "Adicionar chave Pix" }).click();
    const pix = page.getByRole("dialog", { name: "Adicionar chave Pix" });
    await expect(pix.getByLabel("Chave", { exact: true })).toHaveValue(fmtCpf(cpf));
    await pix.getByRole("button", { name: "Adicionar chave" }).click();
    await expect(page.getByRole("row", { name: new RegExp(fmtCpf(cpf).replace(/\./g, "\\.")) })).toContainText("Caixa Econômica Federal");
    await expect(page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: /^Contas e Pix/ })).toContainText("2");

    // Salvar a ficha: apelido novo aparece no resumo.
    await page.goto(ficha);
    await page.getByLabel("Apelido").fill("E2E");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".resumo")).toContainText("E2E");
    await expect(page.locator(".barra-salvar")).toBeHidden();

    await page.goto("/motoristas");
    await page.getByRole("searchbox", { name: "Buscar por nome, apelido ou CPF" }).fill(nome);
    await expect(page.getByRole("row", { name: new RegExp(nome) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(nome) })).toContainText(fmtCpf(cpf));

    // O mesmo CPF de novo: agora já é motorista.
    await page.goto("/motoristas/novo");
    await page.getByLabel("CPF", { exact: true }).fill(fmtCpf(cpf));
    await expect(page.locator(".achado-pessoa")).toContainText("Já é motorista");
  });

  test("ficha: abas por ?aba=", async ({ page }) => {
    await entrar(page);
    await page.goto(`/motoristas/${EDSON}`);
    await expect(page.getByRole("heading", { level: 1, name: "Edson Ramos Figueira" })).toBeVisible();
    const abas = page.getByRole("navigation", { name: "Partes da ficha" });
    await expect(abas.getByRole("link", { name: "Dados pessoais" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Nome completo")).toHaveValue("Edson Ramos Figueira");

    await page.goto(`/motoristas/${EDSON}?aba=cnh`);
    await expect(abas.getByRole("link", { name: "CNH" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".marco-validade:visible")).toContainText("CNH");
    await expect(page.getByLabel("Registro", { exact: true })).toBeVisible();

    await abas.getByRole("link", { name: /^Contatos/ }).click();
    await expect(page).toHaveURL(/\?aba=contatos$/);
    await expect(page.getByRole("heading", { name: "Endereços" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Telefones" })).toBeVisible();

    await abas.getByRole("link", { name: /^Referências/ }).click();
    await expect(page.getByRole("heading", { name: "Referências pessoais e comerciais" })).toBeVisible();
    await abas.getByRole("link", { name: /^Contas e Pix/ }).click();
    await expect(page.getByRole("heading", { name: "Contas bancárias" })).toBeVisible();
    await abas.getByRole("link", { name: /^Documentos/ }).click();
    await expect(page.getByRole("heading", { name: "Arquivos do motorista" })).toBeVisible();
    await abas.getByRole("link", { name: "Gerenciadora de risco" }).click();
    await expect(page.locator(".marco-validade:visible")).toContainText("Consulta de risco");
    await abas.getByRole("link", { name: "Histórico" }).click();
    await expect(page.getByRole("heading", { name: "Histórico do registro" })).toBeVisible();
  });

  test("ficha: alteração não salva sobrevive à troca de aba e Descartar volta", async ({ page }) => {
    await entrar(page);
    await page.goto(`/motoristas/${CLAUDIO}`);
    const apelido = page.getByLabel("Apelido");
    const original = await apelido.inputValue();
    await apelido.fill(`${original} X`);
    await expect(page.locator(".barra-salvar")).toBeVisible();
    await page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: "CNH" }).click();
    await expect(page).toHaveURL(/\?aba=cnh$/);
    await expect(page.locator(".barra-salvar")).toBeVisible();
    await page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: "Dados pessoais" }).click();
    await expect(apelido).toHaveValue(`${original} X`);
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(apelido).toHaveValue(original);
    await expect(page.locator(".barra-salvar")).toBeHidden();
  });

  test("id inválido ou inexistente mostra a página de não encontrado", async ({ page }) => {
    await entrar(page);
    for (const id of ["abc", "00000000-0000-4000-8000-00000000ffff"]) {
      await page.goto(`/motoristas/${id}`);
      await expect(page.getByRole("heading", { name: "Não encontramos este motorista" })).toBeVisible();
      await expect(page.locator(".erro-ficha .cod")).toHaveText(id);
      await expect(page.getByRole("link", { name: "Ir para a lista de motoristas" })).toBeVisible();
      await expect(page.locator(".erro-lista")).toContainText("Edson Ramos Figueira");
    }
  });

  test("prints (1440 e 390) ao lado do protótipo", async ({ page }) => {
    test.setTimeout(180_000);
    const telas: [string, string, string][] = [
      ["lista", "/motoristas", "motoristas.html"],
      ["novo", "/motoristas/novo", "motorista-novo.html"],
      ["ficha", `/motoristas/${CLAUDIO}`, "motorista.html?id=p02"],
    ];
    for (const [largura, altura] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [nome, , pagina] of telas) {
        const [arquivo, busca] = pagina.split("?");
        await page.goto(PROTOTIPO(arquivo) + (busca ? `?${busca}` : ""));
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: path.join(PRINTS, `motoristas-prototipo-${nome}-${largura}.png`), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    for (const [largura, altura] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [nome, rota] of telas) {
        await page.goto(rota);
        await prepararPrint(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(PRINTS, `motoristas-${nome}-${largura}.png`), fullPage: true });
      }
    }
  });
  test("prints das abas da ficha e do não encontrado (1440 e 390)", async ({ page }) => {
    test.setTimeout(240_000);
    const id = (p: string) => `00000000-0000-4000-8000-000000000${100 + Number(p)}`;
    const casos: [string, string, string][] = [
      ["cnh", "02", "cnh"],
      ["contatos", "01", "contatos"],
      ["referencias", "03", "referencias"],
      ["contas", "04", "contas"],
      ["documentos", "01", "documentos"],
      ["gr", "07", "gr"],
      ["historico", "01", "historico"],
      ["proprietario", "12", "dados"],
    ];
    for (const [largura, altura] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [nome, p, aba] of casos) {
        await page.goto(PROTOTIPO("motorista.html") + `?id=p${p}&aba=${aba}`);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: path.join(PRINTS, `motoristas-prototipo-aba-${nome}-${largura}.png`), fullPage: true });
      }
      await page.goto(PROTOTIPO("motorista.html") + "?id=p99");
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(PRINTS, `motoristas-prototipo-aba-naoachado-${largura}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page);
    for (const [largura, altura] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [nome, p, aba] of casos) {
        await page.goto(`/motoristas/${id(p)}?aba=${aba}`);
        await prepararPrint(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(PRINTS, `motoristas-aba-${nome}-${largura}.png`), fullPage: true });
      }
      await page.goto("/motoristas/00000000-0000-4000-8000-000000000999");
      await prepararPrint(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(PRINTS, `motoristas-aba-naoachado-${largura}.png`), fullPage: true });
    }
  });
});
