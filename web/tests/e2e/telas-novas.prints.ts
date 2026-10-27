import { test, type Page } from "@playwright/test";
import path from "node:path";
import { prepararPrint } from "./apoio";

// Prints das telas novas das fases do sistema do sócio (para o PR de cada fase), em 1440 e 390.
// `npm run test:prints -- telas-novas` (fora da suíte padrão; E2E_PORTA escolhe a porta do servidor).
// Só lê dados da semente local: nada é criado nem apagado.
// Saída: tests/e2e/prints/novas/<fase>-<nome>-<largura>.jpg (gitignored; JPEG para caber leve no PR).
const PRINTS = path.join(__dirname, "prints", "novas");
const TAMANHOS = [
  [1440, 900],
  [390, 844],
] as const;

/** Viagem da semente com as duas parcelas no financeiro (adiantamento pago, saldo aprovado). */
const VIAGEM_COM_PARCELAS = "00000000-0000-4000-8000-000000001208";

/** [fase, nome, rota] */
type Tela = [string, string, string];

const TELAS: Tela[] = [
  ["fase1", "pagar", "/financeiro/pagar"],
  ["fase1", "pagar-vencidas", "/financeiro/pagar?filtro=vencidas"],
  ["fase1", "pagar-por-centro", "/financeiro/pagar?agrupar=centro"],
  ["fase1", "receber", "/financeiro/receber"],
  ["fase1", "centros-de-custo", "/centros-de-custo"],
  ["fase1", "viagem-parcelas", `/viagens/${VIAGEM_COM_PARCELAS}`],
  ["fase1", "quadro", "/quadro"],
];

async function fotografar(page: Page, fase: string, nome: string, largura: number) {
  await prepararPrint(page);
  await page.screenshot({ path: path.join(PRINTS, `${fase}-${nome}-${largura}.jpg`), fullPage: true, type: "jpeg", quality: 82 });
}

test.describe("telas novas", () => {
  for (const [fase, nome, rota] of TELAS) {
    test(`${fase} ${nome}`, async ({ page }) => {
      for (const [largura, altura] of TAMANHOS) {
        await page.setViewportSize({ width: largura, height: altura });
        await page.goto(rota);
        await page.waitForLoadState("networkidle");
        await fotografar(page, fase, nome, largura);
      }
    });
  }

  test("fase1 interruptor do frete (diálogo)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/financeiro/pagar");
    await page.waitForLoadState("networkidle");
    const botao = page.getByRole("button", { name: /^(Ligar|Desligar)$/ });
    if ((await botao.count()) === 0) test.skip(true, "a tela não mostra o botão do interruptor");
    await botao.first().click();
    await page.getByRole("dialog").waitFor();
    await fotografar(page, "fase1", "interruptor-dialogo", 1440);
  });
});
