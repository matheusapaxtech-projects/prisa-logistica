import path from "node:path";
import { expect, test } from "@playwright/test";
import { bancoAdmin, prepararPrint } from "./apoio";

// Calcular frete: a cotação Mandaguari/PR → Maracaju/MS (rota medida, 583 km, granel sólido, 7 eixos),
// 37 t a R$ 241,30/t com o motorista a R$ 6.844,40 dá margem líquida de 8,35%: "Negociar". Depois o
// motorista abaixo do piso ("Não contratar"), o atalho "Usar o da margem mínima" ("Pode contratar") e
// a abertura pela ficha da viagem. Só lê o banco. Prints em test-results/calculadora/.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o bloco da viagem é pulado
}

const PRINTS = path.join(__dirname, "..", "..", "test-results", "calculadora");

test("decisão de contratação na calculadora", async ({ page }) => {
  await page.goto("/calculadora");
  await expect(page.getByRole("heading", { name: "Calcular frete" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Carga em", { exact: true })).toHaveValue("Mandaguari/PR");

  await page.getByLabel("Descarga em", { exact: true }).fill("Maracaju/MS");
  await expect(page.getByLabel("Km da rota", { exact: true })).toHaveValue("583", { timeout: 20_000 });
  await expect(page.getByText("rota já medida pela Prisa", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Pedágio (vale-pedágio)", { exact: true })).toHaveValue("155,08");

  await page.getByLabel("Peso da carga", { exact: true }).fill("37");
  await page.getByLabel("Capacidade do caminhão", { exact: true }).fill("37");
  await page.getByLabel("Frete contratado por tonelada", { exact: true }).fill("241,30");
  await page.getByLabel("Frete do motorista", { exact: true }).fill("6.844,40");

  const decisao = page.getByRole("region", { name: /Negociar|Pode contratar|Não contratar|Ajustar|Faltam/ });
  await expect(page.locator("#calc-veredito")).toHaveText("Negociar");
  await expect(decisao.getByText("Pague ao motorista no máximo")).toBeVisible();
  await expect(decisao.getByText("R$ 6.831,33")).toBeVisible();
  await expect(decisao.getByText("R$ 8.944,85")).toBeVisible();
  await expect(page.getByText("Frete mínimo ANTT", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 5.619,36").first()).toBeVisible();
  // admin vê a margem e o resultado do CT-e
  await expect(decisao.getByText("8,35%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resultado do CT-e" })).toBeVisible();
  await prepararPrint(page);
  await page.screenshot({ path: path.join(PRINTS, "1-negociar.png"), fullPage: true });

  await page.getByLabel("Frete do motorista", { exact: true }).fill("5.000");
  await expect(page.locator("#calc-veredito")).toHaveText("Não contratar");
  await expect(decisao.getByText("Pague ao motorista pelo menos")).toBeVisible();
  await page.screenshot({ path: path.join(PRINTS, "2-nao-contratar.png"), fullPage: true });

  await page.getByLabel("Frete do motorista", { exact: true }).fill("6.844,40");
  await page.getByRole("button", { name: /Usar o da margem mínima/ }).click();
  await expect(page.locator("#calc-veredito")).toHaveText("Pode contratar");
  await expect(page.getByLabel("Frete contratado por tonelada", { exact: true })).toHaveValue("241,76");
  await page.screenshot({ path: path.join(PRINTS, "3-pode-contratar.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Frete do motorista", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(PRINTS, "4-celular.png") });
});

test("abre preenchida pela ficha da viagem", async ({ page }) => {
  const r = await bancoAdmin().from("viagem").select("id, numero").is("cancelada_em", null).order("numero", { ascending: false }).limit(1).maybeSingle();
  test.skip(!r.data, "não há viagem no banco");
  await page.goto(`/viagens/${r.data!.id}`);
  await page.getByRole("link", { name: "Abrir na calculadora" }).click();
  await expect(page).toHaveURL(new RegExp(`/calculadora\\?viagem=${r.data!.id}`));
  await expect(page.getByRole("link", { name: `viagem #${r.data!.numero}` })).toBeVisible({ timeout: 30_000 });
  await prepararPrint(page);
  await page.screenshot({ path: path.join(PRINTS, "5-da-viagem.png"), fullPage: true });
});

test("lote de carga: composição, preço mínimo e abrir um caminhão na carga única", async ({ page }) => {
  await page.goto("/calculadora");
  await page.getByLabel("Descarga em", { exact: true }).fill("Maracaju/MS");
  await expect(page.getByLabel("Km da rota", { exact: true })).toHaveValue("583", { timeout: 20_000 });
  await page.getByRole("button", { name: "Lote de carga" }).click();

  await page.getByLabel("Peso total do lote", { exact: true }).fill("128");
  await page.getByLabel("Frete contratado por tonelada", { exact: true }).fill("205");
  for (const e of [5, 6, 6, 7]) await page.getByRole("button", { name: `+ ${e} eixos` }).click();
  await page.getByRole("button", { name: "Distribuir o peso" }).click();

  await expect(page.locator("#calc-veredito")).toHaveText("Negociar");
  const decisao = page.locator("#calc-decisao");
  await expect(decisao.getByText("R$ 209,52/t")).toBeVisible();
  await expect(decisao.getByText("128,00 de 128,00 t")).toBeVisible();
  await expect(decisao.getByText("R$ 20.462,00")).toBeVisible();
  await expect(page.getByText("50 t · o mais barato")).toBeVisible();
  await prepararPrint(page);
  await page.screenshot({ path: path.join(PRINTS, "6-lote-negociar.png"), fullPage: true });

  await page.getByLabel("Frete contratado por tonelada", { exact: true }).fill("210");
  await expect(page.locator("#calc-veredito")).toHaveText("Pode contratar");

  await page.getByLabel("Frete do motorista").first().fill("4.000");
  await expect(page.locator("#calc-veredito")).toHaveText("Não contratar");
  await page.getByLabel("Frete do motorista").first().fill("");

  await page.getByRole("button", { name: "Abrir na carga única" }).last().click();
  await expect(page.getByRole("button", { name: "Carga única" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Frete do motorista", { exact: true })).toHaveValue("5.620,00");
  await expect(page.getByLabel("Peso da carga", { exact: true })).toHaveValue("38,00");
});

test("rotas salvas: salvar, usar no lugar da estimativa e apagar", async ({ page }) => {
  // Rota fictícia no Acre (nenhuma rota da Prisa passa por lá); limpa antes e depois.
  const db = bancoAdmin();
  const limpar = () => db.from("rota_salva").delete().eq("chave", "acrelandia/ac>assis brasil/ac");
  await limpar();
  try {
    await page.goto("/calculadora");
    await page.getByLabel("Carga em", { exact: true }).fill("Acrelândia/AC");
    await page.getByLabel("Descarga em", { exact: true }).fill("Assis Brasil/AC");
    await expect(page.getByText(/^estimado: linha reta/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Km da rota", { exact: true }).fill("345");
    await page.getByLabel("Pedágio (vale-pedágio)", { exact: true }).fill("70");
    await page.getByRole("button", { name: "Salvar rota para a equipe" }).click();
    await expect(page.getByText("Rota salva: 345 km e pedágio de R$ 70,00 para 7 eixos.")).toBeVisible();

    await expect(page.getByLabel("Km da rota", { exact: true })).toHaveValue("345");
    await expect(page.getByText(/^rota salva pela equipe em/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Atualizar rota salva" })).toBeDisabled();
    const linha = page.getByRole("row", { name: /Acrelândia\/AC → Assis Brasil\/AC/ });
    await expect(linha).toContainText("R$ 70,00 / 7 eixos");
    // 5 eixos: o pedágio da rota salva é convertido por eixo/km
    await page.getByRole("group", { name: "Eixos do caminhão" }).getByRole("button", { name: "5", exact: true }).click();
    await expect(page.getByLabel("Pedágio (vale-pedágio)", { exact: true })).toHaveValue("50,00");
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "7-rota-salva.png"), fullPage: true });

    await page.getByLabel("Descarga em", { exact: true }).fill("Maracaju/MS");
    await linha.getByRole("button", { name: "Usar" }).click();
    await expect(page.getByLabel("Descarga em", { exact: true })).toHaveValue("Assis Brasil/AC");

    await linha.getByRole("button", { name: /Apagar a rota/ }).click();
    await linha.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Rota apagada.")).toBeVisible();
    await expect(linha).toHaveCount(0);
  } finally {
    await limpar();
  }
});
