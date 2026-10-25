import { describe, expect, it } from "vitest";
import {
  aliquotaIcms,
  calcularCTe,
  checklistCiot,
  coeficientePara,
  decidir,
  freteEmpresaMinimo,
  freteMotoristaMaximo,
  freteSugerido,
  horasDeViagem,
  horasTexto,
  MARGEM_MINIMA,
  pisoAntt,
  situacaoContratado,
  type Coeficiente,
  type EntradaCTe,
  type TipoCarga,
} from "@/lib/calculadora/regras";
import { acharMunicipio, estimarRota, lerMunicipios, pedagioEstimado } from "@/lib/calculadora/rota";
import casos from "./casos.json";

/* Casos da Calculadora de Frete PRISA (regras/casos.json), conferidos ao centavo com CT-e reais. */

const ROTULO: Record<string, TipoCarga> = {
  "Granel sólido": "granel_solido",
  "Carga geral": "carga_geral",
  "Granel pressurizada": "granel_pressurizada",
};

// Só os tipos usados nos casos, com as colunas da Portaria SUROC/ANTT nº 22/2026.
const P = "Portaria SUROC/ANTT nº 22/2026";
const TABELA: Coeficiente[] = [
  ...[
    [2, 4.1056, 460.59],
    [3, 5.2555, 552.24],
    [4, 5.9476, 597.0],
    [5, 6.8548, 664.83],
    [6, 7.5641, 680.01],
    [7, 8.2316, 820.34],
    [9, 9.4318, 908.91],
  ].map(([eixos, ccd, cc]) => ({ tipo: "granel_solido" as const, eixos, ccd, cc, portaria: P })),
  ...[
    [2, 4.0738, 451.84],
    [5, 6.8284, 657.56],
    [7, 8.2727, 831.66],
  ].map(([eixos, ccd, cc]) => ({ tipo: "carga_geral" as const, eixos, ccd, cc, portaria: P })),
  ...[
    [5, 7.1929, 757.81],
    [6, 7.9452, 784.82],
    [9, 9.9531, 1052.26],
  ].map(([eixos, ccd, cc]) => ({ tipo: "granel_pressurizada" as const, eixos, ccd, cc, portaria: P })),
];

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

describe("calcularCTe (casos do modelo)", () => {
  it.each(casos.calcularCTe.map((c, i) => [i, c] as const))("caso %i", (_i, c) => {
    const r = calcularCTe(c.entrada as EntradaCTe);
    const s = c.saida;
    expect(r2(r.icms)).toBe(s.icms);
    expect(r2(r.impostoFederal)).toBe(s.impostoFederal);
    expect(r2(r.inssPatronal)).toBe(s.inssPatronal);
    expect(r2(r.retencoesMotorista)).toBe(s.retencoesMotorista);
    expect(r2(r.freteMotoristaDevido)).toBe(s.freteMotoristaDevido);
    expect(r2(r.taxaPanCard)).toBe(s.taxaPanCard);
    expect(r2(r.seguroCarga)).toBe(s.seguroCarga);
    expect(r2(r.descontoDuplicata)).toBe(s.descontoDuplicata);
    expect(r2(r.resultado)).toBe(s.resultado);
    expect(r4(r.margem)).toBe(s.margem);
    expect(r2(r.irpjCsll)).toBe(s.irpjCsll);
    expect(r2(r.resultadoLiquido)).toBe(s.resultadoLiquido);
    expect(r4(r.margemLiquida)).toBe(s.margemLiquida);
    expect(r.faixa).toBe(s.faixa);
  });
});

describe("piso ANTT (casos do modelo)", () => {
  it.each(casos.pisoAntt.map((c) => [c.entrada.tipo, c.entrada.eixos, c.entrada.km, c.saida] as const))("%s, %i eixos, %i km", (tipo, eixos, km, saida) => {
    expect(r2(pisoAntt(coeficientePara(TABELA, ROTULO[tipo], eixos), km))).toBe(saida);
  });

  it("8 eixos usa a coluna de 7; 2 eixos sem coluna usa a superior", () => {
    expect(coeficientePara(TABELA, "granel_solido", 8)?.eixosTabela).toBe(7);
    expect(coeficientePara(TABELA, "granel_pressurizada", 2)?.eixosTabela).toBe(5);
  });

  it("retorno vazio soma 0,92 × km × CCD; sem km não há piso", () => {
    const c = coeficientePara(TABELA, "granel_solido", 7);
    expect(r2(pisoAntt(c, 100, true))).toBe(r2(100 * 8.2316 + 820.34 + 0.92 * 100 * 8.2316));
    expect(pisoAntt(c, 0)).toBe(0);
    expect(pisoAntt(null, 500)).toBe(0);
  });
});

