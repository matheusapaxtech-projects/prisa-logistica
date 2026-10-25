import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/** Sessão do administrador de teste gravada por tests/e2e/sessao.setup.ts (mesmo caminho de SESSAO_ADMIN em apoio.ts). */
const SESSAO_ADMIN = path.join(__dirname, "tests", "e2e", ".sessao", "admin.json");

// Credenciais de teste (E2E_*) ficam em .env.test.local (gitignored).
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // arquivo ausente: segue sem credenciais
}

// Porta do servidor dos testes: 3000, ou E2E_PORTA (ex.: outro projeto já ocupa a 3000).
const PORTA = process.env.E2E_PORTA ?? "3000";
const ENDERECO = `http://localhost:${PORTA}`;

// Suíte padrão (`npm run test:e2e`): só os *.spec.ts. Os prints ao lado do protótipo (*.prints.ts, que
// abrem o protótipo por file:// e dependem do lucide no unpkg) rodam à parte: `npm run test:prints`
// (playwright.prints.config.ts).
export default defineConfig({
  testDir: "tests/e2e",
  // Rastro só das falhas (test-results/, fora do git): mostra onde um teste travou.
  use: { baseURL: ENDERECO, trace: "retain-on-failure" },
  // Servidor de produção (build + start): o `next dev` compila cada rota na primeira visita e, com os
  // specs em paralelo, os fluxos longos estouravam o tempo. Um `next dev` já aberto na mesma porta é reaproveitado.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    // Um login só por execução (o Supabase Auth limita logins por IP): os specs usam esta sessão.
    { name: "sessao", testMatch: "**/sessao.setup.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      testMatch: "**/*.spec.ts",
      dependencies: ["sessao"],
      use: { ...devices["Desktop Chrome"], storageState: SESSAO_ADMIN },
    },
  ],
});
