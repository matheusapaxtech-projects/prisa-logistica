"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { lerCentroNovo, lerNome } from "./regras";

/* Gravações dos centros de custo: só o administrador (o RLS confere). Não existe apagar: desativa-se. O banco
   recusa trocar o código e criar subdepartamento sem o departamento, e a frase dele chega à tela como vem. */

const OPCOES = { somenteAdmin: true } as const;
const NAO_ACHADO = "Centro de custo não encontrado. Atualize a página.";
/** Erro com frase pronta para a tela (`mensagemDeErro` mostra a mensagem de P0001 como está). */
const recusa = (message: string) => ({ code: "P0001", message });

function revalidar() {
  revalidatePath("/centros-de-custo");
}

const ehId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v < 32768;

export async function criarCentro(form: FormData): Promise<ResultadoAcao> {
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const existentes = await db.from("centro_custo").select("codigo");
    if (existentes.error) throw existentes.error;
    const lido = lerCentroNovo(
      form,
      (existentes.data ?? []).map((c) => c.codigo),
    );
    if (!lido.ok) throw recusa(Object.values(lido.erros).find(Boolean) ?? "Confira os campos.");
    const r = await db.from("centro_custo").insert(lido.dados);
    if (r.error) throw r.error;
    revalidar();
  }, OPCOES);
}

export async function renomearCentro(id: number, nome: string): Promise<ResultadoAcao> {
  if (!ehId(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const lido = lerNome(nome);
    if (!lido.ok) throw recusa(lido.erro);
    const r = await tipado(supabase).from("centro_custo").update({ nome: lido.nome }).eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw recusa(NAO_ACHADO);
    revalidar();
  }, OPCOES);
}

export async function definirAtivo(id: number, ativo: boolean): Promise<ResultadoAcao> {
  if (!ehId(id) || typeof ativo !== "boolean") return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("centro_custo").update({ ativo }).eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw recusa(NAO_ACHADO);
    revalidar();
  }, OPCOES);
}
