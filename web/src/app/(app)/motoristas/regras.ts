/* Regras puras das telas de Motoristas (servidor e cliente). */
import { validacao } from "@/lib/validacao";

/** Número de tamanho fixo (INSS/NIT, registro da CNH): nulo quando vazio ou certo; senão a mensagem.
   Faltando, a frase do protótipo ("Faltam N dígitos: o número tem T."); sobrando (o campo corta no
   navegador, mas o servidor confere), "Sobram N dígitos: o número tem T.". */
export function erroDigitos(v: string, t: number): string | null {
  const d = validacao.soDigitos(v);
  if (!d || d.length === t) return null;
  if (d.length < t) return `Faltam ${t - d.length} dígitos: o número tem ${t}.`;
  const n = d.length - t;
  return `${n === 1 ? "Sobra 1 dígito" : `Sobram ${n} dígitos`}: o número tem ${t}.`;
}
