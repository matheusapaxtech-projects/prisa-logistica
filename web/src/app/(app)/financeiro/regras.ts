/* Regras puras das telas do Financeiro (servidor e cliente). Fora de actions.ts porque um arquivo
   "use server" só exporta funções assíncronas. */

import { CATEGORIAS, ehCategoria, type Categoria } from "@/lib/financeiro";
import { lerNumeroBr } from "@/lib/formato";

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
  /** Novos que batem com um lançamento feito à mão (mesma data e valor): conferir para não contar duas vezes. */
  manuais: number;
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

/* ---------- lançamento à mão ---------- */

/** Campos do formulário "Novo lançamento" (nomes dos inputs). */
export type CampoManual = "data" | "sentido" | "valor" | "descricao" | "categoria" | "conta" | "observacao";

/** Lançamento à mão já conferido: valor com sinal (entrada +, saída −), conta nula = sem conta. */
export type LancamentoManual = {
  data: string;
  valor: number;
  descricao: string;
  categoria: Categoria;
  contaId: string | null;
  observacao: string | null;
};

export type LeituraManual = { ok: true; dados: LancamentoManual } | { ok: false; erros: Partial<Record<CampoManual, string>> };

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_DESCRICAO = 200;
export const MAX_OBSERVACAO = 500;
/** Teto de um lançamento (numeric(14,2) cabe muito mais; isto pega um zero a mais digitado). */
export const VALOR_MAXIMO = 100_000_000;

function dataReal(v: string): boolean {
  const m = RE_DATA.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Confere o formulário do lançamento à mão. `hoje` ("aaaa-mm-dd") limita a data a um ano à frente. */
export function lerLancamentoManual(form: FormData, hoje: string): LeituraManual {
  const txt = (k: CampoManual) => String(form.get(k) ?? "").trim();
  const erros: Partial<Record<CampoManual, string>> = {};

  const data = txt("data");
  const limite = `${Number(hoje.slice(0, 4)) + 1}${hoje.slice(4)}`;
  if (!data) erros.data = "Informe a data do lançamento.";
  else if (!dataReal(data)) erros.data = "Data inválida.";
  else if (data < "2000-01-01" || data > limite) erros.data = "Confira o ano da data.";

  const sentido = txt("sentido");
  if (sentido !== "entrada" && sentido !== "saida") erros.sentido = "Diga se o dinheiro entrou ou saiu.";

  const bruto = txt("valor");
  const numero = lerNumeroBr(bruto);
  if (numero === null) erros.valor = "Informe o valor.";
  else if (Number.isNaN(numero)) erros.valor = "Valor inválido. Use vírgula para os centavos: 1.234,56.";
  else if (Math.round(numero * 100) === 0) erros.valor = "O valor não pode ser zero.";
  else if (numero > VALOR_MAXIMO) erros.valor = "Valor alto demais. Confira se não sobrou um zero.";

  const descricao = txt("descricao").replace(/\s+/g, " ");
  if (!descricao) erros.descricao = "Escreva o que foi o lançamento (quem pagou ou recebeu, e por quê).";
  else if (descricao.length > MAX_DESCRICAO) erros.descricao = `Use até ${MAX_DESCRICAO} caracteres.`;

  const categoria = txt("categoria");
  if (!ehCategoria(categoria)) erros.categoria = "Escolha a categoria.";
  else if (sentido === "entrada" || sentido === "saida") {
    const s = CATEGORIAS[categoria].sentido;
    if (s !== "ambos" && s !== sentido) erros.categoria = `${CATEGORIAS[categoria].rotulo} é ${s === "entrada" ? "uma entrada" : "uma saída"}.`;
  }

  const conta = txt("conta");
  if (conta && !RE_UUID.test(conta)) erros.conta = "Escolha uma conta da lista.";

  const observacao = txt("observacao");
  if (observacao.length > MAX_OBSERVACAO) erros.observacao = `Use até ${MAX_OBSERVACAO} caracteres.`;

  if (Object.keys(erros).length) return { ok: false, erros };
  const centavos = Math.round((numero as number) * 100);
  return {
    ok: true,
    dados: {
      data,
      valor: (sentido === "saida" ? -centavos : centavos) / 100,
      descricao,
      categoria: categoria as Categoria,
      contaId: conta || null,
      observacao: observacao || null,
    },
  };
}
