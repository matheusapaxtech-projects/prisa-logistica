/* Guardas das gravações de conjunto, conferidas no banco antes da RPC (servidor).
   O `salvar_conjunto` encerra todo conjunto aberto do cavalo; sem estas guardas, uma tela com dados
   velhos (ou um pedido forjado) encerraria em silêncio o conjunto que outra pessoa acabou de montar. */
import type { Banco } from "@/lib/banco";
import { MENSAGENS_CONJUNTO } from "@/lib/conjunto";
import type { LocalErro } from "./regras";

export const MSG_ENCERRADO = "Este conjunto já foi encerrado. Atualize a página.";
export const MSG_MOTORISTA = "Escolha um motorista com cadastro normal.";

/** Por que a gravação foi recusada antes de chegar ao banco, e onde a mensagem aparece. */
export type Recusa = { erro: string; local: LocalErro | null };

/**
 * Motorista escolhido precisa ter cadastro normal (a regra da tela: o select só oferece esses).
 * Exceção: o motorista atual do conjunto, mantido como está (pode ter ficado pendente depois).
 */
export async function conferirMotorista(db: Banco, motoristaId: string | null, atual: string | null): Promise<Recusa | null> {
  if (!motoristaId || motoristaId === atual) return null;
  const r = await db.from("motorista").select("situacao_cadastro").eq("pessoa_id", motoristaId).maybeSingle();
  if (r.error) throw r.error;
  return r.data?.situacao_cadastro === "normal" ? null : { erro: MSG_MOTORISTA, local: null };
}

/**
 * Antes de `salvar_conjunto`:
 * - conjunto novo (`conjuntoId` nulo): o cavalo não pode ter conjunto aberto (alguém montou nele
 *   enquanto a tela estava aberta) → a mensagem do banco, junto do cavalo;
 * - trocar peças: o conjunto informado tem de existir, estar aberto e ser do mesmo cavalo;
 *   senão (encerrado nesse meio-tempo, ou ids que não combinam) → "Este conjunto já foi encerrado…";
 * - motorista: `conferirMotorista`.
 * `null` = pode gravar.
 */
export async function conferirMontagem(
  db: Banco,
  m: { conjuntoId: string | null; cavaloId: string; motoristaId: string | null },
): Promise<Recusa | null> {
  let atual: string | null = null;
  if (m.conjuntoId) {
    const r = await db.from("conjunto").select("id, cavalo_id, motorista_id, fim").eq("id", m.conjuntoId).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data || r.data.fim || r.data.cavalo_id !== m.cavaloId) return { erro: MSG_ENCERRADO, local: null };
    atual = r.data.motorista_id;
  } else {
    const r = await db.from("conjunto").select("id").eq("cavalo_id", m.cavaloId).is("fim", null).limit(1);
    if (r.error) throw r.error;
    if (r.data?.length) return { erro: MENSAGENS_CONJUNTO.emOutroConjunto, local: { alvo: "cavalo" } };
  }
  return conferirMotorista(db, m.motoristaId, atual);
}