describe("aliquotaIcms (casos do modelo)", () => {
  it.each(casos.aliquotaIcms.map((c) => [c.entrada.origem, c.entrada.destino, c.saida] as const))("%s → %s = %f", (o, d, s) => {
    expect(aliquotaIcms(o, d)).toBe(s);
  });
});

const BASE: EntradaCTe = { freteEmpresa: 8928.1, freteMotorista: 6844.4, pedagio: 155.08, origemUF: "PR", destinoUF: "MS", motoristaPF: false };

describe("limites da margem mínima", () => {
  it("frete máximo do motorista e mínimo do cliente deixam a margem líquida em 8,5%", () => {
    const fmMax = freteMotoristaMaximo(BASE)!;
    const feMin = freteEmpresaMinimo(BASE)!;
    expect(r4(calcularCTe({ ...BASE, freteMotorista: fmMax }).margemLiquida)).toBe(MARGEM_MINIMA);
    expect(r4(calcularCTe({ ...BASE, freteEmpresa: feMin }).margemLiquida)).toBe(MARGEM_MINIMA);
    expect(fmMax).toBeLessThan(BASE.freteMotorista);
    expect(feMin).toBeGreaterThan(BASE.freteEmpresa);
  });

  it("sem frete da empresa não há teto para o motorista", () => {
    expect(freteMotoristaMaximo({ ...BASE, freteEmpresa: 0 })).toBeNull();
  });
});

const ciotOk = (fm: number, piso: number) =>
  checklistCiot({ km: 583, piso, freteMotorista: fm, pedagio: 155.08, prazoSaldoDias: 3, rntrcConferido: true, motoristaPF: false });

describe("decidir", () => {
  const piso = 583 * 8.2316 + 820.34;

  it("margem abaixo de 8,5% → negociar, com o teto do motorista em destaque", () => {
    const d = decidir({ cte: BASE, piso, ciot: ciotOk(BASE.freteMotorista, piso) });
    expect(d.veredito).toBe("negociar");
    expect(d.limites[0]).toMatchObject({ rotulo: "Pague ao motorista no máximo", principal: true });
    expect(d.limites[1].rotulo).toBe("Ou cobre do cliente pelo menos");
  });

  it("motorista abaixo do piso → não contratar, pagando pelo menos o piso", () => {
    const cte = { ...BASE, freteMotorista: 5000 };
    const d = decidir({ cte, piso, ciot: ciotOk(5000, piso) });
    expect(d.veredito).toBe("nao_contratar");
    expect(d.limites[0]).toMatchObject({ rotulo: "Pague ao motorista pelo menos", valor: piso });
  });

  it("margem boa e nada no CIOT → pode contratar", () => {
    const cte = { ...BASE, freteMotorista: 6000 };
    expect(decidir({ cte, piso, ciot: ciotOk(6000, piso) }).veredito).toBe("contratar");
  });

  it("margem boa mas saldo em mais de 30 dias → ajustar", () => {
    const cte = { ...BASE, freteMotorista: 6000 };
    const ciot = checklistCiot({ km: 583, piso, freteMotorista: 6000, pedagio: 155.08, prazoSaldoDias: 45, rntrcConferido: true, motoristaPF: false });
    expect(decidir({ cte, piso, ciot }).veredito).toBe("ajustar");
  });

  it("prejuízo → não contratar", () => {
    const cte = { ...BASE, freteEmpresa: 6500, freteMotorista: 6000 };
    expect(decidir({ cte, piso, ciot: ciotOk(6000, piso) }).veredito).toBe("nao_contratar");
  });

  it("piso alto demais para fechar a margem → só subindo o frete do cliente", () => {
    const cte = { ...BASE, freteEmpresa: 6400, freteMotorista: piso };
    const d = decidir({ cte, piso, ciot: ciotOk(piso, piso) });
    expect(["negociar", "nao_contratar"]).toContain(d.veredito);
    expect(d.limites[0]).toMatchObject({ rotulo: "Cobre do cliente pelo menos", principal: true });
  });

  it("sem fretes ou sem piso → incompleto", () => {
    expect(decidir({ cte: { ...BASE, freteMotorista: 0 }, piso, ciot: [] }).veredito).toBe("incompleto");
    expect(decidir({ cte: BASE, piso: 0, ciot: [] }).veredito).toBe("incompleto");
  });
});

