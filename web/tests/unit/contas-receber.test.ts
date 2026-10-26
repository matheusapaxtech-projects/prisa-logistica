import { beforeEach, describe, expect, it, vi } from "vitest";

// Regras puras da tela de contas a receber e, no fim, as Server Actions com um cliente Supabase falso
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

import {
  acoesDoTitulo,
  FILTROS,
  lerFiltro,
  lerParametrosSimulacao,
  lerRecebimento,
  lerTitulo,
  ROTULO_FILTRO,
} from "@/app/(app)/financeiro/receber/regras";
import { cancelarReceber, desfazerRecebimento, editarTitulo, lancarTitulo, receberTitulo } from "@/app/(app)/financeiro/receber/actions";
import { hojeISO } from "@/lib/datas";

const HOJE = "2026-10-26";
const UUID = "00000000-0000-4000-8000-000000000901";
const CLIENTE = "00000000-0000-4000-8000-000000000a01";
const CONTA_BANCO = "00000000-0000-4000-8000-000000000902";

function formulario(campos: Record<string, string> = {}): FormData {
  const f = new FormData();
  const base: Record<string, string> = {
    cliente: CLIENTE,
    titulo: "CT-e 1234",
    plano: "1",
    centro: "3",
    forma: "boleto",
    vencimento: "2026-11-05",
    valor: "1.234,56",
    observacao: "",
  };
  for (const [k, v] of Object.entries({ ...base, ...campos })) f.set(k, v);
  return f;
}

describe("lerTitulo (conta a receber lançada à mão)", () => {
  it("lê o formulário: valor '1.234,56' vira 1234.56 e a observação vazia vira null", () => {
    expect(lerTitulo(formulario(), HOJE)).toEqual({
      ok: true,
      dados: {
        clienteId: CLIENTE,
        titulo: "CT-e 1234",
        planoId: 1,
        centroId: 3,
        forma: "boleto",
        vencimento: "2026-11-05",
        valor: 1234.56,
        observacao: null,
      },
    });
  });

  it("junta espaços repetidos e guarda a observação", () => {
    const r = lerTitulo(formulario({ titulo: "  CT-e   1234 ", observacao: " Pago em duas vezes " }), HOJE);
    expect(r.ok && r.dados.titulo).toBe("CT-e 1234");
    expect(r.ok && r.dados.observacao).toBe("Pago em duas vezes");
  });

  it("cliente é obrigatório e precisa vir da lista", () => {
    const vazio = lerTitulo(formulario({ cliente: "" }), HOJE);
    expect(!vazio.ok && vazio.erros.cliente).toBe("Escolha o cliente.");
    const ruim = lerTitulo(formulario({ cliente: "123" }), HOJE);
    expect(!ruim.ok && ruim.erros.cliente).toBe("Escolha o cliente.");
  });

  it("título de 1 a 120 caracteres", () => {
    const vazio = lerTitulo(formulario({ titulo: "   " }), HOJE);
    expect(!vazio.ok && vazio.erros.titulo).toMatch(/Escreva o título/);
    expect(lerTitulo(formulario({ titulo: "a" }), HOJE).ok).toBe(true);
    expect(lerTitulo(formulario({ titulo: "a".repeat(120) }), HOJE).ok).toBe(true);
    const longo = lerTitulo(formulario({ titulo: "a".repeat(121) }), HOJE);
    expect(!longo.ok && longo.erros.titulo).toBe("Use até 120 caracteres.");
  });

  it("valor zero é recusado; vazio, mal escrito e alto demais também", () => {
    const zero = lerTitulo(formulario({ valor: "0" }), HOJE);
    expect(zero).toEqual({ ok: false, erros: { valor: "Informe um valor maior que zero." } });
    const vazio = lerTitulo(formulario({ valor: "" }), HOJE);
    expect(!vazio.ok && vazio.erros.valor).toBe("Informe o valor.");
    const ruim = lerTitulo(formulario({ valor: "1,234.56" }), HOJE);
    expect(!ruim.ok && ruim.erros.valor).toMatch(/Valor inválido/);
    const alto = lerTitulo(formulario({ valor: "999.999.999,00" }), HOJE);
    expect(!alto.ok && alto.erros.valor).toMatch(/Valor alto demais/);
  });

  it("vencimento vazio, inexistente ou com ano estranho é recusado; atrasado e a vencer passam", () => {
    const vazio = lerTitulo(formulario({ vencimento: "" }), HOJE);
    expect(!vazio.ok && vazio.erros.vencimento).toBe("Informe o vencimento.");
    const falso = lerTitulo(formulario({ vencimento: "2026-02-30" }), HOJE);
    expect(!falso.ok && falso.erros.vencimento).toBe("Data inválida.");
    const antigo = lerTitulo(formulario({ vencimento: "1999-12-31" }), HOJE);
    expect(!antigo.ok && antigo.erros.vencimento).toBe("Confira o ano do vencimento.");
    const longe = lerTitulo(formulario({ vencimento: "2040-01-01" }), HOJE);
    expect(!longe.ok && longe.erros.vencimento).toBe("Confira o ano do vencimento.");
    expect(lerTitulo(formulario({ vencimento: "2026-09-01" }), HOJE).ok).toBe(true);
  });

  it("tipo de receita, centro e forma precisam ser escolhidos", () => {
    const r = lerTitulo(formulario({ plano: "", centro: "abc", forma: "cheque" }), HOJE);
    expect(r).toEqual({
      ok: false,
      erros: { plano: "Escolha o tipo de receita.", centro: "Escolha o centro de custo.", forma: "Escolha a forma de recebimento." },
    });
  });

  it("observação passa de 500 caracteres: recusa", () => {
    const r = lerTitulo(formulario({ observacao: "x".repeat(501) }), HOJE);
    expect(!r.ok && r.erros.observacao).toBe("Use até 500 caracteres.");
  });

  it("junta todos os erros de uma vez", () => {
    const r = lerTitulo(formulario({ cliente: "", titulo: "", valor: "", vencimento: "" }), HOJE);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual(["cliente", "titulo", "valor", "vencimento"]);
  });
});

