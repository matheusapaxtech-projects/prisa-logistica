"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { RE_ID } from "../../_pessoa/formulario";

/* Acesso do motorista ao app (migration 20261107000300): a operação libera o celular; ele entra com o código
   que chega no WhatsApp desse número. O banco confere o papel e o formato do celular. */

const NAO_ACHADO = "Motorista não encontrado.";

export async function liberarAcessoApp(motoristaId: string, celular: string): Promise<ResultadoAcao<string>> {
  if (typeof motoristaId !== "string" || !RE_ID.test(motoristaId)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("liberar_acesso_app", { p_motorista: motoristaId, p_celular: String(celular ?? "") });
    if (r.error) throw r.error;
    revalidatePath(`/motoristas/${motoristaId}`);
    return r.data;
  });
}

export async function revogarAcessoApp(motoristaId: string): Promise<ResultadoAcao> {
  if (typeof motoristaId !== "string" || !RE_ID.test(motoristaId)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("revogar_acesso_app", { p_motorista: motoristaId });
    if (r.error) throw r.error;
    revalidatePath(`/motoristas/${motoristaId}`);
  });
}
