import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpfAleatorio, E2E_EMAIL, E2E_SENHA, entrar, prepararPrint } from "./apoio";

// Proprietários (Task 8): lista, novo (PF/PJ, CPF e CNPJ → Receita) e ficha com abas.
// Re-executável: cria um proprietário PF com CPF válido aleatório e nome "E2E …" (nada é apagado);
// o resto só lê a seed. O CNPJ real 00000000000191 só consulta a Receita: nunca é gravado.
const PRINTS = path.join(__dirname, "prints");
const PROTOTIPO = (pagina: string) => {
  const [arquivo, consulta] = pagina.split("?");
  return pathToFileURL(path.join(__dirname, "..", "..", "..", "prototipo", arquivo)).href + (consulta ? `?${consulta}` : "");
};
const EDSON = "00000000-0000-4000-8000-000000000101"; // seed: PF, TAC, 3 veículos, também motorista
const TSC = "00000000-0000-4000-8000-000000000109"; // seed: PJ (ETC), 8 veículos, arrendados
const IVAI = "00000000-0000-4000-8000-000000000111"; // seed: PJ sem RNTRC, pendente
const GERSON_CPF = "27614038517"; // seed: só proprietário, sem veículos

const futuro = (dias: number) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);
const fmtCpf = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

test.describe("proprietários", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("lista: achado, abas, busca e vazio guardados na URL", async ({ page }) => {
    await entrar(page);
    await page.goto("/proprietarios");
    await expect(page.getByRole("heading", { level: 1, name: "Proprietários" })).toBeVisible();
    await expect(page.locator("#achado")).toContainText(/\d+ proprietários/);
    const abas = page.getByRole("tablist", { name: "Filtrar proprietários" });
    await expect(abas.getByRole("tab", { name: /^Todos/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("row", { name: /Transportes Serra do Cadeado/ })).toBeVisible();

    // Aba Empresa só tem PJ; aba Pessoa física só PF.
    await abas.getByRole("tab", { name: /^Empresa/ }).click();
    await expect(page).toHaveURL(/aba=pj/);
    await expect(page.getByRole("row", { name: /Edson Ramos Figueira/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Rodo Norte/ })).toBeVisible();
    await abas.getByRole("tab", { name: /^Pessoa física/ }).click();
    await expect(page.getByRole("row", { name: /Rodo Norte/ })).toHaveCount(0);

    // Busca por nome fantasia e por dígitos do documento.
    await abas.getByRole("tab", { name: /^Todos/ }).click();
    const busca = page.getByRole("searchbox", { name: "Buscar por nome, nome fantasia, CPF ou CNPJ" });
    await busca.fill("tsc");
    await expect(page.locator("#linhas tr")).toHaveCount(1);
    await expect(page).toHaveURL(/q=tsc/);
    await busca.fill("318.265");
    await expect(page.getByRole("row", { name: /Edson Ramos Figueira/ })).toBeVisible();

    await busca.fill("zzzz nada");
    await expect(page.locator(".vazio-linha")).toContainText("Nenhum proprietário com “zzzz nada” nesta aba. Confira o nome ou os dígitos do documento.");

    // A linha abre a ficha.
    await page.goto("/proprietarios?q=serra");
    await page.getByRole("row", { name: /Transportes Serra do Cadeado/ }).click();
    await expect(page).toHaveURL(new RegExp(`/proprietarios/${TSC}$`));
  });

  test("novo: empresa desabilita TAC, confere o CNPJ e preenche pela Receita (rede real)", async ({ page }) => {
    await entrar(page);
    // Só pula se a Receita está fora do ar ou sem rede (504 ou falha de rede). Um 502/403/500 é regressão: falha.
    const sonda = await page.request.get("/api/cnpj/00000000000191", { timeout: 25_000 }).catch(() => null);
    test.skip(!sonda || sonda.status() === 504, "BrasilAPI sem resposta agora (offline, timeout): a consulta real de CNPJ não pôde ser conferida.");
    expect(sonda!.status(), "o CNPJ 00000000000191 existe na Receita; só 200 é aceitável quando há rede").toBe(200);
    await page.goto("/proprietarios/novo");
    // Antes do tipo: só a prévia das etapas.
    await expect(page.getByRole("heading", { name: "Depois do tipo" })).toBeVisible();
    await page.locator(".tipo-opcao", { hasText: "Empresa" }).click();
    await expect(page.getByRole("heading", { name: "Documento" })).toBeVisible();

    const cnpj = page.getByLabel("CNPJ", { exact: true });
    await cnpj.fill("11.222.333/0001-80");
    await expect(page.locator(".campo", { has: cnpj }).locator(".erro")).toHaveText(
      "CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.",
    );
    await cnpj.fill("00.000.000/0001");
    await expect(page.locator("#cnpj-estado")).toHaveText("2 dígitos faltam");

    // CNPJ real: confere, procura no NILT e libera "Buscar na Receita" / "preencha à mão".
    await cnpj.fill("00000000000191");
    await expect(page.locator("#cnpj-estado")).toContainText("CNPJ válido. Busque na Receita ou preencha à mão.");
    await page.getByRole("button", { name: "Buscar na Receita" }).click();

    const razao = page.getByLabel("Razão social");
    await expect(razao).toBeVisible({ timeout: 20_000 });
    await expect(razao).not.toHaveValue("");
    expect((await razao.inputValue()).toUpperCase()).toContain("BANCO DO BRASIL");
    await expect(page.locator("#receita-estado")).toContainText("Consultado na Receita hoje às");
    await expect(page.getByLabel("Cidade")).not.toHaveValue("");
    await expect(page.getByRole("heading", { name: "Responsável" })).toBeVisible();

    // TAC é só para pessoa física: desabilitado, e o padrão é ETC. Nada é criado.
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeDisabled();
    await expect(page.getByRole("radio", { name: /^ETC empresa/ })).toBeChecked();
    await expect(page.locator("#enq-ajuda")).toContainText("TAC é só para pessoa física");
    await expect(page.locator("#resumo")).toContainText("Pendente");

    // Voltar para pessoa física reabilita o TAC e limpa o formulário da empresa.
    await page.locator(".tipo-opcao", { hasText: "Pessoa física" }).click();
    await page.getByLabel("CPF", { exact: true }).fill(fmtCpf(cpfAleatorio()));
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeEnabled();
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeChecked();
  });

  test("novo: CPF inválido, já proprietário e liga o papel a quem já existe", async ({ page }) => {
    await entrar(page);
    await page.goto("/proprietarios/novo?tipo=pf");
    const cpf = page.getByLabel("CPF", { exact: true });
    await cpf.fill("111.444.777-36");
    await expect(page.locator(".campo", { has: cpf }).locator(".erro")).toHaveText(
      "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
    );
    await expect(page.getByLabel("Nome completo")).toBeHidden();

    await cpf.fill(fmtCpf(GERSON_CPF));
    await expect(page.locator(".existe")).toContainText("Gerson Vidal Prado já é proprietário no NILT");
    await expect(page.getByRole("link", { name: "Abrir ficha" })).toHaveAttribute("href", /\/proprietarios\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("button", { name: "Criar proprietário" })).toBeHidden();

    await cpf.fill("318.265.904-98");
    await expect(page.locator(".existe")).toContainText("Edson Ramos Figueira já é proprietário");

    // Quem só é motorista (seed) pode ganhar o papel de proprietário: os dados vêm da ficha, falta só a ANTT.
    // Não grava: a seed não pode ganhar proprietário em cada execução.
    await cpf.fill("407.193.526-06");
    await expect(page.locator(".existe")).toContainText("Cláudio Bertoli Neto já está no NILT como motorista");
    await expect(page.getByRole("link", { name: "Ver ficha de motorista" })).toHaveAttribute("href", /\/motoristas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "ANTT" })).toBeHidden();
    await page.getByRole("button", { name: "Cadastrar também como proprietário" }).click();
    await expect(page.getByRole("button", { name: "Ligando como proprietário" })).toBeDisabled();
    await expect(page.locator(".kv")).toContainText("Cláudio Bertoli Neto");
    await expect(page.locator(".kv")).toContainText("407.193.526-06");
    await expect(page.getByRole("heading", { name: "ANTT" })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeHidden();
    await expect(page.locator("#btn-criar")).toHaveText("Cadastrar também como proprietário");
  });

  test("novo: cria pessoa física com CPF aleatório e abre a ficha criada", async ({ page }) => {
    const cpf = cpfAleatorio();
    const nome = `E2E Proprietário ${Date.now().toString(36)}`;
    await entrar(page);
    await page.goto("/proprietarios/novo");
    await page.locator(".tipo-opcao", { hasText: "Pessoa física" }).click();
    await page.getByLabel("CPF", { exact: true }).fill(fmtCpf(cpf));
    await expect(page.locator(".achado-pessoa, .existe .aviso")).toHaveCount(0);
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeChecked();
    await expect(page.locator("#resumo")).toContainText("Pendente");
    await expect(page.locator("#resumo")).toContainText("porque falta o RNTRC");

    // Validação do servidor e do campo, sem perder o que foi digitado.
    await page.locator("#celular").fill("43 9");
    await page.getByLabel("RNTRC").fill("12345");
    await page.getByLabel("RNTRC").blur();
    await expect(page.locator(".campo", { has: page.getByLabel("RNTRC") }).locator(".erro")).toHaveText("O RNTRC tem 9 dígitos. Confira no certificado da ANTT.");
    await page.getByRole("button", { name: "Criar proprietário" }).click();
    await expect(page.locator(".campo", { has: page.getByLabel("Nome completo") }).locator(".erro")).toHaveText("Informe o nome completo, como está no CPF.");
    await expect(page.locator(".campo", { has: page.locator("#celular") }).locator(".erro")).toHaveText(
      "Telefone incompleto: DDD e número, 10 ou 11 dígitos.",
    );
    await expect(page.getByLabel("RNTRC")).toHaveValue("12345");

    await page.getByLabel("Nome completo").fill(nome);
    await page.locator("#celular").fill("(43) 99912-3456");
    await page.getByLabel("RNTRC").fill("987654321");
    await page.getByLabel("Validade", { exact: true }).fill(futuro(400));
    await expect(page.locator("#resumo")).toContainText("Normal");
    await page.getByRole("button", { name: "Criar proprietário" }).click();

    await expect(page).toHaveURL(/\/proprietarios\/[0-9a-f-]{36}\?criado=1$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
    await expect(page.locator(".aviso-criado")).toContainText("Proprietário criado.");
    await expect(page.locator(".linha-doc")).toContainText(fmtCpf(cpf));
    await expect(page.locator(".sinais .sinal").first()).toHaveText("Normal");
    const id = page.url().match(/proprietarios\/([0-9a-f-]{36})/)![1];

    // Aparece na lista (busca pelo CPF) e o mesmo CPF de novo vira "já é proprietário".
    await page.goto(`/proprietarios?q=${cpf}`);
    await expect(page.getByRole("row", { name: new RegExp(nome) })).toBeVisible();
    await page.goto(`/proprietarios/novo?tipo=pf&cpf=${cpf}`);
    await expect(page.locator(".existe")).toContainText(`${nome} já é proprietário`);

    // Ficha: ANTT (marco), Pagamento (prévias) e salvar.
    await page.goto(`/proprietarios/${id}?aba=antt`);
    await expect(page.locator(".marco-rntrc")).toContainText("restantes");
    await page.goto(`/proprietarios/${id}?aba=pagamento`);
    await expect(page.locator("#prev-adto")).toHaveText("Sem limite próprio: vale o limite geral da Prisa.");
    await page.locator("#limite_adiantamento_percentual").fill("70");
    await page.locator("#limite_adiantamento_valor").fill("5.000,00");
    await expect(page.locator("#prev-adto")).toHaveText("Num frete de R$ 10.000,00, o adiantamento vai até R$ 5.000,00.");
    await page.locator("#frete_empresa_motorista_percentual").fill("90");
    await expect(page.locator("#prev-frete")).toHaveText("Num frete da empresa de R$ 10.000,00, o motorista recebe R$ 9.000,00.");
    await page.locator("#taxa_adm_percentual").fill("120");
    await page.getByLabel(/Peso de saída/).check({ force: true });
    await expect(page.locator(".barra-salvar")).toBeVisible();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".campo", { has: page.locator("#taxa_adm_percentual") }).locator(".erro")).toHaveText("Percentual inválido: use um número de 0 a 100.");
    await page.locator("#taxa_adm_percentual").fill("3,5");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".barra-salvar")).toBeHidden({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator("#limite_adiantamento_valor")).toHaveValue("5.000,00");
    await expect(page.locator("#taxa_adm_percentual")).toHaveValue("3,5");
    await expect(page.getByLabel(/Peso de saída/)).toBeChecked();
    await expect(page.locator("#prev-adto")).toHaveText("Num frete de R$ 10.000,00, o adiantamento vai até R$ 5.000,00.");
  });

  test("ficha de empresa: nove abas por ?aba=, TAC desabilitado e veículos com links", async ({ page }) => {
    await entrar(page);
    await page.goto(`/proprietarios/${TSC}`);
    await expect(page.getByRole("heading", { level: 1, name: "Transportes Serra do Cadeado Ltda" })).toBeVisible();
    await expect(page.locator(".linha-doc")).toContainText("CNPJ");
    const nav = page.getByRole("navigation", { name: "Partes da ficha" });
    for (const rotulo of ["Dados", "ANTT", "Responsável", "Pagamento", "Contatos", "Contas e Pix", /^Documentos/, /^Veículos/, "Histórico"])
      await expect(nav.getByRole("link", { name: rotulo })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dados" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Empresa", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Atualizar pela Receita" })).toBeVisible();

    // "Atualizar pela Receita": preenche o que mudou e só grava ao salvar (aqui: descarta). Se a Receita não
    // responder, a ficha não muda, o aviso oferece "Tentar de novo" e o formulário continua editável.
    const razaoAntes = await page.getByLabel("Razão social").inputValue();
    await page.getByRole("button", { name: "Atualizar pela Receita" }).click();
    await expect(page.locator("#receita-msg .aviso")).toBeVisible({ timeout: 20_000 });
    if (await page.locator(".barra-salvar").isVisible()) {
      await expect(page.locator("#carimbo")).toContainText("Consultado na Receita agora, às");
      await expect(page.locator("#receita-msg .aviso")).toContainText("confira e salve");
      await page.getByRole("button", { name: "Descartar" }).click();
      await expect(page.locator(".barra-salvar")).toBeHidden();
      await expect(page.locator("#carimbo")).not.toContainText("agora");
      await expect(page.getByLabel("Razão social")).toHaveValue(razaoAntes);
    } else {
      await expect(page.locator("#receita-msg .aviso-bloqueado")).toContainText("Nada na ficha foi alterado.");
      await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    }
    await expect(page.getByLabel("Razão social")).toBeEditable();

    await page.goto(`/proprietarios/${TSC}?aba=antt`);
    await expect(nav.getByRole("link", { name: "ANTT" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeDisabled();
    await expect(page.locator(".campo", { has: page.locator("#g-enq") }).locator(".ajuda")).toContainText("TAC é só para pessoa física");
    await expect(page.locator("#rntrc")).toHaveValue("061190473");

    await nav.getByRole("link", { name: "Responsável" }).click();
    await expect(page).toHaveURL(/aba=responsavel/);
    await expect(page.getByLabel("Telefone")).toBeVisible();

    await nav.getByRole("link", { name: "Contatos" }).click();
    await expect(page.getByRole("heading", { name: "Endereços" })).toBeVisible();
    await nav.getByRole("link", { name: "Contas e Pix" }).click();
    await expect(page.getByRole("heading", { name: "Contas bancárias" })).toBeVisible();
    await nav.getByRole("link", { name: /^Documentos/ }).click();
    await expect(page.getByRole("heading", { name: "Arquivos do proprietário" })).toBeVisible();
    await nav.getByRole("link", { name: "Histórico" }).click();
    await expect(page.getByRole("heading", { name: "Histórico do registro" })).toBeVisible();

    await nav.getByRole("link", { name: /^Veículos/ }).click();
    await expect(page).toHaveURL(/aba=veiculos/);
    // A seed tem 8 veículos da TSC; outras execuções de teste (veículos) podem ter acrescentado mais.
    const linhas = await page.locator(".tabela tbody tr").count();
    expect(linhas).toBeGreaterThanOrEqual(8);
    await expect(page.locator(".tabela tbody tr").first()).toHaveAttribute("data-href", /\/veiculos\/[0-9a-f-]{36}$/);
    await expect(page.locator("p.muted").first()).toContainText(`${linhas} veículos`);
    await expect(page.locator("p.muted").first()).toContainText(/\d+ no CRLV\s*·\s*\d+ na ANTT/);
  });

  test("ficha de pessoa física: TAC habilitado e alteração não salva sobrevive à troca de aba", async ({ page }) => {
    await entrar(page);
    await page.goto(`/proprietarios/${EDSON}`);
    await expect(page.getByText("também é motorista", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "também é motorista" })).toHaveAttribute("href", `/motoristas/${EDSON}`);
    await expect(page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: "Responsável" })).toHaveCount(0);

    const apelido = page.locator("#apelido");
    const antes = await apelido.inputValue();
    await apelido.fill(`${antes}x`);
    await expect(page.locator(".barra-salvar")).toBeVisible();
    await page.getByRole("link", { name: "ANTT" }).click();
    await expect(page.getByRole("radio", { name: /^TAC/ })).toBeEnabled();
    await expect(page.locator(".barra-salvar")).toBeVisible();
    await page.getByRole("link", { name: "Dados", exact: true }).click();
    await expect(apelido).toHaveValue(`${antes}x`);
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(apelido).toHaveValue(antes);
    await expect(page.locator(".barra-salvar")).toBeHidden();

    // CPF inválido bloqueia o salvar no campo, com a mensagem do protótipo.
    const cpf = page.locator("#cpf");
    await cpf.fill("111.444.777-36");
    await cpf.blur();
    await expect(page.locator(".campo", { has: cpf }).locator(".erro")).toHaveText(
      "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
    );
    await page.getByRole("button", { name: "Descartar" }).click();
  });

  test("novo: resposta antiga da Receita não preenche o formulário de outro CNPJ", async ({ page }) => {
    await entrar(page);
    // A Receita (simulada) demora para o primeiro CNPJ; no meio do caminho a pessoa troca o CNPJ.
    await page.route("**/api/cnpj/00000000000191", async (rota) => {
      await new Promise((r) => setTimeout(r, 1500));
      await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nome: "EMPRESA ANTIGA SA", nome_fantasia: "", fundacao: "", natureza_juridica: "", cnae_principal: "", optante_simples: null, situacao: "ATIVA", endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" } }) });
    });
    await page.goto("/proprietarios/novo");
    await page.locator(".tipo-opcao", { hasText: "Empresa" }).click();
    const cnpj = page.getByLabel("CNPJ", { exact: true });
    await cnpj.fill("00000000000191");
    await expect(page.locator("#cnpj-estado")).toContainText("CNPJ válido");
    await page.getByRole("button", { name: "Buscar na Receita" }).click();
    await expect(page.getByRole("button", { name: "Buscando…" })).toBeVisible();
    await cnpj.fill("45321876000178");
    await page.waitForTimeout(2500);
    await expect(page.getByLabel("Razão social")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buscar na Receita" })).toBeEnabled();
  });

  test("novo: falha da Receita usa os textos do protótipo e mantém o formulário editável", async ({ page }) => {
    await entrar(page);
    await page.route("**/api/cnpj/00000000000191", (rota) => rota.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ erro: "CNPJ não encontrado na Receita." }) }));
    await page.goto("/proprietarios/novo");
    await page.locator(".tipo-opcao", { hasText: "Empresa" }).click();
    const cnpj = page.getByLabel("CNPJ", { exact: true });
    await cnpj.fill("00000000000191");
    await page.getByRole("button", { name: "Buscar na Receita" }).click();
    await expect(page.locator(".existe .aviso-bloqueado")).toContainText(
      "CNPJ não encontrado na Receita. Confira os dígitos no cartão CNPJ; se estiverem certos, preencha os dados à mão.",
    );
    await page.unroute("**/api/cnpj/00000000000191");
    await page.route("**/api/cnpj/00000000000191", (rota) => rota.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ erro: "A consulta não respondeu. Preencha à mão ou tente de novo." }) }));
    await page.getByRole("button", { name: "Buscar na Receita" }).click();
    await expect(page.locator(".existe .aviso-bloqueado")).toContainText("A consulta à Receita não respondeu (BrasilAPI fora do ar ou sem internet). Tente de novo em instantes ou preencha os dados à mão.");
    await page.getByRole("button", { name: "Preencher à mão" }).click();
    await expect(page.getByLabel("Razão social")).toBeEditable();
  });

  test("ficha: erro do servidor em painel oculto leva à aba do campo e foca nele", async ({ page }) => {
    await entrar(page);
    await page.goto(`/proprietarios/${TSC}`);
    // Uma edição visível primeiro (garante a hidratação); nada é gravado porque o servidor recusa o outro campo.
    await page.locator("#nome_fantasia").fill("TSC Transportes x");
    await expect(page.locator(".barra-salvar")).toBeVisible();
    // Campo de Pagamento (painel oculto): a validação do servidor recusa e a ficha troca de aba.
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>("#taxa_adm_percentual")!;
      // Setter nativo: o React ignora o evento quando o valor foi trocado pela propriedade do elemento.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, "150");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(/aba=pagamento/);
    await expect(page.locator("#taxa_adm_percentual")).toBeFocused();
    await expect(page.locator(".campo", { has: page.locator("#taxa_adm_percentual") }).locator(".erro")).toHaveText("Percentual inválido: use um número de 0 a 100.");
    await page.getByRole("button", { name: "Descartar" }).click();
  });

  test("não encontrado: id que não é uuid, uuid sem cadastro e pessoa que não é proprietária", async ({ page }) => {
    await entrar(page);
    for (const id of ["abc", "00000000-0000-4000-8000-0000000fffff"]) {
      await page.goto(`/proprietarios/${id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Proprietário não encontrado" })).toBeVisible();
      await expect(page.locator(".prop-nao-achou")).toContainText(`Não há proprietário com o código “${id}”.`);
      await expect(page.getByRole("link", { name: "Voltar para proprietários" })).toHaveAttribute("href", "/proprietarios");
      await expect(page.getByRole("link", { name: "Novo proprietário" })).toBeVisible();
    }
  });

  test("ficha: ?aba= inválida volta para Dados; empresa sem RNTRC mostra o aviso", async ({ page }) => {
    await entrar(page);
    await page.goto(`/proprietarios/${IVAI}?aba=nada`);
    await expect(page.getByRole("navigation", { name: "Partes da ficha" }).getByRole("link", { name: "Dados" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".sinais")).toContainText("Sem RNTRC");
    await page.goto(`/proprietarios/${IVAI}?aba=antt`);
    await expect(page.locator("#marco-rntrc")).toContainText("Sem RNTRC: o proprietário fica pendente até o número e a validade serem informados.");
    await page.goto(`/proprietarios/${IVAI}?aba=veiculos`);
    await expect(page.locator(".tabela tbody tr")).toHaveCount(2);
  });

  test("prints: lista, novo e ficha em 1440 e 390, ao lado do protótipo", async ({ page }) => {
    test.setTimeout(240_000);
    await entrar(page);
    const alvos: [string, string, string][] = [
      ["lista", "/proprietarios", "proprietarios.html"],
      ["novo", "/proprietarios/novo", "proprietario-novo.html"],
      ["ficha", `/proprietarios/${TSC}`, "proprietario.html?id=p09"],
      ["naoachado", "/proprietarios/abc", "proprietario.html?id=zzz"],
    ];
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      for (const [nome, rota, proto] of alvos) {
        await page.goto(rota);
        await expect(page.locator("main[aria-busy]")).toHaveCount(0);
        await prepararPrint(page);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-${nome}-${w}.png`), fullPage: true });
        await page.goto(PROTOTIPO(proto));
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-prototipo-${nome}-${w}.png`), fullPage: true });
      }
      for (const aba of ["antt", "pagamento", "contatos", "contas", "documentos", "veiculos", "historico", "responsavel"]) {
        await page.goto(`/proprietarios/${TSC}?aba=${aba}`);
        await expect(page.locator("main[aria-busy]")).toHaveCount(0);
        await prepararPrint(page);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-aba-${aba}-${w}.png`), fullPage: true });
        await page.goto(PROTOTIPO("proprietario.html?id=p09"));
        await page.locator(`#aba-${aba}`).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-prototipo-aba-${aba}-${w}.png`), fullPage: true });
      }
    }
  });

  test("prints: novo (pessoa física e empresa pela Receita) em 1440 e 390, ao lado do protótipo", async ({ page }) => {
    test.setTimeout(240_000);
    const cpf = fmtCpf(cpfAleatorio());
    await entrar(page);
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      for (const [nome, rotulo, doc, campo, botao] of [
        ["pf", "Pessoa física", cpf, "#cpf", null],
        ["pj", "Empresa", "00000000000191", "#cnpj", "#btn-receita"],
      ] as const) {
        await page.goto("/proprietarios/novo");
        await page.locator(".tipo-opcao", { hasText: rotulo }).click();
        await page.locator(campo).fill(doc);
        if (botao) {
          await page.locator(botao).click();
          await expect(page.locator("#nome")).not.toHaveValue("", { timeout: 20_000 });
        } else await expect(page.locator("#nome")).toBeVisible();
        await page.locator("#rntrc").fill("123456789");
        await prepararPrint(page);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-novo-${nome}-${w}.png`), fullPage: true });

        await page.goto(PROTOTIPO("proprietario-novo.html"));
        await page.locator(".tipo-opcao", { hasText: rotulo }).click();
        await page.locator(campo).fill(doc);
        if (botao) {
          await page.locator(botao).click();
          await expect(page.locator("#pj-nome")).not.toHaveValue("", { timeout: 20_000 });
        }
        await page.locator("#rntrc").fill("123456789");
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(PRINTS, `proprietarios-prototipo-novo-${nome}-${w}.png`), fullPage: true });
      }
    }
  });
});
