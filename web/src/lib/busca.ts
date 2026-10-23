/* Termo da busca global (topbar). O texto entra num filtro `.or()` do PostgREST, onde vírgula,
   parênteses, ponto, `*`, `%`, `_` e aspas mudam ou alargam o filtro: só passam letras, dígitos e
   espaço. Regras de tamanho iguais às de `buscar()` do protótipo. */
import { validacao } from "@/lib/validacao";

/** Só letras (com acento), dígitos e um espaço entre palavras. */
export function sanitizarTermo(termo: string): string {
  return termo
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type TermoBusca = {
  /** Para nome, apelido e nome fantasia (ilike). */
  texto: string;
  /** Para CPF/CNPJ (só dígitos). Use quando tiver 3 ou mais. */
  digitos: string;
  /** Placa normalizada (A-Z0-9). Use quando tiver 2 ou mais. */
  placa: string;
};

/** Nulo quando não há o que buscar (menos de 2 caracteres úteis). */
export function termoBusca(termo: string): TermoBusca | null {
  const texto = sanitizarTermo(termo);
  if (texto.length < 2) return null;
  return { texto, digitos: validacao.soDigitos(texto), placa: validacao.normalizarPlaca(texto) };
}

/** Um resultado da busca global. `placa` preenchida → mostra a `<Placa>`; senão `cod` (CPF/CNPJ formatado). */
export type ResultadoBusca = {
  href: string;
  placa?: string;
  cod?: string;
  nome: string;
  tipo: string;
};

/** Máximo de resultados, como no protótipo. */
export const MAX_RESULTADOS = 8;
