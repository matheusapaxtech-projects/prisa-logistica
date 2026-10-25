import path from "node:path";
import { expect, test } from "@playwright/test";
import { prepararPrint } from "./apoio";

// Quadro com as etapas do motor de despacho (migration 20261029000300): Descarregando e Aguardando saldo (30%)
// entre as colunas, na ordem. Só lê. Print em test-results/quadro/.
const PRINTS = path.join(__dirname, "..", "..", "test-results", "quadro");

test("Quadro mostra as 12 colunas com as etapas novas", async ({ page }) => {
  await page.goto("/quadro");
  const titulos = page.locator(".quadro-coluna h2");
  await expect(titulos.first()).toBeVisible({ timeout: 30_000 });
  const nomes = await titulos.allTextContents();
  expect(nomes).toEqual([
    "Trânsito",
    "Aguardando carregamento",
    "Em carregamento",
    "Aguardando NF e pagamento",
    "Em rota",
    "Pausa",
    "Aguardando descarga",
    "Descarregando",
    "Aguardando contagem de divergência",
    "Resolução de divergência na carga",
    "Aguardando saldo (30%)",
    "Frete finalizado",
  ]);
  await prepararPrint(page);
  await page.screenshot({ path: path.join(PRINTS, "quadro-12-colunas.png"), fullPage: true });
});
