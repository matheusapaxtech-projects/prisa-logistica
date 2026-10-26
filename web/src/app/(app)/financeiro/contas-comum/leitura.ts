/* Leitura e conferência de formulários das contas a pagar e a receber (servidor e cliente), usada pelas duas telas.
   Fora de actions.ts porque um arquivo "use server" só exporta funções assíncronas. */

export const MAX_OBSERVACAO = 500;
export const MAX_MOTIVO = 300;
/** Teto de uma conta (o banco aceita menos de 1 bilhão; isto pega um zero a mais digitado). */
export const VALOR_MAXIMO = 100_000_000;

export type Erros<C extends string> = Partial<Record<C, string>>;
export type Leitura<T, C extends string> = { ok: true; dados: T } | { ok: false; erros: Erros<C> };

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "aaaa-mm-dd" que existe no calendário (2026-02-30 não). */
export function dataReal(v: string): boolean {
  const m = RE_DATA.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Campo de texto do formulário, sem as pontas em branco. */
export const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

/** Inteiro positivo de até 9 dígitos (id de plano, de centro de custo); senão nulo. */
export const inteiro = (v: string): number | null => (/^\d{1,9}$/.test(v) && Number(v) > 0 ? Number(v) : null);

/** Confere o id de uma conta (uuid) antes de ir ao banco. */
export const ehIdConta = (v: unknown): v is string => typeof v === "string" && RE_UUID.test(v);

/** Motivo de um cancelamento ou da liberação da antecipação (o banco exige ao menos 3 caracteres). */
export function lerMotivo(valor: unknown, para: "cancelamento" | "liberação"): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = String(valor ?? "").trim();
  if (motivo.length < 3) return { ok: false, erro: `Diga o motivo ${para === "cancelamento" ? "do cancelamento" : "da liberação"}.` };
  if (motivo.length > MAX_MOTIVO) return { ok: false, erro: `Use até ${MAX_MOTIVO} caracteres.` };
  return { ok: true, motivo };
}
