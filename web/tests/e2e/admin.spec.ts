import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Usuários e Auditoria (Task 11). Roda contra o banco vivo de desenvolvimento com os usuários de teste:
// admin (E2E_EMAIL), operação (E2E_OPERACAO_EMAIL, o 3º usuário criado para esta tela) e sem perfil.
// O papel da operação é mudado e restaurado no `finally`; o admin nunca é rebaixado (o banco recusa).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o teste é pulado
}
const { E2E_EMAIL, E2E_SENHA, E2E_OPERACAO_EMAIL, E2E_OPERACAO_SENHA, NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Cliente do banco logado como o admin de teste (mesmo RLS da tela). */
async function banco() {
  const db = createClient(URL!, CHAVE!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email: E2E_EMAIL!, password: E2E_SENHA! });
  if (error) throw new Error("Não foi possível entrar no banco com o usuário de teste.");
  return db;
}

const dialogo = (page: Page) => page.locator("#dlg-acesso");
const linhaDe = (page: Page, email: string) => page.locator("tr[data-usuario]", { hasText: email });

test.describe("usuários e auditoria", () => {
  test.skip(
    !E2E_EMAIL || !E2E_SENHA || !E2E_OPERACAO_EMAIL || !E2E_OPERACAO_SENHA || !URL || !CHAVE,
    "Faltam E2E_EMAIL/E2E_SENHA/E2E_OPERACAO_* (.env.test.local) ou as chaves públicas (.env.local).",
  );

  test("admin muda o papel da operação para leitura, vê na lista e restaura", async ({ page }) => {
    const db = await banco();
    const alvo = await db.rpc("listar_usuarios");
    expect(alvo.error).toBeNull();
    const operacao = ((alvo.data ?? []) as { email: string; user_id: string }[]).find((u) => u.email === E2E_OPERACAO_EMAIL);
    expect(operacao, "usuário de teste da operação").toBeTruthy();

    try {
      await entrar(page, E2E_EMAIL!, E2E_SENHA!);
      await page.goto("/usuarios");
      await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
      await expect(page.getByText("Authentication → Users → Add user")).toBeVisible();

      const linha = linhaDe(page, E2E_OPERACAO_EMAIL!);
      await linha.getByRole("button", { name: "Editar acesso de Teste Operação" }).click();
      await expect(dialogo(page)).toBeVisible();
      await expect(dialogo(page).getByRole("heading", { name: "Acesso de Teste Operação" })).toBeVisible();
      await expect(dialogo(page).locator('input[name="papel"][value="operacao"]')).toBeChecked();
      await dialogo(page).locator("label.papel-opcao", { hasText: "Leitura" }).click();
      await dialogo(page).getByRole("button", { name: "Salvar" }).click();

      await expect(page.locator(".toast")).toContainText("Acesso de Teste Operação atualizado: papel: Operação → Leitura.");
      await expect(dialogo(page)).toBeHidden();
      await expect(linha.locator("td.papel-col")).toHaveText("Leitura");
      await page.reload();
      await expect(linhaDe(page, E2E_OPERACAO_EMAIL!).locator("td.papel-col")).toHaveText("Leitura");

      // a mudança aparece na auditoria, com o filtro na URL
      await page.goto("/auditoria?tipo=perfil&acao=update");
      await expect(page.locator(".evento").first()).toContainText("Teste Admin alterou o perfil de usuário");
      await expect(page.locator(".evento").first()).toContainText("Alterou papel");
    } finally {
      // restaura pelo banco, com a sessão do admin (vale mesmo se a tela falhou no meio)
      const r = await db.rpc("definir_perfil", { p_user_id: operacao!.user_id, p_nome: "Teste Operação", p_papel: "operacao", p_ativo: true });
      expect(r.error).toBeNull();
    }
  });

  test("admin não consegue tirar o próprio acesso: a mensagem é a do banco", async ({ page }) => {
    await entrar(page, E2E_EMAIL!, E2E_SENHA!);
    await page.goto("/usuarios");
    await linhaDe(page, E2E_EMAIL!).getByRole("button", { name: /Editar acesso de/ }).click();
    await expect(dialogo(page)).toBeVisible();

    // a tela já trava as outras opções e a chave; aqui se contorna a tela de propósito (a regra vale no banco)
    await expect(dialogo(page).locator("#dlg-proprio")).toBeVisible();
    await expect(dialogo(page).locator('input[name="papel"][value="leitura"]')).toBeDisabled();
    await expect(dialogo(page).getByRole("switch")).toBeDisabled();
    await page.evaluate(() => document.querySelectorAll('#dlg-acesso input[name="papel"]').forEach((i) => i.removeAttribute("disabled")));
    await dialogo(page).locator("label.papel-opcao", { hasText: "Leitura" }).click();
    await dialogo(page).getByRole("button", { name: "Salvar" }).click();

    await expect(dialogo(page).getByRole("alert")).toHaveText("você não pode tirar o próprio acesso de administrador");
    await expect(dialogo(page)).toBeVisible();

    await dialogo(page).getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo(page)).toBeHidden();
    await page.reload();
    await expect(linhaDe(page, E2E_EMAIL!).locator("td.papel-col")).toHaveText("Administrador");
  });

  test("quem não é admin vê a frase em /usuarios e em /auditoria", async ({ page }) => {
    await entrar(page, E2E_OPERACAO_EMAIL!, E2E_OPERACAO_SENHA!);
    for (const [rota, titulo] of [
      ["/usuarios", "Usuários"],
      ["/auditoria", "Auditoria"],
    ] as const) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await expect(page.locator("#conteudo")).toContainText("Só o administrador vê esta tela.");
      await expect(page.locator("table, .evento")).toHaveCount(0);
    }
    // o menu também não oferece o grupo Administração
    await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
  });

  test("auditoria: filtro na URL sobrevive ao recarregar, agrupa por dia de São Paulo e destaca visualizações", async ({ page }) => {
    const db = await banco();
    const ultimo = await db.from("auditoria").select("em").order("em", { ascending: false }).limit(1);
    expect(ultimo.error).toBeNull();
    const diaEsperado = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(ultimo.data![0].em),
    );

    await entrar(page, E2E_EMAIL!, E2E_SENHA!);
    await page.goto("/auditoria");
    await expect(page.getByRole("heading", { level: 1, name: "Auditoria" })).toBeVisible();
    // sem filtro: o dia do evento mais novo abre a lista, rotulado Hoje/Ontem/data
    await expect(page.locator("section.dia").first()).toHaveAttribute("data-dia", diaEsperado);
    await expect(page.locator("section.dia h2").first()).toHaveText(/^(Hoje|Ontem|[A-ZÀ-Ú][a-zà-ú]+-feira, \d+ de \w+|Sábado, \d+ de \w+|Domingo, \d+ de \w+)$/);

    // filtro pelos selects vai para a URL
    await page.getByLabel("Ação", { exact: true }).selectOption("visualizacao");
    await expect(page).toHaveURL(/\/auditoria\?acao=visualizacao$/);
    await page.getByLabel("Tipo de registro").selectOption("arquivo");
    await expect(page).toHaveURL(/\/auditoria\?tipo=arquivo&acao=visualizacao$/);
    await expect(page.locator("#f-limpar")).toBeVisible();

    const eventos = page.locator(".evento");
    await expect(eventos.first()).toBeVisible();
    const n = await eventos.count();
    expect(n).toBeGreaterThan(0);
    await expect(page.locator(".evento.visto")).toHaveCount(n);
    await expect(page.locator(".evento .sinal-info")).toHaveCount(n);
    await expect(page.locator("#total")).toContainText("de");

    // recarregar mantém o filtro (selects e lista)
    await page.reload();
    await expect(page).toHaveURL(/\/auditoria\?tipo=arquivo&acao=visualizacao$/);
    await expect(page.getByLabel("Ação", { exact: true })).toHaveValue("visualizacao");
    await expect(page.getByLabel("Tipo de registro")).toHaveValue("arquivo");
    await expect(page.locator(".evento.visto")).toHaveCount(n);

    // um filtro que não casa com nada mostra o estado vazio e "Limpar filtros" volta ao começo
    await page.goto("/auditoria?acao=visualizacao&tipo=veiculo");
    await expect(page.locator("#linha-do-tempo")).toContainText("Nenhum evento com esses filtros.");
    await page.locator("#linha-do-tempo").getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/auditoria$/);
    await expect(page.locator(".evento").first()).toBeVisible();
  });
});
