import { describe, expect, it } from "vitest";
import { lerCentroNovo, lerFiltro, lerNome, montarArvore, validarCodigo, type CentroLinha } from "@/app/(app)/centros-de-custo/regras";

// Regras puras da tela de centros de custo: o código ("00" ou "00.00"), o nome e a árvore da lista.

describe("validarCodigo", () => {
  it.each(["01.05", "99", "00.00"])("aceita %s", (c) => {
    expect(validarCodigo(c, ["01", "00"])).toMatchObject({ ok: true, codigo: c });
  });

  it.each(["1.5", "001", "01.5", "1", "ab", "01.005", "01,05", "01.", ""])("recusa %j com a frase do formato", (c) => {
    const r = validarCodigo(c, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/dois dígitos/);
  });

  it("tira as pontas em branco", () => {
    expect(validarCodigo(" 07 ", [])).toMatchObject({ ok: true, codigo: "07", subdepartamento: false });
  });

  it("subdepartamento exige o departamento na lista", () => {
    expect(validarCodigo("07.01", ["01", "02"])).toEqual({ ok: false, erro: "Crie primeiro o departamento 07." });
    expect(validarCodigo("07.01", ["07"])).toMatchObject({ ok: true, codigo: "07.01", subdepartamento: true });
  });

  it("recusa código que já existe", () => {
    expect(validarCodigo("07", ["07"])).toEqual({ ok: false, erro: "Já existe um centro de custo com o código 07." });
  });
});

describe("lerNome", () => {
  it("corta as pontas e aceita de 1 a 80 caracteres", () => {
    expect(lerNome("  Oficina ")).toEqual({ ok: true, nome: "Oficina" });
    expect(lerNome("a".repeat(80)).ok).toBe(true);
  });
  it("recusa vazio e acima de 80", () => {
    expect(lerNome("   ")).toEqual({ ok: false, erro: "Digite o nome do centro de custo." });
    expect(lerNome("a".repeat(81))).toEqual({ ok: false, erro: "Use até 80 caracteres no nome." });
  });
});

describe("lerCentroNovo", () => {
  const form = (codigo: string, nome: string) => {
    const f = new FormData();
    f.set("codigo", codigo);
    f.set("nome", nome);
    return f;
  };
  it("junta código e nome, ou devolve o erro de cada campo", () => {
    expect(lerCentroNovo(form("01.05", "Pneus"), ["01"])).toEqual({ ok: true, dados: { codigo: "01.05", nome: "Pneus" } });
    expect(lerCentroNovo(form("1.5", ""), [])).toMatchObject({ ok: false, erros: { codigo: expect.any(String), nome: expect.any(String) } });
  });
});

describe("montarArvore", () => {
  const c = (id: number, codigo: string, nome: string, ativo = true): CentroLinha => ({ id, codigo, nome, ativo });
  const todos = [c(3, "02.01", "Diesel"), c(1, "01", "Frota"), c(2, "01.01", "Pneus", false), c(4, "02", "Administração", false), c(5, "01.02", "Oficina")];

  it("agrupa os subs sob o departamento, em ordem de código", () => {
    const a = montarArvore(todos, "todos");
    expect(a.map((d) => d.codigo)).toEqual(["01", "02"]);
    expect(a[0].subs.map((s) => s.codigo)).toEqual(["01.01", "01.02"]);
  });

  it("em 'ativos' esconde os desativados, mas mantém o departamento que tem sub ativo", () => {
    const a = montarArvore(todos, "ativos");
    expect(a.map((d) => d.codigo)).toEqual(["01", "02"]);
    expect(a[0].subs.map((s) => s.codigo)).toEqual(["01.02"]);
  });

  it("departamento desativado sem sub ativo some em 'ativos'", () => {
    const a = montarArvore([c(1, "01", "Frota", false), c(2, "01.01", "Pneus", false)], "ativos");
    expect(a).toEqual([]);
  });

  it("departamento ativo sem subs aparece", () => {
    expect(montarArvore([c(1, "01", "Frota")], "ativos")).toHaveLength(1);
  });
});

describe("lerFiltro", () => {
  it("padrão é ativos", () => {
    expect(lerFiltro(undefined)).toBe("ativos");
    expect(lerFiltro("todos")).toBe("todos");
    expect(lerFiltro("xx")).toBe("ativos");
  });
});
