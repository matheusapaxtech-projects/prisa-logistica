import { expect, test, type Page } from "@playwright/test";

// Credenciais dos usuários de teste vêm de web/.env.test.local (carregado pelo playwright.config.ts).
const { E2E_EMAIL, E2E_SENHA, E2E_SEMPERFIL_EMAIL, E2E_SEMPERFIL_SENHA } = process.env;
const semCredenciais = !E2E_EMAIL || !E2E_SENHA || !E2E_SEMPERFIL_EMAIL || !E2E_SEMPERFIL_SENHA;
const MOTIVO =
  "Faltam E2E_EMAIL/E2E_SENHA/E2E_SEMPERFIL_EMAIL/E2E_SEMPERFIL_SENHA em web/.env.test.local (usuários de teste da Task 4).";

async function entrar(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("sem sessão, / leva para /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar no NILT" })).toBeVisible();
});

test("campos vazios mostram os erros do protótipo sem enviar", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Digite o seu e-mail.")).toBeVisible();
  await expect(page.getByText("Digite a sua senha.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("com usuários de teste", () => {
  test.skip(semCredenciais, MOTIVO);

  test("login errado mostra a mensagem e mantém o e-mail digitado", async ({ page }) => {
    await entrar(page, E2E_EMAIL!, "senha-errada-de-proposito");
    // #erro-entrar: o Next também tem um role="alert" (o anunciador de rotas).
    await expect(page.locator("#erro-entrar")).toHaveText("E-mail ou senha incorretos. Confira e tente de novo.");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("E-mail")).toHaveValue(E2E_EMAIL!);
  });

  test("login certo leva para /, e /login logado volta para /", async ({ page }) => {
    await entrar(page, E2E_EMAIL!, E2E_SENHA!);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Placa ABC1D23")).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("usuário sem perfil vai para /sem-acesso (sem laço) e consegue sair", async ({ page }) => {
    await entrar(page, E2E_SEMPERFIL_EMAIL!, E2E_SEMPERFIL_SENHA!);
    await expect(page).toHaveURL(/\/sem-acesso$/);
    await expect(page.getByRole("heading", { name: "Seu acesso ainda não foi liberado" })).toBeVisible();
    await expect(page.getByText(E2E_SEMPERFIL_EMAIL!)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/sem-acesso$/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/sem-acesso");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("rotas de consulta", () => {
  test("/api/cnpj sem sessão responde 401 com a mensagem de sessão expirada", async ({ request }) => {
    const r = await request.get("/api/cnpj/00000000000191");
    expect(r.status()).toBe(401);
    expect(await r.json()).toEqual({
      erro: "Sua sessão expirou. Entre de novo; o que você digitou continua na tela.",
    });
  });
});

test("POST de Server Action sem sessão não é redirecionado pelo proxy (a action responde)", async ({ request }) => {
  // Id de action inexistente: quem responde é o Next (hoje 409, "action não encontrada"), sem erro de
  // servidor; o proxy não pode intervir.
  const r = await request.post("/", {
    headers: { "Next-Action": "00" + "0".repeat(40) },
    data: "[]",
    maxRedirects: 0,
  });
  // Sem a exceção do Next-Action no proxy, isto seria um 307 para /login.
  expect(r.status() >= 300 && r.status() < 400, `não pode ser redirecionamento (veio ${r.status()})`).toBe(false);
  expect(r.headers()["location"] ?? "").not.toMatch(/\/login/);
  expect(r.status(), "não pode ser erro de servidor").toBeLessThan(500);
});

test("GET com cabeçalho Next-Action não é Server Action: sem sessão vai para /login", async ({ request }) => {
  // Caminho sem página: só o proxy pode mandar para /login (em "/", o exigirPerfil() da página
  // também redirecionaria e esconderia a falha do proxy). Com a exceção errada, viria 404.
  const r = await request.get("/caminho-que-nao-existe", {
    headers: { "Next-Action": "00" + "0".repeat(40) },
    maxRedirects: 0,
  });
  expect(r.status()).toBe(307);
  expect(new URL(r.headers()["location"] ?? "", "http://localhost:3000").pathname).toBe("/login");
});