describe("lerRecebimento", () => {
  const dados = (c: Record<string, string> = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ data: HOJE, conta: "", ...c })) f.set(k, v);
    return f;
  };

  it("sem conta bancária (dinheiro) vira null", () => {
    expect(lerRecebimento(dados(), HOJE)).toEqual({ ok: true, dados: { data: HOJE, contaId: null } });
  });

  it("com conta bancária e data passada", () => {
    expect(lerRecebimento(dados({ conta: CONTA_BANCO, data: "2026-10-20" }), HOJE)).toEqual({
      ok: true,
      dados: { data: "2026-10-20", contaId: CONTA_BANCO },
    });
  });

  it("data no futuro, vazia, inválida ou muito antiga é recusada", () => {
    const futuro = lerRecebimento(dados({ data: "2026-10-27" }), HOJE);
    expect(!futuro.ok && futuro.erros.data).toBe("A data do recebimento não pode ser depois de hoje.");
    const vazia = lerRecebimento(dados({ data: "" }), HOJE);
    expect(!vazia.ok && vazia.erros.data).toBe("Informe a data do recebimento.");
    const ruim = lerRecebimento(dados({ data: "26/10/2026" }), HOJE);
    expect(!ruim.ok && ruim.erros.data).toBe("Data inválida.");
    const antiga = lerRecebimento(dados({ data: "1999-01-01" }), HOJE);
    expect(!antiga.ok && antiga.erros.data).toBe("Confira o ano da data.");
  });

  it("conta fora do formato é recusada", () => {
    expect(lerRecebimento(dados({ conta: "123" }), HOJE)).toEqual({ ok: false, erros: { conta: "Escolha uma conta da lista." } });
  });
});

