import { afterEach, describe, expect, it, vi } from "vitest";
import { formato, lerNumeroBr, mascaras } from "@/lib/formato";

describe("formato de documentos", () => {
  it("cpf formata 11 dígitos e devolve o resto como veio", () => {
    expect(formato.cpf("52998224725")).toBe("529.982.247-25");
    expect(formato.cpf("123")).toBe("123");
    expect(formato.cpf(null)).toBe("");
  });
  it("cnpj formata 14 dígitos", () => {
    expect(formato.cnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formato.cnpj(undefined)).toBe("");
  });
  it("doc escolhe CPF ou CNPJ pelo tipo da pessoa", () => {
    expect(formato.doc({ tipo: "pf", cpf: "52998224725", cnpj: null })).toBe("529.982.247-25");
    expect(formato.doc({ tipo: "pj", cpf: null, cnpj: "11222333000181" })).toBe("11.222.333/0001-81");
  });
  it("telefone formata 10 e 11 dígitos", () => {
    expect(formato.telefone("43998765432")).toBe("(43) 99876-5432");
    expect(formato.telefone("4333445566")).toBe("(43) 3344-5566");
    expect(formato.telefone("998")).toBe("998");
  });
  it("cep formata 8 dígitos", () => {
    expect(formato.cep("86800000")).toBe("86800-000");
    expect(formato.cep("868")).toBe("868");
  });
});

describe("formato de datas", () => {
  it("data converte ISO em dd/mm/aaaa e usa travessão quando vazio", () => {
    expect(formato.data("2026-10-23")).toBe("23/10/2026");
    expect(formato.data("2026-10-23T14:05:00Z")).toBe("23/10/2026");
    expect(formato.data(null)).toBe("—");
    expect(formato.data("")).toBe("—");
  });
  it("dataHora mostra o horário de Brasília, seja qual for o fuso do runtime", () => {
    expect(formato.dataHora("2026-10-23T17:05:00Z")).toBe("23/10/2026 14:05");
    // 02:30 UTC ainda é o dia anterior em Brasília; 03:05 UTC é meia-noite (sem "24:05").
    expect(formato.dataHora("2026-10-24T02:30:00Z")).toBe("23/10/2026 23:30");
    expect(formato.dataHora("2026-10-24T03:05:00Z")).toBe("24/10/2026 00:05");
    expect(formato.dataHora("2026-10-23T17:05:00-03:00")).toBe("23/10/2026 17:05");
  });
});

describe("formato.relativo", () => {
  afterEach(() => vi.useRealTimers());
  const agora = new Date("2026-10-23T12:00:00Z");
  const antes = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  it("agora, minutos, horas, ontem e dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    expect(formato.relativo(antes(10_000))).toBe("agora");
    expect(formato.relativo(antes(5 * 60_000))).toBe("há 5 min");
    expect(formato.relativo(antes(3 * 3_600_000))).toBe("há 3 h");
    expect(formato.relativo(antes(24 * 3_600_000))).toBe("ontem");
    expect(formato.relativo(antes(5 * 24 * 3_600_000))).toBe("há 5 dias");
  });
});

describe("formato de números", () => {
  it("t usa vírgula, uma casa e o sufixo t", () => {
    expect(formato.t(37.2)).toBe("37,2 t");
    expect(formato.t(45)).toBe("45,0 t");
    expect(formato.t(null)).toBe("—");
    expect(formato.t(undefined)).toBe("—");
  });
  it("m usa duas casas", () => {
    expect(formato.m(14.6)).toBe("14,60 m");
    expect(formato.m(null)).toBe("—");
  });
  it("kb escolhe kB ou MB", () => {
    expect(formato.kb(412000)).toBe("412 kB");
    expect(formato.kb(1830000)).toBe("1,8 MB");
  });
  it("dias descreve o prazo", () => {
    expect(formato.dias(0)).toBe("vence hoje");
    expect(formato.dias(1)).toBe("vence amanhã");
    expect(formato.dias(18)).toBe("vence em 18 dias");
    expect(formato.dias(-1)).toBe("venceu ontem");
    expect(formato.dias(-6)).toBe("venceu há 6 dias");
  });
  it("kg agrupa o milhar com ponto e mostra até uma casa", () => {
    expect(formato.kg(30000)).toBe("30.000 kg");
    expect(formato.kg(37000.5)).toBe("37.000,5 kg");
    expect(formato.kg(null)).toBe("—");
  });
  it("reais usa duas casas e o prefixo R$", () => {
    expect(formato.reais(1234.56)).toBe("R$ 1.234,56");
    expect(formato.reais(150)).toBe("R$ 150,00");
    expect(formato.reais(null)).toBe("—");
  });
  it("numeroCampo devolve o texto que o campo aceita de volta", () => {
    expect(formato.numeroCampo(30000)).toBe("30.000");
    expect(formato.numeroCampo(37000.5)).toBe("37.000,5");
    expect(formato.numeroCampo(1234.56, 2)).toBe("1.234,56");
    expect(formato.numeroCampo(null)).toBe("");
  });
});

