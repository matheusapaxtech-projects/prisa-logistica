/* Consultas do contas a pagar, sempre com o cliente do usuário (RLS: só admin e financeiro veem). */
import type { Banco } from "@/lib/banco";
import { sanitizarTermo } from "@/lib/busca";
import type { FormaPagamento, OrigemPagar } from "@/lib/contas";
import { limitesDoMes } from "@/lib/financeiro";
import { nomesDe, todas } from "../contas-comum/consulta";
import type { FiltroPagar, GrupoPlano } from "./regras";

export type ContaPagar = {
  id: string;
  numero: number;
  origem: OrigemPagar;
  descricao: string;
  favorecidoNome: string;
  planoId: number;
  planoNome: string;
  planoGrupo: GrupoPlano;
  centroId: number;
  centroCodigo: string;
  centroNome: string;
  forma: FormaPagamento;
  /** "aaaa-mm-dd". */
  vencimento: string;
  valor: number;
  observacao: string | null;
  viagemId: string | null;
  viagemNumero: number | null;
  lancadoPor: string | null;
  editadoPor: string | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  /** Dia do pagamento, "aaaa-mm-dd". */
  pagoEm: string | null;
  pagoPor: string | null;
  antecipacaoLiberadaEm: string | null;
  antecipacaoMotivo: string | null;
  canceladoEm: string | null;
  cancelamentoMotivo: string | null;
  /** Nomes de quem lançou, aprovou e pagou (nulo quando a pessoa não tem mais cadastro). */
  lancadoPorNome: string | null;
  aprovadoPorNome: string | null;
  pagoPorNome: string | null;
};

/**
 * Contas da aba escolhida (o filtro é feito no banco). Abertas e vencidas por vencimento (as mais antigas
 * primeiro); pagas pela data do pagamento (as mais recentes primeiro). Pagas e Todas olham o mês `mes`
 * ("aaaa-mm"): Pagas pelo dia do pagamento, Todas pelo vencimento (com as canceladas). `busca` procura na
 * descrição e no favorecido.
 */
export async function listarContasPagar(db: Banco, p: { filtro: FiltroPagar; mes: string; busca: string }): Promise<ContaPagar[]> {
  const [ini, fim] = limitesDoMes(p.mes);
  const termo = sanitizarTermo(p.busca);
  const linhas = await todas((de, ate) => {
    let q = db.from("v_fin_pagar").select("*");
    switch (p.filtro) {
      case "aberto":
        q = q.eq("aberta", true);
        break;
      case "aprovar":
        q = q.eq("aberta", true).is("aprovado_em", null);
        break;
      case "vencidas":
        q = q.eq("vencida", true);
        break;
      case "pagas":
        q = q.gte("pago_em", ini).lte("pago_em", fim);
        break;
      case "todas":
        q = q.gte("vencimento", ini).lte("vencimento", fim);
        break;
    }
    if (termo) q = q.or(`descricao.ilike.*${termo}*,favorecido_nome.ilike.*${termo}*`);
    // numero no fim: ordem estável entre as páginas de 1.000.
    q = p.filtro === "pagas" ? q.order("pago_em", { ascending: false }) : q.order("vencimento");
    return q.order("numero").range(de, ate);
  });

  const nomes = await nomesDe(db, linhas.flatMap((l) => [l.lancado_por, l.aprovado_por, l.pago_por]));
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? null) : null);
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    origem: l.origem as OrigemPagar,
    descricao: l.descricao,
    favorecidoNome: l.favorecido_nome,
    planoId: l.plano_id,
    planoNome: l.plano_nome,
    planoGrupo: l.plano_grupo,
    centroId: l.centro_custo_id,
    centroCodigo: l.centro_codigo,
    centroNome: l.centro_nome,
    forma: l.forma,
    vencimento: l.vencimento,
    valor: Number(l.valor),
    observacao: l.observacao,
    viagemId: l.viagem_id,
    viagemNumero: l.viagem_numero,
    lancadoPor: l.lancado_por,
    editadoPor: l.editado_por,
    aprovadoPor: l.aprovado_por,
    aprovadoEm: l.aprovado_em,
    pagoEm: l.pago_em,
    pagoPor: l.pago_por,
    antecipacaoLiberadaEm: l.antecipacao_liberada_em,
    antecipacaoMotivo: l.antecipacao_motivo,
    canceladoEm: l.cancelado_em,
    cancelamentoMotivo: l.cancelamento_motivo,
    lancadoPorNome: nome(l.lancado_por),
    aprovadoPorNome: nome(l.aprovado_por),
    pagoPorNome: nome(l.pago_por),
  }));
}

/* ---------- números do topo e contagem das abas ---------- */

export type IndicadoresPagar = {
  abertoQtd: number;
  abertoValor: number;
  vencidasQtd: number;
  vencidasValor: number;
  aprovarQtd: number;
  aprovarValor: number;
  pagoMesQtd: number;
  pagoMesValor: number;
};

