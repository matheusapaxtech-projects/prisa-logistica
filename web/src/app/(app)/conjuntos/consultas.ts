/* Consultas da tela de Conjuntos (servidor, RLS de quem consulta). Mesmos campos do banco:
   `conjunto`, `conjunto_item`, `veiculo` + `tipo_veiculo` + `marca_veiculo.nome`, `pessoa`, `motorista`. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipado, type Banco } from "@/lib/banco";
import { capacidade, type Capacidade } from "@/lib/conjunto";
import type { PecaEngate } from "@/components/Engate";
import type { AbertoConjunto, MotoristaOpcao, VeiculoConjunto } from "./regras";

/** Id do endereço: as seeds usam ids fora da RFC 9562, então a forma (8-4-4-4-12 hex) basta. */
export const RE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUNAS_VEICULO =
  "id, placa, modelo, cmt_t, pbt_t, tara_t, capacidade_carga_t, situacao_operacional, ultimo_motorista_id, " +
  "proprietario_documento_id, arrendado, tipo_veiculo(nome, categoria, eixos, configuracao_cavalo), marca_veiculo(nome)";

type LinhaVeiculo = {
  id: string;
  placa: string;
  modelo: string | null;
  cmt_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
  capacidade_carga_t: number | null;
  situacao_operacional: string;
  ultimo_motorista_id: string | null;
  proprietario_documento_id: string;
  arrendado: boolean | null;
  tipo_veiculo: {
    nome: string;
    categoria: VeiculoConjunto["categoria"];
    eixos: number;
    configuracao_cavalo: "toco" | "trucado" | null;
  } | null;
  marca_veiculo: { nome: string } | null;
};

const num = (n: number | string | null) => (n == null ? null : Number(n));

function erroDe(r: { error: unknown }) {
  if (r.error) throw r.error;
}

/** Nomes curtos (nome fantasia ou nome) das pessoas pedidas. */
async function nomesCurtos(db: Banco, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const r = await db.from("pessoa").select("id, nome, nome_fantasia").in("id", [...new Set(ids)]);
  erroDe(r);
  return new Map((r.data ?? []).map((p) => [p.id, p.nome_fantasia || p.nome]));
}

/** Veículos (todos, ou só os ids pedidos) já no formato da tela. */
export async function carregarVeiculos(db: Banco, ids?: string[]): Promise<Map<string, VeiculoConjunto>> {
  let q = db.from("veiculo").select(COLUNAS_VEICULO).order("created_at").order("id");
  if (ids) {
    if (!ids.length) return new Map();
    q = q.in("id", [...new Set(ids)]);
  }
  const r = await q;
  erroDe(r);
  const linhas = (r.data ?? []) as unknown as LinhaVeiculo[];
  const donos = await nomesCurtos(db, linhas.map((v) => v.proprietario_documento_id));
  return new Map(
    linhas.map((v) => [
      v.id,
      {
        id: v.id,
        placa: v.placa,
        categoria: v.tipo_veiculo?.categoria ?? "outros",
        cmt_t: num(v.cmt_t),
        pbt_t: num(v.pbt_t),
        tara_t: num(v.tara_t),
        capacidade_carga_t: num(v.capacidade_carga_t),
        eixos: v.tipo_veiculo?.eixos ?? 0,
        configuracao_cavalo: v.tipo_veiculo?.configuracao_cavalo ?? null,
        tipo: v.tipo_veiculo?.nome ?? "",
        marca: v.marca_veiculo?.nome ?? null,
        modelo: v.modelo,
        arrendado: !!v.arrendado,
        dono: donos.get(v.proprietario_documento_id) ?? "—",
        dono_id: v.proprietario_documento_id,
        situacao_operacional: v.situacao_operacional,
        ultimo_motorista_id: v.ultimo_motorista_id,
      } satisfies VeiculoConjunto,
    ]),
  );
}

/** Capacidade efetiva da carreta (a informada, ou PBT − tara), como no desenho do engate. */
export function cargaEfetiva(v: VeiculoConjunto): number | null {
  if (v.capacidade_carga_t != null) return v.capacidade_carga_t;
  if (v.pbt_t != null && v.tara_t != null) return Math.round((v.pbt_t - v.tara_t) * 100) / 100;
  return null;
}

/** Peça do desenho (`Engate`). */
export function peca(v: VeiculoConjunto): PecaEngate {
  return {
    placa: v.placa,
    categoria: v.categoria,
    configuracao_cavalo: v.configuracao_cavalo,
    eixos: v.eixos,
    capacidade_carga_t: v.categoria === "carreta" ? cargaEfetiva(v) : null,
  };
}

