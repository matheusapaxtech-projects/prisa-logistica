import { expect, test } from "@playwright/test";
import { entrar } from "./apoio";

// Shell (Task 5): sidebar, topbar, busca global, selo de pendências e menu do celular.
// Usa o administrador de teste de web/.env.test.local. Só lê dados (nada é criado nem apagado).
const { E2E_EMAIL, E2E_SENHA } = process.env;

test.describe("shell", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("menu, usuário e selo de pendências", async ({ page }) => {
    await entrar(page);
    // Visual rapport: seções em pílulas no topo; cadastros, administração, senha e sair no trilho escuro.
    const secoes = page.getByRole("navigation", { name: "Seções" });
    for (const item of ["Início", "Quadro", "Pedidos", "Viagens", "Clientes", "Pendências"]) {
      await expect(secoes.getByRole("link", { name: new RegExp(`^${item}`) })).toBeVisible();
    }
    await expect(secoes.getByRole("link", { name: "Início", exact: true })).toHaveAttribute("aria-current", "page");
    const menu = page.getByRole("complementary", { name: "Menu principal" });
    for (const item of ["Motoristas", "Proprietários", "Veículos", "Conjuntos", "Usuários", "Auditoria"]) {
      await expect(menu.getByRole("link", { name: item })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: /, Administrador$/ })).toBeVisible();
    const selo = secoes.locator(".contagem");
    await expect(selo).toHaveText(/^\d+$/);
    await expect(selo).toHaveAttribute("aria-label", /^\d+ pendências$/);
    await expect(menu.getByRole("button", { name: "Sair" })).toBeVisible();
  });

  test("busca global: placa, nome, nada encontrado, teclado e '/'", async ({ page }) => {
    await entrar(page);
    await page.locator("body").press("/");
    const busca = page.getByRole("combobox", { name: "Buscar placa, CPF, CNPJ ou nome" });
    await expect(busca).toBeFocused();

    await busca.fill("bra2");
    const lista = page.locator("#busca-resultados");
    await expect(lista.getByRole("option").first()).toContainText("BRA2E19");
    await expect(lista.locator(".placa").first()).toHaveAttribute("aria-label", "Placa BRA2E19");

    await busca.fill("edson");
    await expect(lista.getByRole("option", { name: /Edson/ })).toContainText("motorista");
    await expect(lista.getByRole("option", { name: /Edson/ })).toHaveAttribute("href", /^\/motoristas\/[0-9a-f-]{36}$/);

    // Nome com espaço e dígitos do CPF (com pontuação) também acham a pessoa.
    await busca.fill("edson ramos");
    await expect(lista.getByRole("option", { name: /Edson Ramos/ })).toBeVisible();
    await busca.fill("318.265");
    await expect(lista.getByRole("option", { name: /Edson/ })).toContainText("318.265.904-98");

    // Caracteres do PostgREST não quebram nem alargam o filtro.
    await busca.fill("ed,son*)");
    await expect(lista.locator(".busca-vazio")).toHaveText("Nada encontrado para “ed,son*)”. Confira a placa ou o documento.");

    await busca.fill("bra2e19");
    // Os dígitos da placa ("219") também acham CPFs da seed do Quadro (o Serginho, 957.318.462-19): a placa vem primeiro.
    await expect(lista.getByRole("option", { name: /BRA2E19/ })).toHaveCount(1);
    await expect(lista.getByRole("option").first()).toContainText("BRA2E19");
    await busca.press("ArrowDown");
    await expect(lista.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await busca.press("Enter");
    await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]{36}$/);
  });

  test("celular: o menu abre pelo botão e fecha ao clicar fora", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page);
    const shell = page.locator(".shell");
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
    // Espera a página hidratar: o React põe `__reactProps$…` nos elementos que ele já controla. Antes disso o clique
    // não faz nada (ou abre o menu sem que o clique fora tenha ouvinte) e o teste falhava de vez em quando.
    await page.waitForLoadState("load");
    await page.waitForFunction(() => {
      const botao = document.querySelector(".menu-btn");
      const moldura = document.querySelector(".shell");
      const hidratado = (el: Element | null) => !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
      return hidratado(botao) && hidratado(moldura);
    });
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(shell).toHaveClass(/menu-aberto/);
    await page.mouse.click(370, 400);
    await expect(shell).not.toHaveClass(/menu-aberto/);
  });

});
