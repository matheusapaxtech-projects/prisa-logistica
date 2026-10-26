/* Consultas do contas a receber, sempre com o cliente do usuário (RLS: só admin e financeiro veem). */
import type { Banco } from "@/lib/banco";
import { sanitizarTermo } from "@/lib/busca";
import type { FormaPagamento, SituacaoReceber } from "@/lib/contas";
import { limitesDoMes } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import type { GrupoPlano } from "../pagar/regras";
import type { FiltroReceber } from "./regras";

export type TituloReceber = {
  id: string;
  numero: number;
  clienteId: string;
  clienteNome: string;
  titulo: string;
  planoId: number;
  planoNome: string;
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
  situacao: SituacaoReceber;
  /** Dia do recebimento, "aaaa-mm-dd". */
  recebidoEm: string | null;
  recebidoPor: string | null;
  canceladoEm: string | null;
  cancelamentoMotivo: string | null;
  /** Nome de quem registrou o recebimento (nulo quando a pessoa não tem mais cadastro). */
  recebidoPorNome: string | null;
};

/** A API devolve no máximo 1.000 linhas por vez: busca em páginas até acabar. */
async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const TAM = 1000;
  const saida: T[] = [];
  for (let de = 0; ; de += TAM) {
    const { data, error } = await pagina(de, de + TAM - 1);
    if (error) throw error;
    saida.push(...(data ?? []));
    if (!data || data.length < TAM) return saida;
  }
}

/** Nome de cada usuário citado (quem registrou o recebimento). */
async function nomesDe(db: Banco, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))];
  if (unicos.length === 0) return new Map();
  const r = await db.rpc("nomes_usuarios", { p_ids: unicos });
  if (r.error) throw r.error;
  return new Map((r.data ?? []).map((n) => [n.user_id, n.nome]));
}

/**
 * Títulos da aba escolhida (o filtro é feito no banco). Em aberto e vencidos por vencimento (os mais antigos
 * primeiro); recebidos pela data do recebimento (os mais recentes primeiro). Recebidas e Todas olham o mês `mes`
 * ("aaaa-mm"): Recebidas pelo dia do recebimento, Todas pelo vencimento (com os cancelados). `busca` procura no
 * título e no nome do cliente.
 */
export async function listarTitulos(db: Banco, p: { filtro: FiltroReceber; mes: string; busca: string }): Promise<TituloReceber[]> {
  const [ini, fim] = limitesDoMes(p.mes);
  const termo = sanitizarTermo(p.busca);
  const linhas = await todas((de, ate) => {
    let q = db.from("v_fin_receber").select("*");
    switch (p.filtro) {
      case "aberto":
        q = q.eq("aberta", true);
        break;
      case "vencidas":
        q = q.eq("vencida", true);
        break;
      case "recebidas":
        q = q.gte("recebido_em", ini).lte("recebido_em", fim);
        break;
      case "todas":
        q = q.gte("vencimento", ini).lte("vencimento", fim);
        break;
    }
    if (termo) q = q.or(`titulo.ilike.*${termo}*,cliente_nome.ilike.*${termo}*`);
    // numero no fim: ordem estável entre as páginas de 1.000.
    q = p.filtro === "recebidas" ? q.order("recebido_em", { ascending: false }) : q.order("vencimento");
    return q.order("numero").range(de, ate);
  });

  const nomes = await nomesDe(db, linhas.map((l) => l.recebido_por));
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    clienteId: l.cliente_id,
    clienteNome: l.cliente_nome ?? "—",
    titulo: l.titulo,
    planoId: l.plano_id,
    planoNome: l.plano_nome,
    centroId: l.centro_custo_id,
    centroCodigo: l.centro_codigo,
    centroNome: l.centro_nome,
    forma: l.forma,
    vencimento: l.vencimento,
    valor: Number(l.valor),
    observacao: l.observacao,
    viagemId: l.viagem_id,
    viagemNumero: l.viagem_numero,
    situacao: l.situacao as SituacaoReceber,
    recebidoEm: l.recebido_em,
    recebidoPor: l.recebido_por,
    canceladoEm: l.cancelado_em,
    cancelamentoMotivo: l.cancelamento_motivo,
    recebidoPorNome: l.recebido_por ? (nomes.get(l.recebido_por) ?? null) : null,
  }));
}

