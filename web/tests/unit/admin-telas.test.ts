import { describe, expect, it } from "vitest";
import { chaveDia, diasEntre, hora, rotuloDia } from "@/app/(app)/auditoria/dias";
import { lerFiltros, montarBusca, PASSO } from "@/app/(app)/auditoria/filtros";
import { objetoDe } from "@/app/(app)/auditoria/eventos";
import { situacao } from "@/app/(app)/usuarios/papeis";

describe("auditoria: dia de São Paulo", () => {
  it("22h de Brasília ainda é o mesmo dia (02h UTC do dia seguinte)", () => {
    expect(chaveDia("2026-10-24T01:30:00Z")).toBe("2026-10-23");
    expect(hora("2026-10-24T01:30:00Z")).toBe("22:30");
    expect(chaveDia("2026-10-23T03:00:00Z")).toBe("2026-10-23");
    expect(chaveDia("2026-10-23T02:59:00Z")).toBe("2026-10-22");
  });

  it("rótulos Hoje, Ontem e dia da semana", () => {
    const agora = new Date("2026-10-23T15:00:00Z");
    expect(rotuloDia("2026-10-23T10:00:00Z", agora)).toBe("Hoje");
    expect(rotuloDia("2026-10-22T20:00:00Z", agora)).toBe("Ontem");
    expect(rotuloDia("2026-10-21T20:00:00Z", agora)).toBe("Quarta-feira, 21 de outubro");
    expect(diasEntre(agora, "2026-10-17T12:00:00Z")).toBe(6);
  });
});

describe("auditoria: filtros na URL", () => {
  it("lê, descarta o inválido e converte ?tabela=", () => {
    expect(lerFiltros({ acao: "update", tipo: "veiculo" })).toMatchObject({ acao: "update", tipo: "veiculo", usuario: "" });
    expect(lerFiltros({ acao: "drop table", tipo: "x", usuario: "nao-e-uuid", registro: "a;b" })).toEqual({
      usuario: "",
      tipo: "",
      acao: "",
      registro: "",
      limite: PASSO,
    });
    expect(lerFiltros({ tabela: "pessoa_telefone" }).tipo).toBe("pessoa");
    expect(lerFiltros({ usuario: "sistema" }).usuario).toBe("sistema");
    expect(lerFiltros({ limite: "9999" }).limite).toBe(500);
  });

  it("monta a busca só com o preenchido", () => {
    expect(montarBusca({})).toBe("");
    expect(montarBusca({ acao: "update", tipo: "pessoa", limite: PASSO })).toBe("?tipo=pessoa&acao=update");
    expect(montarBusca({ acao: "update", limite: 100 })).toBe("?acao=update&limite=100");
  });
});

describe("auditoria: objeto do verbo vem de lib/auditoria", () => {
  it("usa os mesmos textos do resumo", () => {
    expect(objetoDe("pessoa")).toBe("a pessoa");
    expect(objetoDe("veiculo")).toBe("o veículo");
    expect(objetoDe("perfil_usuario")).toBe("o perfil de usuário");
    expect(objetoDe("arquivo")).toBe("o arquivo");
  });
});

describe("usuários: situação", () => {
  it("sem papel espera acesso; com papel depende de ativo", () => {
    expect(situacao({ papel: null, ativo: false })).toBe("sem_acesso");
    expect(situacao({ papel: "leitura", ativo: true })).toBe("ativo");
    expect(situacao({ papel: "leitura", ativo: false })).toBe("desativado");
  });
});
