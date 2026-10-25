import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bancoAdmin, E2E_EMAIL, E2E_SENHA, prepararPrint } from "./apoio";

// Financeiro: o fluxo inteiro com o extrato fictício (tests/fixtures/extrato-ficticio.ofx, banco 999,
// conta 12345-6, setembro e outubro de 2026): importar, reimportar sem duplicar, classificar com
// "Lembrar para os parecidos", conferir o resultado do mês, desfazer a importação e reimportar já
// classificado pelas regras. Roda no banco vivo; antes e depois apaga tudo o que é da conta fictícia
// (importações, lançamentos, a conta) e as regras com as descrições do arquivo. Prints em
// test-results/financeiro/.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local os testes são pulados
}

const ARQUIVO = path.join(__dirname, "..", "fixtures", "extrato-ficticio.ofx");
const PRINTS = path.join(__dirname, "..", "..", "test-results", "financeiro");
/** Como o leitor grava a conta do arquivo (agência "0001" → "1", conta "12345-6" → "123456"). */
const CONTA = { banco: "999", agencia: "1", numero: "123456" };
/** Chaves (descrição sem números) das regras que o teste cria. */
const CHAVES = [
  "ROADCARD PAGAMENTO FRETE",
  "TED RECEBIDA TRANSPORTADORA EXEMPLO LTDA",
  "PIX RECEBIDO AGRO EXEMPLO SA",
  "PIX ENVIADO CONTABILIDADE EXEMPLO",
  "APORTE SOCIO FICTICIO",
  "CREDITO EMPRESTIMO CAPITAL GIRO",
  "PARCELA EMPRESTIMO CAPITAL GIRO",
  "TARIFA PACOTE SERVICOS",
  "PIX ENVIADO SOCIO FICTICIO DEVOLUCAO",
  "TRANSF ENTRE CONTAS MESMA TITULARIDADE",
];

async function limpar(db: SupabaseClient) {
  const c = await db.from("fin_conta").select("id").match(CONTA).maybeSingle();
  if (c.error) throw c.error;
  if (c.data) {
    const i = await db.from("fin_importacao").delete().eq("conta_id", c.data.id);
    if (i.error) throw i.error;
    const d = await db.from("fin_conta").delete().eq("id", c.data.id);
    if (d.error) throw d.error;
  }
  const r = await db.from("fin_regra").delete().in("chave", CHAVES);
  if (r.error) throw r.error;
}

async function importar(page: Page) {
  await page.goto("/financeiro/importar");
  await page.getByLabel("Arquivo do extrato (OFX)").setInputFiles(ARQUIVO);
  await page.getByRole("button", { name: "Importar extrato" }).click();
}

