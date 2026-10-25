"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { RE_ID } from "../_pessoa/formulario";

/* Gravações de "Motoristas livres" (motorista_disponibilidade, migration 20261029000500): registrar o que o
   motorista avisou (cidade e até quando está livre) e encerrar a disponibilidade. Admin e operação (RLS). */

export type DadosDisponibilidade = { motoristaId: string; cidade: string; lat: number; lon: number; horas: number; observacao: string };

function revalidar() {
  revalidatePath("/disponiveis");
  revalidatePath("/pedidos/[id]", "page");
}

export async function registrarDisponibilidade(d: DadosDisponibilidade): Promise<ResultadoAcao> {
  if (!RE_ID.test(d.motoristaId)) return { ok: false, erro: "Escolha o motorista." };
  const cidade = typeof d.cidade === "string" ? d.cidade.trim().slice(0, 120) : "";
  if (!cidade || !Number.isFinite(d.lat) || !Number.isFinite(d.lon)) return { ok: false, erro: "Escolha a cidade na lista." };
  const horas = Math.round(Number(d.horas));
  if (!(horas >= 1 && horas <= 168)) return { ok: false, erro: "Escolha até quando ele está livre." };
  const obs = typeof d.observacao === "string" ? d.observacao.trim().slice(0, 500) : "";
  return comSessao(async ({ supabase }) => {
    const agora = new Date();
    const { error } = await tipado(supabase)
      .from("motorista_disponibilidade")
      .insert({
        motorista_id: d.motoristaId,
        cidade,
        latitude: Math.round(d.lat * 1e6) / 1e6,
        longitude: Math.round(d.lon * 1e6) / 1e6,
        livre_desde: agora.toISOString(),
        livre_ate: new Date(agora.getTime() + horas * 36e5).toISOString(),
        observacao: obs || null,
      });
    if (error) throw error;
    revalidar();
  });
}

/** Encerra a disponibilidade (livre até agora): o motorista sai do ranking. */
export async function encerrarDisponibilidade(id: string): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Registro não encontrado." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase)
      .from("motorista_disponibilidade")
      .update({ livre_ate: new Date(Date.now() + 1000).toISOString() })
      .eq("id", id)
      .select("id");
    if (r.error) throw r.error;
    if (!r.data.length) throw { code: "42501", message: "row-level security" };
    revalidar();
  });
}
