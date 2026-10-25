/* Quebra de peso (motor de despacho, kanban.ts `verificarQuebra`): compara o ticket de saída com o de
   chegada usando a tolerância do contrato do cliente. A mesma conta existe no banco (`quebra_e_estadia`,
   migration 20261029000400); aqui ela serve ao diálogo da contagem, antes de gravar. */

export type Quebra = {
  /** Saída − chegada, em t (positivo = faltou). */
  difT: number;
  /** Diferença sobre a saída, em %. */
  pct: number;
  divergente: boolean;
  /** O que passa da tolerância, em t. */
  excedenteT: number;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function verificarQuebra(pesoOrigemT: number, pesoDestinoT: number, toleranciaPct: number): Quebra {
  const dif = pesoOrigemT - pesoDestinoT;
  const pct = pesoOrigemT > 0 ? (dif / pesoOrigemT) * 100 : 0;
  const excedente = Math.max(0, Math.abs(dif) - (pesoOrigemT * toleranciaPct) / 100);
  return { difT: r3(dif), pct: r3(pct), divergente: Math.abs(pct) > toleranciaPct, excedenteT: r3(excedente) };
}

/** Frase para a tela: "Quebra de 0,26 t (0,81%), acima da tolerância de 0,30%". */
export function textoQuebra(q: Quebra, toleranciaPct: number): string {
  const n = (v: number, c = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  if (q.difT === 0) return "Sem diferença entre o peso de saída e o de chegada.";
  const qual = q.difT > 0 ? "Quebra" : "Sobra";
  const dentro = q.divergente ? `acima da tolerância de ${n(toleranciaPct)}%` : `dentro da tolerância de ${n(toleranciaPct)}%`;
  return `${qual} de ${n(Math.abs(q.difT), 3)} t (${n(Math.abs(q.pct))}%), ${dentro}.`;
}