/** Escolhe a categoria na linha do lançamento e espera o aviso da gravação. */
async function classificar(page: Page, descricao: string, categoria: string, aviso: string | RegExp) {
  await page.getByRole("combobox", { name: `Categoria de “${descricao}”` }).selectOption(categoria);
  await expect(page.locator(".toasts").getByText(aviso).last()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Financeiro", () => {
  test.skip(!E2E_EMAIL || !E2E_SENHA, "Faltam E2E_EMAIL/E2E_SENHA em web/.env.test.local.");

  test.beforeAll(async () => limpar(bancoAdmin()));
  test.afterAll(async () => limpar(bancoAdmin()));

  test("importa, classifica e mostra o resultado do mês", async ({ page }) => {
    test.setTimeout(180_000);

    // Importar e reimportar o mesmo arquivo.
    await importar(page);
    const status = page.locator(".form-importar [role=status]");
    await expect(status).toContainText("17 lançamentos novos");
    await expect(status).toContainText("Banco 999");
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "importar.png"), fullPage: true });

    await importar(page);
    await expect(status).toContainText("Nada novo: os 17 lançamentos deste arquivo já estavam no NILT.");
    await expect(page.getByRole("table").getByText("extrato-ficticio.ofx")).toHaveCount(2);
    // Só a importação mais recente da conta pode ser desfeita.
    await expect(page.getByRole("button", { name: /Desfazer a importação de extrato-ficticio.ofx/ })).toHaveCount(1);

    // Resultado de outubro ainda sem categoria.
    await page.getByRole("link", { name: "Ver o resultado de outubro de 2026" }).click();
    await expect(page.getByRole("heading", { name: "Resultado de outubro de 2026" })).toBeVisible();
    await expect(page.locator(".aviso-fin")).toContainText("7 lançamentos de outubro sem categoria");
    await expect(page.locator(".aviso-fin")).toContainText("Há mais 10 em outros meses.");

    // Classificar setembro.
    await page.goto("/financeiro?aba=lancamentos&mes=2026-09");
    await expect(page.locator("#total")).toContainText("10 lançamentos");
    await classificar(page, "ROADCARD PAGAMENTO FRETE 778812", "pagamento_frete", "Pagamento de frete. Mais 3 lançamentos parecidos também.");
    await classificar(page, "TED RECEBIDA TRANSPORTADORA EXEMPLO LTDA", "receita_frete", "Receita de frete. Mais 1 lançamento parecido também.");
    await classificar(page, "PIX RECEBIDO AGRO EXEMPLO SA", "receita_frete", "Receita de frete. Mais 1 lançamento parecido também.");

    // Sinal que não bate (lembrar desligado: não cria regra errada).
    await page.getByLabel("Lembrar para os parecidos").uncheck();
    const tarifa = page.getByRole("row").filter({ hasText: "05/09/2026" });
    await tarifa.getByRole("combobox").selectOption("receita_frete");
    await expect(tarifa.getByText("Confira: é uma saída")).toBeVisible();
    await expect(page.locator(".toasts").getByText(/^Receita de frete\.$/).last()).toBeVisible();
    await tarifa.getByRole("combobox").selectOption("despesa");
    await expect(page.locator(".toasts").getByText(/^Despesa\.$/).last()).toBeVisible();
    await expect(tarifa.getByText("Confira: é uma saída")).toHaveCount(0);
    await page.getByLabel("Lembrar para os parecidos").check();

    await classificar(page, "PIX ENVIADO CONTABILIDADE EXEMPLO", "despesa", "Despesa. Mais 1 lançamento parecido também.");
    await classificar(page, "APORTE SOCIO FICTICIO", "aporte_capital", /^Aporte de capital\.$/);
    await classificar(page, "CREDITO EMPRESTIMO CAPITAL GIRO", "emprestimo", /^Empréstimo\.$/);
    await classificar(page, "PARCELA EMPRESTIMO CAPITAL GIRO 01/10", "devolucao_emprestimo", /^Devolução de empréstimo\.$/);
    await page.getByRole("row").filter({ hasText: "30/09/2026" }).getByRole("combobox").selectOption("despesa");
    await expect(page.locator(".toasts").getByText(/^Despesa\.$/).last()).toBeVisible();

    // Filtro "sem categoria": setembro vazio, com o atalho para o mês que ainda tem.
    await page.goto("/financeiro?aba=lancamentos&mes=2026-09&ver=sem");
    await expect(page.getByText("Todos os lançamentos de setembro de 2026 têm categoria.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ainda há 2 em outros meses: ir para outubro de 2026/ })).toBeVisible();

    await page.goto("/financeiro?aba=lancamentos&mes=2026-10");
    await classificar(page, "PIX ENVIADO SOCIO FICTICIO DEVOLUCAO", "devolucao_capital", /^Devolução de capital\.$/);
    await classificar(page, "TRANSF ENTRE CONTAS MESMA TITULARIDADE", "transferencia", /^Transferência entre contas\.$/);
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "lancamentos.png"), fullPage: true });

    // Resultado de setembro: receita 40.550,50, pagamento 28.100,00, despesas 2.629,80.
    await page.goto("/financeiro?mes=2026-09");
    const resultado = page.locator("section.bloco", { has: page.getByRole("heading", { name: "Resultado de setembro de 2026" }) });
    await expect(resultado.getByRole("row", { name: /Receita de frete/ })).toContainText("R$ 40.550,50");
    await expect(resultado.getByRole("row", { name: /Pagamento de frete/ })).toContainText("−R$ 28.100,00");
    await expect(resultado.getByRole("row", { name: /Margem do frete/ })).toContainText("R$ 12.450,50");
    await expect(resultado.getByRole("row", { name: /Despesas/ })).toContainText("−R$ 2.629,80");
    await expect(resultado.getByRole("row", { name: /Resultado da operação/ })).toContainText("R$ 9.820,70");
    await expect(resultado).toContainText("margem do frete de 30,7%");
    await expect(page.locator(".aviso-fin")).toHaveCount(0);
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "resultado.png"), fullPage: true });

    // Outubro: caixa com devolução de capital e transferência; saldo do extrato.
    await page.goto("/financeiro?mes=2026-10");
    const caixa = page.locator("section.bloco", { has: page.getByRole("heading", { name: "Caixa" }) });
    await expect(caixa.getByRole("row", { name: /Resultado da operação/ })).toContainText("R$ 11.610,00");
    await expect(caixa.getByRole("row", { name: /Devolução de capital/ })).toContainText("−R$ 10.000,00");
    await expect(caixa.getByRole("row", { name: /Variação do caixa/ })).toContainText("−R$ 3.390,00");
    await expect(caixa).toContainText("R$ 88.200,80");

    // Celular.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/financeiro?mes=2026-09");
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "resultado-celular.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), "resultado sem rolagem horizontal no celular").toBeLessThanOrEqual(375);
    // A tabela do ano não cabe: abre rolada até o mês da tela.
    await page.getByRole("heading", { name: "Mês a mês em 2026" }).scrollIntoViewIfNeeded();
    await expect(page.locator(".tabela-ano thead th.atual")).toBeInViewport({ ratio: 1 });
    await page.goto("/financeiro?aba=lancamentos&mes=2026-09");
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "lancamentos-celular.png"), fullPage: true });
    const larguraPagina = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraPagina, "sem rolagem horizontal no celular").toBeLessThanOrEqual(375);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Regras aprendidas.
    await page.goto("/financeiro?aba=regras");
    await expect(page.locator("#total-regras")).toContainText(`${CHAVES.length} regras`);
    await prepararPrint(page);
    await page.screenshot({ path: path.join(PRINTS, "regras.png"), fullPage: true });

    // Desfazer as duas importações e importar de novo: as regras classificam tudo sozinhas.
    for (let i = 0; i < 2; i++) {
      await page.goto("/financeiro/importar");
      await page.getByRole("button", { name: /Desfazer a importação de extrato-ficticio.ofx/ }).first().click();
      await page.getByRole("button", { name: "Desfazer importação" }).click();
      await expect(page.locator(".toasts").getByText(/Importação desfeita/).last()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Desfazer a importação de extrato-ficticio.ofx/ })).toHaveCount(0);

    await importar(page);
    await expect(status).toContainText("17 lançamentos novos; 17 classificados pelas regras.");
    await expect(status.getByRole("link", { name: /Classificar/ })).toHaveCount(0);
  });

  test("o item Financeiro do menu abre a tela (admin)", async ({ page }) => {
    // O usuário de teste é admin. Que a operação não vê nada é coberto no banco (financeiro.test.sql).
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Financeiro" }).click();
    await expect(page).toHaveURL(/\/financeiro/);
    await expect(page.getByRole("heading", { level: 1, name: "Financeiro" })).toBeVisible();
  });
});
