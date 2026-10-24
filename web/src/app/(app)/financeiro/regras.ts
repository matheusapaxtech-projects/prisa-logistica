/* Regras puras das telas do Financeiro (servidor e cliente). Fora de actions.ts porque um arquivo
   "use server" só exporta funções assíncronas. */

/** Tamanho máximo do OFX (o servidor aceita até 5 MB de corpo; sobra folga para o envio). */
export const TAMANHO_MAXIMO = 4 * 1024 * 1024;

/** O que a importação devolve para a tela. */
export type Importado = {
  total: number;
  novos: number;
  repetidos: number;
  classificados: number;
  /** Novos com a mesma data, valor e histórico de um que já estava na conta (banco que muda o FITID). */
  suspeitos: number;
  banco: string;
  agencia: string;
  numero: string;
  /** Meses ("aaaa-mm") do primeiro e do último lançamento do arquivo. */
  primeiroMes: string;
  ultimoMes: string;
};

/** O que a classificação devolve: quantos outros lançamentos ganharam a categoria e se a regra foi
   gravada (`pediuRegra` com `regra` falso = descrição genérica demais, como "PIX RECEBIDO"). */
export type Classificado = { outros: number; regra: boolean; pediuRegra: boolean };

/** Abas da tela do Financeiro (`?aba=`). */
export const ABAS = ["resultado", "lancamentos", "regras"] as const;
export type AbaFinanceiro = (typeof ABAS)[number];

/** Filtro da aba Lançamentos (`?ver=`): todos, só os sem categoria, ou uma categoria. */
export const SEM_CATEGORIA = "sem";

const MENOS = "−";

/** Dinheiro com sinal: "R$ 1.234,56" e "−R$ 1.234,56" (saída). `semMoeda` tira o "R$" (colunas da tabela do ano). */
export function dinheiro(n: number, semMoeda = false): string {
  const v = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = semMoeda ? v : `R$ ${v}`;
  return n < 0 && Math.round(n * 100) !== 0 ? `${MENOS}${s}` : s;
}
