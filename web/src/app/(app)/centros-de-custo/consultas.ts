/* Consultas dos centros de custo, sempre com o cliente do usuário (todos leem; admin e financeiro veem o uso). */
import type { Banco } from "@/lib/banco";
import { todas } from "../financeiro/contas-comum/consulta";
import type { CentroLinha } from "./regras";

/** Todos os centros (ativos e desativados), em ordem de código. */
export async function listarCentros(db: Banco): Promise<CentroLinha[]> {
  const r = await db.from("centro_custo").select("id, codigo, nome, ativo").order("codigo");
  if (r.error) throw r.error;
  return r.data ?? [];
}

/** Contas a pagar em aberto (nem pagas nem canceladas) por centro de custo: `id do centro → quantidade`. */
export async function contasAbertasPorCentro(db: Banco): Promise<Map<number, number>> {
  const linhas = await todas<{ centro_custo_id: number }>((de, ate) =>
    db.from("fin_pagar").select("centro_custo_id").is("pago_em", null).is("cancelado_em", null).order("id").range(de, ate),
  );
  const uso = new Map<number, number>();
  for (const l of linhas) uso.set(l.centro_custo_id, (uso.get(l.centro_custo_id) ?? 0) + 1);
  return uso;
}
