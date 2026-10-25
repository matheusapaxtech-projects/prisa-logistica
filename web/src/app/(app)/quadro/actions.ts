"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado, type Json } from "@/lib/banco";
import { COLUNAS, type StatusCampo } from "@/lib/quadro";
import { RE_ID } from "../_pessoa/formulario";
import { MSG_SO_ADMIN } from "@/lib/erros";
import { NAO_ACHADA } from "../viagens/regras";
import { lerLimites, MSG_VERMELHO_MAIOR } from "./regras";

/* Gravação do Quadro: a única porta para trocar a coluna da viagem é a RPC `mover_viagem` (security
   definer). Ela recebe a coluna que a tela via (`de`); se a viagem já mudou, recusa com "…; o quadro
   foi atualizado" sem gravar nada, e a tela recarrega. As recusas dela (pt-BR) aparecem como estão. */

const STATUS: readonly string[] = COLUNAS.map((c) => c.status);
const ehStatus = (s: unknown): s is StatusCampo => typeof s === "string" && STATUS.includes(s);

/* Só o que mover_viagem lê; o resto não vai ao banco (nem para a linha do tempo). */
const NUMEROS = ["peso_saida_kg", "peso_chegada_kg"] as const;
const TEXTOS = [
  "chave_cte",
  "chave_mdfe",
  "chave_nfe",
  "ciot",
  "averbacao",
  "pausa_tipo",
  "divergencia",
  "divergencia_descricao",
  "resolucao",
  "motivo",
] as const;
/** Confirmações (motor de despacho): checklist do veículo, MDF-e e CIOT encerrados. */
const MARCAS = ["pausa_programada", "checklist_veiculo", "mdfe_encerrado", "ciot_encerrado"] as const;

/** Dados da passagem já no formato do banco (Ruling R7): pesos como número JSON, `pausa_programada`
   como booleano JSON; textos aparados e com até 2000 caracteres. Devolve o erro da tela se algo veio errado. */
function dadosDaPassagem(dados: unknown): { ok: true; json: Record<string, Json> } | { ok: false; erro: string } {
  if (typeof dados !== "object" || dados === null || Array.isArray(dados)) return { ok: true, json: {} };
  const d = dados as Record<string, unknown>;
  const json: Record<string, Json> = {};
  for (const k of NUMEROS) {
    if (d[k] === undefined) continue;
    const n = d[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
      return { ok: false, erro: k === "peso_saida_kg" ? "Informe o peso de saída em kg." : "Informe o peso de chegada em kg." };
    }
    json[k] = n;
  }
  for (const k of TEXTOS) {
    if (d[k] === undefined) continue;
    if (typeof d[k] !== "string") return { ok: false, erro: "Dados da passagem inválidos. Atualize a página." };
    const t = (d[k] as string).trim();
    if (t.length > 2000) return { ok: false, erro: "O texto tem até 2000 caracteres." };
    json[k] = t;
  }
  for (const k of MARCAS) {
    if (d[k] === undefined) continue;
    if (typeof d[k] !== "boolean") return { ok: false, erro: k === "pausa_programada" ? "Informe se a pausa é programada." : "Dados da passagem inválidos. Atualize a página." };
    json[k] = d[k] as boolean;
  }
  return { ok: true, json };
}

/** Move a viagem de `de` (a coluna que a tela via) para `para`, com os dados que a passagem pede. */
export async function moverViagem(
  viagemId: string,
  de: StatusCampo,
  para: StatusCampo,
  dados: Record<string, unknown>,
): Promise<ResultadoAcao> {
  if (typeof viagemId !== "string" || !RE_ID.test(viagemId)) return { ok: false, erro: NAO_ACHADA };
  if (!ehStatus(de) || !ehStatus(para)) return { ok: false, erro: "Coluna desconhecida. Atualize a página." };
  const d = dadosDaPassagem(dados);
  if (!d.ok) return d;
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("mover_viagem", { p_viagem: viagemId, p_de: de, p_para: para, p_dados: d.json });
    if (error) throw error;
    revalidatePath("/quadro");
    revalidatePath("/viagens");
    revalidatePath(`/viagens/${viagemId}`);
  });
}

const recusa = (message: string) => ({ code: "P0001", message });

/** Tempos-limite do Quadro (só o administrador): grava âmbar e vermelho de cada linha de `quadro_limite`.
   Valida aqui (`lerLimites`, a mesma conta da tela) e o banco repete a trava (vermelho > âmbar). O RLS
   não dá erro a quem não é administrador: o update só não atinge linha, e isso vira "só o administrador". */
export async function salvarLimites(_antes: ResultadoAcao | null, form: FormData): Promise<ResultadoAcao> {
  const v = lerLimites(form);
  if (!v.ok) return { ok: false, erro: v.erro };
  return comSessao(
    async ({ supabase }) => {
      const db = tipado(supabase);
      const respostas = await Promise.all(
        v.limites.map((l) =>
          db.from("quadro_limite").update({ minutos_ambar: l.ambar, minutos_vermelho: l.vermelho }).eq("chave", l.chave).select("chave"),
        ),
      );
      for (const r of respostas) {
        if (r.error?.code === "23514") throw recusa(MSG_VERMELHO_MAIOR);
        if (r.error) throw r.error;
      }
      if (respostas.some((r) => (r.data ?? []).length === 0)) throw recusa(MSG_SO_ADMIN);
      revalidatePath("/quadro");
      revalidatePath("/");
    },
    { somenteAdmin: true },
  );
}
