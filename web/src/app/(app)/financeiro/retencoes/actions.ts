"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { mesValido } from "@/lib/financeiro";

/* Gravações da tela de retenções. Quem pode é o banco (pode_financeiro(): admin e financeiro). */

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const recusa = (message: string) => ({ code: "P0001", message });

/** Gera (ou atualiza) as guias de INSS e SEST/SENAT do mês. */
export async function gerarGuias(mes: string): Promise<ResultadoAcao<number>> {
  return comSessao(async ({ supabase }) => {
    if (!mesValido(mes)) throw recusa("Mês inválido. Atualize a página.");
    const r = await tipado(supabase).rpc("fiscal_gerar_guias", { p_competencia: `${mes}-01` });
    if (r.error) throw r.error;
    revalidatePath("/financeiro/retencoes");
    return r.data;
  });
}

/** Marca a guia como paga na data (ou desfaz, com null). */
export async function marcarGuia(id: string, data: string | null): Promise<ResultadoAcao> {
  return comSessao(async ({ supabase }) => {
    if (data !== null && !RE_DATA.test(data)) throw recusa("Informe a data do pagamento.");
    const r = await tipado(supabase).rpc("fiscal_marcar_guia", { p_guia: id, p_data: data as string });
    if (r.error) throw r.error;
    revalidatePath("/financeiro/retencoes");
  });
}
