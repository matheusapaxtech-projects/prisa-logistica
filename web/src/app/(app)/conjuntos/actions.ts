"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { createClient } from "@/lib/supabase/server";
import { carregarAbertos, carregarVeiculos } from "./consultas";
import { conferirMontagem, conferirMotorista, MSG_ENCERRADO, type Recusa } from "./guardas";
import { localizarErro, MAX_PECAS, type LocalErro } from "./regras";

/* Gravações da tela de Conjuntos. Montar e trocar peças = uma chamada só de `salvar_conjunto`
   (encerra o anterior, insere o novo e valida dentro da mesma transação: ou grava tudo, ou nada).
   Antes da RPC, as guardas (guardas.ts) conferem no banco que o cavalo está livre (montar) ou que o
   conjunto editado continua aberto e é do mesmo cavalo (trocar peças): o `salvar_conjunto` encerra
   todo conjunto aberto do cavalo e não pode fechar o de outra pessoa em silêncio.
   Encerrar = `encerrar_conjunto`. Trocar motorista = update de `conjunto.motorista_id` (o conjunto
   continua o mesmo). Tudo passa por `comSessao` (RLS: só admin e operação gravam). */

const id = z.guid("Conjunto inválido. Atualize a página.");

const Montagem = z.object({
  conjuntoId: id.nullable(),
  cavaloId: z.guid("Para salvar, escolha o cavalo."),
  motoristaId: z.guid("Motorista inválido. Escolha de novo.").nullable(),
  itens: z
    .array(z.guid("Peça inválida. Remova e adicione de novo."))
    .min(1, "Para salvar, adicione pelo menos uma carreta.")
    .max(MAX_PECAS, `O conjunto já tem ${MAX_PECAS} peças, o máximo.`),
});
export type Montagem = z.infer<typeof Montagem>;

/** Resultado do salvar: o id do conjunto novo, ou o erro e onde ele aparece (cavalo ou peça). */
export type ResultadoMontagem = ResultadoAcao<string> | { ok: false; erro: string; local: LocalErro | null };

/** Tudo muda junto: lista, fichas, Início, selo do menu e a aba Conjunto dos veículos. */
function revalidar() {
  revalidatePath("/", "layout");
}

/**
 * Onde a mensagem do banco aparece: refaz a validação com os dados atuais do banco, tirando o
 * conjunto editado e o aberto do mesmo cavalo (o `salvar_conjunto` encerra os dois antes de validar).
 * Falha de leitura → `null` (a mensagem vai para o aviso geral, nunca some).
 */
async function localizarNoBanco(erro: string, m: Montagem): Promise<LocalErro | null> {
  try {
    const db = tipado(await createClient());
    const [veiculos, abertos] = await Promise.all([carregarVeiculos(db, [m.cavaloId, ...m.itens]), carregarAbertos(db)]);
    const cavalo = veiculos.get(m.cavaloId) ?? null;
    const itens = m.itens.flatMap((x) => veiculos.get(x) ?? []);
    if (itens.length !== m.itens.length) return null;
    const outros = abertos.filter((c) => c.id !== m.conjuntoId && c.cavalo_id !== m.cavaloId);
    return localizarErro(erro, cavalo, itens, outros);
  } catch {
    return null;
  }
}

export async function salvarConjunto(entrada: Montagem): Promise<ResultadoMontagem> {
  const p = Montagem.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0].message, local: null };
  const m = p.data;

  // a recusa das guardas sai daqui de dentro com o lugar onde aparece (cavalo), não só a frase
  const guarda: { recusa: Recusa | null } = { recusa: null };
  const r = await comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    guarda.recusa = await conferirMontagem(db, m);
    if (guarda.recusa) return "";
    const { data, error } = await db.rpc("salvar_conjunto", {
      // os tipos gerados não dizem que os dois aceitam null (conjunto novo, sem motorista)
      p_conjunto_id: m.conjuntoId as string,
      p_cavalo_id: m.cavaloId,
      p_motorista_id: m.motoristaId as string,
      p_itens: m.itens,
    });
    if (error) throw error;
    revalidar();
    return data;
  });
  if (guarda.recusa) return { ok: false, ...guarda.recusa };
  if (r.ok) return r;
  return { ok: false, erro: r.erro, local: await localizarNoBanco(r.erro, m) };
}

export async function encerrarConjunto(conjuntoId: string): Promise<ResultadoAcao> {
  const p = id.safeParse(conjuntoId);
  if (!p.success) return { ok: false, erro: p.error.issues[0].message };
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("encerrar_conjunto", { p_conjunto_id: p.data });
    if (error) throw error;
    revalidar();
  });
}

const Troca = z.object({ conjuntoId: id, motoristaId: z.guid("Motorista inválido. Escolha de novo.").nullable() });

export async function trocarMotorista(entrada: z.infer<typeof Troca>): Promise<ResultadoAcao> {
  const p = Troca.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0].message };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const atual = await db.from("conjunto").select("motorista_id, fim").eq("id", p.data.conjuntoId).maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data || atual.data.fim) throw { code: "P0001", message: MSG_ENCERRADO };
    const recusa = await conferirMotorista(db, p.data.motoristaId, atual.data.motorista_id);
    if (recusa) throw { code: "P0001", message: recusa.erro };
    const { data, error } = await db
      .from("conjunto")
      .update({ motorista_id: p.data.motoristaId })
      .eq("id", p.data.conjuntoId)
      .is("fim", null)
      .select("id");
    if (error) throw error;
    // nenhuma linha: encerrado nesse meio-tempo (ou o RLS barrou)
    if (!data?.length) throw { code: "P0001", message: MSG_ENCERRADO };
    revalidar();
  });
}
