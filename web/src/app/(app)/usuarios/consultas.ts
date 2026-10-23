import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsuarioLinha, UsuarioTela } from "./papeis";

/** `listar_usuarios()` (só admin; inclui quem tem conta mas ainda não tem perfil). */
export async function listarUsuarios(supabase: SupabaseClient): Promise<UsuarioTela[]> {
  const { data, error } = await tipado(supabase).rpc("listar_usuarios");
  if (error) throw error;
  return ((data ?? []) as unknown as UsuarioLinha[]).map((u) => ({
    ...u,
    acesso: u.ultimo_acesso ? formato.relativo(u.ultimo_acesso) : "nunca entrou",
  }));
}
