import { describe, expect, it } from "vitest";
import { mensagensValidacao, validacao } from "@/lib/validacao";

describe("validacao.cpf", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(validacao.cpf("52998224725")).toBe(true);
    expect(validacao.cpf("529.982.247-25")).toBe(true);
  });
  it("recusa dígito verificador errado", () => {
    expect(validacao.cpf("52998224724")).toBe(false);
    expect(validacao.cpf("52998224715")).toBe(false);
  });
  it("recusa sequência repetida e tamanho errado", () => {
    expect(validacao.cpf("111.111.111-11")).toBe(false);
    expect(validacao.cpf("00000000000")).toBe(false);
    expect(validacao.cpf("5299822472")).toBe(false);
    expect(validacao.cpf("")).toBe(false);
    expect(validacao.cpf(null)).toBe(false);
  });
});

describe("validacao.cnpj", () => {
  it("aceita CNPJ válido, com ou sem máscara", () => {
    expect(validacao.cnpj("11222333000181")).toBe(true);
    expect(validacao.cnpj("11.222.333/0001-81")).toBe(true);
  });
  it("recusa dígito verificador errado, repetido e tamanho errado", () => {
    expect(validacao.cnpj("11222333000180")).toBe(false);
    expect(validacao.cnpj("11111111111111")).toBe(false);
    expect(validacao.cnpj("1122233300018")).toBe(false);
    expect(validacao.cnpj(undefined)).toBe(false);
  });
});

describe("placas", () => {
  it("normalizarPlaca tira símbolos e põe em maiúsculas", () => {
    expect(validacao.normalizarPlaca("abc-1234")).toBe("ABC1234");
    expect(validacao.normalizarPlaca(" rtx 3c58 ")).toBe("RTX3C58");
    expect(validacao.normalizarPlaca(null)).toBe("");
  });
  it("placa aceita ABC1234 e ABC1D23", () => {
    expect(validacao.placa("abc-1234")).toBe(true);
    expect(validacao.placa("ABC1D23")).toBe(true);
  });
  it("placa recusa formatos fora do padrão", () => {
    expect(validacao.placa("AB12345")).toBe(false);
    expect(validacao.placa("ABC12")).toBe(false);
    expect(validacao.placa("ABC1234X")).toBe(false);
    expect(validacao.placa("")).toBe(false);
  });
  it("mercosul só aceita a letra na quinta posição", () => {
    expect(validacao.mercosul("ABC1D23")).toBe(true);
    expect(validacao.mercosul("abc-1d23")).toBe(true);
    expect(validacao.mercosul("ABC1234")).toBe(false);
  });
});

describe("validacao.soDigitos", () => {
  it("mantém só os dígitos", () => {
    expect(validacao.soDigitos("529.982.247-25")).toBe("52998224725");
    expect(validacao.soDigitos(null)).toBe("");
    expect(validacao.soDigitos(123)).toBe("123");
  });
});

describe("mensagensValidacao", () => {
  it("tem os textos do protótipo", () => {
    expect(mensagensValidacao.cpf).toBe(
      "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
    );
    expect(mensagensValidacao.cnpj).toBe(
      "CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.",
    );
    expect(mensagensValidacao.placa).toBe("Placa inválida: use ABC1234 ou ABC1D23.");
  });
});
