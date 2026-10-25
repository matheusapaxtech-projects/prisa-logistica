import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bancoAdmin, E2E_EMAIL, E2E_SENHA, entrar } from "./apoio";

// Quadro da operação (Task 12): o fluxo inteiro, do pedido ao "Frete finalizado", e o tempo real entre
// duas telas. Roda contra o banco vivo de desenvolvimento, com os clientes, locais e conjuntos da seed
// fictícia (supabase/seed/dev_dados_ficticios.sql, parte "QUADRO DA OPERAÇÃO"). Re-executável:
// - o conjunto é escolhido na hora entre os conjuntos abertos da seed, com motorista, cujo cavalo e
//   motorista não estão em viagem ativa (não depende da ordem dos outros cartões);
// - tudo o que o teste cria leva "E2E quadro" na observação do pedido e termina fora do Quadro ativo:
//   o fluxo completo acaba em "Frete finalizado" (o app não apaga pedido nem viagem); o teste de tempo
//   real cancela a viagem e o pedido. Se um teste cair no meio, a limpeza tira a viagem do Quadro
//   ativo (cancela, ou leva adiante até "Frete finalizado" quando já passou da janela de cancelamento).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local os testes são pulados
}
const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE } = process.env;

/** Ids fixos da seed: conjuntos 3xx; clientes Coop Ivaí (113) e Terminal Litoral (114); locais 514 e 516. */
const SEED_CONJUNTO = "00000000-0000-4000-8000-0000000003";
const COOP_IVAI = "00000000-0000-4000-8000-000000000113";
const TERMINAL_LITORAL = "00000000-0000-4000-8000-000000000114";
const LOCAL_ARAPONGAS = "00000000-0000-4000-8000-000000000514";
const LOCAL_PARANAGUA = "00000000-0000-4000-8000-000000000516";
const MARCA = "E2E quadro";

/** PNG fictício de 1x1 (o "canhoto" do teste). */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Chave fictícia de CT-e (57) ou MDF-e (58) com o dígito verificador certo: mesma conta de
 * `chaveDfeValida` (web/src/lib/quadro.ts) e de `chave_dfe_valida` (mover_viagem.sql).
 * cUF 41 (PR), AAMM 2610, CNPJ 11222333000181, série 001, número `n`, emissão normal (1).
 */
function chaveDfe(modelo: "55" | "57" | "58", n: number): string {
  const base = `41261011222333000181${modelo}001${String(n).padStart(9, "0")}1${String(n * 7 + 13).padStart(8, "0").slice(-8)}`;
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(base[i]) * (2 + ((42 - i) % 8));
  let dv = 11 - (soma % 11);
  if (dv >= 10) dv = 0;
  return `${base}${dv}`;
}

type Livre = { id: string; placa: string; travas: number };

/** Conjuntos abertos da seed, com motorista, sem viagem ativa no cavalo nem no motorista; os sem trava primeiro. */
async function conjuntosLivres(db: SupabaseClient): Promise<Livre[]> {
  const [cs, vs] = await Promise.all([
    db.from("conjunto").select("id, cavalo_id, motorista_id").is("fim", null).not("motorista_id", "is", null),
    db.from("viagem").select("cavalo_id, motorista_id").is("cancelada_em", null).not("status_campo", "is", null).not("status_campo", "in", "(aguardando_saldo,frete_finalizado)"),
  ]);
  if (cs.error) throw cs.error;
  if (vs.error) throw vs.error;
  const ocupados = new Set((vs.data ?? []).flatMap((v) => [v.cavalo_id, v.motorista_id]));
  const candidatos = (cs.data ?? []).filter((c) => c.id.startsWith(SEED_CONJUNTO) && !ocupados.has(c.cavalo_id) && !ocupados.has(c.motorista_id));
  const placas = await db.from("veiculo").select("id, placa").in("id", candidatos.map((c) => c.cavalo_id));
  if (placas.error) throw placas.error;
  const livres: Livre[] = [];
  for (const c of candidatos) {
    const a = await db.rpc("aptidao_viagem", { p_conjunto: c.id, p_tomador: COOP_IVAI });
    if (a.error) throw a.error;
    const niveis = (a.data as { nivel: string }[]).map((x) => x.nivel);
    if (niveis.includes("trava_legal")) continue;
    livres.push({ id: c.id, placa: placas.data!.find((v) => v.id === c.cavalo_id)!.placa, travas: niveis.filter((n) => n === "trava").length });
  }
  return livres.sort((a, b) => a.travas - b.travas || a.id.localeCompare(b.id));
}

