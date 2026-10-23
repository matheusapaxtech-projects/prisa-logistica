import { describe, expect, it } from "vitest";
import { pode, type Papel } from "@/lib/papeis";

const perfil = (papel: Papel, ativo = true) => ({ papel, ativo });

// Espelha as funções do banco (migration 0200 e policies da 0400):
// pode_editar() = admin|operacao; contas e Pix = tem_papel(admin, operacao, financeiro); eh_admin() = admin.
describe("pode", () => {
  it.each([
    ["admin", true, true, true],
    ["operacao", true, true, false],
    ["financeiro", false, true, false],
    ["leitura", false, false, false],
  ] as const)("%s: editar=%s editarFinanceiro=%s admin=%s", (papel, editar, fin, admin) => {
    expect(pode(perfil(papel), "editar")).toBe(editar);
    expect(pode(perfil(papel), "editarFinanceiro")).toBe(fin);
    expect(pode(perfil(papel), "admin")).toBe(admin);
  });

  it("perfil desativado ou ausente não pode nada", () => {
    expect(pode(perfil("admin", false), "admin")).toBe(false);
    expect(pode(null, "editar")).toBe(false);
    expect(pode(undefined, "editar")).toBe(false);
  });
});
