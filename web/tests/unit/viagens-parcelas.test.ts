import { describe, expect, it } from "vitest";
import { lerParcelas, pagoPeloFinanceiro, rotuloDaParcela, sinalDaParcela, type LinhaParcela } from "@/app/(app)/viagens/parcelas";

/* Parcelas do frete na ficha da viagem (RPC viagem_parcelas): leitura, sinal da situação e "quem paga". Dados fictícios. */

const linha = (extra: Partial<LinhaParcela> = {}): LinhaParcela => ({
  origem: "frete_adiantamento",
  numero: 501,
  valor: 8400,
  parte_pedagio: 400,
  vencimento: "2026-11-05",
  situacao: "falta_aprovar",
  pago_em: null,
  antecipacao_liberada: false,
  ...extra,
});

describe("lerParcelas", () => {
  it("põe o adiantamento antes do saldo e converte os números", () => {
    const r = lerParcelas([linha({ origem: "frete_saldo", numero: "502", valor: "3000.5", parte_pedagio: null }), linha()]);
    expect(r.map((p) => p.origem)).toEqual(["frete_adiantamento", "frete_saldo"]);
    expect(r[1]).toMatchObject({ numero: 502, valor: 3000.5, partePedagio: 0, antecipacaoLiberada: false });
    expect(r[0]).toMatchObject({ numero: 501, valor: 8400, partePedagio: 400 });
  });
  it("sem linhas (viagem antiga) devolve lista vazia; origem ou situação desconhecida fica de fora", () => {
    expect(lerParcelas(null)).toEqual([]);
    expect(lerParcelas([])).toEqual([]);
    expect(lerParcelas([linha({ origem: "manual" }), linha({ situacao: "outra" })])).toEqual([]);
  });
  it("antecipação liberada só quando é verdadeira", () => {
    expect(lerParcelas([linha({ origem: "frete_saldo", antecipacao_liberada: true })])[0].antecipacaoLiberada).toBe(true);
    expect(lerParcelas([linha({ antecipacao_liberada: null })])[0].antecipacaoLiberada).toBe(false);
  });
});

describe("sinalDaParcela", () => {
  const sinal = (situacao: string, extra: Partial<LinhaParcela> = {}) => {
    const [p] = lerParcelas([linha({ situacao, ...extra })]);
    return sinalDaParcela(p);
  };
  it("paga: verde com a data do pagamento", () => {
    expect(sinal("paga", { pago_em: "2026-11-03" })).toEqual({ tipo: "normal", texto: "Paga em 03/11/2026" });
  });
  it("falta aprovar: laranja", () => {
    expect(sinal("falta_aprovar")).toEqual({ tipo: "pendente", texto: "Falta aprovar" });
  });
  it("vencida: ferrugem", () => {
    expect(sinal("vencida")).toEqual({ tipo: "bloqueado", texto: "Vencida" });
  });
  it("a vencer aqui é aprovada e no prazo: informação com o vencimento", () => {
    expect(sinal("a_vencer")).toEqual({ tipo: "info", texto: "Aprovada, vence 05/11/2026" });
  });
  it("cancelada: neutra", () => {
    expect(sinal("cancelada")).toEqual({ tipo: "neutro", texto: "Cancelada" });
  });
});

describe("pagoPeloFinanceiro", () => {
  it("só conta parcela que existe e não foi cancelada", () => {
    const ambas = lerParcelas([linha(), linha({ origem: "frete_saldo", situacao: "a_vencer" })]);
    expect(pagoPeloFinanceiro(ambas, "adiantamento")).toBe(true);
    expect(pagoPeloFinanceiro(ambas, "saldo")).toBe(true);
    const umaCancelada = lerParcelas([linha({ situacao: "cancelada" }), linha({ origem: "frete_saldo", situacao: "paga" })]);
    expect(pagoPeloFinanceiro(umaCancelada, "adiantamento")).toBe(false);
    expect(pagoPeloFinanceiro(umaCancelada, "saldo")).toBe(true);
    expect(pagoPeloFinanceiro([], "adiantamento")).toBe(false);
    expect(pagoPeloFinanceiro([], "saldo")).toBe(false);
  });
});

describe("rotuloDaParcela", () => {
  it("rótulos da ficha", () => {
    expect(rotuloDaParcela("frete_adiantamento")).toBe("Adiantamento (70% + pedágio)");
    expect(rotuloDaParcela("frete_saldo")).toBe("Saldo (30%)");
  });
});
