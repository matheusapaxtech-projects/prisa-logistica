/* Leituras da calculadora de frete (servidor): a tabela da ANTT vigente, as alíquotas (parametros_calculadora,
   migration 20261028000100) e, vindo da ficha da viagem, os valores dela para preencher a tela. */
import type { Banco, Database, Json } from "@/lib/banco";
import { FISCAL_PADRAO, type Coeficiente, type ParamFiscais, type TipoCarga } from "@/lib/calculadora/regras";
import type { RotaSalva } from "@/lib/calculadora/rota";
import { lerFrete } from "@/lib/frete";

type Embutido<T> = T | T[] | null;
const um = <T,>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Linhas da vigência mais recente (até hoje) de cada tipo de carga, como `antt_coeficiente_para`. */
export async function tabelaAntt(db: Banco): Promise<Coeficiente[]> {
  const r = await db.from("antt_coeficiente").select("vigencia_inicio, portaria, tipo_carga, eixos, ccd, cc").lte("vigencia_inicio", hoje());
  if (r.error) throw r.error;
  const vigencia = new Map<TipoCarga, string>();
  for (const l of r.data) if ((vigencia.get(l.tipo_carga) ?? "") < l.vigencia_inicio) vigencia.set(l.tipo_carga, l.vigencia_inicio);
  return r.data
    .filter((l) => vigencia.get(l.tipo_carga) === l.vigencia_inicio)
    .map((l) => ({ tipo: l.tipo_carga, eixos: l.eixos, ccd: Number(l.ccd), cc: Number(l.cc), portaria: l.portaria }));
}

export type Parametros = { fiscal: ParamFiscais; vigencia: string | null };

/** Alíquotas vigentes; sem linha vigente, os valores de partida (e a tela avisa). */
export async function parametros(db: Banco): Promise<Parametros> {
  const r = await db.rpc("parametros_calculadora");
  if (r.error) throw r.error;
  const p = r.data as Record<string, Json> | null;
  if (!p) return { fiscal: FISCAL_PADRAO, vigencia: null };
  const n = (k: string) => Number(p[k]);
  return {
    vigencia: typeof p.vigencia_inicio === "string" ? p.vigencia_inicio : null,
    fiscal: {
      pisCofins: n("pis_cofins"),
      irpjCsll: n("irpj_csll"),
      panCardPct: n("pan_card_pct"),
      panCardTransferencia: n("pan_card_transferencia"),
      panCardTransferencias: n("pan_card_transferencias"),
      descontoDuplicata: n("desconto_duplicata"),
      seguroRctrc: n("seguro_rctrc"),
      seguroRcdc: n("seguro_rcdc"),
    },
  };
}

/** O que a viagem leva para a calculadora ("Abrir na calculadora" da ficha). */
export type DaViagem = {
  id: string;
  numero: number;
  origem: string;
  destino: string;
  km: number | null;
  pedagio: number | null;
  eixos: number;
  tipo: TipoCarga;
  pesoT: number;
  freteEmpresaTotal: number;
  /** R$/t do pedido quando o cliente paga por tonelada; nulo = total. */
  freteEmpresaPorT: number | null;
  freteMotorista: number | null;
  contratadoPf: boolean;
};

type ViagemBanco = {
  numero: number;
  pedido: Embutido<{
    frete_empresa_tipo: Database["public"]["Enums"]["tipo_tarifa"];
    frete_empresa_valor: number;
    tipo_carga_antt: TipoCarga;
    coleta: Embutido<{ cidade: string; uf: string }>;
    descarga: Embutido<{ cidade: string; uf: string }>;
  }>;
};

export async function daViagem(db: Banco, id: string): Promise<DaViagem | null> {
  const [v, f] = await Promise.all([
    db
      .from("viagem")
      .select(
        "numero, pedido:pedido!viagem_pedido_id_fkey(frete_empresa_tipo, frete_empresa_valor, tipo_carga_antt, " +
          "coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf), " +
          "descarga:pessoa_endereco!pedido_local_descarga_id_fkey(cidade, uf))",
      )
      .eq("id", id)
      .maybeSingle(),
    db.rpc("frete_da_viagem", { p_viagem: id }),
  ]);
  if (v.error) throw v.error;
  if (f.error) throw f.error;
  const viagem = v.data as unknown as ViagemBanco | null;
  const pedido = um(viagem?.pedido);
  const frete = lerFrete(f.data);
  if (!viagem || !pedido || !frete) return null;
  const coleta = um(pedido.coleta);
  const descarga = um(pedido.descarga);
  return {
    id,
    numero: viagem.numero,
    origem: coleta ? `${coleta.cidade}/${coleta.uf}` : "",
    destino: descarga ? `${descarga.cidade}/${descarga.uf}` : "",
    km: frete.km,
    pedagio: frete.pedagio,
    eixos: frete.eixos,
    tipo: pedido.tipo_carga_antt,
    pesoT: frete.pesoT,
    freteEmpresaTotal: frete.freteEmpresa,
    freteEmpresaPorT: pedido.frete_empresa_tipo === "por_tonelada" ? Number(pedido.frete_empresa_valor) : null,
    freteMotorista: frete.freteMotorista,
    contratadoPf: frete.contratadoPf,
  };
}

/** Rotas salvas pela equipe (tabela `rota_salva`), em ordem de origem e destino. */
export async function rotasSalvas(db: Banco): Promise<RotaSalva[]> {
  const r = await db.from("rota_salva").select("id, origem, destino, vias, km, eixos, pedagio, updated_at").order("origem").order("destino");
  if (r.error) throw r.error;
  return r.data.map((x) => ({
    id: x.id,
    origem: x.origem,
    destino: x.destino,
    vias: x.vias,
    km: x.km,
    eixos: x.eixos,
    pedagio: x.pedagio === null ? null : Number(x.pedagio),
    atualizada: x.updated_at,
  }));
}
