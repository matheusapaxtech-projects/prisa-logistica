import { defineConfig, devices } from "@playwright/test";

// Credenciais de teste (E2E_*) ficam em .env.test.local (gitignored).
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // arquivo ausente: segue sem credenciais
}

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
