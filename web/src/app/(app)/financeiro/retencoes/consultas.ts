/* Consultas da tela de retenções, sempre com o cliente do usuário (só admin e financeiro: pode_financeiro()). */
import type { Banco } from "@/lib/banco";
import type { LinhaRetencao } from "@/lib/fiscal";

/** Retenções das viagens finalizadas no mês ("aaaa-mm") com contratado pessoa física. */
export async function retencoesDoMes(db: Banco, mes: string): Promise<LinhaRetencao[]> {
  const r = await db.rpc("fiscal_retencoes", { p_competencia: `${mes}-01` });
  if (r.error) throw r.error;
  return (r.data ?? []).map((l) => ({
    viagemId: l.viagem_id,
    viagemNumero: Number(l.viagem_numero),
    data: l.data,
    cteNumero: l.cte_numero ?? null,
    contratadoId: l.contratado_id,
    contratadoNome: l.contratado_nome,
    contratadoCpf: l.contratado_cpf ?? "",
    frete: Number(l.frete),
    base: Number(l.base),
    inss: Number(l.inss),
    sest: Number(l.sest),
    senat: Number(l.senat),
    patronal: Number(l.patronal),
    baseIrrf: Number(l.base_irrf),
  }));
}

export type Guia = { id: string; tipo: "inss" | "sest_senat"; valor: number; vencimento: string; pagaEm: string | null };

/** Guias já geradas para o mês. */
export async function guiasDoMes(db: Banco, mes: string): Promise<Guia[]> {
  const r = await db.from("fiscal_guia").select("id, tipo, valor, vencimento, paga_em").eq("competencia", `${mes}-01`).order("tipo");
  if (r.error) throw r.error;
  return (r.data ?? []).map((g) => ({ id: g.id, tipo: g.tipo, valor: Number(g.valor), vencimento: g.vencimento, pagaEm: g.paga_em }));
}

/** Vencimento das guias do mês (dia 20 do mês seguinte, antecipado no fim de semana). */
export async function vencimentoDoMes(db: Banco, mes: string): Promise<string> {
  const r = await db.rpc("fiscal_vencimento_guia", { p_competencia: `${mes}-01` });
  if (r.error) throw r.error;
  return r.data;
}
