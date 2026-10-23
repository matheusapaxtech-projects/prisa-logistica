/* Validação de documentos e placas. Porta 1:1 de `N.valida` / `N.so` (prototipo/assets/nilt.js),
   que por sua vez espelha as funções do banco (cpf_valido, cnpj_valido, placa_valida). */

/** Só os dígitos (`N.so`). Aceita qualquer valor; nulo/indefinido vira "". */
function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Placa em maiúsculas, sem hífen nem espaços: "abc-1234" → "ABC1234". */
function normalizarPlaca(v: unknown): string {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cpf(v: unknown): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
    const r = (s * 10) % 11;
    if ((r === 10 ? 0 : r) !== +d[n]) return false;
  }
  return true;
}

function cnpj(v: unknown): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: 12 | 13) => {
    const pesos =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, w, i) => a + w * +d[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +d[12] && calc(13) === +d[13];
}

/** Antiga (ABC1234) ou Mercosul (ABC1D23). */
function placa(v: unknown): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca(v));
}

/** Só o padrão Mercosul (ABC1D23). */
function mercosul(v: unknown): boolean {
  return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(normalizarPlaca(v));
}

export const validacao = { cpf, cnpj, placa, normalizarPlaca, mercosul, soDigitos };

/** Textos de erro dos campos com validação ao vivo (`montarValidacao` do protótipo). */
export const mensagensValidacao = {
  cpf: "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
  cnpj: "CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.",
  placa: "Placa inválida: use ABC1234 ou ABC1D23.",
} as const;
