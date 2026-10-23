import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_SENHA, entrar } from "./apoio";

// Pendências (Task 10): abas Pendências, Vencimentos e Documentos; `?tipo=` vindo das placas da tela Início.
// Só lê dados.

/** Os `tipo` que a tela Início linka e o título do grupo que cada um abre. */
const TIPOS: [string, string][] = [
  ["arquivo_vencido", "Documentos vencidos"],
  ["veiculo_arrendado_sem_contrato", "Arrendado sem contrato"],
  ["conjunto_acima_cmt", "Conjunto acima do CMT"],
  ["motorista_sem_cnh", "Motorista sem CNH anexada"],
  ["motorista_sem_comprovante", "Sem comprovante de residência"],
];

test.describe("pendências", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("cada ?tipo= da tela Início abre a aba Pendências só com aquele grupo", async ({ page }) => {
    await entrar(page);
    const abas = page.getByRole("navigation", { name: "Pendências, vencimentos e documentos" });
    for (const [tipo, titulo] of TIPOS) {
      await page.goto(`/pendencias?tipo=${tipo}`);
      await expect(abas.getByRole("link", { name: /^Pendências/ })).toHaveAttribute("aria-current", "page");
      await expect(page.locator("#filtro-tipo")).toHaveValue(tipo);
      const grupos = page.locator("#grupos section.grupo-pend");
      await expect(grupos).toHaveCount(1);
      await expect(grupos.first()).toHaveAttribute("data-tipo", tipo);
      await expect(grupos.first().getByRole("heading", { level: 2 })).toHaveText(titulo);
    }
  });

  test("os links das placas da tela Início chegam no filtro certo", async ({ page }) => {
    await entrar(page);
    for (const [tipo, titulo] of TIPOS) {
      await page.goto("/");
      await page.locator(`a.advertencia[href="/pendencias?tipo=${tipo}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/pendencias\\?tipo=${tipo}$`));
      await expect(page.locator("#grupos h2")).toHaveText([titulo]);
    }
  });

  test("contagens iguais às do selo do menu; filtro grava ?tipo=; ?aba= abre a aba; valor fora da lista cai no padrão", async ({ page }) => {
    await entrar(page);
    await page.goto("/pendencias");
    const selo = Number(await page.locator(".nav .contagem").textContent());
    const abas = page.getByRole("navigation", { name: "Pendências, vencimentos e documentos" });
    await expect(abas.getByRole("link", { name: /^Pendências/ }).locator(".n")).toHaveText(String(selo));
    await expect(page.locator("#achado")).toContainText(`${selo} ${selo === 1 ? "pendência" : "pendências"}`);
    await expect(page.locator("#total-pend")).toHaveText(`${selo} ${selo === 1 ? "pendência" : "pendências"}`);
    await expect(page.locator("#grupos section.grupo-pend")).toHaveCount(5);

    await page.locator("#filtro-tipo").selectOption("conjunto_acima_cmt");
    await expect(page).toHaveURL(/\/pendencias\?tipo=conjunto_acima_cmt$/);
    await expect(page.locator("#grupos section.grupo-pend")).toHaveCount(1);

    await page.goto("/pendencias?aba=vencimentos");
    await expect(abas.getByRole("link", { name: /^Vencimentos/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 2, name: /^Vencidos/ })).toBeVisible();
    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /^A vencer\d/ })).toBeVisible();

    await page.goto("/pendencias?aba=documentos");
    await expect(abas.getByRole("link", { name: /^Documentos/ })).toHaveAttribute("aria-current", "page");
    await page.locator("#docs-conf").selectOption("nao");
    const linhas = page.locator("#docs tr[data-href]");
    const n = await linhas.count();
    for (let i = 0; i < Math.min(n, 5); i++) await expect(linhas.nth(i)).toContainText("A conferir");

    await page.goto("/pendencias?aba=xyz&tipo=drop");
    await expect(abas.getByRole("link", { name: /^Pendências/ })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#filtro-tipo")).toHaveValue("");
  });

});
