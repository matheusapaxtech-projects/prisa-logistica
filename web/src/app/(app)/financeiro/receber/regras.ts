/* Regras puras da tela de contas a receber (servidor e cliente). Fora de actions.ts porque um arquivo
   "use server" só exporta funções assíncronas. As regras de verdade estão no banco; aqui só o que a tela
   confere antes de enviar e o que ela oferece em cada linha. Tetos e leitura de motivo vêm da tela irmã. */

import { ehForma, type FormaPagamento } from "@/lib/contas";
import { lerNumeroBr } from "@/lib/formato";
import { dataReal, inteiro, MAX_OBSERVACAO, RE_UUID, texto, VALOR_MAXIMO, type Erros, type Leitura } from "../contas-comum/leitura";

export const MAX_TITULO = 120;
/** Teto da taxa de antecipação ao mês, em %: pega uma vírgula fora do lugar. */
export const TAXA_MAXIMA = 100;
/** Anos à frente que o vencimento pode ter. */
const ANOS_A_FRENTE = 5;

/* ---------- filtros da lista (URL) ---------- */

export const FILTROS = ["aberto", "vencidas", "recebidas", "todas"] as const;
export type FiltroReceber = (typeof FILTROS)[number];

export const ROTULO_FILTRO: Record<FiltroReceber, string> = {
  aberto: "Em aberto",
  vencidas: "Vencidas",
  recebidas: "Recebidas",
  todas: "Todas",
};

export function lerFiltro(v: unknown): FiltroReceber {
  return FILTROS.find((f) => f === v) ?? "aberto";
}

/* ---------- leitura dos formulários ---------- */

/** Campos do formulário "Lançar conta a receber" (nomes dos inputs). */
export type CampoTitulo = "cliente" | "titulo" | "plano" | "centro" | "forma" | "vencimento" | "valor" | "observacao";

/** Título lançado à mão, já conferido. */
export type TituloLido = {
  clienteId: string;
  titulo: string;
  planoId: number;
  centroId: number;
  forma: FormaPagamento;
  vencimento: string;
  valor: number;
  observacao: string | null;
};

/** Confere o formulário do título. `hoje` ("aaaa-mm-dd") limita o ano do vencimento. */
export function lerTitulo(form: FormData, hoje: string): Leitura<TituloLido, CampoTitulo> {
  const erros: Erros<CampoTitulo> = {};

  const cliente = texto(form, "cliente");
  if (!RE_UUID.test(cliente)) erros.cliente = "Escolha o cliente.";

  const titulo = texto(form, "titulo").replace(/\s+/g, " ");
  if (!titulo) erros.titulo = "Escreva o título (por exemplo, CT-e 1234).";
  else if (titulo.length > MAX_TITULO) erros.titulo = `Use até ${MAX_TITULO} caracteres.`;

  const planoId = inteiro(texto(form, "plano"));
  if (planoId === null) erros.plano = "Escolha o tipo de receita.";

  const centroId = inteiro(texto(form, "centro"));
  if (centroId === null) erros.centro = "Escolha o centro de custo.";

  const forma = texto(form, "forma");
  if (!ehForma(forma)) erros.forma = "Escolha a forma de recebimento.";

  const vencimento = texto(form, "vencimento");
  const limite = `${Number(hoje.slice(0, 4)) + ANOS_A_FRENTE}${hoje.slice(4)}`;
  if (!vencimento) erros.vencimento = "Informe o vencimento.";
  else if (!dataReal(vencimento)) erros.vencimento = "Data inválida.";
  else if (vencimento < "2000-01-01" || vencimento > limite) erros.vencimento = "Confira o ano do vencimento.";

  const numero = lerNumeroBr(texto(form, "valor"));
  if (numero === null) erros.valor = "Informe o valor.";
  else if (Number.isNaN(numero)) erros.valor = "Valor inválido. Use vírgula para os centavos: 1.234,56.";
  else if (Math.round(numero * 100) <= 0) erros.valor = "Informe um valor maior que zero.";
  else if (numero > VALOR_MAXIMO) erros.valor = "Valor alto demais. Confira se não sobrou um zero.";

  const observacao = texto(form, "observacao");
  if (observacao.length > MAX_OBSERVACAO) erros.observacao = `Use até ${MAX_OBSERVACAO} caracteres.`;

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      clienteId: cliente,
      titulo,
      planoId: planoId as number,
      centroId: centroId as number,
      forma: forma as FormaPagamento,
      vencimento,
      valor: Math.round((numero as number) * 100) / 100,
      observacao: observacao || null,
    },
  };
}

