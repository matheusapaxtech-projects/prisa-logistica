import { describe, expect, it } from "vitest";
import { inserirComPrincipal, type ClientePrincipal } from "@/app/(app)/_pessoa/principal";
import { erroDigitos } from "@/app/(app)/motoristas/regras";

type Chamada = { op: "insert" | "update"; tabela: string; valores: Record<string, unknown>; filtros: string[] };

/** Cliente simulado: registra as chamadas; `falhar` decide quais devolvem erro. */
function simular(opcoes: { insertFalha?: boolean; marcarFalha?: boolean; anteriores?: string[] } = {}) {
  const chamadas: Chamada[] = [];
  const db: ClientePrincipal = {
    from(tabela) {
      return {
        insert(valores) {
          const c: Chamada = { op: "insert", tabela, valores, filtros: [] };
          chamadas.push(c);
          return {
            select: () => ({
              single: async () =>
                opcoes.insertFalha ? { data: null, error: { code: "23505", message: "duplicate key" } } : { data: { id: "novo" }, error: null },
            }),
          };
        },
        update(valores) {
          const c: Chamada = { op: "update", tabela, valores, filtros: [] };
          chamadas.push(c);
          const filtro = {
            eq: (col: string, v: unknown) => (c.filtros.push(`eq ${col} ${String(v)}`), filtro),
            neq: (col: string, v: unknown) => (c.filtros.push(`neq ${col} ${String(v)}`), filtro),
            in: (col: string, v: unknown[]) => (c.filtros.push(`in ${col} ${v.join(",")}`), filtro),
            select: async () => {
              if (valores.principal === true && c.filtros.includes("eq id novo"))
                return opcoes.marcarFalha ? { data: null, error: { code: "42501", message: "rls" } } : { data: [{ id: "novo" }], error: null };
              if (valores.principal === false) return { data: (opcoes.anteriores ?? []).map((id) => ({ id })), error: null };
              return { data: [], error: null };
            },
          };
          return filtro;
        },
      };
    },
  };
  return { db, chamadas };
}

describe("_pessoa: inclusão com principal sem perder o anterior", () => {
  it("insert que falha (chave Pix repetida) não mexe em nenhum principal", async () => {
    const { db, chamadas } = simular({ insertFalha: true });
    await expect(inserirComPrincipal(db, "pessoa_chave_pix", "p1", { pessoa_id: "p1", chave: "x" }, true)).rejects.toMatchObject({ code: "23505" });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({ op: "insert", valores: { principal: false } });
    expect(chamadas.some((c) => c.op === "update")).toBe(false);
  });

  it("insert ok com principal: insere desmarcado, desmarca os outros (neq novo) e marca o novo", async () => {
    const { db, chamadas } = simular({ anteriores: ["velho"] });
    await expect(inserirComPrincipal(db, "pessoa_telefone", "p1", { pessoa_id: "p1" }, true)).resolves.toBe("novo");
    expect(chamadas.map((c) => c.op)).toEqual(["insert", "update", "update"]);
    expect(chamadas[0].valores.principal).toBe(false);
    expect(chamadas[1]).toMatchObject({ valores: { principal: false }, filtros: ["eq pessoa_id p1", "eq principal true", "neq id novo"] });
    expect(chamadas[2]).toMatchObject({ valores: { principal: true }, filtros: ["eq id novo"] });
  });

  it("sem principal marcado: só o insert", async () => {
    const { db, chamadas } = simular();
    await inserirComPrincipal(db, "pessoa_email", "p1", { pessoa_id: "p1" }, false);
    expect(chamadas.map((c) => c.op)).toEqual(["insert"]);
  });

  it("se marcar o novo falhar, devolve o principal ao anterior", async () => {
    const { db, chamadas } = simular({ marcarFalha: true, anteriores: ["velho"] });
    await expect(inserirComPrincipal(db, "pessoa_endereco", "p1", { pessoa_id: "p1" }, true)).rejects.toMatchObject({ code: "42501" });
    expect(chamadas.at(-1)).toMatchObject({ op: "update", valores: { principal: true }, filtros: ["in id velho"] });
  });
});

describe("motoristas: números de tamanho fixo (INSS, registro da CNH)", () => {
  it("vazio ou certo passa; faltando usa a frase do protótipo; sobrando diz quantos sobram", () => {
    expect(erroDigitos("", 11)).toBeNull();
    expect(erroDigitos("123.456.789-01", 11)).toBeNull();
    expect(erroDigitos("12345678", 11)).toBe("Faltam 3 dígitos: o número tem 11.");
    expect(erroDigitos("123456789012", 11)).toBe("Sobra 1 dígito: o número tem 11.");
    expect(erroDigitos("12345678901234", 11)).toBe("Sobram 3 dígitos: o número tem 11.");
  });
});
