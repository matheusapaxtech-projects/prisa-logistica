/* Consultas de leitura compartilhadas pelas telas (servidor). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipado } from "@/lib/banco";

export type ResumoPendencias = {
  /** Linhas de v_pendencias_documentos, menos `arquivo_vencido` (esses entram em `vencidos`). */
  documentos: number;
  /** Linhas de v_vencimentos com `dias < 0` (cadastro + arquivos, sem repetir documento). */
  vencidos: number;
  /** Conjuntos abertos (`fim is null`) com `excede_cmt` em v_conjunto_capacidade. */
  acimaCmt: number;
  /** Soma dos três: o número do selo "Pendências" no menu. */
  total: number;
};

/**
 * Mesma regra do protótipo (`montarShell` em nilt.js): pendências sem `arquivo_vencido` +
 * documentos vencidos + conjuntos acima do CMT. Vale o RLS de quem consulta (as views são
 * security_invoker). Erro de banco sobe (o error boundary mostra).
 */
export async function resumoPendencias(cliente: SupabaseClient): Promise<ResumoPendencias> {
  const db = tipado(cliente);
  const [pend, venc, abertos, cmt] = await Promise.all([
    db
      .from("v_pendencias_documentos")
      .select("*", { count: "exact", head: true })
      .neq("tipo_pendencia", "arquivo_vencido"),
    db.from("v_vencimentos").select("*", { count: "exact", head: true }).lt("dias", 0),
    db.from("conjunto").select("id").is("fim", null),
    db.from("v_conjunto_capacidade").select("conjunto_id").eq("excede_cmt", true),
  ]);
  for (const r of [pend, venc, abertos, cmt]) if (r.error) throw r.error;

  const idsAbertos = new Set((abertos.data ?? []).map((c) => c.id));
  const documentos = pend.count ?? 0;
  const vencidos = venc.count ?? 0;
  const acimaCmt = (cmt.data ?? []).filter((c) => c.conjunto_id && idsAbertos.has(c.conjunto_id)).length;
  return { documentos, vencidos, acimaCmt, total: documentos + vencidos + acimaCmt };
}

/** Só o número do selo "Pendências" do menu. */
export async function contarPendencias(cliente: SupabaseClient): Promise<number> {
  return (await resumoPendencias(cliente)).total;
}