/** Campos do diálogo "Receber". */
export type CampoRecebimento = "data" | "conta";

export type RecebimentoLido = { data: string; contaId: string | null };

/** Confere o recebimento: data (não pode ser depois de `hoje`) e conta bancária opcional (sem conta = dinheiro). */
export function lerRecebimento(form: FormData, hoje: string): Leitura<RecebimentoLido, CampoRecebimento> {
  const erros: Erros<CampoRecebimento> = {};

  const data = texto(form, "data");
  if (!data) erros.data = "Informe a data do recebimento.";
  else if (!dataReal(data)) erros.data = "Data inválida.";
  else if (data < "2000-01-01") erros.data = "Confira o ano da data.";
  else if (data > hoje) erros.data = "A data do recebimento não pode ser depois de hoje.";

  const conta = texto(form, "conta");
  if (conta && !RE_UUID.test(conta)) erros.conta = "Escolha uma conta da lista.";

  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { data, contaId: conta || null } };
}

/* ---------- o que cada linha oferece ---------- */

export type AcoesDoTitulo = {
  receber: boolean;
  editar: boolean;
  cancelar: boolean;
  desfazerRecebimento: boolean;
  /** Pode ser marcado para o simulador: em aberto e ainda não vencido. */
  antecipar: boolean;
};

/* Espelha as funções do banco (`fin_receber_conta`, `fin_desfazer_recebimento`, `fin_cancelar_receber`):
   a tela só esconde o que o banco recusaria; a palavra final continua sendo dele. */
export function acoesDoTitulo(t: { canceladoEm: string | null; recebidoEm: string | null; vencimento: string }, hoje: string): AcoesDoTitulo {
  const cancelado = t.canceladoEm !== null;
  const recebido = t.recebidoEm !== null;
  const aberto = !cancelado && !recebido;
  return {
    receber: aberto,
    editar: aberto,
    cancelar: aberto,
    desfazerRecebimento: recebido && !cancelado,
    antecipar: aberto && t.vencimento > hoje,
  };
}

/* ---------- simulador de antecipação ---------- */

export type CampoSimulacao = "taxa" | "tarifa";

/** Lê a taxa ao mês (%) e a tarifa por título (R$) digitadas em formato brasileiro. */
export function lerParametrosSimulacao(
  taxaTexto: string,
  tarifaTexto: string,
): { ok: true; taxa: number; tarifa: number } | { ok: false; erros: Erros<CampoSimulacao> } {
  const erros: Erros<CampoSimulacao> = {};

  const taxa = lerNumeroBr(taxaTexto);
  if (taxa === null) erros.taxa = "Informe a taxa.";
  else if (Number.isNaN(taxa)) erros.taxa = "Taxa inválida. Use vírgula: 2,0.";
  else if (taxa > TAXA_MAXIMA) erros.taxa = `Use uma taxa de até ${TAXA_MAXIMA}%.`;

  const tarifa = lerNumeroBr(tarifaTexto);
  if (tarifa === null) erros.tarifa = "Informe a tarifa (zero se não houver).";
  else if (Number.isNaN(tarifa)) erros.tarifa = "Tarifa inválida. Use vírgula: 5,00.";
  else if (tarifa > VALOR_MAXIMO) erros.tarifa = "Tarifa alta demais. Confira o valor.";

  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, taxa: taxa as number, tarifa: tarifa as number };
}
