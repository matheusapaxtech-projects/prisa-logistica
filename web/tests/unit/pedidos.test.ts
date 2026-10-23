import { describe, expect, it } from "vitest";
import { bloqueioDoCancelamento, esquemaPedido, esquemaViagem, pesoSugerido, situacaoDaViagem } from "@/app/(app)/pedidos/regras";

/** Primeira mensagem do zod para o campo (o que a tela mostra ao lado dele). */
function erroDe(r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) {
  return r.error?.issues.find((i) => i.path[0] === campo)?.message;
}

const ID = (n: number) => `${String(n).repeat(8)}-1111-1111-1111-111111111111`;

describe("esquemaPedido (salvarPedido)", () => {
  const base = {
    tomador_id: ID(1),
    remetente_id: ID(2),
    destinatario_id: ID(3),
    local_coleta_id: ID(4),
    local_descarga_id: ID(5),
    produto: "Soja em grão",
    peso_total_kg: "30.000",
    coleta_prevista: "2026-10-26",
    entrega_prevista: "2026-10-28",
    frete_empresa_valor: "1.234,56",
    frete_empresa_tipo: "por_tonelada",
    observacao: "",
  };

  it('peso "30.000" vira 30000 (número) e o frete "1.234,56" vira 1234.56; origem sempre manual', () => {
    const r = esquemaPedido.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      tomador_id: ID(1),
      remetente_id: ID(2),
      destinatario_id: ID(3),
      local_coleta_id: ID(4),
      local_descarga_id: ID(5),
      produto: "Soja em grão",
      peso_total_kg: 30000,
      coleta_prevista: "2026-10-26",
      entrega_prevista: "2026-10-28",
      frete_empresa_valor: 1234.56,
      frete_empresa_tipo: "por_tonelada",
      frete_empresa_origem: "manual",
      observacao: null,
    });
  });

  it('peso "37.000,5" vira 37000.5', () => {
    const r = esquemaPedido.safeParse({ ...base, peso_total_kg: "37.000,5" });
    expect(r.data?.peso_total_kg).toBe(37000.5);
  });

  it('remetente escolhido sem local → "Escolha o local de coleta"', () => {
    const r = esquemaPedido.safeParse({ ...base, local_coleta_id: "" });
    expect(r.success).toBe(false);
    expect(erroDe(r, "local_coleta_id")).toBe("Escolha o local de coleta");
  });

  it("partes e local de descarga são obrigatórios", () => {
    const r = esquemaPedido.safeParse({ ...base, tomador_id: "", remetente_id: "", destinatario_id: "", local_descarga_id: "" });
    expect(erroDe(r, "tomador_id")).toBe("Escolha o tomador");
    expect(erroDe(r, "remetente_id")).toBe("Escolha o remetente");
    expect(erroDe(r, "destinatario_id")).toBe("Escolha o destinatário");
    expect(erroDe(r, "local_descarga_id")).toBe("Escolha o local de descarga");
  });

  it("peso vazio, zero ou fora do formato pt-BR é recusado", () => {
    expect(erroDe(esquemaPedido.safeParse({ ...base, peso_total_kg: "" }), "peso_total_kg")).toBe("Informe o peso total em kg.");
    expect(erroDe(esquemaPedido.safeParse({ ...base, peso_total_kg: "0" }), "peso_total_kg")).toBe("O peso precisa ser maior que zero.");
    expect(erroDe(esquemaPedido.safeParse({ ...base, peso_total_kg: "1.5" }), "peso_total_kg")).toMatch(/^Use números como/);
    expect(erroDe(esquemaPedido.safeParse({ ...base, peso_total_kg: "30.000,55" }), "peso_total_kg")).toBe("Use no máximo uma casa depois da vírgula.");
  });

  it("frete da empresa obrigatório, com no máximo duas casas", () => {
    expect(erroDe(esquemaPedido.safeParse({ ...base, frete_empresa_valor: "" }), "frete_empresa_valor")).toBe("Informe o frete da empresa.");
    expect(erroDe(esquemaPedido.safeParse({ ...base, frete_empresa_valor: "10,555" }), "frete_empresa_valor")).toBe(
      "Use no máximo duas casas depois da vírgula.",
    );
    expect(esquemaPedido.safeParse({ ...base, frete_empresa_valor: "0" }).success).toBe(true);
  });

  it("tipo do frete: total ou por tonelada", () => {
    expect(esquemaPedido.safeParse({ ...base, frete_empresa_tipo: "total" }).data?.frete_empresa_tipo).toBe("total");
    expect(erroDe(esquemaPedido.safeParse({ ...base, frete_empresa_tipo: "por_km" }), "frete_empresa_tipo")).toBe(
      "Escolha se o frete é por tonelada ou total.",
    );
  });

  it("produto obrigatório; entrega não pode ser antes da coleta; datas vazias viram nulo", () => {
    expect(erroDe(esquemaPedido.safeParse({ ...base, produto: "" }), "produto")).toBe("Informe o produto.");
    expect(erroDe(esquemaPedido.safeParse({ ...base, entrega_prevista: "2026-10-25" }), "entrega_prevista")).toBe(
      "A entrega não pode ser antes da coleta.",
    );
    const r = esquemaPedido.safeParse({ ...base, coleta_prevista: "", entrega_prevista: "" });
    expect(r.data).toMatchObject({ coleta_prevista: null, entrega_prevista: null });
  });
});

