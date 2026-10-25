import { describe, expect, it } from "vitest";
import { textoQuebra, verificarQuebra } from "@/lib/motor/quebra";
import casos from "./casos.json";

/* Casos do motor de despacho (prisa-motor-despacho.zip, test/casos.json). */

describe("verificarQuebra (casos do motor)", () => {
  it.each(casos.verificarQuebra.map((c, i) => [i, c] as const))("caso %i", (_i, c) => {
    expect(verificarQuebra(c.entrada.origem, c.entrada.destino, c.entrada.tolerancia)).toEqual(c.saida);
  });
});

describe("textoQuebra", () => {
  it("quebra acima, sobra dentro e sem diferença", () => {
    expect(textoQuebra(verificarQuebra(32, 31.74, 0.3), 0.3)).toBe("Quebra de 0,260 t (0,81%), acima da tolerância de 0,30%.");
    expect(textoQuebra(verificarQuebra(32, 32.05, 0.3), 0.3)).toBe("Sobra de 0,050 t (0,16%), dentro da tolerância de 0,30%.");
    expect(textoQuebra(verificarQuebra(32, 32, 0.3), 0.3)).toBe("Sem diferença entre o peso de saída e o de chegada.");
  });
});
