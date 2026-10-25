import { describe, expect, it } from "vitest";
import { avaliarLote, custoPorTonelada, distribuirPeso, novoCaminhao, type Caminhao, type EntradaLote } from "@/lib/calculadora/lote";
import { MARGEM_MINIMA, type Coeficiente } from "@/lib/calculadora/regras";

/* Lote de carga: 128 t Mandaguari/PR → Maracaju/MS (583 km, pedágio R$ 0,038 por eixo/km), granel sólido,
   caminhões de 5, 6, 6 e 7 eixos com os motoristas no piso. */

const P = "Portaria SUROC/ANTT nº 22/2026";
const TABELA: Coeficiente[] = [
  [5, 6.8548, 664.83],
  [6, 7.5641, 680.01],
  [7, 8.2316, 820.34],
  [9, 9.4318, 908.91],
].map(([eixos, ccd, cc]) => ({ tipo: "granel_solido" as const, eixos, ccd, cc, portaria: P }));

const ROTA = { km: 583, pedagioEixoKm: 0.038, origemUF: "PR", destinoUF: "MS", tipo: "granel_solido" as const, retornoVazio: false };
const cheio = (e: number): Caminhao => ({ ...novoCaminhao(e), peso: novoCaminhao(e).capacidade });
const BASE: EntradaLote = {
  rota: ROTA,
  tabela: TABELA,
  pesoTotal: 128,
  precoPorTonelada: 205,
  valorMercadoriaPorTonelada: 0,
  caminhoes: [cheio(5), cheio(6), cheio(6), cheio(7)],
};

describe("avaliarLote", () => {
  it("abaixo da margem mínima → negociar, com o preço mínimo que fecha 8,5%", () => {
    const a = avaliarLote(BASE);
    expect(a.veredito).toBe("negociar");
    expect(a.precoMinimo).toBeCloseTo(209.52, 2);
    const noMinimo = avaliarLote({ ...BASE, precoPorTonelada: a.precoMinimo! });
    expect(noMinimo.totais.margemLiquida).toBeCloseTo(MARGEM_MINIMA, 4);
    expect(noMinimo.veredito).toBe("contratar");
  });

  it("frete do motorista começa no piso arredondado para cima", () => {
    const a = avaliarLote(BASE);
    expect(a.caminhoes[3].piso).toBeCloseTo(5619.36, 2);
    expect(a.caminhoes[3].freteMotorista).toBe(5620);
    expect(a.totais.freteMotorista).toBe(20462);
  });

  it("um motorista abaixo do piso → não contratar", () => {
    const cs = [...BASE.caminhoes];
    cs[0] = { ...cs[0], freteMotorista: 4000 };
    const a = avaliarLote({ ...BASE, precoPorTonelada: 260, caminhoes: cs });
    expect(a.veredito).toBe("nao_contratar");
    expect(a.caminhoes[0].situacao).toBe("abaixo_piso");
  });

  it("peso que falta ou caminhão acima da capacidade → ajustar", () => {
    expect(avaliarLote({ ...BASE, precoPorTonelada: 260, pesoTotal: 140 }).texto).toBe("A composição não leva o lote todo: faltam 12,00 t.");
    const cs = [...BASE.caminhoes];
    cs[0] = { ...cs[0], peso: 30 };
    expect(avaliarLote({ ...BASE, precoPorTonelada: 260, pesoTotal: 132, caminhoes: cs }).veredito).toBe("ajustar");
  });

  it("sem caminhões ou sem preço → incompleto", () => {
    expect(avaliarLote({ ...BASE, caminhoes: [] }).veredito).toBe("incompleto");
    expect(avaliarLote({ ...BASE, precoPorTonelada: 0 }).veredito).toBe("incompleto");
  });
});

describe("custoPorTonelada", () => {
  it("piso + pedágio dividido pela capacidade; 9 eixos é o mais barato nesta rota", () => {
    const c = custoPorTonelada(ROTA, TABELA);
    const min = c.reduce((a, b) => (b.valor < a.valor ? b : a));
    expect(min.eixos).toBe(9);
    expect(c.find((x) => x.eixos === 7)!.valor).toBeCloseTo((5619.36 + 155.08) / 38, 2);
  });
});

describe("distribuirPeso", () => {
  it("cabendo tudo, cada um leva a capacidade; senão, proporcional e fecha ao centésimo", () => {
    const cs = [novoCaminhao(5), novoCaminhao(6)];
    expect(distribuirPeso(cs, 100).map((c) => c.peso)).toEqual([26, 32]);
    const r = distribuirPeso(cs, 50);
    expect(r[0].peso).toBe(22.41);
    expect(r[0].peso + r[1].peso).toBeCloseTo(50, 2);
  });
});