/**
 * Tira a viagem do Quadro ativo, onde quer que ela tenha parado: cancela dentro da janela de
 * cancelamento; depois dela, leva adiante até "Frete finalizado" (a passagem de "Aguardando descarga"
 * exige o canhoto no Storage: se o teste caiu antes de enviá-lo, a viagem fica lá e o erro diz qual é).
 */
async function tirarDoQuadro(db: SupabaseClient, viagemId: string) {
  for (let i = 0; i < 12; i++) {
    const v = await db.from("viagem").select("numero, status_campo, cancelada_em").eq("id", viagemId).maybeSingle();
    if (v.error) throw v.error;
    if (!v.data || v.data.cancelada_em || v.data.status_campo === "frete_finalizado") return;
    const st = v.data.status_campo;
    if (st === null || ["transito", "aguardando_carregamento", "em_carregamento", "aguardando_nf_pagamento"].includes(st)) {
      const r = await db.rpc("cancelar_viagem", { p_viagem: viagemId, p_motivo: `${MARCA}: limpeza do teste` });
      if (r.error) throw new Error(`Não foi possível cancelar a viagem #${v.data.numero}: ${r.error.message}`);
      return;
    }
    let para = "";
    let dados: Record<string, unknown> = {};
    if (st === "pausa") {
      const p = await db.from("viagem_pausa").select("coluna_origem").eq("viagem_id", viagemId).is("fim", null).maybeSingle();
      if (p.error) throw p.error;
      para = p.data?.coluna_origem ?? "em_rota";
    } else if (st === "em_rota") para = "aguardando_descarga";
    else if (st === "aguardando_descarga") para = "descarregando";
    else if (st === "descarregando") [para, dados] = ["aguardando_contagem", { peso_chegada_kg: 1 }];
    else if (st === "aguardando_contagem") [para, dados] = ["aguardando_saldo", { divergencia: "sem_divergencia" }];
    else if (st === "resolucao_divergencia") [para, dados] = ["aguardando_saldo", { resolucao: `${MARCA}: limpeza do teste` }];
    else if (st === "aguardando_saldo") {
      const s = await db.from("viagem").select("saldo_pago_em").eq("id", viagemId).single();
      if (s.error) throw s.error;
      if (!s.data.saldo_pago_em) {
        const c = await db.rpc("confirmar_saldo", { p_viagem: viagemId });
        if (c.error) throw new Error(`Não foi possível confirmar o saldo da viagem #${v.data.numero}: ${c.error.message}`);
      }
      [para, dados] = ["frete_finalizado", { mdfe_encerrado: true, ciot_encerrado: true }];
    }
    const r = await db.rpc("mover_viagem", { p_viagem: viagemId, p_de: st, p_para: para, p_dados: dados });
    if (r.error) throw new Error(`A viagem #${v.data.numero} ficou em "${st}": ${r.error.message}`);
  }
}

/** Cancela o pedido do teste (sem viagem viva), com a nota na observação, como a ação da tela faz. */
async function cancelarPedido(db: SupabaseClient, pedidoId: string) {
  const p = await db.from("pedido").select("situacao, observacao").eq("id", pedidoId).maybeSingle();
  if (p.error) throw p.error;
  if (!p.data || p.data.situacao !== "aberto") return;
  const nota = `Pedido cancelado pela limpeza do teste (${MARCA}).`;
  const r = await db
    .from("pedido")
    .update({ situacao: "cancelado", observacao: p.data.observacao ? `${p.data.observacao}\n\n${nota}` : nota })
    .eq("id", pedidoId)
    .eq("situacao", "aberto");
  if (r.error) throw r.error;
}

/** Limpeza (como em conjuntos.spec.ts): roda todos os passos, registra as falhas e devolve a primeira. */
async function limpar(...passos: (() => Promise<unknown>)[]): Promise<unknown> {
  let primeira: unknown = null;
  for (const passo of passos) {
    try {
      await passo();
    } catch (e) {
      console.error("Falha na limpeza do teste do Quadro:", e);
      primeira ??= e;
    }
  }
  return primeira;
}

/* ---------- Quadro ---------- */

const coluna = (page: Page, rotulo: string) => page.getByRole("region", { name: rotulo, exact: true });
const cartao = (onde: Page | Locator, n: number) => onde.getByRole("article", { name: new RegExp(`^Viagem #${n},`) });

