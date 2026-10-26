/* Regras puras da tela de contas a pagar (servidor e cliente). Fora de actions.ts porque um arquivo
   "use server" só exporta funções assíncronas. As regras de verdade (quem aprova, quando paga) estão no banco;
   aqui só o que a tela confere antes de enviar e o que ela oferece em cada linha. */

import type { Database } from "@/lib/banco";
import { ehForma, type FormaPagamento, type OrigemPagar } from "@/lib/contas";
import { lerNumeroBr } from "@/lib/formato";
import { dataReal, inteiro, MAX_OBSERVACAO, RE_UUID, texto, VALOR_MAXIMO, type Erros, type Leitura } from "../contas-comum/leitura";

export const MAX_DESCRICAO = 200;
export const MAX_FAVORECIDO = 160;
/** Anos à frente que o vencimento pode ter (conta parcelada longa, financiamento). */
const ANOS_A_FRENTE = 5;

/* ---------- filtros da lista (URL) ---------- */

export const FILTROS = ["aberto", "aprovar", "vencidas", "pagas", "todas"] as const;
export type FiltroPagar = (typeof FILTROS)[number];

export const ROTULO_FILTRO: Record<FiltroPagar, string> = {
  aberto: "Em aberto",
  aprovar: "Falta aprovar",
  vencidas: "Vencidas",
  pagas: "Pagas",
  todas: "Todas",
};

export function lerFiltro(v: unknown): FiltroPagar {
  return FILTROS.find((f) => f === v) ?? "aberto";
}

export const AGRUPAMENTOS = ["centro", "tipo", "nenhum"] as const;
export type Agrupamento = (typeof AGRUPAMENTOS)[number];

export const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = {
  centro: "Centro de custo",
  tipo: "Tipo de despesa",
  nenhum: "Sem agrupar",
};

export function lerAgrupar(v: unknown): Agrupamento {
  return AGRUPAMENTOS.find((a) => a === v) ?? "centro";
}

/* ---------- tipo de despesa e centro de custo na lista ---------- */

export type GrupoPlano = Database["public"]["Enums"]["fin_grupo_plano"];

/** Ordem dos grupos do plano de contas (a da DRE). */
export const GRUPOS_PLANO: readonly GrupoPlano[] = [
  "receita",
  "imposto_receita",
  "custo_frete",
  "despesa_operacional",
  "financeiro",
  "ir_csll",
  "fora_resultado",
];

export const ROTULO_GRUPO_PLANO: Record<GrupoPlano, string> = {
  receita: "Receita",
  imposto_receita: "Impostos sobre a receita",
  custo_frete: "Custo do frete",
  despesa_operacional: "Despesas operacionais",
  financeiro: "Resultado financeiro",
  ir_csll: "IRPJ e CSLL",
  fora_resultado: "Fora do resultado",
};

/** Chave de `agrupar` por centro de custo: "01.01 · Frete"; os grupos saem na ordem do código. */
export function chaveCentro(c: { centroCodigo: string; centroNome: string }): { id: string; rotulo: string } {
  return { id: c.centroCodigo, rotulo: `${c.centroCodigo} · ${c.centroNome}` };
}

/** Chave de `agrupar` por tipo de despesa: "Custo do frete · Pedágio"; os grupos na ordem do plano de contas. */
export function chaveTipo(c: { planoGrupo: GrupoPlano; planoNome: string }): { id: string; rotulo: string } {
  const ordem = String(Math.max(0, GRUPOS_PLANO.indexOf(c.planoGrupo))).padStart(2, "0");
  return { id: `${ordem}|${c.planoNome}`, rotulo: `${ROTULO_GRUPO_PLANO[c.planoGrupo]} · ${c.planoNome}` };
}

/* ---------- leitura dos formulários ---------- */

/** Campos do formulário "Lançar conta a pagar" (nomes dos inputs). */
export type CampoConta = "descricao" | "favorecido" | "plano" | "centro" | "forma" | "vencimento" | "valor" | "observacao";

/** Conta lançada à mão, já conferida. */
export type ContaLida = {
  descricao: string;
  favorecidoNome: string;
  planoId: number;
  centroId: number;
  forma: FormaPagamento;
  vencimento: string;
  valor: number;
  observacao: string | null;
};

function lerCentro(form: FormData, erros: Erros<CampoConta>): number {
  const centro = inteiro(texto(form, "centro"));
  if (centro === null) erros.centro = "Escolha o centro de custo.";
  return centro ?? 0;
}

function lerForma(form: FormData, erros: Erros<CampoConta>): FormaPagamento {
  const forma = texto(form, "forma");
  if (!ehForma(forma)) {
    erros.forma = "Escolha a forma de pagamento.";
    return "outro";
  }
  return forma;
}

function lerObservacao(form: FormData, erros: Erros<CampoConta>): string | null {
  const observacao = texto(form, "observacao");
  if (observacao.length > MAX_OBSERVACAO) erros.observacao = `Use até ${MAX_OBSERVACAO} caracteres.`;
  return observacao || null;
}

