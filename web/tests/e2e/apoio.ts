import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Apoio dos specs E2E. Credenciais dos usuários de teste em web/.env.test.local (carregado pelo
// playwright.config).
export const { E2E_EMAIL, E2E_SENHA } = process.env;

/** Sessão do administrador de teste gravada pelo sessao.setup.ts (pasta fora do git). */
export const PASTA_SESSAO = path.join(__dirname, ".sessao");
export const SESSAO_ADMIN = path.join(PASTA_SESSAO, "admin.json");
export const TOKEN_BANCO = path.join(PASTA_SESSAO, "banco.json");

/**
 * Abre o Início já logado: a sessão do administrador de teste vem do storageState do projeto
 * (um login só por execução, em sessao.setup.ts). Quem precisa testar o login em si usa
 * `test.use({ storageState: { cookies: [], origins: [] } })` e preenche o formulário.
 */
export async function entrar(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

/**
 * Cliente do Supabase com o token do administrador de teste (mesmo RLS da tela), sem novo login:
 * o token foi obtido uma vez em sessao.setup.ts. Só leitura/RPC; não chame `auth.*` nele.
 */
export function bancoAdmin(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;
  if (!URL || !CHAVE) throw new Error("Faltam as chaves públicas do Supabase (.env.local).");
  const { access_token } = JSON.parse(fs.readFileSync(TOKEN_BANCO, "utf8")) as { access_token: string };
  return createClient(URL, CHAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${access_token}` } },
  });
}

/** CPF válido aleatório (nunca os das fixtures pgTAP nem com todos os dígitos iguais). */
export function cpfAleatorio(): string {
  for (;;) {
    const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (const n of [9, 10]) {
      let s = 0;
      for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i);
      const r = (s * 10) % 11;
      d.push(r === 10 ? 0 : r);
    }
    const cpf = d.join("");
    if (!/^(\d)\1+$/.test(cpf) && cpf !== "52998224725" && cpf !== "11144477735") return cpf;
  }
}

/** Esconde o indicador do `next dev` (cobre o avatar no canto) e espera as fontes, para os prints. */
export async function prepararPrint(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
}
