/* Datas de calendário no fuso de Brasília (o servidor roda em UTC). */

const FUSO = "America/Sao_Paulo";

/** Hoje em Brasília, "yyyy-mm-dd". */
export function hojeISO(agora: Date = new Date()): string {
  // en-CA formata como yyyy-mm-dd.
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Dias de hoje (Brasília) até a data `yyyy-mm-dd` (negativo = já passou), como `dias` de v_vencimentos. */
export function diasAte(iso: string, agora: Date = new Date()): number {
  const alvo = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  const hoje = Date.parse(hojeISO(agora) + "T00:00:00Z");
  return Math.round((alvo - hoje) / 864e5);
}

/** Situação de uma validade (`estadoValidade` de prototipo/assets/paginas/motoristas.js):
   vencido (< 0), vencendo (até 30 dias), normal, ou neutro (sem data). */
export type EstadoValidade = { cls: "normal" | "vencendo" | "vencido" | "neutro"; dias: number | null };

export function estadoValidade(iso: string | null | undefined, agora: Date = new Date()): EstadoValidade {
  if (!iso) return { cls: "neutro", dias: null };
  const dias = diasAte(iso, agora);
  return { cls: dias < 0 ? "vencido" : dias <= 30 ? "vencendo" : "normal", dias };
}
