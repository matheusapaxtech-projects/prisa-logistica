/* Cores e formatos do app, tirados do DESIGN.md do NILT (cor = situação). */
export const cor = {
  fundo: "#e8e6de",
  folha: "#fbf8f2",
  borda: "#e4ddd0",
  tinta: "#161818",
  apagado: "#55574f",
  verde: "#2c5a4d",
  verdeClaro: "#e1ebe4",
  verdeTinta: "#1f4237",
  amareloClaro: "#f7edc8",
  amareloTinta: "#574300",
  vermelhoClaro: "#f6e1d9",
  vermelhoTinta: "#8a2a12",
  azulClaro: "#e2eaf1",
  azulTinta: "#1d3f5e",
};

export const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-10-27" → "27/10" */
export const dia = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "a combinar");

/** Data e hora de Brasília, curta: "27/10 às 14:00". */
export function quando(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${data} às ${hora}`;
}