describe("pesoSugerido (Nova viagem)", () => {
  it("capacidade 37 t e saldo 30000 → 30000", () => {
    expect(pesoSugerido(30000, 37)).toBe(30000);
  });
  it("capacidade 25 t → 25000", () => {
    expect(pesoSugerido(30000, 25)).toBe(25000);
  });
  it("capacidade nula → saldo", () => {
    expect(pesoSugerido(30000, null)).toBe(30000);
  });
  it("capacidade zero (conjunto sem carreta com capacidade) conta como desconhecida", () => {
    expect(pesoSugerido(30000, 0)).toBe(30000);
  });
  it("saldo zerado ou negativo → 0", () => {
    expect(pesoSugerido(0, 25)).toBe(0);
    expect(pesoSugerido(-500, 25)).toBe(0);
  });
});

describe("esquemaViagem (criarViagem)", () => {
  const base = { pedido_id: ID(1), conjunto_id: ID(2), peso_previsto_kg: "25.000", frete_motorista_valor: "", frete_motorista_tipo: "por_tonelada" };

  it('peso "25.000" vira 25000; sem frete do motorista, valor e tipo ficam nulos', () => {
    const r = esquemaViagem.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      pedido_id: ID(1),
      conjunto_id: ID(2),
      peso_previsto_kg: 25000,
      frete_motorista_valor: null,
      frete_motorista_tipo: null,
    });
  });

  it("com frete do motorista, grava valor e tipo", () => {
    const r = esquemaViagem.safeParse({ ...base, frete_motorista_valor: "180,50", frete_motorista_tipo: "total" });
    expect(r.data).toMatchObject({ frete_motorista_valor: 180.5, frete_motorista_tipo: "total" });
  });

  it("conjunto e peso são obrigatórios", () => {
    const r = esquemaViagem.safeParse({ ...base, conjunto_id: "", peso_previsto_kg: "" });
    expect(erroDe(r, "conjunto_id")).toBe("Escolha o conjunto");
    expect(erroDe(r, "peso_previsto_kg")).toBe("Informe o peso previsto em kg.");
  });
});

describe("situacaoDaViagem (coluna na ficha do pedido)", () => {
  it("cancelada vence a coluna; sem coluna é Planejada; senão o nome da coluna do Quadro", () => {
    expect(situacaoDaViagem({ status_campo: null, cancelada_em: "2026-10-23T10:00:00Z" })).toBe("Cancelada");
    expect(situacaoDaViagem({ status_campo: null, cancelada_em: null })).toBe("Planejada");
    expect(situacaoDaViagem({ status_campo: "aguardando_nf_pagamento", cancelada_em: null })).toBe("Aguardando NF e pagamento");
  });
});

describe("bloqueioDoCancelamento (cancelarPedido, Ruling R4)", () => {
  const v = (numero: number, status_campo: Parameters<typeof situacaoDaViagem>[0]["status_campo"], cancelada_em: string | null = null) => ({
    numero,
    status_campo,
    cancelada_em,
  });

  it("sem viagens, ou só canceladas → pode cancelar", () => {
    expect(bloqueioDoCancelamento([])).toBeNull();
    expect(bloqueioDoCancelamento([v(7, null, "2026-10-23T10:00:00Z")])).toBeNull();
  });

  it("viagem já iniciada impede, dizendo o número e a coluna", () => {
    expect(bloqueioDoCancelamento([v(3, null), v(4, "em_rota")])).toBe(
      'O pedido não pode ser cancelado: a viagem #4 já começou (está em "Em rota").',
    );
  });

  it("viagem planejada impede até ser cancelada na ficha dela", () => {
    expect(bloqueioDoCancelamento([v(5, null)])).toBe("O pedido tem a viagem #5 planejada. Cancele a viagem na ficha dela e depois cancele o pedido.");
    expect(bloqueioDoCancelamento([v(9, null), v(8, null), v(2, null, "2026-10-23T10:00:00Z")])).toBe(
      "O pedido tem 2 viagens planejadas (#8, #9). Cancele as viagens nas fichas delas e depois cancele o pedido.",
    );
  });
});
