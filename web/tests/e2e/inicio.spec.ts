import { expect, test, type Page } from "@playwright/test";
import { bancoAdmin, entrar } from "./apoio";

// Início (Task 6): as contagens da tela batem com as do banco. O esperado é calculado aqui, direto
// pelo cliente do Supabase logado como o administrador de teste (mesmo RLS da tela), com a mesma
// regra do brief: placas = v_pendencias_documentos + v_vencimentos + excede_cmt dos conjuntos abertos.
// Só lê dados (nada é criado nem apagado).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o teste abaixo é pulado
}
const { E2E_EMAIL, E2E_SENHA, NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await consulta;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Número da placa de advertência cujo rótulo é `rotulo` (o aria-label é "N Rótulo"). */
async function placa(page: Page, rotulo: string): Promise<number> {
  const rot = await page.locator(".advertencia", { hasText: rotulo }).getAttribute("aria-label");
  expect(rot, `placa "${rotulo}"`).toMatch(new RegExp(`^\\d+ ${rotulo}$`));
  return Number(rot!.split(" ")[0]);
}

test.describe("início", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA || !URL || !CHAVE, "Faltam E2E_* (.env.test.local) ou as chaves públicas (.env.local).");

  test("placas, vencimentos, cadastros e conjuntos batem com o banco", async ({ page }) => {
    const db = bancoAdmin();
    const cont = (tabela: string) => db.from(tabela).select("*", { count: "exact", head: true });
    const pend = (tipo: string) => cont("v_pendencias_documentos").eq("tipo_pendencia", tipo);

    // ---- esperado, direto do banco ----
    const vencidos = await contar(cont("v_vencimentos").lt("dias", 0));
    const arrendadoSemContrato = await contar(pend("veiculo_arrendado_sem_contrato"));
    const semCnh = await contar(pend("motorista_sem_cnh"));
    const semComprovante = await contar(pend("motorista_sem_comprovante"));

    const abertos = await db.from("conjunto").select("id").is("fim", null);
    expect(abertos.error).toBeNull();
    const idsAbertos = new Set((abertos.data ?? []).map((c) => c.id));
    const cmt = await db.from("v_conjunto_capacidade").select("conjunto_id").eq("excede_cmt", true);
    expect(cmt.error).toBeNull();
    const acimaCmt = (cmt.data ?? []).filter((c) => idsAbertos.has(c.conjunto_id)).length;

    const venc = await db
      .from("v_vencimentos")
      .select("tipo, data, dias")
      .lte("dias", 90)
      .order("dias", { ascending: true })
      .order("tipo", { ascending: true })
      // Mesmo desempate da tela (consultas.ts): data, arquivo, pessoa, veículo.
      .order("data", { ascending: true })
      .order("arquivo_id", { ascending: true })
      .order("pessoa_id", { ascending: true })
      .order("veiculo_id", { ascending: true })
      .limit(5);
    expect(venc.error).toBeNull();

    const totais = {
      Motoristas: await contar(cont("motorista")),
      Proprietários: await contar(cont("proprietario")),
      Veículos: await contar(cont("veiculo")),
      "Conjuntos abertos": idsAbertos.size,
      "Documentos anexados": await contar(cont("arquivo")),
      Arrendados: await contar(cont("veiculo").eq("arrendado", true)),
    };

    // ---- na tela ----
    await entrar(page);
    await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();

    const nasPlacas = {
      vencidos: await placa(page, "Documentos vencidos"),
      arrendadoSemContrato: await placa(page, "Arrendado sem contrato"),
      acimaCmt: await placa(page, "Conjunto acima do CMT"),
      semCnh: await placa(page, "Motorista sem CNH anexada"),
      semComprovante: await placa(page, "Sem comprovante de residência"),
    };
    expect(nasPlacas).toEqual({ vencidos, arrendadoSemContrato, acimaCmt, semCnh, semComprovante });
    await expect(page.locator(".advertencia")).toHaveCount(5);
    // O número dentro de cada placa é o mesmo do rótulo, e cada placa leva à lista do tipo.
    await expect(page.locator(".advertencia").nth(0)).toHaveAttribute("href", "/pendencias?tipo=arquivo_vencido");
    await expect(page.locator(".advertencia").nth(2).locator("b").first()).toHaveText(String(acimaCmt));

    // O selo do menu é a soma das 5 placas (mesma conta).
    const soma = vencidos + arrendadoSemContrato + acimaCmt + semCnh + semComprovante;
    if (soma > 0) await expect(page.locator(".nav .contagem")).toHaveAttribute("aria-label", `${soma} pendências`);

    // Vencimentos: até 5 linhas, nos próximos 90 dias (ou já vencidos), em ordem de data.
    const linhas = page.locator("#marcos .marco");
    const esperados = venc.data ?? [];
    expect(esperados.length).toBeLessThanOrEqual(5);
    if (esperados.length === 0) {
      await expect(page.locator("#marcos")).toContainText("Nada vence nos próximos 90 dias.");
    } else {
      await expect(linhas).toHaveCount(esperados.length);
      const dias = esperados.map((v) => v.dias as number);
      expect(dias.every((d) => d <= 90)).toBe(true);
      expect([...dias].sort((a, b) => a - b)).toEqual(dias);
      const naTela = await linhas.evaluateAll((els) =>
        els.map((el) => ({
          tipo: el.querySelector(".quem b")!.textContent,
          dias: el.querySelector(".dias b")!.textContent,
          data: el.querySelector(".quem span")!.textContent!.match(/(\d{2}\/\d{2}\/\d{4})$/)?.[1],
        })),
      );
      expect(naTela).toEqual(
        esperados.map((v) => ({
          tipo: v.tipo,
          dias: v.dias! < 0 ? "Vencido" : `${v.dias} ${v.dias === 1 ? "dia" : "dias"}`,
          data: `${(v.data as string).slice(8, 10)}/${(v.data as string).slice(5, 7)}/${(v.data as string).slice(0, 4)}`,
        })),
      );
      // Cada linha leva à ficha de quem vence.
      for (const href of await linhas.evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
        expect(href).toMatch(/^\/(motoristas|proprietarios|veiculos)\/[0-9a-f-]{36}$/);
      }
    }

    // Cadastros: o total de cada linha.
    for (const [rotulo, total] of Object.entries(totais)) {
      const linha = page.locator("#cadastros .marco", { has: page.locator(".quem b", { hasText: new RegExp(`^${rotulo}$`) }) });
      await expect(linha.locator(".dias b")).toHaveText(String(total));
    }

    // Conjuntos: um engate por conjunto aberto, cada um com a barra de capacidade.
    const conjuntos = page.locator("#conjuntos .marco-conjunto");
    await expect(conjuntos).toHaveCount(idsAbertos.size);
    await expect(page.locator("#conjuntos .engate")).toHaveCount(idsAbertos.size);
    await expect(page.locator("#conjuntos .capacidade")).toHaveCount(idsAbertos.size);
    await expect(page.locator("#conj-total")).toHaveText(`${idsAbertos.size} ${idsAbertos.size === 1 ? "aberto" : "abertos"}`);
    const hrefs = await conjuntos.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(new Set(hrefs)).toEqual(new Set([...idsAbertos].map((id) => `/conjuntos/${id}`)));
  });

  test("ações da página: Montar conjunto e menu Novo cadastro", async ({ page }) => {
    await entrar(page);
    await expect(page.getByRole("link", { name: "Montar conjunto" })).toHaveAttribute("href", "/conjuntos/novo");

    const botao = page.getByRole("button", { name: "Novo cadastro" });
    const menu = page.getByRole("menu");
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("menuitem")).toHaveText(["Motorista", "Proprietário", "Veículo"]);
    await expect(menu.getByRole("menuitem", { name: "Motorista" })).toBeFocused();
    await expect(menu.getByRole("menuitem", { name: "Motorista" })).toHaveAttribute("href", "/motoristas/novo");
    await expect(menu.getByRole("menuitem", { name: "Proprietário" })).toHaveAttribute("href", "/proprietarios/novo");
    await expect(menu.getByRole("menuitem", { name: "Veículo" })).toHaveAttribute("href", "/veiculos/novo");

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(botao).toBeFocused();

    await botao.click();
    await expect(menu).toBeVisible();
    await page.locator("h1").click();
    await expect(menu).toBeHidden();
  });

});
