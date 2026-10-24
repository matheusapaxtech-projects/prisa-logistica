// Papéis e permissões da interface. Puro (sem servidor): pode ser usado em Client Components.
// A palavra final é sempre do RLS no banco; isto só decide o que aparece na tela.

export type Papel = "admin" | "operacao" | "financeiro" | "leitura";

export type Perfil = {
  userId: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
};

export type AcaoPermitida = "editar" | "editarFinanceiro" | "financeiro" | "admin";

// Mesmas regras das funções do banco:
// - editar           = pode_editar()                                  (migration 0200)
// - editarFinanceiro = tem_papel('admin','operacao','financeiro')     (contas e Pix, migration 0400)
// - financeiro       = pode_financeiro() (extrato, lançamentos e resultado; migration 20261026000100)
// - admin            = eh_admin()                                     (migration 0200)
const REGRAS: Record<AcaoPermitida, readonly Papel[]> = {
  editar: ["admin", "operacao"],
  editarFinanceiro: ["admin", "operacao", "financeiro"],
  financeiro: ["admin", "financeiro"],
  admin: ["admin"],
};

/** Perfil ausente ou desativado não pode nada (no banco, papel_atual() é null nesses casos). */
export function pode(
  perfil: Pick<Perfil, "papel" | "ativo"> | null | undefined,
  acao: AcaoPermitida,
): boolean {
  if (!perfil || !perfil.ativo) return false;
  return REGRAS[acao].includes(perfil.papel);
}
