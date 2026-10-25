/* Previsão de chegada e frete de retorno da viagem (servidor), com lib/motor/retorno.ts. Vale para a viagem
   que já saiu ("Em rota", "Pausa" a partir dela, "Aguardando descarga" e "Descarregando"): a saída é a
   hora em que entrou em "Em rota"; o km é o da viagem (ou o estimado entre as cidades). As cargas de retorno
   são os pedidos abertos com saldo, menos o próprio pedido. */
import type { Banco } from "@/lib/banco";
import { MUNICIPIOS_RAW } from "@/lib/calculadora/municipios-dados";
import { acharMunicipio, estimarRota, lerMunicipios, type Municipios } from "@/lib/calculadora/rota";
import type { StatusCampo } from "@/lib/quadro";
import { atrasoPrevisto, previsaoDeChegada, sugerirRetornos, type CargaAberta, type SugestaoRetorno } from "@/lib/motor/retorno";

let municipios: Municipios | null = null;
const lista = () => (municipios ??= lerMunicipios(MUNICIPIOS_RAW));

type Embutido<T> = T | T[] | null;
const um = <T,>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Colunas em que a viagem já saiu e ainda não descarregou. */
export const DEPOIS_DA_SAIDA: readonly StatusCampo[] = ["em_rota", "pausa", "aguardando_descarga", "descarregando"];

export type Retorno = {
  previsao: string | null;
  /** Horas de atraso contra a entrega prevista do pedido (negativo = folga); nulo sem data. */
  atrasoH: number | null;
  km: number;
  sugestoes: (SugestaoRetorno & { numero: number; origem: string; destino: string })[];
};

type Entrada = {
  viagemId: string;
  pedidoId: string;
  origem: string;
  destino: string;
  kmViagem: number | null;
  conjuntoId: string;
  eventos: { para: StatusCampo | null; em: string }[];
};

export async function retornoDaViagem(db: Banco, e: Entrada): Promise<Retorno | null> {
  const m = lista();
  const a = acharMunicipio(m, e.origem).municipio;
  const b = acharMunicipio(m, e.destino).municipio;
  const saida = e.eventos.filter((x) => x.para === "em_rota").map((x) => x.em).sort()[0];
  if (!a || !b || !saida) return null;
  const km = e.kmViagem ?? estimarRota([a, b])?.km ?? 0;
  const previsao = previsaoDeChegada(saida, km);

  const [ped, cap, saldos] = await Promise.all([
    db.from("pedido").select("entrega_prevista").eq("id", e.pedidoId).maybeSingle(),
    db.from("v_conjunto_capacidade").select("capacidade_total_t").eq("conjunto_id", e.conjuntoId).maybeSingle(),
    db.from("v_pedido_saldo").select("pedido_id, saldo_kg").gt("saldo_kg", 0),
  ]);
  if (ped.error) throw ped.error;
  if (cap.error) throw cap.error;
  if (saldos.error) throw saldos.error;
  const atrasoH = previsao ? atrasoPrevisto(previsao, ped.data?.entrega_prevista ?? null) : null;

  const ids = (saldos.data ?? []).map((s) => s.pedido_id!).filter((id) => id && id !== e.pedidoId);
  let sugestoes: Retorno["sugestoes"] = [];
  if (previsao && ids.length) {
    const abertos = await db
      .from("pedido")
      .select(
        "id, numero, coleta_prevista, coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf), " +
          "descarga:pessoa_endereco!pedido_local_descarga_id_fkey(cidade, uf)",
      )
      .in("id", ids)
      .eq("situacao", "aberto");
    if (abertos.error) throw abertos.error;
    type Linha = { id: string; numero: number; coleta_prevista: string | null; coleta: Embutido<{ cidade: string; uf: string }>; descarga: Embutido<{ cidade: string; uf: string }> };
    const saldoDe = new Map((saldos.data ?? []).map((s) => [s.pedido_id, Number(s.saldo_kg)]));
    const livre = Date.parse(previsao) + 6 * 36e5;
    const info = new Map<string, { numero: number; origem: string; destino: string }>();
    const cargas: CargaAberta[] = ((abertos.data ?? []) as unknown as Linha[]).flatMap((p) => {
      const co = um(p.coleta);
      const de = um(p.descarga);
      const o = co && acharMunicipio(m, `${co.cidade}/${co.uf}`).municipio;
      const d = de && acharMunicipio(m, `${de.cidade}/${de.uf}`).municipio;
      if (!o || !d) return [];
      info.set(p.id, { numero: p.numero, origem: o.nome, destino: d.nome });
      return [
        {
          id: p.id,
          origem: { lat: o.lat, lon: o.lon, uf: o.uf },
          destino: { lat: d.lat, lon: d.lon, uf: d.uf },
          pesoT: (saldoDe.get(p.id) ?? 0) / 1000,
          // Sem coleta prevista, a carga espera o caminhão: embarque logo que ele descarrega.
          embarqueEm: p.coleta_prevista ? `${p.coleta_prevista}T11:00:00Z` : new Date(livre).toISOString(),
        },
      ];
    });
    sugestoes = sugerirRetornos(
      { destino: { lat: b.lat, lon: b.lon, uf: b.uf }, origemIda: { lat: a.lat, lon: a.lon, uf: a.uf }, previsaoChegada: previsao, capacidadeT: Number(cap.data?.capacidade_total_t ?? 0) || 37 },
      cargas,
    )
      .slice(0, 5)
      .map((s) => ({ ...s, ...info.get(s.carga.id)! }));
  }
  return { previsao, atrasoH, km, sugestoes };
}
