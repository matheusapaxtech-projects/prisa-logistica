/* Regras puras da tela de centros de custo (servidor e cliente). Fora de actions.ts porque um arquivo "use server"
   só exporta funções assíncronas. A palavra final é do banco (código que não muda, departamento que precisa existir);
   aqui só o que a tela confere antes de enviar e como a lista vira árvore. */

export const MAX_NOME = 80;

const RE_CODIGO = /^\d{2}(\.\d{2})?$/;

export type CentroLinha = { id: number; codigo: string; nome: string; ativo: boolean };

/* ---------- filtro da lista (URL) ---------- */

export const FILTROS = ["ativos", "todos"] as const;
export type FiltroCentros = (typeof FILTROS)[number];
export const ROTULO_FILTRO: Record<FiltroCentros, string> = { ativos: "Ativos", todos: "Todos" };

export function lerFiltro(v: unknown): FiltroCentros {
  return FILTROS.find((f) => f === v) ?? "ativos";
}

/* ---------- código e nome ---------- */

export type LeituraCodigo = { ok: true; codigo: string; subdepartamento: boolean } | { ok: false; erro: string };

/** Código "00" (departamento) ou "00.00" (subdepartamento). `existentes` = códigos já cadastrados (ativos ou não). */
export function validarCodigo(valor: string, existentes: readonly string[]): LeituraCodigo {
  const codigo = valor.trim();
  if (!RE_CODIGO.test(codigo)) return { ok: false, erro: "Use o código com dois dígitos (01) ou dois e dois (01.05)." };
  if (existentes.includes(codigo)) return { ok: false, erro: `Já existe um centro de custo com o código ${codigo}.` };
  const subdepartamento = codigo.includes(".");
  const depto = codigo.slice(0, 2);
  if (subdepartamento && !existentes.includes(depto)) return { ok: false, erro: `Crie primeiro o departamento ${depto}.` };
  return { ok: true, codigo, subdepartamento };
}

export function lerNome(valor: unknown): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = String(valor ?? "").trim();
  if (!nome) return { ok: false, erro: "Digite o nome do centro de custo." };
  if (nome.length > MAX_NOME) return { ok: false, erro: `Use até ${MAX_NOME} caracteres no nome.` };
  return { ok: true, nome };
}

export type CampoCentro = "codigo" | "nome";
export type LeituraCentro<T> = { ok: true; dados: T } | { ok: false; erros: Partial<Record<CampoCentro, string>> };

/** Lê o diálogo "Novo centro de custo". */
export function lerCentroNovo(form: FormData, existentes: readonly string[]): LeituraCentro<{ codigo: string; nome: string }> {
  const c = validarCodigo(String(form.get("codigo") ?? ""), existentes);
  const n = lerNome(form.get("nome"));
  if (c.ok && n.ok) return { ok: true, dados: { codigo: c.codigo, nome: n.nome } };
  return { ok: false, erros: { ...(c.ok ? {} : { codigo: c.erro }), ...(n.ok ? {} : { nome: n.erro }) } };
}

/* ---------- árvore ---------- */

export type Departamento = CentroLinha & { subs: CentroLinha[] };

const porCodigo = (a: CentroLinha, b: CentroLinha) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0);

/**
 * Departamentos com seus subdepartamentos, em ordem de código. Em "ativos" some o que está desativado, mas o
 * departamento desativado que ainda tem subdepartamento ativo continua (senão o filho ficaria solto).
 * Subdepartamento sem departamento na lista (não deveria existir) não aparece.
 */
export function montarArvore(centros: readonly CentroLinha[], filtro: FiltroCentros): Departamento[] {
  const deptos = centros.filter((c) => !c.codigo.includes(".")).sort(porCodigo);
  const subs = centros.filter((c) => c.codigo.includes(".")).sort(porCodigo);
  const quer = (c: CentroLinha) => filtro === "todos" || c.ativo;
  return deptos
    .map((d) => ({ ...d, subs: subs.filter((s) => s.codigo.startsWith(`${d.codigo}.`) && quer(s)) }))
    .filter((d) => quer(d) || d.subs.length > 0);
}
