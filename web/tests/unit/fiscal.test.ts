import { describe, expect, it } from "vitest";
import { irrfPorContratado, planilhaRetencoes, somarRetencoes, type LinhaRetencao } from "@/lib/fiscal";

/** Linha com os valores que o banco devolve para um frete (mesmas taxas e arredondamento). */
function linha(id: string, contratado: [string, string, string], frete: number, data = "2026-10-10"): LinhaRetencao {
  const base = Math.round(frete * 20) / 100;
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    viagemId: id,
    viagemNumero: Number(id),
    data,
    cteNumero: null,
    contratadoId: contratado[0],
    contratadoNome: contratado[1],
    contratadoCpf: contratado[2],
    frete,
    base,
    inss: r(base * 0.11),
    sest: r(base * 0.015),
    senat: r(base * 0.01),
    patronal: r(base * 0.2),
    baseIrrf: r(frete * 0.1),
  };
}

const JOAO: [string, string, string] = ["p1", "João Teste", "52998224725"];
const ANA: [string, string, string] = ["p2", "Ana Teste", "11144477735"];
const MES = [linha("1", JOAO, 8432), linha("2", ANA, 6390), linha("3", JOAO, 8432)];

describe("somarRetencoes", () => {
  it("soma o mês e monta as guias", () => {
    const t = somarRetencoes(MES);
    expect(t.quantidade).toBe(3);
    expect(t.frete).toBe(23254);
    expect(t.inss).toBe(511.58);
    expect(t.patronal).toBe(930.16);
    expect(t.guiaInss).toBe(1441.74);
    expect(t.guiaSestSenat).toBe(116.27);
  });

  it("mês vazio é tudo zero", () => {
    expect(somarRetencoes([])).toMatchObject({ quantidade: 0, frete: 0, guiaInss: 0, guiaSestSenat: 0 });
  });
});

describe("irrfPorContratado", () => {
  it("soma os fretes do mesmo contratado, maior base primeiro", () => {
    const g = irrfPorContratado(MES);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ nome: "João Teste", quantidade: 2, fretes: 16864, baseIrrf: 1686.4 });
    expect(g[1]).toMatchObject({ nome: "Ana Teste", quantidade: 1, fretes: 6390, baseIrrf: 639 });
  });
});

describe("planilhaRetencoes", () => {
  const csv = planilhaRetencoes(MES, "2026-10");

  it("abre no Excel em português: BOM, ponto e vírgula e vírgula decimal", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("10/10/2026;1;;João Teste;529.982.247-25;8432,00;1686,40;185,50;25,30;16,86;337,28;843,20");
    expect(csv).toContain("competência 10/2026");
  });

  it("traz total, guias e IRRF por contratado", () => {
    expect(csv).toContain("Total do mês;;;;;23254,00");
    expect(csv).toContain("Guia do INSS (retido + patronal);");
    expect(csv).toContain("João Teste;529.982.247-25;2;16864,00;1686,40");
  });

  it("nome com ponto e vírgula vai entre aspas e fórmula vira texto", () => {
    const s = planilhaRetencoes([linha("9", ["p9", "=HYPERLINK(1;2)", "11144477735"], 1000)], "2026-10");
    expect(s).toContain(`"'=HYPERLINK(1;2)"`);
  });
});
