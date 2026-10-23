/* Regras puras das telas de Proprietários (servidor e cliente): número em formato brasileiro e o que
   falta para o cadastro nascer "normal". Fora de actions.ts porque um arquivo "use server" só exporta
   funções assíncronas. */
import { validacao } from "@/lib/validacao";

/** Número em formato brasileiro ("1.234,56", "R$ 35", "70%"): `null` = vazio, `NaN` = inválido. */
export function lerNumero(s: string | undefined | null): number | null {
  const t = String(s ?? "").replace(/\s|R\$|%/g, "").replace(/\./g, "").replace(",", ".");
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** `faltas()` do protótipo: o que falta para o cadastro nascer "normal". `receitaSituacao` só entra
   quando a empresa foi consultada na Receita (vazio conta como não ativa). */
export function faltasAoCriar(
  a: { rntrc: string; rntrc_validade: string; enquadramento_antt: string },
  receitaSituacao?: string,
): string[] {
  const fx: string[] = [];
  if (validacao.soDigitos(a.rntrc).length !== 9) fx.push("o RNTRC");
  else if (!a.rntrc_validade) fx.push("a validade do RNTRC");
  if (!a.enquadramento_antt) fx.push("o enquadramento");
  if (receitaSituacao !== undefined && receitaSituacao.toUpperCase() !== "ATIVA") fx.push("a situação ativa na Receita");
  return fx;
}