/* ---------- números do topo e contagem das abas ---------- */

export type IndicadoresReceber = {
  abertoQtd: number;
  abertoValor: number;
  vencidasQtd: number;
  vencidasValor: number;
  /** A receber nos próximos 30 dias (inclui o que já venceu e segue em aberto). */
  em30Qtd: number;
  em30Valor: number;
  recebidoMesQtd: number;
  recebidoMesValor: number;
};

/** `fin_indicadores_contas` do mês "aaaa-mm" (o aberto e o vencido valem para hoje; o recebido, para o mês). */
export async function indicadoresReceber(db: Banco, mes: string): Promise<IndicadoresReceber> {
  const r = await db.rpc("fin_indicadores_contas", { p_mes: `${mes}-01` });
  if (r.error) throw r.error;
  const p = ((r.data as { receber?: Record<string, unknown> } | null)?.receber ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(p[k] ?? 0);
  return {
    abertoQtd: n("aberto_qtd"),
    abertoValor: n("aberto_valor"),
    vencidasQtd: n("vencidas_qtd"),
    vencidasValor: n("vencidas_valor"),
    em30Qtd: n("em30_qtd"),
    em30Valor: n("em30_valor"),
    recebidoMesQtd: n("recebido_mes_qtd"),
    recebidoMesValor: n("recebido_mes_valor"),
  };
}

/** Quantos títulos cada aba tem: as duas primeiras vêm dos indicadores; Recebidas e Todas são contadas no mês `mes`. */
export async function contagemDasAbas(db: Banco, mes: string, ind: IndicadoresReceber): Promise<Record<FiltroReceber, number>> {
  const [ini, fim] = limitesDoMes(mes);
  const [dasRecebidas, dasTodas] = await Promise.all([
    db.from("v_fin_receber").select("id", { count: "exact", head: true }).gte("recebido_em", ini).lte("recebido_em", fim),
    db.from("v_fin_receber").select("id", { count: "exact", head: true }).gte("vencimento", ini).lte("vencimento", fim),
  ]);
  if (dasRecebidas.error) throw dasRecebidas.error;
  if (dasTodas.error) throw dasTodas.error;
  return { aberto: ind.abertoQtd, vencidas: ind.vencidasQtd, recebidas: dasRecebidas.count ?? 0, todas: dasTodas.count ?? 0 };
}

/* ---------- listas dos formulários ---------- */

export type TipoReceita = { id: number; grupo: GrupoPlano; nome: string };

/** Tipos de receita ativos (só os que servem para entrada), na ordem do plano de contas. */
export async function listarTiposReceita(db: Banco): Promise<TipoReceita[]> {
  const r = await db.from("fin_plano_conta").select("id, grupo, nome").eq("entrada", true).eq("ativo", true).order("grupo").order("ordem").order("nome");
  if (r.error) throw r.error;
  return r.data ?? [];
}

export type OpcaoCliente = { id: string; rotulo: string };

/** Clientes do cadastro para escolher: "apelido ou nome · documento", em ordem alfabética. */
export async function listarClientesParaEscolher(db: Banco): Promise<OpcaoCliente[]> {
  const r = await db.from("cliente").select("pessoa_id, pessoa(tipo, nome, apelido, cpf, cnpj)");
  if (r.error) throw r.error;
  return (r.data ?? [])
    .flatMap((c) => {
      const p = c.pessoa;
      if (!p) return [];
      const nome = p.apelido?.trim() || p.nome;
      const doc = formato.doc(p);
      return [{ id: c.pessoa_id, rotulo: doc ? `${nome} · ${doc}` : nome }];
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