/** Confere o formulário da conta lançada à mão. `hoje` ("aaaa-mm-dd") limita o ano do vencimento. */
export function lerConta(form: FormData, hoje: string): Leitura<ContaLida, CampoConta> {
  const erros: Erros<CampoConta> = {};

  const descricao = texto(form, "descricao").replace(/\s+/g, " ");
  if (!descricao) erros.descricao = "Escreva o que é esta conta (o que está sendo pago e por quê).";
  else if (descricao.length > MAX_DESCRICAO) erros.descricao = `Use até ${MAX_DESCRICAO} caracteres.`;

  const favorecidoNome = texto(form, "favorecido").replace(/\s+/g, " ");
  if (!favorecidoNome) erros.favorecido = "Diga a quem será paga (fornecedor, pessoa ou empresa).";
  else if (favorecidoNome.length > MAX_FAVORECIDO) erros.favorecido = `Use até ${MAX_FAVORECIDO} caracteres.`;

  const planoId = inteiro(texto(form, "plano"));
  if (planoId === null) erros.plano = "Escolha o tipo de despesa.";

  const centroId = lerCentro(form, erros);
  const forma = lerForma(form, erros);

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

  const observacao = lerObservacao(form, erros);

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      descricao,
      favorecidoNome,
      planoId: planoId as number,
      centroId,
      forma,
      vencimento,
      valor: Math.round((numero as number) * 100) / 100,
      observacao,
    },
  };
}

/** O que muda numa conta gerada pelo NILT (parcela do frete, taxa do cartão): só forma, centro e observação. */
export type AjusteLido = { centroId: number; forma: FormaPagamento; observacao: string | null };

export function lerAjusteGerada(form: FormData): Leitura<AjusteLido, CampoConta> {
  const erros: Erros<CampoConta> = {};
  const centroId = lerCentro(form, erros);
  const forma = lerForma(form, erros);
  const observacao = lerObservacao(form, erros);
  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { centroId, forma, observacao } };
}

/** Campos do diálogo "Pagar". */
export type CampoPagamento = "data" | "conta" | "forma";

export type PagamentoLido = { data: string; contaId: string | null; forma: FormaPagamento };

/** Confere o pagamento: data (não pode ser depois de `hoje`), conta bancária opcional e a forma. */
export function lerPagamento(form: FormData, hoje: string): Leitura<PagamentoLido, CampoPagamento> {
  const erros: Erros<CampoPagamento> = {};

  const data = texto(form, "data");
  if (!data) erros.data = "Informe a data do pagamento.";
  else if (!dataReal(data)) erros.data = "Data inválida.";
  else if (data < "2000-01-01") erros.data = "Confira o ano da data.";
  else if (data > hoje) erros.data = "A data do pagamento não pode ser depois de hoje.";

  const conta = texto(form, "conta");
  if (conta && !RE_UUID.test(conta)) erros.conta = "Escolha uma conta da lista.";

  const forma = texto(form, "forma");
  if (!ehForma(forma)) erros.forma = "Escolha a forma de pagamento.";

  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, dados: { data, contaId: conta || null, forma: forma as FormaPagamento } };
}

/* ---------- o que cada linha oferece ---------- */

export type AcoesDaConta = {
  aprovar: boolean;
  /** Falta aprovar, mas quem está logado lançou ou alterou: outra pessoa precisa aprovar. */
  esperarOutro: boolean;
  pagar: boolean;
  editar: boolean;
  desaprovar: boolean;
  cancelar: boolean;
  liberar: boolean;
  desfazerPagamento: boolean;
};

/* Espelha as funções do banco (`fin_aprovar_pagar`, `fin_desaprovar_pagar`, `fin_cancelar_pagar`, …): a tela só
   esconde o que o banco recusaria; a palavra final continua sendo dele. */
export function acoesDaConta(
  c: {
    origem: OrigemPagar;
    canceladoEm: string | null;
    pagoEm: string | null;
    aprovadoEm: string | null;
    aprovadoPor: string | null;
    lancadoPor: string | null;
    editadoPor: string | null;
    antecipacaoLiberadaEm: string | null;
  },
  usuario: { userId: string; admin: boolean },
): AcoesDaConta {
  const cancelada = c.canceladoEm !== null;
  const paga = c.pagoEm !== null;
  const aberta = !cancelada && !paga;
  const aprovada = c.aprovadoEm !== null;
  const mexeu = usuario.userId === c.lancadoPor || usuario.userId === c.editadoPor;
  const parcelaDoFrete = c.origem === "frete_adiantamento" || c.origem === "frete_saldo";
  return {
    aprovar: aberta && !aprovada && !mexeu,
    esperarOutro: aberta && !aprovada && mexeu,
    pagar: aberta && aprovada,
    editar: aberta && !aprovada,
    desaprovar: aberta && aprovada && (c.aprovadoPor === usuario.userId || usuario.admin),
    cancelar: aberta && (!parcelaDoFrete || usuario.admin),
    liberar: usuario.admin && c.origem === "frete_saldo" && aberta && c.antecipacaoLiberadaEm === null,
    desfazerPagamento: usuario.admin && paga && !cancelada,
  };
}

/** Situação da conta (de `v_fin_pagar`) em palavras, para a linha do bloco da taxa do cartão. */
export const ROTULO_SITUACAO_PAGAR: Record<string, string> = {
  cancelada: "cancelada",
  paga: "paga",
  vencida: "vencida",
  falta_aprovar: "falta aprovar",
  a_vencer: "aprovada",
};
