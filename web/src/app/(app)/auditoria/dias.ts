/* Dia e hora dos eventos no calendário de São Paulo (o servidor roda em UTC: sem o fuso, um evento das
   22h de Brasília cairia no dia seguinte). O Brasil não tem horário de verão desde 2019. */
const FUSO = "America/Sao_Paulo";

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-10-23": o dia de Brasília de um instante `timestamptz` (ISO). */
export const chaveDia = (instante: string | Date): string => formatoDia.format(typeof instante === "string" ? new Date(instante) : instante);

const emDias = (chave: string): number => Date.parse(`${chave}T00:00:00Z`) / 864e5;

/** Quantos dias de calendário separam `a` de `b` (positivo se `a` é depois de `b`). */
export const diasEntre = (a: string | Date, b: string | Date): number => Math.round(emDias(chaveDia(a)) - emDias(chaveDia(b)));

/** "Hoje", "Ontem" ou "Quinta-feira, 22 de outubro". */
export function rotuloDia(instante: string, agora: Date = new Date()): string {
  const dif = diasEntre(agora, instante);
  if (dif === 0) return "Hoje";
  if (dif === 1) return "Ontem";
  const s = new Date(instante).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO });
  return s[0].toUpperCase() + s.slice(1);
}

/** "17:42" no horário de Brasília. */
export const hora = (instante: string): string =>
  new Date(instante).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
