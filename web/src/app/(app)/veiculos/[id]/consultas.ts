/* Consultas da ficha do veículo (somente servidor, com a sessão do usuário: o RLS vale). */
import { cache } from "react";
import { tipado, type Banco } from "@/lib/banco";
import { createClient } from "@/lib/supabase/server";
import type { PecaEngate } from "@/components/Engate";
import { capacidadeEfetiva, um, type TipoVeiculo } from "../rotulos";
import type { VeiculoFicha } from "./tipos";

type Embutido<T> = T | T[] | null;

export type FichaCarregada = {
  v: VeiculoFicha;
  tipo: TipoVeiculo;
  marca: string | null;
};

/** Veículo + tipo + marca; nulo se o id não existe (ou o RLS não o mostra). Memorizado por requisição. */
export const carregarVeiculo = cache(async (id: string): Promise<FichaCarregada | null> => {
  const db = tipado(await createClient());
  const { data, error } = await db
    .from("veiculo")
    .select("*, tipo_veiculo(id, nome, categoria, eixos, configuracao_cavalo), marca_veiculo(nome)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { tipo_veiculo, marca_veiculo, ...v } = data;
  const tipo = um(tipo_veiculo as Embutido<TipoVeiculo>);
  if (!tipo) return null;
  return { v: v as VeiculoFicha, tipo, marca: um(marca_veiculo as Embutido<{ nome: string }>)?.nome ?? null };
});

export type ArquivoResumo = { id: string; tipo: string; nome: string; validade: string | null; restrito: boolean };

/** Arquivos do veículo que o usuário pode ver (o contrato restrito some para quem não é admin). */
export async function listarArquivos(db: Banco, veiculoId: string): Promise<ArquivoResumo[]> {
  const { data, error } = await db
    .from("arquivo")
    .select("id, nome_original, validade, restrito, storage_path, tipo_arquivo(nome)")
    .eq("veiculo_id", veiculoId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    tipo: um(a.tipo_arquivo as Embutido<{ nome: string }>)?.nome ?? "Documento",
    nome: a.nome_original ?? a.storage_path.split("/").pop() ?? "",
    validade: a.validade,
    restrito: a.restrito,
  }));
}

/** Id do conjunto aberto em que o veículo está (como cavalo ou como peça), se houver. */
export async function conjuntoAberto(db: Banco, veiculoId: string): Promise<string | null> {
  const [comoCavalo, comoPeca] = await Promise.all([
    db.from("conjunto").select("id").eq("cavalo_id", veiculoId).is("fim", null).maybeSingle(),
    db
      .from("conjunto_item")
      .select("conjunto_id, conjunto!inner(fim)")
      .eq("veiculo_id", veiculoId)
      .is("conjunto.fim", null)
      .limit(1)
      .maybeSingle(),
  ]);
  if (comoCavalo.error) throw comoCavalo.error;
  if (comoPeca.error) throw comoPeca.error;
  return comoCavalo.data?.id ?? comoPeca.data?.conjunto_id ?? null;
}

export type Capacidade = { limite_t: number | null; capacidade_total_t: number; excede_cmt: boolean; tara_total_t: number };

/** Capacidade do conjunto (`v_conjunto_capacidade`); `limite_t` = CMT − tara total, como a tela de Início. */
export async function capacidadeDoConjunto(db: Banco, conjuntoId: string): Promise<Capacidade | null> {
  const { data, error } = await db
    .from("v_conjunto_capacidade")
    .select("cmt_t, tara_total_t, capacidade_total_t, excede_cmt")
    .eq("conjunto_id", conjuntoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const tara = data.tara_total_t ?? 0;
  return {
    limite_t: data.cmt_t != null ? Math.round((data.cmt_t - tara) * 100) / 100 : null,
    capacidade_total_t: data.capacidade_total_t ?? 0,
    excede_cmt: !!data.excede_cmt,
    tara_total_t: tara,
  };
}

export type ConjuntoDetalhe = {
  id: string;
  inicio: string;
  fim: string | null;
  cavalo: PecaEngate;
  itens: PecaEngate[];
  motorista: { id: string; nome: string } | null;
  eixos: number;
};

type PecaBruta = {
  placa: string;
  pbt_t: number | null;
  tara_t: number | null;
  capacidade_carga_t: number | null;
  tipo_veiculo: Embutido<{ categoria: PecaEngate["categoria"]; configuracao_cavalo: "toco" | "trucado" | null; eixos: number }>;
};

function peca(b: PecaBruta): PecaEngate {
  const t = um(b.tipo_veiculo);
  return {
    placa: b.placa,
    categoria: t?.categoria ?? "outros",
    configuracao_cavalo: t?.configuracao_cavalo ?? null,
    eixos: t?.eixos ?? 0,
    capacidade_carga_t: t?.categoria === "carreta" ? capacidadeEfetiva(b) : null,
  };
}

const PECA = "id, placa, pbt_t, tara_t, capacidade_carga_t, tipo_veiculo(categoria, configuracao_cavalo, eixos)";
const CONJUNTO = `id, cavalo_id, inicio, fim, motorista_id, cavalo:veiculo!conjunto_cavalo_id_fkey(${PECA}), conjunto_item(posicao, veiculo(${PECA})), motorista(pessoa(nome))`;

/** Todos os conjuntos de que o veículo já fez parte (o aberto primeiro, depois os encerrados, mais novos antes). */
export async function conjuntosDoVeiculo(db: Banco, veiculoId: string): Promise<ConjuntoDetalhe[]> {
  const [comoCavalo, comoPeca] = await Promise.all([
    db.from("conjunto").select(CONJUNTO).eq("cavalo_id", veiculoId),
    db.from("conjunto_item").select("conjunto_id").eq("veiculo_id", veiculoId),
  ]);
  if (comoCavalo.error) throw comoCavalo.error;
  if (comoPeca.error) throw comoPeca.error;
  const idsPeca = (comoPeca.data ?? []).map((c) => c.conjunto_id);
  const comoItem = idsPeca.length ? await db.from("conjunto").select(CONJUNTO).in("id", idsPeca) : null;
  if (comoItem?.error) throw comoItem.error;

  type Bruto = {
    id: string;
    inicio: string;
    fim: string | null;
    motorista_id: string | null;
    cavalo: Embutido<PecaBruta>;
    conjunto_item: { posicao: number; veiculo: Embutido<PecaBruta> }[];
    motorista: Embutido<{ pessoa: Embutido<{ nome: string }> }>;
  };
  const unicos = new Map<string, Bruto>();
  for (const c of [...(comoCavalo.data ?? []), ...(comoItem?.data ?? [])] as unknown as Bruto[]) unicos.set(c.id, c);

  const lista = [...unicos.values()].map((c): ConjuntoDetalhe => {
    const cavalo = peca(um(c.cavalo)!);
    const itens = [...c.conjunto_item].sort((a, b) => a.posicao - b.posicao).map((i) => peca(um(i.veiculo)!));
    return {
      id: c.id,
      inicio: c.inicio,
      fim: c.fim,
      cavalo,
      itens,
      motorista: c.motorista_id ? { id: c.motorista_id, nome: um(um(c.motorista)?.pessoa)?.nome ?? "—" } : null,
      eixos: cavalo.eixos + itens.reduce((s, x) => s + x.eixos, 0),
    };
  });
  return lista.sort((a, b) => (a.fim === null ? -1 : b.fim === null ? 1 : a.inicio < b.inicio ? 1 : -1));
}
