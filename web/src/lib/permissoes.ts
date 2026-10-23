// Perfil do usuário logado (só servidor). Para Client Components, importe `pode` de "@/lib/papeis".
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Papel, Perfil } from "@/lib/papeis";

export { pode } from "@/lib/papeis";
export type { AcaoPermitida, Papel, Perfil } from "@/lib/papeis";

/**
 * Lê a linha de `perfil_usuario` do próprio usuário (a policy deixa cada um ver o seu, ativo ou não).
 * `null` sem sessão ou sem perfil. Memorizado por requisição (layout e páginas podem chamar à vontade).
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data: sessao } = await supabase.auth.getClaims();
  const userId = sessao?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("perfil_usuario")
    .select("user_id, nome, papel, ativo")
    .eq("user_id", userId)
    .maybeSingle();
  // Falha de rede/banco não é "sem acesso": deixa o error boundary mostrar o erro.
  if (error) throw error;
  if (!data) return null;

  return { userId: data.user_id, nome: data.nome, papel: data.papel as Papel, ativo: data.ativo };
});

/**
 * Para páginas do sistema: sem sessão → `/login`; sem perfil ou desativado → `/sem-acesso`
 * (explica o que houve, em vez de listas vazias que parecem erro). Devolve o perfil ativo.
 */
export async function exigirPerfil(): Promise<Perfil> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const perfil = await getPerfil();
  if (!perfil || !perfil.ativo) redirect("/sem-acesso");
  return perfil;
}
