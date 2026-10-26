import { beforeEach, describe, expect, it, vi } from "vitest";

// Regras puras da tela de contas a pagar e, no fim, as Server Actions com um cliente Supabase falso
// (sessão válida): só as colunas permitidas entram na gravação e as funções do banco recebem os argumentos certos.
const rpc = vi.fn();
const respostas: unknown[] = [];
const chamadas: [string, string, unknown[]][] = [];
function consulta(tabela: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "eq", "single", "maybeSingle"]) {
    q[m] = (...a: unknown[]) => {
      chamadas.push([tabela, m, a]);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => void) => ok(respostas.shift() ?? { data: null, error: null });
  return q;
}
const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-fin" } }, error: null })) },
  rpc,
  from: vi.fn(consulta),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { agrupar } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import {
  acoesDaConta,
  chaveCentro,
  chaveTipo,
  lerAjusteGerada,
  lerAgrupar,
  lerConta,
  lerFiltro,
  lerMotivo,
  lerPagamento,
} from "@/app/(app)/financeiro/pagar/regras";
import {
  aprovar,
  cancelar,
  desfazerPagamento,
  editarConta,
  lancarConta,
  lancarTaxaCartao,
  liberarAntecipacao,
  pagar,
} from "@/app/(app)/financeiro/pagar/actions";

const HOJE = "2026-10-26";
const UUID = "00000000-0000-4000-8000-000000000901";
const CONTA_BANCO = "00000000-0000-4000-8000-000000000902";

function formulario(campos: Record<string, string> = {}): FormData {
  const f = new FormData();
  const base: Record<string, string> = {
    descricao: "Manutenção do cavalo 12",
    favorecido: "Oficina Fictícia Ltda",
    plano: "52",
    centro: "3",
    forma: "pix",
    vencimento: "2026-11-05",
    valor: "1.234,56",
    observacao: "",
  };
  for (const [k, v] of Object.entries({ ...base, ...campos })) f.set(k, v);
  return f;
}

