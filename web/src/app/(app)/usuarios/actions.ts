"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";

/* Gravação de /usuarios: define o papel, o nome e se o acesso está ativo (`definir_perfil`, só admin).
   Validação = a do protótipo (mesmas mensagens). As regras que moram no banco (o administrador não tira
   o próprio acesso de administrador, usuário inexistente) chegam à tela com a mensagem do banco. */

const Entrada = z.object({
  userId: z.guid("Usuário não encontrado. Atualize a página."),
  nome: z.string().trim().min(1, "Digite o nome da pessoa para dar acesso.").max(60, "O nome tem até 60 caracteres."),
  papel: z.enum(["admin", "operacao", "financeiro", "leitura"], "Escolha um papel para dar acesso."),
  ativo: z.boolean("Informe se o acesso está ativo."),
});

export type EntradaPerfil = z.input<typeof Entrada>;

export async function definirPerfil(entrada: EntradaPerfil): Promise<ResultadoAcao> {
  const v = Entrada.safeParse(entrada);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const { userId, nome, papel, ativo } = v.data;
  return comSessao(
    async ({ supabase }) => {
      const { error } = await tipado(supabase).rpc("definir_perfil", { p_user_id: userId, p_nome: nome, p_papel: papel, p_ativo: ativo });
      if (error) throw error;
      revalidatePath("/usuarios");
      revalidatePath("/auditoria");
    },
    { somenteAdmin: true },
  );
}
