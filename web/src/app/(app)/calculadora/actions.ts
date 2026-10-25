"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { RE_ID } from "../_pessoa/formulario";

/* Gravações da calculadora: salvar a rota conferida (salvar_rota, migration 20261029000100) e apagar uma
   rota salva (só admin, pelo RLS). A tela manda números já lidos; aqui só os limites. */

export type DadosRota = { origem: string; destino: string; vias: string[]; km: number; eixos: number; pedagio: number | null };

const texto = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function salvarRota(d: DadosRota): Promise<ResultadoAcao<string>> {
  const origem = texto(d.origem);
  const destino = texto(d.destino);
  const vias = Array.isArray(d.vias) ? d.vias.map((v) => texto(v)).filter(Boolean).slice(0, 10) : [];
  const km = Math.round(Number(d.km));
  const eixos = Math.round(Number(d.eixos));
  const pedagio = d.pedagio === null ? null : Math.round(Number(d.pedagio) * 100) / 100;
  if (!origem || !destino) return { ok: false, erro: "Escolha a cidade de carga e a de descarga na lista." };
  if (!(km > 0 && km < 10000)) return { ok: false, erro: "Informe o km da rota." };
  if (!(eixos >= 2 && eixos <= 9)) return { ok: false, erro: "Escolha os eixos do caminhão." };
  if (pedagio !== null && !(pedagio >= 0)) return { ok: false, erro: "Pedágio inválido." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("salvar_rota", {
      p_origem: origem,
      p_destino: destino,
      p_vias: vias,
      p_km: km,
      p_eixos: eixos,
      ...(pedagio ? { p_pedagio: pedagio } : {}),
    });
    if (r.error) throw r.error;
    revalidatePath("/calculadora");
    return r.data;
  });
}

export async function apagarRota(id: string): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Rota não encontrada." };
  return comSessao(
    async ({ supabase }) => {
      const r = await tipado(supabase).from("rota_salva").delete().eq("id", id).select("id");
      if (r.error) throw r.error;
      if (!r.data.length) throw { code: "42501", message: "row-level security" };
      revalidatePath("/calculadora");
    },
    { somenteAdmin: true },
  );
}
