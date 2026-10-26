import { describe, expect, it } from "vitest";
import {
  agrupar,
  diasEntre,
  ehForma,
  estadoVencimento,
  rotuloForma,
  simularAntecipacao,
  fraseRetencao,
  sinalAprovacao,
  sinalReceber,
  somarValores,
} from "@/lib/contas";

describe("somarValores", () => {
  it("soma em centavos", () => {
    expect(somarValores([{ valor: 0.1 }, { valor: 0.2 }])).toBe(0.3);
    expect(somarValores([])).toBe(0);
  });
});

describe("agrupar", () => {
  it("agrupa na ordem do id com o subtotal", () => {
    const g = agrupar(
      [
        { valor: 10.1, c: "03.08" },
        { valor: 5, c: "01.01" },
        { valor: 0.2, c: "03.08" },
      ],
      (x) => ({ id: x.c, rotulo: `Centro ${x.c}` }),
    );
    expect(g.map((x) => [x.id, x.total, x.itens.length])).toEqual([
      ["01.01", 5, 1],
      ["03.08", 10.3, 2],
    ]);
  });
});

describe("datas e situações", () => {
  it("conta os dias entre datas", () => {
    expect(diasEntre("2026-10-26", "2026-10-26")).toBe(0);
    expect(diasEntre("2026-10-26", "2026-10-27")).toBe(1);
    expect(diasEntre("2026-10-26", "2026-10-20")).toBe(-6);
  });

  it("vencimento: vencida, vence em até 7 dias, normal; fechada não tem prazo", () => {
    expect(estadoVencimento("2026-10-25", "2026-10-26", true).estado).toBe("vencida");
    expect(estadoVencimento("2026-11-02", "2026-10-26", true).estado).toBe("vencendo");
    expect(estadoVencimento("2026-11-03", "2026-10-26", true).estado).toBe("normal");
    expect(estadoVencimento("2026-10-01", "2026-10-26", false).estado).toBe("neutro");
  });

  it("aprovação: cancelada, paga, aprovada ou falta aprovar", () => {
    const base = { canceladoEm: null, pagoEm: null, aprovadoEm: null };
    expect(sinalAprovacao(base)).toEqual({ tipo: "pendente", texto: "Falta aprovar" });
    expect(sinalAprovacao({ ...base, aprovadoEm: "2026-10-26T10:00:00Z" }).texto).toBe("Aprovada");
    expect(sinalAprovacao({ ...base, aprovadoEm: "x", pagoEm: "2026-10-26" }).texto).toBe("Paga");
    expect(sinalAprovacao({ ...base, canceladoEm: "x" }).tipo).toBe("neutro");
    expect(sinalReceber("vencida").tipo).toBe("bloqueado");
  });

  it("aprovação: conta vencida sem aprovação mostra também que venceu", () => {
    const base = { canceladoEm: null, pagoEm: null, aprovadoEm: null };
    expect(sinalAprovacao(base, -3)).toEqual({ tipo: "pendente", texto: "Falta aprovar · venceu há 3 dias" });
    expect(sinalAprovacao(base, -1).texto).toBe("Falta aprovar · venceu ontem");
    expect(sinalAprovacao(base, 0).texto).toBe("Falta aprovar");
    expect(sinalAprovacao(base, 4).texto).toBe("Falta aprovar");
    expect(sinalAprovacao(base, null).texto).toBe("Falta aprovar");
    // aprovada, paga ou cancelada não repetem o atraso
    expect(sinalAprovacao({ ...base, aprovadoEm: "x" }, -3).texto).toBe("Aprovada");
  });

  it("aprovação: parcela cancelada pelo NILT diz quem cancelou", () => {
    const base = { canceladoEm: "2026-10-26T10:00:00Z", pagoEm: null, aprovadoEm: null };
    expect(sinalAprovacao({ ...base, canceladoAutomatico: true })).toEqual({ tipo: "neutro", texto: "Cancelada pelo NILT" });
    expect(sinalAprovacao({ ...base, canceladoAutomatico: false }).texto).toBe("Cancelada");
  });

  it("retenção do autônomo em uma frase", () => {
    expect(fraseRetencao(270)).toBe("Já descontadas as retenções do autônomo (INSS, SEST e SENAT): R$ 270,00");
  });

  it("formas de pagamento", () => {
    expect(rotuloForma("cartao_frete")).toBe("Cartão-frete");
    expect(ehForma("pix")).toBe(true);
    expect(ehForma("cheque")).toBe(false);
  });
});

describe("simularAntecipacao", () => {
  it("deságio simples, tarifa por título e custo efetivo", () => {
    const s = simularAntecipacao([{ id: "a", valor: 10000, vencimento: "2026-11-25" }], 2, 5, "2026-10-26");
    expect(s.linhas[0]).toEqual({ id: "a", valor: 10000, dias: 30, desagio: 200, tarifa: 5, liquido: 9795 });
    expect(s.liquido).toBe(9795);
    expect(s.prazoMedio).toBe(30);
    expect(s.custoEfetivoMesPct).toBeCloseTo(2.0929, 3);
  });

  it("prazo médio ponderado pelo valor e título vencendo hoje sem deságio", () => {
    const s = simularAntecipacao(
      [
        { id: "a", valor: 1000, vencimento: "2026-10-26" },
        { id: "b", valor: 3000, vencimento: "2026-11-25" },
      ],
      3,
      0,
      "2026-10-26",
    );
    expect(s.linhas[0].desagio).toBe(0);
    expect(s.desagio).toBe(90);
    expect(s.prazoMedio).toBe(22.5);
    expect(s.bruto).toBe(4000);
  });

  it("sem títulos: zeros e sem custo efetivo", () => {
    const s = simularAntecipacao([], 2, 5, "2026-10-26");
    expect([s.bruto, s.liquido, s.prazoMedio]).toEqual([0, 0, 0]);
    expect(s.custoEfetivoMesPct).toBeNull();
  });
});
