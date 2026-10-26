/* Parcelas do frete do motorista (contas a pagar do financeiro) como a ficha da viagem e o Quadro mostram.
   Puro (sem servidor, sem React). A fonte é o RPC `viagem_parcelas` (migration 20261101000300): lê quem lê
   viagens, inclusive a operação, que não enxerga o resto do financeiro. O banco é a autoridade. */
import type { TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";

export type OrigemParcela = "frete_adiantamento" | "frete_saldo";
export type SituacaoParcela = "cancelada" | "paga" | "vencida" | "falta_aprovar" | "a_vencer";

export type ParcelaViagem = {
  origem: OrigemParcela;
  numero: number;
  valor: number;
  /** Parte do valor que é o pedágio (vale-pedágio); só o adiantamento tem. */
  partePedagio: number;
  vencimento: string;
  situacao: SituacaoParcela;
  pagoEm: string | null;
  antecipacaoLiberada: boolean;
};

/** Linha de `viagem_parcelas` como o cliente tipado devolve. */
export type LinhaParcela = {
  origem: string;
  numero: number | string;
  valor: number | string;
  parte_pedagio: number | string | null;
  vencimento: string;
  situacao: string;
  pago_em: string | null;
  antecipacao_liberada: boolean | null;
};

const ROTULOS: Record<OrigemParcela, string> = {
  frete_adiantamento: "Adiantamento (70% + pedágio)",
  frete_saldo: "Saldo (30%)",
};

const SITUACOES: readonly string[] = ["cancelada", "paga", "vencida", "falta_aprovar", "a_vencer"];

/** Rótulo da parcela na ficha da viagem. */
export function rotuloDaParcela(origem: OrigemParcela): string {
  return ROTULOS[origem];
}

/** Linhas do banco → parcelas, o adiantamento antes do saldo. Origem ou situação que a tela não conhece fica de fora. */
export function lerParcelas(linhas: readonly LinhaParcela[] | null | undefined): ParcelaViagem[] {
  const lidas: ParcelaViagem[] = [];
  for (const l of linhas ?? []) {
    if ((l.origem !== "frete_adiantamento" && l.origem !== "frete_saldo") || !SITUACOES.includes(l.situacao)) continue;
    lidas.push({
      origem: l.origem,
      numero: Number(l.numero),
      valor: Number(l.valor),
      partePedagio: Number(l.parte_pedagio ?? 0),
      vencimento: l.vencimento,
      situacao: l.situacao as SituacaoParcela,
      pagoEm: l.pago_em,
      antecipacaoLiberada: l.antecipacao_liberada === true,
    });
  }
  return lidas.sort((a, b) => (a.origem === b.origem ? 0 : a.origem === "frete_adiantamento" ? -1 : 1));
}

/** Situação da parcela como sinal (forma + cor). "A vencer" aqui é "aprovada e ainda no prazo": o banco só
   chama de `a_vencer` a conta que já foi aprovada (antes disso é `falta_aprovar`). */
export function sinalDaParcela(p: Pick<ParcelaViagem, "situacao" | "pagoEm" | "vencimento">): { tipo: TipoSinal; texto: string } {
  switch (p.situacao) {
    case "paga":
      return { tipo: "normal", texto: p.pagoEm ? `Paga em ${formato.data(p.pagoEm)}` : "Paga" };
    case "falta_aprovar":
      return { tipo: "pendente", texto: "Falta aprovar" };
    case "vencida":
      return { tipo: "bloqueado", texto: "Vencida" };
    case "a_vencer":
      return { tipo: "info", texto: `Aprovada, vence ${formato.data(p.vencimento)}` };
    case "cancelada":
      return { tipo: "neutro", texto: "Cancelada" };
  }
}

/** A parcela existe e não foi cancelada: é o financeiro que paga, e o banco recusa a confirmação manual. */
export function pagoPeloFinanceiro(parcelas: readonly ParcelaViagem[], qual: "adiantamento" | "saldo"): boolean {
  const origem: OrigemParcela = qual === "adiantamento" ? "frete_adiantamento" : "frete_saldo";
  return parcelas.some((p) => p.origem === origem && p.situacao !== "cancelada");
}