describe("lerConta (conta a pagar lançada à mão)", () => {
  it("lê o formulário: valor '1.234,56' vira 1234.56 e a observação vazia vira null", () => {
    const r = lerConta(formulario(), HOJE);
    expect(r).toEqual({
      ok: true,
      dados: {
        descricao: "Manutenção do cavalo 12",
        favorecidoNome: "Oficina Fictícia Ltda",
        planoId: 52,
        centroId: 3,
        forma: "pix",
        vencimento: "2026-11-05",
        valor: 1234.56,
        observacao: null,
      },
    });
  });

  it("junta espaços repetidos e guarda a observação", () => {
    const r = lerConta(formulario({ descricao: "  Troca   de  pneus ", observacao: " Nota 123 " }), HOJE);
    expect(r.ok && r.dados.descricao).toBe("Troca de pneus");
    expect(r.ok && r.dados.observacao).toBe("Nota 123");
  });

  it("valor zero é recusado com a frase pedida", () => {
    const r = lerConta(formulario({ valor: "0" }), HOJE);
    expect(r).toEqual({ ok: false, erros: { valor: "Informe um valor maior que zero." } });
    const r2 = lerConta(formulario({ valor: "0,00" }), HOJE);
    expect(!r2.ok && r2.erros.valor).toBe("Informe um valor maior que zero.");
  });

  it("valor vazio, mal escrito ou alto demais", () => {
    expect(!lerConta(formulario({ valor: "" }), HOJE).ok).toBe(true);
    const vazio = lerConta(formulario({ valor: "" }), HOJE);
    expect(!vazio.ok && vazio.erros.valor).toBe("Informe o valor.");
    const ruim = lerConta(formulario({ valor: "1,234.56" }), HOJE);
    expect(!ruim.ok && ruim.erros.valor).toMatch(/Valor inválido/);
    const alto = lerConta(formulario({ valor: "999.999.999,00" }), HOJE);
    expect(!alto.ok && alto.erros.valor).toMatch(/Valor alto demais/);
  });

  it("vencimento vazio ou inexistente é recusado", () => {
    const vazio = lerConta(formulario({ vencimento: "" }), HOJE);
    expect(!vazio.ok && vazio.erros.vencimento).toBe("Informe o vencimento.");
    const falso = lerConta(formulario({ vencimento: "2026-02-30" }), HOJE);
    expect(!falso.ok && falso.erros.vencimento).toBe("Data inválida.");
    const antigo = lerConta(formulario({ vencimento: "1999-12-31" }), HOJE);
    expect(!antigo.ok && antigo.erros.vencimento).toBe("Confira o ano do vencimento.");
  });

  it("aceita vencimento já passado (conta atrasada) mas não muito longe no futuro", () => {
    expect(lerConta(formulario({ vencimento: "2026-09-01" }), HOJE).ok).toBe(true);
    const longe = lerConta(formulario({ vencimento: "2040-01-01" }), HOJE);
    expect(!longe.ok && longe.erros.vencimento).toBe("Confira o ano do vencimento.");
  });

  it("descrição vazia ou com mais de 200 caracteres é recusada", () => {
    const longa = lerConta(formulario({ descricao: "a".repeat(201) }), HOJE);
    expect(!longa.ok && longa.erros.descricao).toBe("Use até 200 caracteres.");
    expect(lerConta(formulario({ descricao: "a".repeat(200) }), HOJE).ok).toBe(true);
    const vazia = lerConta(formulario({ descricao: "   " }), HOJE);
    expect(!vazia.ok && vazia.erros.descricao).toMatch(/Escreva/);
  });

  it("favorecido vazio ou com mais de 160 caracteres é recusado", () => {
    const vazio = lerConta(formulario({ favorecido: "  " }), HOJE);
    expect(!vazio.ok && vazio.erros.favorecido).toMatch(/a quem/i);
    const longo = lerConta(formulario({ favorecido: "a".repeat(161) }), HOJE);
    expect(!longo.ok && longo.erros.favorecido).toBe("Use até 160 caracteres.");
  });

  it("tipo, centro e forma precisam ser escolhidos", () => {
    const r = lerConta(formulario({ plano: "", centro: "abc", forma: "cheque" }), HOJE);
    expect(r).toEqual({
      ok: false,
      erros: { plano: "Escolha o tipo de despesa.", centro: "Escolha o centro de custo.", forma: "Escolha a forma de pagamento." },
    });
  });

  it("observação passa de 500 caracteres: recusa", () => {
    const r = lerConta(formulario({ observacao: "x".repeat(501) }), HOJE);
    expect(!r.ok && r.erros.observacao).toBe("Use até 500 caracteres.");
  });

  it("junta todos os erros de uma vez", () => {
    const r = lerConta(formulario({ descricao: "", favorecido: "", valor: "", vencimento: "" }), HOJE);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual(["descricao", "favorecido", "valor", "vencimento"]);
  });
});

describe("lerAjusteGerada (conta gerada pelo NILT)", () => {
  it("lê só forma, centro de custo e observação", () => {
    const f = new FormData();
    f.set("centro", "4");
    f.set("forma", "cartao_frete");
    f.set("observacao", " ajuste ");
    expect(lerAjusteGerada(f)).toEqual({ ok: true, dados: { centroId: 4, forma: "cartao_frete", observacao: "ajuste" } });
  });

  it("não exige descrição, favorecido, valor nem vencimento", () => {
    const f = new FormData();
    f.set("centro", "4");
    f.set("forma", "boleto");
    expect(lerAjusteGerada(f).ok).toBe(true);
  });

  it("recusa centro e forma inválidos", () => {
    const f = new FormData();
    f.set("forma", "x");
    const r = lerAjusteGerada(f);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual(["centro", "forma"]);
  });
});

describe("lerPagamento", () => {
  const dados = (c: Record<string, string> = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ data: HOJE, conta: "", forma: "pix", ...c })) f.set(k, v);
    return f;
  };

  it("sem conta bancária (cartão-frete ou dinheiro) vira null", () => {
    expect(lerPagamento(dados(), HOJE)).toEqual({ ok: true, dados: { data: HOJE, contaId: null, forma: "pix" } });
  });

  it("com conta bancária", () => {
    const r = lerPagamento(dados({ conta: CONTA_BANCO, forma: "transferencia" }), HOJE);
    expect(r).toEqual({ ok: true, dados: { data: HOJE, contaId: CONTA_BANCO, forma: "transferencia" } });
  });

  it("data no futuro, vazia ou inválida é recusada", () => {
    const futuro = lerPagamento(dados({ data: "2026-10-27" }), HOJE);
    expect(!futuro.ok && futuro.erros.data).toBe("A data do pagamento não pode ser depois de hoje.");
    const vazia = lerPagamento(dados({ data: "" }), HOJE);
    expect(!vazia.ok && vazia.erros.data).toBe("Informe a data do pagamento.");
    const ruim = lerPagamento(dados({ data: "26/10/2026" }), HOJE);
    expect(!ruim.ok && ruim.erros.data).toBe("Data inválida.");
  });

  it("conta fora do formato e forma desconhecida são recusadas", () => {
    const r = lerPagamento(dados({ conta: "123", forma: "cheque" }), HOJE);
    expect(r).toEqual({ ok: false, erros: { conta: "Escolha uma conta da lista.", forma: "Escolha a forma de pagamento." } });
  });
});

