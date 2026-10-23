import { expect, test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { E2E_EMAIL, E2E_SENHA, PASTA_SESSAO, SESSAO_ADMIN, TOKEN_BANCO } from "./apoio";

// Entra UMA vez com o administrador de teste e guarda a sessão para todos os specs (storageState) e
// um token para as consultas diretas ao banco (bancoAdmin). Antes cada teste fazia o próprio login e
// a suíte batia no limite de logins por IP do Supabase Auth (HTTP 429) quando rodava duas vezes seguidas.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local o token do banco não é gravado (os specs que precisam dele se pulam)
}

setup("sessão do administrador de teste", async ({ page }) => {
  fs.mkdirSync(PASTA_SESSAO, { recursive: true });
  if (!E2E_EMAIL || !E2E_SENHA) {
    // Sem credenciais: sessão vazia, para os contextos abrirem e os specs se pularem sozinhos.
    fs.writeFileSync(SESSAO_ADMIN, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");
    return;
  }
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.context().storageState({ path: SESSAO_ADMIN });

  const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;
  if (URL && CHAVE) {
    const db = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_SENHA });
    if (error || !data.session) throw new Error("Não foi possível entrar no banco com o usuário de teste.");
    fs.writeFileSync(TOKEN_BANCO, JSON.stringify({ access_token: data.session.access_token }));
  }
});