describe("lerNumeroBr (pesos e dinheiro digitados em pt-BR)", () => {
  it("ponto é milhar e vírgula é decimal", () => {
    expect(lerNumeroBr("30.000")).toBe(30000);
    expect(lerNumeroBr("37.000,5")).toBe(37000.5);
    expect(lerNumeroBr("1.234,56")).toBe(1234.56);
    expect(lerNumeroBr("1.234.567,8")).toBe(1234567.8);
  });
  it("aceita sem separador de milhar, com espaços e com R$", () => {
    expect(lerNumeroBr("30000")).toBe(30000);
    expect(lerNumeroBr("37,5")).toBe(37.5);
    expect(lerNumeroBr(" 25.000 ")).toBe(25000);
    expect(lerNumeroBr("R$ 1.234,56")).toBe(1234.56);
  });
  it("vazio é null", () => {
    expect(lerNumeroBr("")).toBeNull();
    expect(lerNumeroBr("   ")).toBeNull();
    expect(lerNumeroBr(undefined)).toBeNull();
    expect(lerNumeroBr(null)).toBeNull();
  });
  it("o que não é número em pt-BR é NaN (nunca adivinha)", () => {
    expect(lerNumeroBr("1.5")).toBeNaN();
    expect(lerNumeroBr("37.0000")).toBeNaN();
    expect(lerNumeroBr("1,234.56")).toBeNaN();
    expect(lerNumeroBr("abc")).toBeNaN();
    expect(lerNumeroBr("-3")).toBeNaN();
    expect(lerNumeroBr("3,")).toBeNaN();
  });
});

describe("mascaras", () => {
  it("cpf aplica a máscara conforme digita", () => {
    expect(mascaras.cpf("529")).toBe("529");
    expect(mascaras.cpf("5299")).toBe("529.9");
    expect(mascaras.cpf("529982")).toBe("529.982");
    expect(mascaras.cpf("5299822")).toBe("529.982.2");
    expect(mascaras.cpf("52998224725")).toBe("529.982.247-25");
    expect(mascaras.cpf("5299822472599")).toBe("529.982.247-25");
  });
  it("cnpj aplica a máscara conforme digita", () => {
    expect(mascaras.cnpj("11")).toBe("11");
    expect(mascaras.cnpj("112")).toBe("11.2");
    expect(mascaras.cnpj("11222333")).toBe("11.222.333");
    expect(mascaras.cnpj("112223330001")).toBe("11.222.333/0001");
    expect(mascaras.cnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("telefone vale para 10 e 11 dígitos e não deixa sobra de pontuação", () => {
    expect(mascaras.telefone("43")).toBe("43");
    expect(mascaras.telefone("439987")).toBe("(43) 9987");
    expect(mascaras.telefone("4333445566")).toBe("(43) 3344-5566");
    expect(mascaras.telefone("43998765432")).toBe("(43) 99876-5432");
    expect(mascaras.telefone("439987654329999")).toBe("(43) 99876-5432");
  });
  it("cep, placa e dígitos", () => {
    expect(mascaras.cep("868")).toBe("868");
    expect(mascaras.cep("868000001")).toBe("86800-000");
    expect(mascaras.placa("abc-1d23x")).toBe("ABC1D23");
    expect(mascaras.digitos("12")).toBe("12");
  });
});