describe("lerMotivo", () => {
  it("corta os espaços e exige ao menos 3 caracteres", () => {
    expect(lerMotivo("  Fornecedor trocado ", "cancelamento")).toEqual({ ok: true, motivo: "Fornecedor trocado" });
    expect(lerMotivo("ab", "cancelamento")).toEqual({ ok: false, erro: "Diga o motivo do cancelamento." });
    expect(lerMotivo(null, "liberação")).toEqual({ ok: false, erro: "Diga o motivo da liberação." });
  });

  it("não passa de 300 caracteres", () => {
    expect(lerMotivo("a".repeat(300), "cancelamento").ok).toBe(true);
    expect(lerMotivo("a".repeat(301), "cancelamento")).toEqual({ ok: false, erro: "Use até 300 caracteres." });
  });
});

describe("lerFiltro e lerAgrupar", () => {
  it("padrões: aberto e por centro de custo", () => {
    expect(lerFiltro(undefined)).toBe("aberto");
    expect(lerFiltro("lixo")).toBe("aberto");
    expect(lerAgrupar(undefined)).toBe("centro");
    expect(lerAgrupar("lixo")).toBe("centro");
  });

  it("valores válidos passam", () => {
    for (const f of ["aberto", "aprovar", "vencidas", "pagas", "todas"]) expect(lerFiltro(f)).toBe(f);
    for (const a of ["centro", "tipo", "nenhum"]) expect(lerAgrupar(a)).toBe(a);
  });
});

describe("acoesDaConta (o que a linha oferece)", () => {
  const base = {
    origem: "manual" as const,
    canceladoEm: null,
    pagoEm: null,
    aprovadoEm: null,
    aprovadoPor: null,
    lancadoPor: "u-a",
    editadoPor: null,
    antecipacaoLiberadaEm: null,
  };
  const financeiro = { userId: "u-b", admin: false };
  const admin = { userId: "u-adm", admin: true };

  it("falta aprovar: outra pessoa aprova; pode editar e cancelar", () => {
    const a = acoesDaConta(base, financeiro);
    expect(a).toMatchObject({ aprovar: true, esperarOutro: false, pagar: false, editar: true, desaprovar: false, cancelar: true });
  });

  it("quem lançou ou alterou por último não aprova: mostra a dica", () => {
    expect(acoesDaConta(base, { userId: "u-a", admin: false })).toMatchObject({ aprovar: false, esperarOutro: true });
    expect(acoesDaConta({ ...base, editadoPor: "u-b" }, financeiro)).toMatchObject({ aprovar: false, esperarOutro: true });
    // o administrador também segue a regra: quem lançou não aprova
    expect(acoesDaConta({ ...base, lancadoPor: "u-adm" }, admin)).toMatchObject({ aprovar: false, esperarOutro: true });
  });

  it("aprovada: paga; não edita; só quem aprovou (ou o admin) desfaz", () => {
    const aprovada = { ...base, aprovadoEm: "2026-10-20T10:00:00Z", aprovadoPor: "u-b" };
    expect(acoesDaConta(aprovada, financeiro)).toMatchObject({ aprovar: false, esperarOutro: false, pagar: true, editar: false, desaprovar: true });
    expect(acoesDaConta(aprovada, { userId: "u-c", admin: false }).desaprovar).toBe(false);
    expect(acoesDaConta(aprovada, admin).desaprovar).toBe(true);
  });

  it("paga: só o admin desfaz o pagamento; nada mais", () => {
    const paga = { ...base, aprovadoEm: "2026-10-20T10:00:00Z", aprovadoPor: "u-b", pagoEm: "2026-10-25" };
    expect(acoesDaConta(paga, financeiro)).toEqual({
      aprovar: false,
      esperarOutro: false,
      pagar: false,
      editar: false,
      desaprovar: false,
      cancelar: false,
      liberar: false,
      desfazerPagamento: false,
    });
    expect(acoesDaConta(paga, admin).desfazerPagamento).toBe(true);
  });

  it("cancelada não oferece nada", () => {
    const c = acoesDaConta({ ...base, canceladoEm: "2026-10-21T10:00:00Z" }, admin);
    expect(Object.values(c).some(Boolean)).toBe(false);
  });

  it("parcela do frete: só o admin cancela; saldo sem antecipação tem 'Liberar antecipação' para o admin", () => {
    const adiant = { ...base, origem: "frete_adiantamento" as const };
    expect(acoesDaConta(adiant, financeiro).cancelar).toBe(false);
    expect(acoesDaConta(adiant, admin).cancelar).toBe(true);
    expect(acoesDaConta(adiant, admin).liberar).toBe(false);

    const saldo = { ...base, origem: "frete_saldo" as const };
    expect(acoesDaConta(saldo, financeiro).liberar).toBe(false);
    expect(acoesDaConta(saldo, admin).liberar).toBe(true);
    expect(acoesDaConta({ ...saldo, antecipacaoLiberadaEm: "2026-10-22T10:00:00Z" }, admin).liberar).toBe(false);
  });

  it("taxa do cartão-frete (gerada) pode ser cancelada pelo financeiro", () => {
    expect(acoesDaConta({ ...base, origem: "taxa_cartao" as const }, financeiro).cancelar).toBe(true);
  });
});