async function aoVivo(page: Page) {
  await page.goto("/quadro");
  await expect(page.getByRole("heading", { level: 1, name: "Quadro da operação" })).toBeVisible();
  await expect(page.locator(".quadro-conexao [role=status]")).toHaveText("Ao vivo", { timeout: 20_000 });
}

/** "Mover" no cartão e escolhe o destino. Devolve o diálogo da passagem (quando ela pede dados). */
async function abrirMover(page: Page, n: number, destino: string) {
  await cartao(page, n).getByRole("button", { name: `Mover a viagem #${n}` }).click();
  const menu = page.getByRole("dialog", { name: `Mover a viagem #${n}` });
  await menu.getByRole("button", { name: destino, exact: true }).click();
  await expect(menu).toBeHidden();
}

/** Espera a passagem terminar: o cartão na coluna nova, o aviso da tela e o botão "Mover" livre de novo. */
async function chegou(page: Page, n: number, destino: string) {
  await expect(cartao(coluna(page, destino), n)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".toast", { hasText: `Viagem #${n}: ${destino}.` }).last()).toBeVisible({ timeout: 15_000 });
  await expect(cartao(page, n)).not.toHaveAttribute("aria-busy", "true", { timeout: 15_000 });
}

async function mover(page: Page, n: number, destino: string, preencher?: (dlg: Locator) => Promise<void>, titulo?: string) {
  await abrirMover(page, n, destino);
  if (preencher) {
    const dlg = page.getByRole("dialog", { name: titulo });
    await expect(dlg).toBeVisible();
    await preencher(dlg);
    await dlg.getByRole("button", { name: "Mover", exact: true }).click();
    await expect(dlg).toBeHidden({ timeout: 30_000 });
  }
  await chegou(page, n, destino);
}

