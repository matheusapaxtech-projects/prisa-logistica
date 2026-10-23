import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bancoAdmin, E2E_EMAIL, E2E_SENHA, entrar } from "./apoio";

// Conjuntos (Task 10): lista, montador (/conjuntos/novo), ficha, "Trocar peças" (?editar=1) e encerrar.
// Roda contra o banco vivo de desenvolvimento. Re-executável e sem apagar nada:
// - o cavalo, as carretas e o dolly são escolhidos na hora entre os veículos da seed que estão livres;
// - o que o teste monta fica no histórico (encerrado) e o estado aberto do cavalo volta ao que era
//   (a limpeza, depois do teste, encerra o que o teste abriu, ou salva de novo a composição original).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o teste é pulado
}
const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;

/** Ids fixos da seed de desenvolvimento: veículos 2xx, conjuntos 3xx. */
const SEED_VEICULO = "00000000-0000-4000-8000-0000000002";
const SEED_CONJUNTO = "00000000-0000-4000-8000-0000000003";
const MSG_DOLLY = "dolly não pode ser a primeira nem a última peça";
const MSG_OUTRO = "veículo já está em outro conjunto aberto";

type Veic = { id: string; placa: string; categoria: string; tipo: string };
type Aberto = { id: string; cavalo_id: string; motorista_id: string | null; itens: string[] };

async function abertos(db: SupabaseClient): Promise<Aberto[]> {
  const { data, error } = await db.from("conjunto").select("id, cavalo_id, motorista_id, created_by, conjunto_item(posicao, veiculo_id)").is("fim", null);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    cavalo_id: c.cavalo_id,
    motorista_id: c.motorista_id,
    itens: [...(c.conjunto_item as { posicao: number; veiculo_id: string }[])].sort((a, b) => a.posicao - b.posicao).map((i) => i.veiculo_id),
  }));
}

async function veiculosSeed(db: SupabaseClient): Promise<Veic[]> {
  const { data, error } = await db.from("veiculo").select("id, placa, tipo_veiculo(nome, categoria)").order("id");
  if (error) throw error;
  return (data ?? []).filter((v) => v.id.startsWith(SEED_VEICULO)).map((v) => {
    const t = v.tipo_veiculo as unknown as { nome: string; categoria: string };
    return { id: v.id, placa: v.placa, categoria: t.categoria, tipo: t.nome };
  });
}

const abertoDoCavalo = async (db: SupabaseClient, cavalo: string) => (await abertos(db)).find((c) => c.cavalo_id === cavalo) ?? null;

/** Volta o cavalo ao estado aberto original: sem conjunto aberto, ou a mesma composição de antes. */
async function restaurar(db: SupabaseClient, cavalo: string, original: Aberto | null) {
  const agora = await abertoDoCavalo(db, cavalo);
  if (!original) {
    if (agora) {
      const r = await db.rpc("encerrar_conjunto", { p_conjunto_id: agora.id });
      if (r.error) throw new Error(`Não foi possível encerrar o conjunto ${agora.id}: ${r.error.message}`);
    }
    return;
  }
  if (agora && agora.itens.join() === original.itens.join() && agora.motorista_id === original.motorista_id) return;
  const r = await db.rpc("salvar_conjunto", {
    p_conjunto_id: agora?.id ?? null,
    p_cavalo_id: cavalo,
    p_motorista_id: original.motorista_id,
    p_itens: original.itens,
  });
  if (r.error) throw new Error(`Não foi possível restaurar o conjunto do cavalo ${cavalo}: ${r.error.message}`);
}

/**
 * Limpeza depois do teste, fora do `finally` (sem `expect` lá dentro): roda todos os passos, registra
 * as falhas no log e devolve a primeira. Quem chama relança primeiro o erro do teste (se houve) e só
 * depois o da limpeza, para a falha original nunca ficar escondida.
 */
async function limpar(...passos: (() => Promise<unknown>)[]): Promise<unknown> {
  let primeira: unknown = null;
  for (const passo of passos) {
    try {
      await passo();
    } catch (e) {
      console.error("Falha na limpeza do teste de conjuntos:", e);
      primeira ??= e;
    }
  }
  return primeira;
}