/** `fin_indicadores_contas` do mês "aaaa-mm" (o aberto, o vencido e o a aprovar valem para hoje; o pago, para o mês). */
export async function indicadoresPagar(db: Banco, mes: string): Promise<IndicadoresPagar> {
  const r = await db.rpc("fin_indicadores_contas", { p_mes: `${mes}-01` });
  if (r.error) throw r.error;
  const p = ((r.data as { pagar?: Record<string, unknown> } | null)?.pagar ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(p[k] ?? 0);
  return {
    abertoQtd: n("aberto_qtd"),
    abertoValor: n("aberto_valor"),
    vencidasQtd: n("vencidas_qtd"),
    vencidasValor: n("vencidas_valor"),
    aprovarQtd: n("aprovar_qtd"),
    aprovarValor: n("aprovar_valor"),
    pagoMesQtd: n("pago_mes_qtd"),
    pagoMesValor: n("pago_mes_valor"),
  };
}

/** Quantas contas cada aba tem: as três primeiras vêm dos indicadores; Pagas e Todas são contadas no mês `mes`. */
export async function contagemDasAbas(db: Banco, mes: string, ind: IndicadoresPagar): Promise<Record<FiltroPagar, number>> {
  const [ini, fim] = limitesDoMes(mes);
  const [dasPagas, dasTodas] = await Promise.all([
    db.from("v_fin_pagar").select("id", { count: "exact", head: true }).gte("pago_em", ini).lte("pago_em", fim),
    db.from("v_fin_pagar").select("id", { count: "exact", head: true }).gte("vencimento", ini).lte("vencimento", fim),
  ]);
  if (dasPagas.error) throw dasPagas.error;
  if (dasTodas.error) throw dasTodas.error;
  return { aberto: ind.abertoQtd, aprovar: ind.aprovarQtd, vencidas: ind.vencidasQtd, pagas: dasPagas.count ?? 0, todas: dasTodas.count ?? 0 };
}

/* ---------- listas dos formulários ---------- */

export type TipoDespesa = { id: number; grupo: GrupoPlano; nome: string };

/** Tipos de despesa ativos (só os que servem para saída), na ordem do plano de contas. */
export async function listarTiposDespesa(db: Banco): Promise<TipoDespesa[]> {
  const r = await db.from("fin_plano_conta").select("id, grupo, nome").eq("saida", true).eq("ativo", true).order("grupo").order("ordem").order("nome");
  if (r.error) throw r.error;
  return r.data ?? [];
}

export type CentroCusto = { id: number; codigo: string; nome: string };

/** Centros de custo ativos, na ordem do código. */
export async function listarCentrosAtivos(db: Banco): Promise<CentroCusto[]> {
  const r = await db.from("centro_custo").select("id, codigo, nome").eq("ativo", true).order("codigo");
  if (r.error) throw r.error;
  return r.data ?? [];
}

/* ---------- taxa do cartão-frete ---------- */

export type TaxaCartao = {
  /** Mês "aaaa-mm". */
  mes: string;
  totalPago: number;
  pagamentos: number;
  /** Fração (0,01 = 1%); nulo sem parâmetro fiscal vigente. */
  pct: number | null;
  porTransferencia: number | null;
  valorPct: number | null;
  valorTransferencias: number | null;
  taxa: number | null;
  /** A conta da taxa deste mês, se já foi lançada. */
  conta: null | {
    numero: number;
    valor: number;
    aprovadoEm: string | null;
    pagoEm: string | null;
    canceladoEm: string | null;
    situacao: string;
  };
};

/** O que foi pago pelo cartão-frete no mês, a taxa da Pan Card e a conta dela (se lançada). */
export async function taxaDoMes(db: Banco, mes: string): Promise<TaxaCartao> {
  const r = await db.rpc("fin_taxa_cartao", { p_mes: `${mes}-01` });
  if (r.error) throw r.error;
  const t = r.data?.[0];
  const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
  let conta: TaxaCartao["conta"] = null;
  if (t?.conta_id) {
    const c = await db.from("v_fin_pagar").select("aprovado_em, pago_em, cancelado_em").eq("id", t.conta_id).maybeSingle();
    if (c.error) throw c.error;
    conta = {
      numero: Number(t.conta_numero),
      valor: Number(t.conta_valor),
      aprovadoEm: c.data?.aprovado_em ?? null,
      pagoEm: c.data?.pago_em ?? null,
      canceladoEm: c.data?.cancelado_em ?? null,
      situacao: t.conta_situacao,
    };
  }
  return {
    mes,
    totalPago: Number(t?.total_pago ?? 0),
    pagamentos: Number(t?.pagamentos ?? 0),
    pct: num(t?.pct),
    porTransferencia: num(t?.por_transferencia),
    valorPct: num(t?.valor_pct),
    valorTransferencias: num(t?.valor_transferencias),
    taxa: num(t?.taxa),
    conta,
  };
}
