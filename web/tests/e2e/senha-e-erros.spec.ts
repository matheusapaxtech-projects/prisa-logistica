import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_SENHA } from "./apoio";

// Recuperação/troca de senha e as páginas de erro em pt-BR. Nada aqui troca senha de verdade: o único
// envio do formulário usa senhas diferentes, que a própria tela recusa.

test.describe("sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/auth/confirm com token inválido mostra o aviso de link inválido", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=token-invalido-e2e&type=recovery");
    await expect(page).toHaveURL(/\/auth\/link-invalido$/);
    await expect(page.getByRole("heading", { name: "Esse link não vale mais" })).toBeVisible();
    await expect(page.getByText("Peça ao administrador do NILT um link novo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para a entrada" })).toHaveAttribute("href", "/login");
  });

  test("/auth/confirm sem token também cai no aviso (sem passar pelo login)", async ({ page }) => {
    await page.goto("/auth/confirm");
    await expect(page).toHaveURL(/\/auth\/link-invalido$/);
    await expect(page.getByRole("heading", { name: "Esse link não vale mais" })).toBeVisible();
  });

  test("/nova-senha sem sessão vai para /login", async ({ page }) => {
    await page.goto("/nova-senha");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar no NILT" })).toBeVisible();
  });
});

test.describe("com sessão do administrador de teste", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test("endereço desconhecido mostra a página 404 em português", async ({ page }) => {
    const resposta = await page.goto("/endereco-que-nao-existe-e2e");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Início" })).toHaveAttribute("href", "/");
    await expect(page).toHaveTitle("Página não encontrada · NILT");
  });

  test("'Trocar senha' do shell abre /nova-senha e senhas diferentes não são enviadas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Trocar senha" }).click();
    await expect(page).toHaveURL(/\/nova-senha$/);
    await expect(page.getByRole("heading", { name: "Criar uma senha nova" })).toBeVisible();
    await expect(page.getByText(E2E_EMAIL!)).toBeVisible();

    await page.getByLabel("Senha nova", { exact: true }).fill("Senha-E2E-nao-enviada-1");
    await page.getByLabel("Repita a senha nova").fill("Senha-E2E-nao-enviada-2");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("As duas senhas não são iguais. Digite de novo.")).toBeVisible();
    await expect(page).toHaveURL(/\/nova-senha$/);

    await page.getByRole("link", { name: "Voltar sem trocar" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
