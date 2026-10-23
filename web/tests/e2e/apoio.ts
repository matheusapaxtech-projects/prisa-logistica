import { expect, type Page } from "@playwright/test";

// Apoio dos specs E2E (Tasks 7+). Os specs anteriores (auth, shell, inicio) têm o próprio `entrar`.
// Credenciais do administrador de teste em web/.env.test.local (carregado pelo playwright.config).
export const { E2E_EMAIL, E2E_SENHA } = process.env;

/** Entra com o administrador de teste e espera o Início. */
export async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Folga para o `next dev` compilar quando vários specs rodam juntos.
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
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