test.describe("quadro da operação", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!E2E_EMAIL || !E2E_SENHA || !URL || !CHAVE, "Faltam E2E_EMAIL/E2E_SENHA (.env.test.local) ou as chaves públicas (.env.local).");
  // Clique que não acha o alvo falha logo (e não espera o teste inteiro estourar o tempo).
  test.use({ actionTimeout: 20_000 });

  /* A limpeza roda no afterEach (que tem tempo próprio): mesmo quando o teste estoura o tempo no meio,
     a viagem sai do Quadro ativo e o pedido sem viagem é cancelado. Cada teste registra o que criou. */
  let aLimpar: (() => Promise<unknown>)[] = [];
  test.afterEach(async () => {
    const passos = aLimpar;
    aLimpar = [];
    const falha = await limpar(...passos);
    if (falha) throw falha;
  });

  test("fluxo completo: pedido, viagem, iniciar e as passagens do Quadro até Frete finalizado", async ({ page }) => {
    test.setTimeout(300_000);
    const db = bancoAdmin();
    const [conj] = await conjuntosLivres(db);
    test.skip(!conj, "Nenhum conjunto aberto da seed com motorista está livre de viagem ativa agora.");
    const marca = `${MARCA} ${new Date().toISOString()}`;
    let viagemId: string | null = null;
    // Termina fora do Quadro ativo: o pedido fica aberto, com a viagem finalizada (o app não cancela pedido
    // com viagem que começou). Se o teste cair no meio, a viagem sai do Quadro ativo e, se ela nem chegou
    // a ser criada ou foi cancelada, o pedido (achado pela marca: a tela pode gravá-lo sem chegar a abrir a
    // ficha) é cancelado.
    aLimpar.push(
      async () => {
        if (viagemId) await tirarDoQuadro(db, viagemId);
      },
      async () => {
        if (viagemId) {
          const v = await db.from("viagem").select("cancelada_em").eq("id", viagemId).single();
          if (v.error) throw v.error;
          if (!v.data.cancelada_em) return; // finalizada: o pedido fica aberto
        }
        const ps = await db.from("pedido").select("id").eq("observacao", marca);
        if (ps.error) throw ps.error;
        for (const { id } of ps.data ?? []) await cancelarPedido(db, id);
      },
    );

    // 1) Novo pedido: Coop Ivaí (tomador e remetente, coleta em Arapongas) → Terminal Litoral (Paranaguá)
    await entrar(page);
    await page.goto("/pedidos/novo");
    await expect(page.getByRole("heading", { level: 1, name: "Novo pedido" })).toBeVisible();
    for (const [campo, busca] of [
      ["Tomador", "Coop Ivaí"],
      ["Remetente", "Coop Ivaí"],
      ["Destinatário", "Terminal Litoral"],
    ] as const) {
      const cb = page.getByRole("combobox", { name: campo });
      await cb.click();
      await cb.fill(busca);
      await page.getByRole("option", { name: new RegExp(busca) }).first().click();
      await expect(cb).toHaveValue(new RegExp(busca));
    }
    await page.locator("#local_coleta_id").selectOption(LOCAL_ARAPONGAS);
    await page.locator("#local_descarga_id").selectOption(LOCAL_PARANAGUA);
    await page.locator("#produto").fill("Soja em grãos (fictícia)");
    await page.locator("#peso_total_kg").fill("37.000");
    await page.locator("#frete_empresa_valor").fill("150,00");
    await page.locator("#observacao").fill(marca);
    await page.locator("#btn-criar").click();
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}\?criado=1$/, { timeout: 30_000 });
    const pedidoId = page.url().match(/\/pedidos\/([0-9a-f-]{36})/)![1];
    const ped = await db.from("pedido").select("tomador_id, destinatario_id, observacao").eq("id", pedidoId).single();
    expect(ped.data).toEqual({ tomador_id: COOP_IVAI, destinatario_id: TERMINAL_LITORAL, observacao: marca });

    // 2) Nova viagem no conjunto livre
    await page.locator("#btn-nova-viagem").click();
    const dlgViagem = page.getByRole("dialog", { name: /^Nova viagem do pedido #\d+$/ });
    await dlgViagem.locator("label.conjunto-opcao", { hasText: conj.placa }).locator("input[type=radio]").check();
    await dlgViagem.locator("#peso_previsto_kg").fill("37.000");
    await dlgViagem.getByRole("button", { name: "Criar viagem" }).click();
    await expect(page).toHaveURL(/\/viagens\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    viagemId = page.url().match(/\/viagens\/([0-9a-f-]{36})/)![1];
    const titulo = await page.getByRole("heading", { level: 1, name: /^Viagem #\d+$/ }).textContent();
    const n = Number(titulo!.replace(/\D/g, ""));

    // 3) Iniciar trânsito (com exceção do admin se o conjunto tiver trava, como o Serginho de CNH vencida)
    const iniciar = page.locator("#btn-iniciar");
    await expect(iniciar).toBeEnabled();
    if ((await iniciar.textContent())?.includes("com exceção")) {
      await iniciar.click();
      const dlg = page.getByRole("dialog", { name: `Liberar a viagem #${n} com exceção` });
      await dlg.locator("#justificativa").fill(`${MARCA}: teste automatizado`);
      await dlg.getByRole("button", { name: "Liberar e iniciar" }).click();
    } else {
      await iniciar.click();
    }
    await expect(page.locator(".toast", { hasText: `Viagem #${n} iniciada: está em Trânsito.` })).toBeVisible({ timeout: 15_000 });

    // 4) No Quadro, pelo botão "Mover"
    await aoVivo(page);
    await expect(cartao(coluna(page, "Trânsito"), n)).toBeVisible();
    await mover(page, n, "Aguardando carregamento");
    await mover(
      page,
      n,
      "Em carregamento",
      async (d) => {
        for (const item of ["Carroceria limpa e sem avaria", "Lona e amarração em ordem", "CRLV, CNH e tacógrafo conferidos (fotos)"]) {
          await d.getByLabel(item).check();
        }
      },
      `Checklist do veículo da viagem #${n}`,
    );
    await mover(page, n, "Aguardando NF e pagamento", (d) => d.locator("#passagem-peso").fill("37.050"), `Peso de saída da viagem #${n}`);

    // 5) Pagamento de saída pelo cartão; depois as chaves (CT-e e MDF-e) para ir a "Em rota"
    const noNf = cartao(coluna(page, "Aguardando NF e pagamento"), n);
    await expect(noNf.getByText("Falta pagamento de saída")).toBeVisible();
    await noNf.getByRole("button", { name: `Confirmar pagamento de saída da viagem #${n}` }).click();
    const dlgPag = page.getByRole("dialog", { name: `Pagamento de saída da viagem #${n}` });
    await dlgPag.getByRole("button", { name: "Confirmar" }).click();
    await expect(dlgPag).toBeHidden({ timeout: 15_000 });
    await expect(page.locator(".toast", { hasText: "Adiantamento e vale-pedágio confirmados." })).toBeVisible();
    await expect(noNf.getByText("Pagamento de saída", { exact: true })).toBeVisible({ timeout: 15_000 });

    const cte = chaveDfe("57", n);
    const mdfe = chaveDfe("58", n);
    await mover(
      page,
      n,
      "Em rota",
      async (d) => {
        await expect(d.getByText("Adiantamento e vale-pedágio confirmados")).toBeVisible();
        // como copiada do DACTE: com espaços (só os dígitos contam)
        await d.locator("#passagem-cte").fill(cte.replace(/(\d{4})/g, "$1 ").trim());
        await d.locator("#passagem-mdfe").fill(mdfe);
        await d.locator("#passagem-nfe").fill(chaveDfe("55", n));
        await d.locator("#passagem-ciot").fill("123456789012");
        await d.locator("#passagem-averbacao").fill(`AV-${n}`);
      },
      `Documentos de saída da viagem #${n}`,
    );

    // 6) Pausa (almoço, programada) e de volta a "Em rota"
    await mover(
      page,
      n,
      "Pausa",
      async (d) => {
        await d.locator("#passagem-pausa-tipo").selectOption({ label: "Almoço" });
        await d.getByRole("radio", { name: "Programada", exact: true }).check();
      },
      `Pausa da viagem #${n}`,
    );
    await expect(cartao(coluna(page, "Pausa"), n).getByText("Almoço, programada")).toBeVisible();
    await mover(page, n, "Em rota");

    // 7) Descarga: "Descarregando", canhoto (PNG fictício) e peso de chegada; contagem sem divergência
    await mover(page, n, "Aguardando descarga");
    await expect(cartao(coluna(page, "Aguardando descarga"), n).getByText("Falta canhoto")).toBeVisible();
    await mover(page, n, "Descarregando");
    await mover(
      page,
      n,
      "Aguardando contagem de divergência",
      async (d) => {
        await d.locator("#passagem-peso").fill("36.990");
        await d.locator("#passagem-canhoto").setInputFiles({ name: "canhoto-e2e-quadro.png", mimeType: "image/png", buffer: PNG_1X1 });
      },
      `Chegada da viagem #${n}`,
    );
    await mover(
      page,
      n,
      "Aguardando saldo (30%)",
      async (d) => {
        await d.getByRole("radio", { name: "Sem divergência" }).check();
      },
      `Contagem da viagem #${n}`,
    );

    // 8) Saldo de 30% pelo cartão; depois o encerramento (MDF-e e CIOT) para "Frete finalizado"
    const noSaldo = cartao(coluna(page, "Aguardando saldo (30%)"), n);
    await expect(noSaldo.getByText("Falta pagar o saldo")).toBeVisible();
    await noSaldo.getByRole("button", { name: `Confirmar pagamento do saldo da viagem #${n}` }).click();
    const dlgSaldo = page.getByRole("dialog", { name: `Saldo da viagem #${n}` });
    await dlgSaldo.getByRole("button", { name: "Confirmar" }).click();
    await expect(dlgSaldo).toBeHidden({ timeout: 15_000 });
    await expect(page.locator(".toast", { hasText: "Saldo de 30% confirmado." })).toBeVisible();
    await expect(noSaldo.getByText("Saldo pago", { exact: true })).toBeVisible({ timeout: 15_000 });
    await mover(
      page,
      n,
      "Frete finalizado",
      async (d) => {
        await d.getByLabel("MDF-e encerrado").check();
        await d.getByLabel("CIOT encerrado").check();
      },
      `Encerramento da viagem #${n}`,
    );
    await expect(cartao(coluna(page, "Frete finalizado"), n).getByText("Canhoto", { exact: true })).toBeVisible();

    // 9) No banco: o que as passagens gravaram
    const v = await db
      .from("viagem")
      .select("status_campo, peso_saida_kg, peso_chegada_kg, chave_cte, chave_mdfe, pagamento_saida_em, divergencia, finalizada_em")
      .eq("id", viagemId)
      .single();
    expect(v.error).toBeNull();
    expect(v.data).toMatchObject({
      status_campo: "frete_finalizado",
      peso_saida_kg: 37050,
      peso_chegada_kg: 36990,
      chave_cte: cte,
      chave_mdfe: mdfe,
      divergencia: "sem_divergencia",
    });
    expect(v.data!.pagamento_saida_em).not.toBeNull();
    expect(v.data!.finalizada_em).not.toBeNull();
    const ev = await db.from("viagem_evento").select("id", { count: "exact", head: true }).eq("viagem_id", viagemId);
    expect(ev.count).toBe(14);

    // 10) Linha do tempo na ficha: "Viagem planejada", o início, os dois pagamentos e as passagens, na ordem
    await cartao(coluna(page, "Frete finalizado"), n).getByRole("link", { name: `Abrir a viagem #${n}` }).click();
    await expect(page).toHaveURL(new RegExp(`/viagens/${viagemId}$`));
    const titulos = page.locator(".linha-tempo > li > span > b");
    await expect(titulos).toHaveCount(15);
    await expect(titulos).toHaveText([
      "Viagem planejada",
      /^Viagem iniciada( com exceção)?: Trânsito$/,
      "Trânsito → Aguardando carregamento",
      "Aguardando carregamento → Em carregamento",
      "Em carregamento → Aguardando NF e pagamento",
      "Adiantamento e vale-pedágio confirmados",
      "Aguardando NF e pagamento → Em rota",
      "Em rota → Pausa",
      "Pausa → Em rota",
      "Em rota → Aguardando descarga",
      "Aguardando descarga → Descarregando",
      "Descarregando → Aguardando contagem de divergência",
      "Aguardando contagem de divergência → Aguardando saldo (30%)",
      "Saldo de 30% confirmado",
      "Aguardando saldo (30%) → Frete finalizado",
    ]);
  });

  test("tempo real: mover numa tela aparece na outra em até 5 s", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const db = bancoAdmin();
    const [conj] = await conjuntosLivres(db);
    test.skip(!conj, "Nenhum conjunto aberto da seed com motorista está livre de viagem ativa agora.");
    let pedidoId: string | null = null;
    let viagemId: string | null = null;
    const outra = await browser.newContext({ storageState: test.info().project.use.storageState });
    // Viagem e pedido cancelados no fim: nada do teste fica ativo.
    aLimpar.push(
      () => outra.close(),
      async () => {
        if (viagemId) await tirarDoQuadro(db, viagemId);
      },
      async () => {
        if (pedidoId) await cancelarPedido(db, pedidoId);
      },
    );

    // Pedido e viagem fictícios pelo banco (o fluxo pela tela é o teste acima), iniciada em Trânsito
    const p = await db
      .from("pedido")
      .insert({
        tomador_id: COOP_IVAI,
        remetente_id: COOP_IVAI,
        destinatario_id: TERMINAL_LITORAL,
        local_coleta_id: LOCAL_ARAPONGAS,
        local_descarga_id: LOCAL_PARANAGUA,
        produto: "Soja em grãos (fictícia)",
        peso_total_kg: 37000,
        frete_empresa_valor: 150,
        frete_empresa_tipo: "por_tonelada",
        frete_empresa_origem: "manual",
        observacao: `${MARCA} tempo real ${new Date().toISOString()}`,
      })
      .select("id")
      .single();
    if (p.error) throw p.error;
    pedidoId = p.data.id;
    const c = await db.from("conjunto").select("cavalo_id, motorista_id").eq("id", conj.id).single();
    if (c.error) throw c.error;
    const v = await db
      .from("viagem")
      // Frete do motorista e km acima do piso da ANTT (sem eles a viagem tem trava, migration 20261027000100).
      .insert({
        pedido_id: pedidoId,
        conjunto_id: conj.id,
        cavalo_id: c.data.cavalo_id,
        motorista_id: c.data.motorista_id,
        peso_previsto_kg: 37000,
        frete_motorista_valor: 9000,
        frete_motorista_tipo: "total",
        km_viagem: 400,
      })
      .select("id, numero")
      .single();
    if (v.error) throw v.error;
    viagemId = v.data.id;
    const n = v.data.numero as number;
    const ini = await db.rpc("iniciar_viagem", conj.travas ? { p_viagem: viagemId, p_justificativa: `${MARCA}: teste automatizado` } : { p_viagem: viagemId });
    if (ini.error) throw ini.error;

    // Duas telas do Quadro, as duas ao vivo e com o cartão em "Trânsito"
    const page2 = await outra.newPage();
    await entrar(page);
    await aoVivo(page);
    await aoVivo(page2);
    await expect(cartao(coluna(page, "Trânsito"), n)).toBeVisible();
    await expect(cartao(coluna(page2, "Trânsito"), n)).toBeVisible();

    // Move na primeira (botão "Mover", sem arrastar); a segunda mostra na coluna nova em até 5 s
    await abrirMover(page, n, "Aguardando carregamento");
    await expect(cartao(coluna(page2, "Aguardando carregamento"), n)).toBeVisible({ timeout: 5000 });
    await expect(cartao(coluna(page2, "Trânsito"), n)).toHaveCount(0);
    await chegou(page, n, "Aguardando carregamento");
  });
});
