/* Apoio aos formulários das fichas (puro: servidor e cliente). */
import type { z } from "zod";
import type { ResultadoAcao } from "@/lib/acao";

/** Resultado de uma ação de formulário: o de `comSessao` ou, na validação, o erro de cada campo
   (`campos[nome] = mensagem`), para marcar o campo sem limpar o que foi digitado. */
export type ResultadoForm<T = void> = ResultadoAcao<T> | { ok: false; erro: string; campos: Record<string, string> };

export const MSG_FALTAM_DADOS = "Faltam dados: veja os campos marcados.";

/** Converte o erro do zod em `{ ok: false, campos }` (primeira mensagem de cada campo). */
export function errosDoZod(erro: z.ZodError): { ok: false; erro: string; campos: Record<string, string> } {
  const campos: Record<string, string> = {};
  for (const p of erro.issues) {
    const nome = String(p.path[0] ?? "");
    if (nome && !campos[nome]) campos[nome] = p.message;
  }
  return { ok: false, erro: MSG_FALTAM_DADOS, campos };
}

/** Lê o FormData como objeto simples: texto aparado; checkbox marcado = "on". */
export function lerForm(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v.trim();
  return o;
}

/**
 * Caminhos que a ação pode revalidar: só rotas internas do app. O valor vem do navegador (argumento
 * de Server Action), então qualquer coisa que não seja uma lista vira lista vazia, sem lançar.
 */
export function caminhosValidos(revalidar: unknown): string[] {
  if (!Array.isArray(revalidar)) return [];
  return revalidar.filter((c): c is string => typeof c === "string" && /^\/(?!\/)[a-z0-9/_-]*$/i.test(c));
}

/** Id de registro (formato 8-4-4-4-12 sem exigir versão: as seeds usam ids fora da RFC). */
export const RE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