describe("agrupamento da lista", () => {
  const contas = [
    { valor: 100, centroCodigo: "03.08", centroNome: "Manutenção", planoGrupo: "despesa_operacional" as const, planoNome: "Peças" },
    { valor: 50, centroCodigo: "01.01", centroNome: "Frete", planoGrupo: "custo_frete" as const, planoNome: "Pedágio" },
    { valor: 25, centroCodigo: "03.08", centroNome: "Manutenção", planoGrupo: "custo_frete" as const, planoNome: "Combustível" },
  ];

  it("por centro de custo: 'código · nome', na ordem do código", () => {
    const g = agrupar(contas, chaveCentro);
    expect(g.map((x) => x.rotulo)).toEqual(["01.01 · Frete", "03.08 · Manutenção"]);
    expect(g.map((x) => x.total)).toEqual([50, 125]);
  });

  it("por tipo de despesa: 'grupo · conta', com os grupos na ordem do plano de contas", () => {
    const g = agrupar(contas, chaveTipo);
    expect(g.map((x) => x.rotulo)).toEqual(["Custo do frete · Combustível", "Custo do frete · Pedágio", "Despesas operacionais · Peças"]);
  });
});

describe("Server Actions de contas a pagar", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    respostas.length = 0;
    chamadas.length = 0;
  });

  it("lancarConta grava só as colunas do formulário e devolve o id", async () => {
    respostas.push({ data: { id: UUID }, error: null });
    const r = await lancarConta(formulario({ favorecido: "Oficina Fictícia Ltda" }));
    expect(r).toEqual({ ok: true, dados: UUID });
    const insert = chamadas.find((c) => c[1] === "insert");
    expect(insert?.[0]).toBe("fin_pagar");
    expect(insert?.[2][0]).toEqual({
      descricao: "Manutenção do cavalo 12",
      favorecido_nome: "Oficina Fictícia Ltda",
      plano_id: 52,
      centro_custo_id: 3,
      forma: "pix",
      vencimento: "2026-11-05",
      valor: 1234.56,
      observacao: null,
    });
  });

  it("lancarConta com formulário inválido não chama o banco", async () => {
    const r = await lancarConta(formulario({ valor: "0" }));
    expect(r).toEqual({ ok: false, erro: "Informe um valor maior que zero." });
    expect(chamadas).toHaveLength(0);
  });

  it("editarConta de uma conta gerada manda só forma, centro e observação", async () => {
    respostas.push({ data: { origem: "frete_saldo" }, error: null });
    respostas.push({ data: [{ id: UUID }], error: null });
    const f = new FormData();
    f.set("centro", "4");
    f.set("forma", "cartao_frete");
    f.set("observacao", "troca");
    // campos que não podem mudar numa conta gerada são ignorados, mesmo se o formulário os mandar
    f.set("valor", "9.999,00");
    f.set("descricao", "outra");
    const r = await editarConta(UUID, f);
    expect(r.ok).toBe(true);
    const up = chamadas.find((c) => c[1] === "update");
    expect(up?.[2][0]).toEqual({ centro_custo_id: 4, forma: "cartao_frete", observacao: "troca" });
  });

  it("editarConta de uma conta manual manda todas as colunas do formulário", async () => {
    respostas.push({ data: { origem: "manual" }, error: null });
    respostas.push({ data: [{ id: UUID }], error: null });
    const r = await editarConta(UUID, formulario());
    expect(r.ok).toBe(true);
    const up = chamadas.find((c) => c[1] === "update");
    expect(Object.keys(up?.[2][0] as object).sort()).toEqual(
      ["centro_custo_id", "descricao", "favorecido_nome", "forma", "observacao", "plano_id", "valor", "vencimento"].sort(),
    );
  });

  it("editarConta sem linha atualizada (outra pessoa mexeu) avisa", async () => {
    respostas.push({ data: { origem: "manual" }, error: null });
    respostas.push({ data: [], error: null });
    const r = await editarConta(UUID, formulario());
    expect(r.ok).toBe(false);
  });

  it("aprovar chama fin_aprovar_pagar e traz a frase do banco quando recusa", async () => {
    expect(await aprovar(UUID)).toEqual({ ok: true, dados: undefined });
    expect(rpc).toHaveBeenCalledWith("fin_aprovar_pagar", { p_id: UUID });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Quem lançou a conta não pode aprová-la." } });
    expect(await aprovar(UUID)).toEqual({ ok: false, erro: "Quem lançou a conta não pode aprová-la." });
  });

  it("aprovar com id inválido nem chama o banco", async () => {
    const r = await aprovar("abc");
    expect(r.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pagar manda data, conta e forma; sem conta bancária omite p_conta", async () => {
    const f = new FormData();
    f.set("data", hojeISO());
    f.set("conta", CONTA_BANCO);
    f.set("forma", "transferencia");
    expect((await pagar(UUID, f)).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("fin_pagar_conta", { p_id: UUID, p_data: hojeISO(), p_conta: CONTA_BANCO, p_forma: "transferencia" });

    const g = new FormData();
    g.set("data", hojeISO());
    g.set("conta", "");
    g.set("forma", "cartao_frete");
    await pagar(UUID, g);
    expect(rpc).toHaveBeenLastCalledWith("fin_pagar_conta", { p_id: UUID, p_data: hojeISO(), p_conta: undefined, p_forma: "cartao_frete" });
  });

  it("pagar com data futura é recusado antes do banco", async () => {
    const f = new FormData();
    f.set("data", "2999-01-01");
    f.set("forma", "pix");
    const r = await pagar(UUID, f);
    expect(r).toEqual({ ok: false, erro: "A data do pagamento não pode ser depois de hoje." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cancelar e liberar antecipação exigem o motivo", async () => {
    expect(await cancelar(UUID, "ab")).toEqual({ ok: false, erro: "Diga o motivo do cancelamento." });
    expect(await liberarAntecipacao(UUID, "")).toEqual({ ok: false, erro: "Diga o motivo da liberação." });
    expect(rpc).not.toHaveBeenCalled();
    expect((await cancelar(UUID, " Fornecedor trocado ")).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("fin_cancelar_pagar", { p_id: UUID, p_motivo: "Fornecedor trocado" });
    expect((await liberarAntecipacao(UUID, "Cliente pagou adiantado")).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("fin_liberar_antecipacao", { p_id: UUID, p_motivo: "Cliente pagou adiantado" });
  });

  it("desfazerPagamento mostra 'só o administrador' quando o banco recusa por permissão", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Só o administrador desfaz um pagamento." } });
    expect(await desfazerPagamento(UUID)).toEqual({ ok: false, erro: "Só o administrador pode fazer isso." });
  });

  it("lancarTaxaCartao manda o primeiro dia do mês e rejeita mês inválido", async () => {
    rpc.mockResolvedValueOnce({ data: UUID, error: null });
    expect(await lancarTaxaCartao("2026-10")).toEqual({ ok: true, dados: UUID });
    expect(rpc).toHaveBeenLastCalledWith("fin_lancar_taxa_cartao", { p_mes: "2026-10-01" });
    expect((await lancarTaxaCartao("2026-13")).ok).toBe(false);
  });
});