describe("lerFiltro", () => {
  it("padrão: em aberto; valores válidos passam; cada aba tem rótulo", () => {
    expect(lerFiltro(undefined)).toBe("aberto");
    expect(lerFiltro("lixo")).toBe("aberto");
    expect(lerFiltro("aprovar")).toBe("aberto");
    expect(FILTROS).toEqual(["aberto", "vencidas", "recebidas", "todas"]);
    for (const f of FILTROS) expect(lerFiltro(f)).toBe(f);
    expect(ROTULO_FILTRO).toEqual({ aberto: "Em aberto", vencidas: "Vencidas", recebidas: "Recebidas", todas: "Todas" });
  });
});

describe("acoesDoTitulo (o que a linha oferece)", () => {
  const aberto = { canceladoEm: null, recebidoEm: null, vencimento: "2026-11-05" };

  it("a vencer: recebe, edita, cancela e pode ser marcado para antecipar", () => {
    expect(acoesDoTitulo(aberto, HOJE)).toEqual({ receber: true, editar: true, cancelar: true, desfazerRecebimento: false, antecipar: true });
  });

  it("vence hoje ou já venceu: segue em aberto, mas não entra na antecipação", () => {
    expect(acoesDoTitulo({ ...aberto, vencimento: HOJE }, HOJE)).toMatchObject({ receber: true, antecipar: false });
    expect(acoesDoTitulo({ ...aberto, vencimento: "2026-10-01" }, HOJE)).toMatchObject({ receber: true, editar: true, antecipar: false });
  });

  it("recebido: só desfazer o recebimento", () => {
    expect(acoesDoTitulo({ ...aberto, recebidoEm: "2026-10-20" }, HOJE)).toEqual({
      receber: false,
      editar: false,
      cancelar: false,
      desfazerRecebimento: true,
      antecipar: false,
    });
  });

  it("cancelado não oferece nada", () => {
    expect(acoesDoTitulo({ ...aberto, canceladoEm: "2026-10-21T10:00:00Z" }, HOJE)).toEqual({
      receber: false,
      editar: false,
      cancelar: false,
      desfazerRecebimento: false,
      antecipar: false,
    });
  });
});

describe("lerParametrosSimulacao", () => {
  it("lê taxa e tarifa em formato brasileiro", () => {
    expect(lerParametrosSimulacao("2,0", "5,00")).toEqual({ ok: true, taxa: 2, tarifa: 5 });
    expect(lerParametrosSimulacao("1,85", "12,5")).toEqual({ ok: true, taxa: 1.85, tarifa: 12.5 });
    expect(lerParametrosSimulacao("0", "0")).toEqual({ ok: true, taxa: 0, tarifa: 0 });
  });

  it("vazio, mal escrito, negativo ou exagerado vira erro no campo certo", () => {
    expect(lerParametrosSimulacao("", "5,00")).toMatchObject({ ok: false, erros: { taxa: "Informe a taxa." } });
    expect(lerParametrosSimulacao("2.5", "5,00")).toMatchObject({ ok: false, erros: { taxa: expect.stringMatching(/inválida/) } });
    expect(lerParametrosSimulacao("2,0", "")).toMatchObject({ ok: false, erros: { tarifa: "Informe a tarifa (zero se não houver)." } });
    expect(lerParametrosSimulacao("2,0", "abc")).toMatchObject({ ok: false, erros: { tarifa: expect.stringMatching(/inválida/) } });
    expect(lerParametrosSimulacao("100,1", "5")).toMatchObject({ ok: false, erros: { taxa: expect.stringMatching(/até 100/) } });
    expect(lerParametrosSimulacao("2", "999.999.999,00")).toMatchObject({ ok: false, erros: { tarifa: expect.stringMatching(/alta demais/) } });
  });
});

