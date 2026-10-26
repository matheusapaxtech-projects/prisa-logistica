"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { MUNICIPIOS_RAW } from "@/lib/calculadora/municipios-dados";
import { acharMunicipio, lerMunicipios, type Municipios } from "@/lib/calculadora/rota";
import { RE_ID } from "../_pessoa/formulario";
import { CARROCERIA } from "../veiculos/rotulos";

/* Publicar o pedido no app do motorista (migration 20261031000200, frete_oferta). A posição da coleta vem da
   lista de municípios pela cidade do local, a mesma do despacho. RLS: só admin e operação gravam. */

let municipios: Municipios | null = null;
const lista = () => (municipios ??= lerMunicipios(MUNICIPIOS_RAW));
const recusa = (message: string) => ({ code: "P0001", message });
const CARROCERIAS = new Set<string>(CARROCERIA.map(([k]) => k));

export type DadosOferta = {
  fretePorT: string;
  carrocerias: string[];
  eixosMinimos: string;
  raioKm: string;
  observacao: string;
};

/** "1.234,56" → 1234.56; vazio ou inválido → NaN. */
const numeroBr = (v: string) => (v.trim() ? Number(v.trim().replace(/\./g, "").replace(",", ".")) : NaN);

export async function publicarOferta(pedidoId: string, d: DadosOferta): Promise<ResultadoAcao> {
  if (typeof pedidoId !== "string" || !RE_ID.test(pedidoId)) return { ok: false, erro: "Pedido não encontrado." };
  const frete = numeroBr(String(d.fretePorT ?? ""));
  if (!(frete > 0) || frete > 100000) return { ok: false, erro: "Informe o frete do motorista por tonelada." };
  const raio = d.raioKm?.trim() ? Number(d.raioKm) : 300;
  if (!Number.isInteger(raio) || raio < 1 || raio > 1500) return { ok: false, erro: "O raio de busca vai de 1 a 1.500 km." };
  const eixos = d.eixosMinimos ? Number(d.eixosMinimos) : null;
  if (eixos !== null && !(Number.isInteger(eixos) && eixos >= 2 && eixos <= 12)) return { ok: false, erro: "Escolha os eixos mínimos." };
  const carrocerias = (d.carrocerias ?? []).filter((c) => CARROCERIAS.has(c)) as (typeof CARROCERIA)[number][0][];
  const observacao = String(d.observacao ?? "").trim().slice(0, 500) || null;

  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const p = await db
      .from("pedido")
      .select("situacao, coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf)")
      .eq("id", pedidoId)
      .maybeSingle();
    if (p.error) throw p.error;
    if (!p.data) throw recusa("Pedido não encontrado.");
    if (p.data.situacao !== "aberto") throw recusa("Só pedido aberto vai para o app.");
    const coleta = Array.isArray(p.data.coleta) ? p.data.coleta[0] : p.data.coleta;
    const m = coleta ? acharMunicipio(lista(), `${coleta.cidade}/${coleta.uf}`).municipio : null;
    if (!m || !coleta) throw recusa("A cidade de coleta não está na lista de municípios: confira o cadastro do local.");

    // Uma oferta aberta por pedido: publicar de novo troca os termos (encerra a anterior).
    const fim = await db.from("frete_oferta").update({ encerrada_em: new Date().toISOString() }).eq("pedido_id", pedidoId).is("encerrada_em", null);
    if (fim.error) throw fim.error;
    const r = await db.from("frete_oferta").insert({
      pedido_id: pedidoId,
      frete_motorista_por_t: Math.round(frete * 100) / 100,
      coleta_latitude: m.lat,
      coleta_longitude: m.lon,
      coleta_uf: coleta.uf,
      carrocerias: carrocerias.length ? carrocerias : null,
      eixos_minimos: eixos,
      raio_km: raio,
      observacao,
    });
    if (r.error) throw r.error;
    revalidatePath(`/pedidos/${pedidoId}`);
  });
}

export async function encerrarOferta(pedidoId: string): Promise<ResultadoAcao> {
  if (typeof pedidoId !== "string" || !RE_ID.test(pedidoId)) return { ok: false, erro: "Pedido não encontrado." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase)
      .from("frete_oferta")
      .update({ encerrada_em: new Date().toISOString() })
      .eq("pedido_id", pedidoId)
      .is("encerrada_em", null);
    if (r.error) throw r.error;
    revalidatePath(`/pedidos/${pedidoId}`);
  });
}
