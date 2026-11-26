import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/** Sessão do administrador de teste gravada por tests/e2e/sessao.setup.ts (mesmo caminho de SESSAO_ADMIN em apoio.ts). */
const SESSAO_ADMIN = path.join(__dirname, "tests", "e2e", ".sessao", "admin.json");

// Prints de todas as rotas (1440, 768 e 390) ao lado do protótipo: `npm run test:prints`.
// Fica fora da suíte padrão porque o protótipo abre por file:// e carrega o lucide do unpkg (rede).
// Saída em tests/e2e/prints/ (gitignored). Credenciais E2E_* em .env.test.local.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // arquivo ausente: os testes se pulam
}

// Porta do servidor: 3000, ou E2E_PORTA (ex.: outro projeto já ocupa a 3000), como na suíte padrão.
const PORTA = process.env.E2E_PORTA ?? "3000";
const ENDERECO = `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/prints",
  timeout: 180_000,
  // Cada rota é um teste independente e só lê dados: roda em paralelo.
  fullyParallel: true,
  use: { baseURL: ENDERECO },
  webServer: {
    // Mesmo servidor da suíte padrão (build + start); um `next dev` aberto na mesma porta é reaproveitado.
    command: `npm run build && npm run start -- -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: "prints-sessao", testMatch: "**/sessao.setup.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "prints",
      testMatch: "**/*.prints.ts",
      dependencies: ["prints-sessao"],
      use: { ...devices["Desktop Chrome"], storageState: SESSAO_ADMIN },
    },
  ],
});
