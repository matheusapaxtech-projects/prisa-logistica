import { describe, expect, it } from "vitest";
import { atrasoPrevisto, previsaoDeChegada, sugerirRetornos, type CargaAberta } from "@/lib/motor/retorno";

/* O cenário de frete de retorno de test/motor.test.ts do motor de despacho: viagem descarregando em Rio
   Verde/GO, saída de Mandaguari/PR. */

describe("sugerirRetornos (cenário do motor)", () => {
  const viagem = {
    destino: { lat: -17.79, lon: -50.92, uf: "GO" },
    origemIda: { lat: -23.54, lon: -51.67, uf: "PR" },
    previsaoChegada: "2026-10-27T12:00:00Z",
    capacidadeT: 38,
  };
  const perto: CargaAberta = { id: "R1", origem: { lat: -17.88, lon: -51.72, uf: "GO" }, destino: { lat: -23.42, lon: -51.93, uf: "PR" }, pesoT: 37, embarqueEm: "2026-10-28T06:00:00Z" };
  const longe: CargaAberta = { id: "R2", origem: { lat: -16.69, lon: -49.26, uf: "GO" }, destino: { lat: -15.78, lon: -47.93, uf: "DF" }, pesoT: 37, embarqueEm: "2026-10-28T06:00:00Z" };
  const cedo: CargaAberta = { ...perto, id: "R3", embarqueEm: "2026-10-27T08:00:00Z" };

  it("sugere primeiro a carga perto do destino que volta para a base", () => {
    const s = sugerirRetornos(viagem, [longe, perto, cedo]);
    expect(s[0].carga.id).toBe("R1");
    expect(s.some((x) => x.carga.id === "R3")).toBe(false); // embarque antes de ele descarregar
    expect(s[0].kmRetornoAteBase).toBeLessThan(50);
    expect(s[0].motivos[1]).toBe("o retorno termina perto da base do motorista");
  });
});

describe("previsão de chegada", () => {
  it("755 km: 12h35 dirigindo + 2 pausas de 30 min", () => {
    expect(previsaoDeChegada("2026-10-26T10:00:00Z", 755)).toBe("2026-10-26T23:35:00.000Z");
  });
  it("viagem longa ganha pernoite de 11 h a cada 13 h dirigindo", () => {
    // 1.200 km = 20 h dirigindo + 3 pausas (1h30) + 1 pernoite (11 h) = 32h30
    expect(previsaoDeChegada("2026-10-26T10:00:00Z", 1200)).toBe("2026-10-27T18:30:00.000Z");
  });
  it("sem km não há previsão; atraso contra o fim do dia da entrega", () => {
    expect(previsaoDeChegada("2026-10-26T10:00:00Z", 0)).toBeNull();
    expect(atrasoPrevisto("2026-10-27T23:00:00Z", "2026-10-27")).toBe(2);
    expect(atrasoPrevisto("2026-10-27T15:00:00Z", "2026-10-27")).toBe(-6);
    expect(atrasoPrevisto("2026-10-27T15:00:00Z", null)).toBeNull();
  });
});
