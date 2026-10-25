import { describe, expect, it } from "vitest";
import { comporLote, rankearMotoristas, type CargaDespacho, type Disponibilidade, type MotoristaDespacho } from "@/lib/motor/despacho";
import type { Coeficiente } from "@/lib/calculadora/regras";

/* O cenário de test/motor.test.ts do motor de despacho: lote de 150 t de Mandaguari/PR para Bonito/MS
   (755 km, pedágio R$ 0,029 por eixo/km), 13 motoristas em volta. */

const P = "Portaria SUROC/ANTT nº 22/2026";
const TABELA: Coeficiente[] = [
  [5, 6.8548, 664.83],
  [6, 7.5641, 680.01],
  [7, 8.2316, 820.34],
  [9, 9.4318, 908.91],
].map(([eixos, ccd, cc]) => ({ tipo: "granel_solido" as const, eixos, ccd, cc, portaria: P }));

const agora = new Date("2026-10-26T12:00:00Z");
const carga: CargaDespacho = {
  origem: { lat: -23.54, lon: -51.67, uf: "PR", cidade: "Mandaguari" },
  destino: { lat: -21.13, lon: -56.48, uf: "MS", cidade: "Bonito" },
  pesoT: 150,
  tipo: "granel_solido",
  embarqueEm: "2026-10-26T20:00:00Z",
  fretePorT: 297.6,
  kmViagem: 755,
  pedagioEixoKm: 0.029,
};
const mot = (id: string, eixos: number, cap: number, extra: Partial<MotoristaDespacho> = {}): MotoristaDespacho => ({
  id,
  nome: id,
  conjuntoId: `c-${id}`,
  placaCavalo: id,
  tipo: "PJ",
  eixos,
  capacidadeT: cap,
  rntrc: "123",
  cnhValidade: null,
  viagensPrisa: 2,
  ocorrencias: 0,
  ...extra,
});
const disp = (id: string, lat: number, lon: number, horasAtras: number): Disponibilidade => ({
  motoristaId: id,
  posicao: { lat, lon, uf: "PR" },
  em: new Date(agora.getTime() - horasAtras * 36e5).toISOString(),
});

const frota = [
  mot("A9", 9, 50), mot("B9", 9, 50), mot("C9", 9, 50, { tipo: "PF" }), mot("D6", 6, 32), mot("E6", 6, 32), mot("F6", 6, 32),
  mot("G6", 6, 32), mot("H6", 6, 32), mot("I5", 5, 26), mot("J5", 5, 26), mot("K7", 7, 38, { rntrc: "" }),
  mot("L7", 7, 38, { bloqueio: "Bloqueado pela operação" }), mot("M7", 7, 38),
];
const disps = [
  disp("A9", -23.55, -51.46, 1), disp("B9", -23.42, -51.93, 3), disp("C9", -23.3, -51.17, 2), disp("D6", -23.54, -51.67, 0.5),
  disp("E6", -23.55, -51.46, 1), disp("F6", -23.42, -51.93, 2), disp("G6", -23.3, -51.17, 4), disp("H6", -25.42, -49.26, 1),
  disp("I5", -23.54, -51.67, 1), disp("J5", -23.55, -51.46, 30), disp("K7", -23.55, -51.46, 1), disp("L7", -23.55, -51.46, 1),
  disp("M7", -15.6, -56.1, 1),
];

describe("rankearMotoristas (cenário do motor)", () => {
  const { candidatos, descartados } = rankearMotoristas(carga, frota, disps, TABELA, agora);
  const motivo = (id: string) => descartados.find((d) => d.motorista.id === id)?.motivo;

  it("filtra e explica cada descarte", () => {
    expect(motivo("J5")).toMatch(/Disponibilidade de 30 h/);
    expect(motivo("K7")).toBe("RNTRC não informado");
    expect(motivo("L7")).toBe("Bloqueado pela operação");
    expect(motivo("M7")).toMatch(/raio/);
    expect(motivo("H6")).toMatch(/raio/); // Curitiba, ~450 km
    expect(candidatos.some((c) => ["J5", "K7", "L7", "M7", "H6"].includes(c.motorista.id))).toBe(false);
  });

  it("ordena pela nota e dá cinco motivos", () => {
    for (let i = 1; i < candidatos.length; i++) expect(candidatos[i - 1].score).toBeGreaterThanOrEqual(candidatos[i].score);
    expect(candidatos[0].motivos).toHaveLength(5);
  });

  it("sem disponibilidade ou vencida não entra", () => {
    const r = rankearMotoristas(carga, [mot("Z9", 9, 50), mot("Y9", 9, 50)], [{ ...disp("Y9", -23.55, -51.46, 1), livreAte: "2026-10-26T11:00:00Z" }], TABELA, agora);
    expect(r.descartados.map((d) => d.motivo)).toEqual(["Sem disponibilidade registrada", "Disponibilidade vencida"]);
  });
});

describe("comporLote (cenário do motor)", () => {
  const { candidatos } = rankearMotoristas(carga, frota, disps, TABELA, agora);

  it("150 t: escolhe a composição mais barata, três de 9 eixos", () => {
    const c = comporLote(carga, candidatos);
    expect(c.caminhoes).toHaveLength(3);
    expect(c.caminhoes.every((x) => x.candidato.motorista.eixos === 9)).toBe(true);
    expect(c.pesoAlocadoT).toBe(150);
    expect(c.faltaT).toBe(0);
    expect(Math.round(c.custoMotoristaPedagio)).toBe(24681); // 3 × (piso 8.029,92 + pedágio 197,06)
    const so6 = comporLote(carga, candidatos.filter((x) => x.motorista.eixos === 6));
    expect(c.custoPorT).toBeLessThan(so6.custoPorT - 35);
    expect(so6.faltaT).toBeGreaterThan(0);
  });

  it("frete 5% acima do piso: R$ 8.432 por caminhão e R$ 172,58/t de motorista e pedágio", () => {
    const c = comporLote({ ...carga, fretePorT: 287.6 }, candidatos, { acimaDoPiso: 0.05 });
    expect(c.caminhoes.map((x) => x.freteMotorista)).toEqual([8432, 8432, 8432]);
    expect(Math.round(c.custoPorT * 100) / 100).toBe(172.58);
    expect(c.observacoes).toContain("Frete do motorista 5% acima do piso da ANTT.");
  });

  it("lote que não fecha avisa o que falta", () => {
    const grande = { ...carga, pesoT: 1000 };
    const c = comporLote(grande, rankearMotoristas(grande, frota, disps, TABELA, agora).candidatos);
    expect(c.faltaT).toBeGreaterThan(0);
    expect(c.observacoes.some((o) => o.includes("não fecham o lote"))).toBe(true);
  });
});
