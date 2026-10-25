import { describe, expect, it } from "vitest";
import { lerFrete, lerResultado, porcento, sinalDaFaixa, situacaoDoPiso } from "@/lib/frete";

// Formato de frete_da_viagem / resultado_cte_da_viagem (migration 20261027000100); números chegam como
// número ou texto (numeric do Postgres).
const jsonFrete = {
  peso_t: 37,
  frete_empresa: 5550,
  frete_motorista: "8200.00",
  km: 990,
  pedagio: 155.6,
  eixos: 6,
  tipo_carga: "granel_solido",
  tipo_carga_rotulo: "Granel sólido",
  uf_origem: "PR",
  uf_destino: "MS",
  contratado_pf: false,
  frota_propria: false,
  dia: "2026-10-24",
  piso: 8168.47,
  piso_eixos_tabela: 6,
  piso_portaria: "Portaria SUROC/ANTT nº 22/2026",
  piso_vigencia: "2026-09-30",
  abaixo_do_piso: false,
};

describe("lerFrete", () => {
  it("lê o jsonb do banco e converte numeric em número", () => {
    const f = lerFrete(jsonFrete);
    expect(f).toMatchObject({ freteMotorista: 8200, km: 990, piso: 8168.47, eixos: 6, ufOrigem: "PR", abaixoDoPiso: false });
  });

  it("nulo (viagem que não existe) vira null; campos nulos ficam nulos", () => {
    expect(lerFrete(null)).toBeNull();
    expect(lerFrete({ ...jsonFrete, km: null, piso: null })).toMatchObject({ km: null, piso: null });
  });
});

describe("situacaoDoPiso (mesma ordem da aptidão do banco)", () => {
  const f = lerFrete(jsonFrete)!;
  it("acima e abaixo do piso", () => {
    expect(situacaoDoPiso(f)).toEqual({ tipo: "normal", texto: "Acima do piso" });
    expect(situacaoDoPiso({ ...f, abaixoDoPiso: true })).toEqual({ tipo: "bloqueado", texto: "Abaixo do piso" });
  });
  it("frota própria, sem frete, sem km e sem tabela", () => {
    expect(situacaoDoPiso({ ...f, frotaPropria: true, freteMotorista: null }).texto).toBe("Frota própria: sem piso");
    expect(situacaoDoPiso({ ...f, freteMotorista: null }).texto).toBe("Sem frete do motorista");
    expect(situacaoDoPiso({ ...f, km: null, piso: null }).texto).toBe("Sem km da viagem");
    expect(situacaoDoPiso({ ...f, piso: null }).tipo).toBe("vencendo");
  });
});

describe("lerResultado e faixas", () => {
  it("lê o resultado do CT-e; sem resultado (frota própria) é null", () => {
    const r = lerResultado({ ...jsonFrete, resultado: { icms: 377.66, resultado: "945.15", margem_liquida: 0.0835, faixa: "Abaixo do mínimo" } });
    expect(r).toMatchObject({ icms: 377.66, resultado: 945.15, margemLiquida: 0.0835, faixa: "Abaixo do mínimo" });
    expect(lerResultado({ ...jsonFrete, resultado: null })).toBeNull();
  });

  it("faixa → sinal", () => {
    expect(sinalDaFaixa("Prejuízo")).toBe("bloqueado");
    expect(sinalDaFaixa("Abaixo do mínimo")).toBe("bloqueado");
    expect(sinalDaFaixa("Mínimo aceitável")).toBe("vencendo");
    expect(sinalDaFaixa("Ideal")).toBe("normal");
  });

  it("porcento em pt-BR", () => {
    expect(porcento(0.0835)).toBe("8,35%");
    expect(porcento(0.07)).toBe("7%");
  });
});