describe("Server Actions de contas a receber", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    respostas.length = 0;
    chamadas.length = 0;
  });

  it("lancarTitulo grava só as colunas do formulário e devolve o id", async () => {
    respostas.push({ data: { id: UUID }, error: null });
    const r = await lancarTitulo(formulario());
    expect(r).toEqual({ ok: true, dados: UUID });
    const insert = chamadas.find((c) => c[1] === "insert");
    expect(insert?.[0]).toBe("fin_receber");
    expect(insert?.[2][0]).toEqual({
      cliente_id: CLIENTE,
      titulo: "CT-e 1234",
      plano_id: 1,
      centro_custo_id: 3,
      forma: "boleto",
      vencimento: "2026-11-05",
      valor: 1234.56,
      observacao: null,
    });
  });

  it("lancarTitulo com formulário inválido não chama o banco", async () => {
    const r = await lancarTitulo(formulario({ valor: "0" }));
    expect(r).toEqual({ ok: false, erro: "Informe um valor maior que zero." });
    expect(chamadas).toHaveLength(0);
  });

  it("editarTitulo manda as colunas do formulário e avisa quando nada foi atualizado", async () => {
    respostas.push({ data: [{ id: UUID }], error: null });
    expect((await editarTitulo(UUID, formulario())).ok).toBe(true);
    const up = chamadas.find((c) => c[1] === "update");
    expect(up?.[0]).toBe("fin_receber");
    expect(Object.keys(up?.[2][0] as object).sort()).toEqual(
      ["centro_custo_id", "cliente_id", "forma", "observacao", "plano_id", "titulo", "valor", "vencimento"].sort(),
    );

    respostas.push({ data: [], error: null });
    expect((await editarTitulo(UUID, formulario())).ok).toBe(false);
  });

  it("editarTitulo com id inválido nem chama o banco", async () => {
    expect((await editarTitulo("abc", formulario())).ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("receberTitulo manda data e conta; sem conta bancária omite p_conta", async () => {
    const f = new FormData();
    f.set("data", hojeISO());
    f.set("conta", CONTA_BANCO);
    expect((await receberTitulo(UUID, f)).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("fin_receber_conta", { p_id: UUID, p_data: hojeISO(), p_conta: CONTA_BANCO });

    const g = new FormData();
    g.set("data", hojeISO());
    g.set("conta", "");
    await receberTitulo(UUID, g);
    expect(rpc).toHaveBeenLastCalledWith("fin_receber_conta", { p_id: UUID, p_data: hojeISO(), p_conta: undefined });
  });

  it("receberTitulo com data futura é recusado antes do banco; a frase do banco chega à tela", async () => {
    const f = new FormData();
    f.set("data", "2999-01-01");
    expect(await receberTitulo(UUID, f)).toEqual({ ok: false, erro: "A data do recebimento não pode ser depois de hoje." });
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Este título já foi recebido." } });
    const g = new FormData();
    g.set("data", hojeISO());
    expect(await receberTitulo(UUID, g)).toEqual({ ok: false, erro: "Este título já foi recebido." });
  });

  it("desfazerRecebimento chama fin_desfazer_recebimento", async () => {
    expect(await desfazerRecebimento(UUID)).toEqual({ ok: true, dados: undefined });
    expect(rpc).toHaveBeenLastCalledWith("fin_desfazer_recebimento", { p_id: UUID });
    expect((await desfazerRecebimento("abc")).ok).toBe(false);
  });

  it("cancelarReceber exige o motivo e corta os espaços", async () => {
    expect(await cancelarReceber(UUID, "ab")).toEqual({ ok: false, erro: "Diga o motivo do cancelamento." });
    expect(rpc).not.toHaveBeenCalled();
    expect((await cancelarReceber(UUID, " Cliente desistiu ")).ok).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("fin_cancelar_receber", { p_id: UUID, p_motivo: "Cliente desistiu" });
  });
});
