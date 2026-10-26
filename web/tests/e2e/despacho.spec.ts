import path from "node:path";
import { expect, test } from "@playwright/test";
import { bancoAdmin, prepararPrint } from "./apoio";

// Despacho: registrar um motorista livre perto da coleta de um pedido aberto e ver o ranking na ficha do
// pedido. Grava no banco vivo e apaga o registro no fim. Prints em test-results/despacho/.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o teste é pulado
}
const PRINTS = path.join(__dirname, "..", "..", "test-results", "despacho");

test("motorista livre aparece no ranking do pedido", async ({ page }) => {
  test.setTimeout(120_000);
  const db = bancoAdmin();
  const saldo = await db.from("v_pedido_saldo").select("pedido_id, saldo_kg").gt("saldo_kg", 0).limit(20);
  const pedidos = saldo.data?.length
    ? await db
        .from("pedido")
        .select("id, numero, situacao, coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf)")
        .in("id", saldo.data.map((s) => s.pedido_id!))
        .eq("situacao", "aberto")
        .limit(1)
    : { data: [] };
  const pedido = pedidos.data?.[0] as { id: string; numero: number; coleta: { cidade: string; uf: string } } | undefined;
  test.skip(!pedido, "não há pedido aberto com saldo");

  const inicio = new Date(Date.now() - 60_000).toISOString();
  await page.goto("/disponiveis");
  await expect(page.getByRole("heading", { name: "Motoristas livres" })).toBeVisible({ timeout: 30_000 });
  const select = page.getByLabel("Motorista", { exact: true });
  const opcoes = await select.locator("option").allTextContents();
  test.skip(opcoes.length < 2, "não há motorista de conjunto aberto");
  // um motorista sem viagem planejada ou em andamento (esses ficam de fora do ranking, de propósito)
  const ativas = await db
    .from("viagem")
    .select("cavalo:veiculo!viagem_cavalo_id_fkey(placa)")
    .is("cancelada_em", null)
    .or("status_campo.is.null,status_campo.not.in.(aguardando_saldo,frete_finalizado)");
  const ocupadas = new Set((ativas.data ?? []).map((v) => (v.cavalo as unknown as { placa: string } | null)?.placa));
  const indice = opcoes.findIndex((o, i) => i > 0 && !ocupadas.has(o.split(" · ")[1]));
  test.skip(indice < 0, "todos os motoristas de conjunto aberto estão em viagem");
  await select.selectOption({ index: indice });
  // primeiro nome (o rótulo do conjunto e o da lista podem diferir no apelido)
  const nome = opcoes[indice].split(" · ")[0].split(" ")[0];
  const cidade = `${pedido!.coleta.cidade}/${pedido!.coleta.uf}`;
  const limpar = async () => {
    const mot = await db.from("motorista_disponibilidade").select("id").eq("cidade", cidade).gte("created_at", inicio);
    for (const m of mot.data ?? []) await db.from("motorista_disponibilidade").delete().eq("id", m.id);
  };
  try {
    await page.getByLabel("Está em", { exact: true }).fill(cidade);
    await page.getByRole("button", { name: "24 horas" }).click();
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Disponibilidade registrada.")).toBeVisible();
    await expect(page.locator(".tabela").first().getByText(nome, { exact: false }).first()).toBeVisible();
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "1-livres.png"), fullPage: true });

    await page.goto(`/pedidos/${pedido!.id}`);
    await expect(page.getByRole("heading", { name: "Despacho" }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".desp-cartoes").getByText(nome, { exact: false }).first()).toBeVisible();
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "2-ranking.png"), fullPage: true });
  } finally {
    await limpar();
  }
});