type LinhaConjunto = {
  id: string;
  cavalo_id: string;
  motorista_id: string | null;
  inicio: string;
  fim: string | null;
  conjunto_item: { posicao: number; veiculo_id: string }[];
};

const COLUNAS_CONJUNTO = "id, cavalo_id, motorista_id, inicio, fim, conjunto_item(posicao, veiculo_id)";

const itensEmOrdem = (c: LinhaConjunto) => [...c.conjunto_item].sort((a, b) => a.posicao - b.posicao).map((i) => i.veiculo_id);

/** Conjuntos abertos (fim nulo), com os ids das peças na ordem de engate. */
export async function carregarAbertos(db: Banco): Promise<AbertoConjunto[]> {
  const r = await db.from("conjunto").select(COLUNAS_CONJUNTO).is("fim", null).order("inicio").order("id");
  erroDe(r);
  return ((r.data ?? []) as LinhaConjunto[]).map((c) => ({
    id: c.id,
    cavalo_id: c.cavalo_id,
    motorista_id: c.motorista_id,
    inicio: c.inicio,
    item_ids: itensEmOrdem(c),
  }));
}

/** Motoristas com cadastro normal (os únicos que o montador e o "Trocar motorista" oferecem). */
export async function carregarMotoristasNormais(db: Banco): Promise<MotoristaOpcao[]> {
  const r = await db
    .from("motorista")
    .select("pessoa_id, cnh_categoria, cnh_validade, situacao_gr, gr_validade, pessoa!motorista_pessoa_id_fkey(nome)")
    .eq("situacao_cadastro", "normal");
  erroDe(r);
  return (r.data ?? [])
    .map((m) => ({
      pessoa_id: m.pessoa_id,
      nome: (m.pessoa as { nome: string } | null)?.nome ?? "—",
      cnh_categoria: m.cnh_categoria,
      cnh_validade: m.cnh_validade,
      situacao_gr: m.situacao_gr,
      gr_validade: m.gr_validade,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/* ---------- lista (/conjuntos) ---------- */

export type ConjuntoLista = {
  id: string;
  inicio: string;
  fim: string | null;
  motorista: string | null;
  cavalo: PecaEngate;
  itens: PecaEngate[];
  placas: string[];
  eixos: number;
  carretas: number;
  capacidade: Capacidade;
};

export async function carregarLista(cliente: SupabaseClient): Promise<{ abertos: ConjuntoLista[]; historico: ConjuntoLista[] }> {
  const db = tipado(cliente);
  const r = await db.from("conjunto").select(COLUNAS_CONJUNTO).order("created_at").order("id");
  erroDe(r);
  const conjuntos = (r.data ?? []) as LinhaConjunto[];
  const [veiculos, nomes] = await Promise.all([
    carregarVeiculos(db, conjuntos.flatMap((c) => [c.cavalo_id, ...c.conjunto_item.map((i) => i.veiculo_id)])),
    nomesCurtos(db, conjuntos.map((c) => c.motorista_id).filter((x): x is string => !!x)),
  ]);

  const lista = conjuntos.flatMap((c): ConjuntoLista[] => {
    const cav = veiculos.get(c.cavalo_id);
    if (!cav) return [];
    const itens = itensEmOrdem(c).flatMap((id) => veiculos.get(id) ?? []);
    return [
      {
        id: c.id,
        inicio: c.inicio,
        fim: c.fim,
        motorista: c.motorista_id ? (nomes.get(c.motorista_id) ?? null) : null,
        cavalo: peca(cav),
        itens: itens.map(peca),
        placas: [cav.placa, ...itens.map((i) => i.placa)],
        eixos: cav.eixos + itens.reduce((s, i) => s + i.eixos, 0),
        carretas: itens.filter((i) => i.categoria === "carreta").length,
        capacidade: capacidade(cav, itens),
      },
    ];
  });
  return {
    abertos: lista.filter((c) => !c.fim),
    historico: lista.filter((c) => c.fim).sort((a, b) => (a.fim! < b.fim! ? 1 : a.fim! > b.fim! ? -1 : 0)),
  };
}

/* ---------- montador e ficha ---------- */

export type BaseMontador = {
  veiculos: VeiculoConjunto[];
  abertos: AbertoConjunto[];
  motoristas: MotoristaOpcao[];
  /** Nomes das pessoas que aparecem nos avisos (motoristas dos conjuntos abertos). */
  nomes: Record<string, string>;
};

/** Tudo o que o montador precisa para validar ao vivo: frota, conjuntos abertos e motoristas normais. */
export async function carregarBaseMontador(cliente: SupabaseClient): Promise<BaseMontador> {
  const db = tipado(cliente);
  const [veiculos, abertos, motoristas] = await Promise.all([
    carregarVeiculos(db),
    carregarAbertos(db),
    carregarMotoristasNormais(db),
  ]);
  const nomes = await nomesCurtos(db, abertos.map((c) => c.motorista_id).filter((x): x is string => !!x));
  return { veiculos: [...veiculos.values()], abertos, motoristas, nomes: Object.fromEntries(nomes) };
}

export type MotoristaFicha = {
  id: string;
  nome: string;
  cpf: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  situacao_gr: string;
  gr_validade: string | null;
  telefone: { numero: string; whatsapp: boolean } | null;
};

export type Anterior = { id: string; inicio: string; fim: string | null; placas: string[]; motorista: string | null };

export type FichaConjunto = {
  id: string;
  cavalo_id: string;
  motorista_id: string | null;
  inicio: string;
  fim: string | null;
  cavalo: VeiculoConjunto;
  itens: VeiculoConjunto[];
  motorista: MotoristaFicha | null;
  anteriores: Anterior[];
};

/** O conjunto do endereço (aberto ou encerrado), com peças, motorista e os outros conjuntos do cavalo.
   `null` = não existe (ou o RLS esconde). */
export async function carregarFicha(cliente: SupabaseClient, id: string): Promise<FichaConjunto | null> {
  const db = tipado(cliente);
  const r = await db.from("conjunto").select(COLUNAS_CONJUNTO).eq("id", id).maybeSingle();
  erroDe(r);
  const c = r.data as LinhaConjunto | null;
  if (!c) return null;

  const outros = await db
    .from("conjunto")
    .select(COLUNAS_CONJUNTO)
    .eq("cavalo_id", c.cavalo_id)
    .neq("id", c.id)
    .order("inicio", { ascending: false });
  erroDe(outros);
  const anteriores = (outros.data ?? []) as LinhaConjunto[];

  const ids = [c, ...anteriores].flatMap((x) => [x.cavalo_id, ...x.conjunto_item.map((i) => i.veiculo_id)]);
  const motoristaIds = anteriores.map((x) => x.motorista_id).filter((x): x is string => !!x);
  const [veiculos, nomes, motorista] = await Promise.all([
    carregarVeiculos(db, ids),
    nomesCurtos(db, motoristaIds),
    c.motorista_id ? carregarMotorista(db, c.motorista_id) : Promise.resolve(null),
  ]);
  const cavalo = veiculos.get(c.cavalo_id);
  if (!cavalo) return null;

  return {
    id: c.id,
    cavalo_id: c.cavalo_id,
    motorista_id: c.motorista_id,
    inicio: c.inicio,
    fim: c.fim,
    cavalo,
    itens: itensEmOrdem(c).flatMap((x) => veiculos.get(x) ?? []),
    motorista,
    anteriores: anteriores.map((x) => ({
      id: x.id,
      inicio: x.inicio,
      fim: x.fim,
      placas: [x.cavalo_id, ...itensEmOrdem(x)].map((v) => veiculos.get(v)?.placa ?? "—"),
      motorista: x.motorista_id ? (nomes.get(x.motorista_id) ?? null) : null,
    })),
  };
}

async function carregarMotorista(db: Banco, id: string): Promise<MotoristaFicha | null> {
  const [m, tel] = await Promise.all([
    db
      .from("motorista")
      .select("pessoa_id, cnh_categoria, cnh_validade, situacao_gr, gr_validade, pessoa!motorista_pessoa_id_fkey(nome, cpf)")
      .eq("pessoa_id", id)
      .maybeSingle(),
    db.from("pessoa_telefone").select("numero, whatsapp").eq("pessoa_id", id).eq("principal", true).limit(1),
  ]);
  erroDe(m);
  erroDe(tel);
  if (!m.data) return null;
  const p = m.data.pessoa as { nome: string; cpf: string | null } | null;
  return {
    id,
    nome: p?.nome ?? "—",
    cpf: p?.cpf ?? null,
    cnh_categoria: m.data.cnh_categoria,
    cnh_validade: m.data.cnh_validade,
    situacao_gr: m.data.situacao_gr,
    gr_validade: m.data.gr_validade,
    telefone: tel.data?.[0] ?? null,
  };
}