/** Peças livres da seed (fora de qualquer conjunto aberto) e um cavalo da seed sem conjunto aberto. */
async function escolher(db: SupabaseClient) {
  const [frota, abs] = await Promise.all([veiculosSeed(db), abertos(db)]);
  const ocupados = new Set(abs.flatMap((c) => [c.cavalo_id, ...c.itens]));
  const livres = frota.filter((v) => !ocupados.has(v.id));
  const cavalo = livres.find((v) => v.categoria === "cavalo");
  const carretas = livres.filter((v) => v.categoria === "carreta");
  const dolly = livres.find((v) => v.categoria === "dolly");
  return { frota, abs, cavalo, a: carretas[0], b: carretas[1], dolly };
}

const peca = (page: Page, placa: string) => page.locator("#pecas li.peca-linha", { hasText: placa });
const livre = (page: Page, placa: string) => page.locator(`#livres button`, { hasText: placa });

test.describe("conjuntos", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!E2E_EMAIL || !E2E_SENHA || !URL || !CHAVE, "Faltam E2E_EMAIL/E2E_SENHA (.env.test.local) ou as chaves públicas (.env.local).");

  test("lista: abertos, filtro, histórico e linha abre a ficha", async ({ page }) => {
    await entrar(page);
    await page.goto("/conjuntos");
    await expect(page.getByRole("heading", { level: 1, name: "Conjuntos" })).toBeVisible();
    await expect(page.locator("#achado")).toContainText(/\d+ abertos?/);
    const linhas = page.locator("#lista-abertos tr[data-href]");
    expect(await linhas.count()).toBeGreaterThan(0);

    await page.locator("#filtro-abertos").selectOption("excede");
    const n = await linhas.count();
    for (let i = 0; i < n; i++) await expect(linhas.nth(i)).toContainText("do CMT");

    await page.locator("#filtro-abertos").selectOption("");
    await page.getByLabel("Buscar conjunto por placa ou motorista").fill("zzzz9");
    await expect(page.locator("#lista-abertos")).toContainText("Nenhum conjunto aberto com essa placa, motorista ou filtro.");

    await page.getByRole("link", { name: /^Histórico/ }).click();
    await expect(page).toHaveURL(/aba=historico/);
    await expect(page.locator("#total-historico")).toContainText(/encerrados?/);
    await page.locator("#lista-historico tr[data-href] td").first().click();
    await expect(page).toHaveURL(/\/conjuntos\/[0-9a-f-]{36}$/);
    await expect(page.locator(".migalha .sinal")).toContainText("Encerrado");
  });

  test("dolly na ponta não salva; rodotrem válido salva, troca peças e encerra", async ({ page }) => {
    test.setTimeout(120_000);
    const db = bancoAdmin();
    const { cavalo, a, b, dolly } = await escolher(db);
    test.skip(!cavalo || !a || !b || !dolly, "A seed não tem um cavalo, duas carretas e um dolly livres agora.");
    const original = await abertoDoCavalo(db, cavalo!.id);
    let falha: unknown = null;

    try {
      await entrar(page);
      await page.goto(`/conjuntos/novo?cavalo=${cavalo!.id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Montar conjunto" })).toBeVisible();
      await expect(page.locator(`#lista-cav input[value="${cavalo!.id}"]`)).toBeChecked();

      // 1) dolly na primeira posição: a mensagem exata do banco junto da peça e salvar desligado
      await livre(page, dolly!.placa).click();
      await expect(peca(page, dolly!.placa).locator(".erro-msg")).toHaveText(MSG_DOLLY);
      await expect(page.locator("#salvar")).toBeDisabled();
      await expect(page.locator("#motivo")).toContainText(MSG_DOLLY);
      // ... e nada foi gravado
      expect(await abertoDoCavalo(db, cavalo!.id)).toEqual(original);

      // 2) carreta na frente e outra atrás: rodotrem válido (carreta, dolly, carreta)
      await livre(page, a!.placa).click();
      await page.getByRole("button", { name: `Subir ${a!.placa} para a posição 1` }).click();
      await expect(peca(page, dolly!.placa).locator(".erro-msg")).toHaveText(MSG_DOLLY); // agora é a última
      await page.locator("#add-placa").fill(b!.placa);
      await page.locator("#add-placa").press("Enter");
      await expect(page.locator("#pecas .erro-msg")).toHaveCount(0);
      await expect(page.locator("#motivo")).toContainText("Pronto para salvar");
      const nome = [cavalo!.placa, a!.placa, dolly!.placa, b!.placa].join(" + ");
      await expect(page.locator("#previa-legenda")).toContainText(nome);

      await page.locator("#salvar").click();
      await expect(page.locator(".toast", { hasText: `Conjunto ${nome} montado` })).toBeVisible();
      await expect(page).toHaveURL(/\/conjuntos\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
      const montado = await abertoDoCavalo(db, cavalo!.id);
      expect(montado?.itens).toEqual([a!.id, dolly!.id, b!.id]);
      expect(page.url()).toContain(montado!.id);

      // 3) Trocar peças: tira o dolly e a carreta de trás
      await page.getByRole("link", { name: "Trocar peças" }).click();
      await expect(page).toHaveURL(/editar=1/);
      await expect(page.getByRole("heading", { level: 1, name: "Trocar peças" })).toBeVisible();
      await page.getByRole("button", { name: `Remover ${b!.placa} do conjunto` }).click();
      await page.getByRole("button", { name: `Remover ${dolly!.placa} do conjunto` }).click();
      await expect(page.locator("#motivo")).toContainText("Pronto para salvar");
      await page.locator("#salvar").click();
      const nome2 = `${cavalo!.placa} + ${a!.placa}`;
      await expect(page.locator(".toast", { hasText: `Peças do conjunto ${nome2} salvas` })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: nome2 })).toBeVisible();
      const trocado = await abertoDoCavalo(db, cavalo!.id);
      expect(trocado?.itens).toEqual([a!.id]);
      expect(trocado?.id).not.toBe(montado!.id); // o anterior foi para o histórico
      await expect(page.locator("#h-ant")).toContainText(`Outros conjuntos de ${cavalo!.placa}`);

      // 4) Encerrar (confirma no diálogo)
      await page.getByRole("button", { name: "Encerrar conjunto" }).click();
      const dlg = page.locator("dialog.dialogo[open]");
      await expect(dlg.getByRole("heading", { name: `Encerrar o conjunto ${nome2}?` })).toBeVisible();
      await dlg.getByRole("button", { name: "Encerrar conjunto" }).click();
      await expect(page.locator(".toast", { hasText: `Conjunto ${nome2} encerrado` })).toBeVisible();
      await expect(page.locator(".migalha .sinal")).toContainText("Encerrado");
      expect(await abertoDoCavalo(db, cavalo!.id)).toBeNull();
    } catch (e) {
      falha = e;
    }
    const limpeza = await limpar(
      () => restaurar(db, cavalo!.id, original),
    );
    if (falha) throw falha;
    if (limpeza) throw limpeza;
  });

  test("banco recusa a peça que outra pessoa engatou: mensagem junto da peça e nada gravado", async ({ page }) => {
    test.setTimeout(120_000);
    const db = bancoAdmin();
    const { cavalo, a, abs } = await escolher(db);
    // conjunto aberto da seed que vai receber a peça (estado salvo antes, comparado depois)
    const alvo = abs.find((c) => c.id.startsWith(SEED_CONJUNTO) && c.itens.length < 4);
    test.skip(!cavalo || !a || !alvo, "A seed não tem um cavalo e uma carreta livres e um conjunto aberto agora.");
    const original = await abertoDoCavalo(db, cavalo!.id);
    let falha: unknown = null;

    try {
      await entrar(page);
      await page.goto(`/conjuntos/${alvo!.id}?editar=1`);
      await expect(page.getByRole("heading", { level: 1, name: "Trocar peças" })).toBeVisible();
      await expect(livre(page, a!.placa)).toBeVisible();

      // enquanto a tela está aberta, "outra pessoa" engata a carreta num conjunto novo
      const r = await db.rpc("salvar_conjunto", { p_conjunto_id: null, p_cavalo_id: cavalo!.id, p_motorista_id: null, p_itens: [a!.id] });
      expect(r.error).toBeNull(); // a limpeza encerra este conjunto (é o do cavalo escolhido)

      // a tela (com os dados de antes) acha que a carreta está livre e deixa salvar; o banco recusa
      await livre(page, a!.placa).click();
      await expect(page.locator("#motivo")).toContainText("Pronto para salvar");
      await page.locator("#salvar").click();
      await expect(peca(page, a!.placa).locator(".erro-msg").first()).toHaveText(MSG_OUTRO);
      await expect(page.locator("#motivo")).toContainText(MSG_OUTRO);
      await expect(page.locator("#salvar")).toBeDisabled();
      await expect(page).toHaveURL(/editar=1/);

      // nada gravado pela metade: o conjunto continua aberto, com o mesmo id e as mesmas peças
      const depois = (await abertos(db)).find((c) => c.cavalo_id === alvo!.cavalo_id);
      expect(depois).toEqual(alvo);
    } catch (e) {
      falha = e;
    }
    const limpeza = await limpar(
      () => restaurar(db, cavalo!.id, original),
    );
    if (falha) throw falha;
    if (limpeza) throw limpeza;
  });

  test("montar não encerra o conjunto que outra pessoa abriu no mesmo cavalo com a tela aberta", async ({ page }) => {
    test.setTimeout(120_000);
    const db = bancoAdmin();
    const { cavalo, a, b } = await escolher(db);
    test.skip(!cavalo || !a || !b, "A seed não tem um cavalo e duas carretas livres agora.");
    const original = await abertoDoCavalo(db, cavalo!.id);
    let falha: unknown = null;

    try {
      await entrar(page);
      await page.goto(`/conjuntos/novo?cavalo=${cavalo!.id}`);
      await expect(page.locator(`#lista-cav input[value="${cavalo!.id}"]`)).toBeChecked();
      await livre(page, b!.placa).click();
      await expect(page.locator("#motivo")).toContainText("Pronto para salvar");

      // enquanto a tela está aberta, "outra pessoa" monta um conjunto no mesmo cavalo
      const r = await db.rpc("salvar_conjunto", { p_conjunto_id: null, p_cavalo_id: cavalo!.id, p_motorista_id: null, p_itens: [a!.id] });
      expect(r.error).toBeNull();
      const deOutro = r.data as string;

      // salvar com a tela velha: a action recusa no cavalo, sem chamar o salvar_conjunto
      await page.locator("#salvar").click();
      await expect(page.locator("#erro-cav .erro-msg").first()).toHaveText(MSG_OUTRO);
      await expect(page.locator("#salvar")).toBeDisabled();
      await expect(page).toHaveURL(/\/conjuntos\/novo/);

      // o conjunto da outra pessoa continua aberto, com a peça dela
      const agora = await abertoDoCavalo(db, cavalo!.id);
      expect(agora?.id).toBe(deOutro);
      expect(agora?.itens).toEqual([a!.id]);
    } catch (e) {
      falha = e;
    }
    const limpeza = await limpar(
      () => restaurar(db, cavalo!.id, original),
    );
    if (falha) throw falha;
    if (limpeza) throw limpeza;
  });

  test("id que não é uuid e id inexistente mostram 'Conjunto não encontrado'", async ({ page }) => {
    await entrar(page);
    for (const id of ["nao-e-uuid", "00000000-0000-4000-8000-999999999999"]) {
      await page.goto(`/conjuntos/${id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Conjunto não encontrado" })).toBeVisible();
      await expect(page.getByText(`Não há conjunto com o código ${id}. Confira o endereço ou abra o conjunto pela lista.`)).toBeVisible();
      await expect(page.getByRole("link", { name: "Montar conjunto" })).toHaveAttribute("href", "/conjuntos/novo");
    }
  });

});
