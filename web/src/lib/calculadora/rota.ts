/* Km e pedágio estimados da rota (Calculadora de Frete PRISA, `resolveRoute`): rota já medida pela Prisa
   quando existe; senão linha reta × fator de estrada da UF de destino, trecho a trecho. O pedágio sai em
   R$ por eixo/km: dos CT-e da rota medida ou da média da região. Puro: a lista de municípios vem de fora
   (`municipios-dados.ts`, carregado sob demanda). */
import { ROTAS_MEDIDAS, type RotaMedida } from "./rotas-medidas";

export type Municipio = { nome: string; uf: string; lat: number; lon: number };

export type Municipios = {
  lista: Municipio[];
  /** "nome/uf" normalizado → município. */
  porChave: Map<string, Municipio>;
  /** Só o nome normalizado → municípios com esse nome (pode haver vários). */
  porNome: Map<string, Municipio[]>;
};

/** "São José dos Pinhais" → "sao jose dos pinhais". */
export function normalizar(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê o texto "#UF\nNome;lat;lon\n...". */
export function lerMunicipios(raw: string): Municipios {
  const lista: Municipio[] = [];
  const porChave = new Map<string, Municipio>();
  const porNome = new Map<string, Municipio[]>();
  let uf = "";
  for (const l of raw.split("\n")) {
    if (!l) continue;
    if (l[0] === "#") {
      uf = l.slice(1);
      continue;
    }
    const [nome, lat, lon] = l.split(";");
    const m: Municipio = { nome: `${nome}/${uf}`, uf, lat: Number(lat), lon: Number(lon) };
    lista.push(m);
    porChave.set(normalizar(m.nome), m);
    const k = normalizar(nome);
    porNome.set(k, [...(porNome.get(k) ?? []), m]);
  }
  return { lista, porChave, porNome };
}

export type Busca = { municipio: Municipio | null; ambiguos: number };

/** "Maracaju/MS", "Maracaju - MS" ou só "Maracaju" (se o nome for único no país). */
export function acharMunicipio(m: Municipios, texto: string): Busca {
  const n = normalizar(texto);
  if (!n) return { municipio: null, ambiguos: 0 };
  const direto = m.porChave.get(n);
  if (direto) return { municipio: direto, ambiguos: 0 };
  const comUf = n.match(/^(.*?)\s*[/-]\s*([a-z]{2})$/);
  if (comUf) return { municipio: m.porChave.get(`${comUf[1]}/${comUf[2]}`) ?? null, ambiguos: 0 };
  const mesmos = m.porNome.get(n) ?? [];
  return mesmos.length === 1 ? { municipio: mesmos[0], ambiguos: 0 } : { municipio: null, ambiguos: mesmos.length };
}

/** Distância em linha reta (haversine), em km. */
export function linhaReta(a: Municipio, b: Municipio): number {
  const R = 6371;
  const r = (x: number) => (x * Math.PI) / 180;
  const dla = r(b.lat - a.lat);
  const dlo = r(b.lon - a.lon);
  const h = Math.sin(dla / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Fator estrada/linha reta pela UF de destino (calibrado com 77 rotas medidas a partir do PR). */
const FATOR: Record<string, number> = { PR: 1.25, SP: 1.22, MS: 1.35, MT: 1.3, GO: 1.22, DF: 1.2, MG: 1.17, SC: 1.4, RS: 1.45, RJ: 1.22, ES: 1.22, BA: 1.2 };
const FATOR_PADRAO = 1.25;

function fatorPara(destino: Municipio): number {
  if (destino.uf === "SC") return destino.lon > -50 ? 1.25 : 1.42; // litoral × oeste
  return FATOR[destino.uf] ?? FATOR_PADRAO;
}

/** Pedágio em R$ por eixo/km pela região do destino (calibrado pelos CT-e da Prisa). */
export function pedagioDaRegiao(destino: Municipio): { valor: number; regiao: string } {
  if (destino.uf === "SP") return destino.lon > -49.5 ? { valor: 0.17, regiao: "interior leste de SP" } : { valor: 0.06, regiao: "oeste de SP" };
  const t: Record<string, [number, string]> = {
    PR: [0.15, "PR"],
    MS: [0.035, "MS"],
    MG: [0.09, "MG"],
    GO: [0.09, "GO"],
    DF: [0.1, "DF"],
    MT: [0.06, "MT, sem histórico"],
    SC: [0.1, "SC, sem histórico"],
    RS: [0.1, "RS, sem histórico"],
  };
  const [valor, regiao] = t[destino.uf] ?? [0.08, `${destino.uf}, sem histórico`];
  return { valor, regiao };
}

type Medida = { km: number; pedagio: number | null };

function indexar(rotas: readonly RotaMedida[]): Map<string, Medida> {
  const mapa = new Map<string, Medida>();
  for (const [a, b, km, pe] of rotas) {
    mapa.set(`${normalizar(a)}>${normalizar(b)}`, { km, pedagio: pe });
    // a volta vale para o km; o pedágio é por sentido
    if (!mapa.has(`${normalizar(b)}>${normalizar(a)}`)) mapa.set(`${normalizar(b)}>${normalizar(a)}`, { km, pedagio: null });
  }
  return mapa;
}

const MEDIDAS = indexar(ROTAS_MEDIDAS);

export type OrigemKm = "medida" | "estimada";

export type Estimativa = {
  km: number;
  origemKm: OrigemKm;
  /** Fator médio usado nos trechos estimados (para explicar "linha reta × 1,35"). */
  fator: number;
  trechos: number;
  pedagioEixoKm: number;
  origemPedagio: string;
};

/** Km e pedágio de origem → (pontos de passagem) → destino. */
export function estimarRota(pontos: readonly Municipio[]): Estimativa | null {
  if (pontos.length < 2) return null;
  let km = 0;
  let pedagioKm = 0;
  let todosMedidos = true;
  const fatores: number[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const p = pontos[i];
    const q = pontos[i + 1];
    const m = MEDIDAS.get(`${normalizar(p.nome)}>${normalizar(q.nome)}`);
    let k: number;
    if (m) k = m.km;
    else {
      todosMedidos = false;
      const f = fatorPara(q);
      fatores.push(f);
      k = Math.round(linhaReta(p, q) * f);
    }
    const pe = m?.pedagio ?? pedagioDaRegiao(q).valor;
    km += k;
    pedagioKm += k * pe;
  }
  const a = pontos[0];
  const b = pontos[pontos.length - 1];
  const direta = pontos.length === 2 ? MEDIDAS.get(`${normalizar(a.nome)}>${normalizar(b.nome)}`) : undefined;
  const regiao = pedagioDaRegiao(b);
  const [pedagioEixoKm, origemPedagio] =
    direta?.pedagio != null
      ? [direta.pedagio, "dos CT-e da Prisa nesta rota"]
      : pontos.length > 2
        ? [km ? pedagioKm / km : regiao.valor, "média das regiões do trajeto"]
        : [regiao.valor, `média da região: ${regiao.regiao}`];
  return {
    km,
    origemKm: todosMedidos ? "medida" : "estimada",
    fator: fatores.length ? fatores.reduce((x, y) => x + y, 0) / fatores.length : FATOR_PADRAO,
    trechos: pontos.length - 1,
    pedagioEixoKm,
    origemPedagio,
  };
}

/** Pedágio estimado = km × eixos × R$ por eixo/km. */
export function pedagioEstimado(km: number, eixos: number, porEixoKm: number): number {
  return km > 0 && eixos > 0 ? Math.round(km * eixos * porEixoKm * 100) / 100 : 0;
}
