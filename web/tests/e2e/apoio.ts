import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Apoio dos specs E2E. Credenciais dos usuários de teste em web/.env.test.local (carregado pelo
// playwright.config).
export const { E2E_EMAIL, E2E_SENHA, E2E_FINANCEIRO_EMAIL, E2E_FINANCEIRO_SENHA } = process.env;

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

let clienteFinanceiro: SupabaseClient | null = null;

/**
 * Cliente do Supabase já logado como o usuário financeiro de teste (E2E_FINANCEIRO_*), para o que a regra de
 * duas pessoas pede: quem lançou a conta (o admin, ao contratar a viagem) não a aprova. Um login só por worker.
 */
export async function bancoFinanceiro(): Promise<SupabaseClient> {
  if (clienteFinanceiro) return clienteFinanceiro;
  const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;
  if (!URL || !CHAVE) throw new Error("Faltam as chaves públicas do Supabase (.env.local).");
  if (!E2E_FINANCEIRO_EMAIL || !E2E_FINANCEIRO_SENHA) throw new Error("Faltam E2E_FINANCEIRO_EMAIL/E2E_FINANCEIRO_SENHA (.env.test.local).");
  const db = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email: E2E_FINANCEIRO_EMAIL, password: E2E_FINANCEIRO_SENHA });
  if (error) throw new Error(`Não foi possível entrar no banco como o financeiro de teste: ${error.message}`);
  clienteFinanceiro = db;
  return db;
}

/**
 * Paga, pelo banco, a parcela do frete da viagem no Contas a pagar (o que o financeiro faz na tela): o financeiro
 * aprova se ainda falta (`fin_aprovar_pagar`) e o admin paga com a data de hoje (`fin_pagar_conta`). O banco marca a
 * viagem como paga (pagamento_saida_em / saldo_pago_em). O adiantamento só passa depois do peso de saída, e o saldo,
 * em "Aguardando saldo (30%)": quem chama escolhe o momento. Parcela já paga não faz nada.
 */
export async function pagarParcelaDoFrete(admin: SupabaseClient, viagemId: string, origem: "frete_adiantamento" | "frete_saldo") {
  const c = await admin.from("v_fin_pagar").select("id, situacao").eq("viagem_id", viagemId).eq("origem", origem).single();
  if (c.error) throw new Error(`A viagem não tem a parcela ${origem} no Contas a pagar: ${c.error.message}`);
  if (c.data.situacao === "paga") return;
  if (c.data.situacao === "cancelada") throw new Error(`A parcela ${origem} da viagem está cancelada.`);
  if (c.data.situacao === "falta_aprovar") {
    const financeiro = await bancoFinanceiro();
    const a = await financeiro.rpc("fin_aprovar_pagar", { p_id: c.data.id });
    if (a.error) throw new Error(`O financeiro não conseguiu aprovar a parcela ${origem}: ${a.error.message}`);
  }
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const p = await admin.rpc("fin_pagar_conta", { p_id: c.data.id, p_data: hoje });
  if (p.error) throw new Error(`Não foi possível pagar a parcela ${origem}: ${p.error.message}`);
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