describe("checklistCiot", () => {
  it("pedágio zerado e prazo acima de 30 dias são impedimentos", () => {
    const l = checklistCiot({ km: 300, piso: 3000, freteMotorista: 3500, pedagio: 0, prazoSaldoDias: 31, rntrcConferido: false, motoristaPF: true });
    expect(l.filter((i) => i.tipo === "bloqueado").map((i) => i.texto)).toEqual(["Vale-pedágio zerado", "Saldo em 31 dias úteis"]);
    expect(l.filter((i) => i.tipo === "vencendo")).toHaveLength(2);
  });
});

describe("rota", () => {
  const M = lerMunicipios("#PR\nMandaguari;-23.55;-51.67\nToledo;-24.72;-53.74\n#MS\nMaracaju;-21.61;-55.17\nBonito;-21.12;-56.48\n#SP\nToledo;-22.74;-46.37");

  it("acha pelo nome com UF, sem acento e só pelo nome quando é único", () => {
    expect(acharMunicipio(M, "maracaju - ms").municipio?.nome).toBe("Maracaju/MS");
    expect(acharMunicipio(M, "Bonito").municipio?.nome).toBe("Bonito/MS");
    expect(acharMunicipio(M, "Toledo")).toEqual({ municipio: null, ambiguos: 2 });
  });

  it("rota medida usa o km e o pedágio dos CT-e", () => {
    const e = estimarRota([acharMunicipio(M, "Mandaguari/PR").municipio!, acharMunicipio(M, "Maracaju/MS").municipio!])!;
    expect(e).toMatchObject({ km: 583, origemKm: "medida", pedagioEixoKm: 0.038 });
    expect(pedagioEstimado(e.km, 7, e.pedagioEixoKm)).toBe(155.08);
  });

  it("rota sem medida é linha reta × fator da UF de destino", () => {
    const e = estimarRota([acharMunicipio(M, "Mandaguari/PR").municipio!, acharMunicipio(M, "Toledo/PR").municipio!])!;
    expect(e.origemKm).toBe("estimada");
    expect(e.fator).toBe(1.25);
    expect(e.km).toBeGreaterThan(200);
    expect(e.pedagioEixoKm).toBe(0.15);
  });
});

describe("frete contratado × mínimo × sugerido", () => {
  const piso = 5000;
  const sug = freteSugerido(piso, 150);

  it("sugerido = piso + 40% + pedágio", () => {
    expect(sug).toBe(7150);
    expect(freteSugerido(0, 150)).toBe(0);
  });

  it("abaixo do mínimo é proibido; entre mínimo e sugerido, atenção; acima, normal", () => {
    expect(situacaoContratado(4500, piso, sug)).toEqual({ tipo: "bloqueado", texto: "10% abaixo do mínimo: contratação proibida" });
    expect(situacaoContratado(6000, piso, sug)).toEqual({ tipo: "vencendo", texto: "20% acima do mínimo, abaixo do sugerido" });
    expect(situacaoContratado(7500, piso, sug)).toEqual({ tipo: "normal", texto: "50% acima do mínimo" });
    expect(situacaoContratado(0, piso, sug)).toBeNull();
  });
});

describe("tempo de viagem", () => {
  it("80 km/h com parada de 30 min a cada 5h30", () => {
    expect(horasTexto(horasDeViagem(583))).toBe("7h47");
    expect(horasTexto(0)).toBe("—");
  });
});
