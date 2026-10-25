/* Lote de carga (Calculadora de Frete PRISA, `calcLote`): um total em toneladas a um preço por tonelada,
   levado por vários caminhões. Cada caminhão é uma carga única (mesmo calcularCTe); o lote soma e decide.
   Puro, como regras.ts. */
import {
  calcularCTe,
  coeficientePara,
  freteMotoristaMaximo,
  FISCAL_PADRAO,
  MARGEM_MINIMA,
  pisoAntt,
  type Coeficiente,
  type ParamFiscais,
  type ResultadoCTe,
  type TipoCarga,
} from "./regras";
import { pedagioEstimado } from "./rota";

/** Tipos da composição e a capacidade de partida de cada um (como na calculadora original). */
export const CAPACIDADE_PADRAO: Record<number, number> = { 5: 26, 6: 32, 7: 38, 9: 50 };
export const EIXOS_LOTE = [5, 6, 7, 9] as const;

export type Caminhao = {
  eixos: number;
  capacidade: number;
  peso: number;
  /** Nulo = no piso da ANTT do caminhão (arredondado para cima ao real). */
  freteMotorista: number | null;
  pf: boolean;
};

export type Rota = {
  km: number;
  pedagioEixoKm: number;
  origemUF: string;
  destinoUF: string;
  tipo: TipoCarga;
  retornoVazio: boolean;
};

export type EntradaLote = {
  rota: Rota;
  tabela: readonly Coeficiente[];
  pesoTotal: number;
  precoPorTonelada: number;
  valorMercadoriaPorTonelada: number;
  caminhoes: readonly Caminhao[];
  param?: ParamFiscais;
  minimo?: number;
};

export type SituacaoCaminhao = "faltam" | "abaixo_piso" | "prejuizo" | "negociar" | "contratar";

export type AvaliacaoCaminhao = {
  piso: number;
  freteMotorista: number;
  pedagio: number;
  freteEmpresa: number;
  resultado: ResultadoCTe;
  /** Maior frete do motorista que mantém este caminhão na margem mínima; nulo = nem com zero. */
  tetoMotorista: number | null;
  situacao: SituacaoCaminhao;
  acimaDaCapacidade: boolean;
};

export function pisoDoCaminhao(rota: Rota, tabela: readonly Coeficiente[], eixos: number): number {
  return pisoAntt(coeficientePara(tabela, rota.tipo, eixos), rota.km, rota.retornoVazio);
}

/** Frete do motorista em uso: o digitado ou o piso arredondado para cima. */
export function freteDoCaminhao(c: Caminhao, piso: number): number {
  return c.freteMotorista ?? Math.ceil(piso);
}

function entradaCTe(rota: Rota, c: Caminhao, freteEmpresa: number, freteMotorista: number, valorMercadoriaT: number) {
  return {
    freteEmpresa,
    freteMotorista,
    pedagio: pedagioEstimado(rota.km, c.eixos, rota.pedagioEixoKm),
    origemUF: rota.origemUF,
    destinoUF: rota.destinoUF,
    motoristaPF: c.pf,
    valorMercadoria: c.peso * valorMercadoriaT,
  };
}

export function avaliarCaminhao(e: EntradaLote, c: Caminhao): AvaliacaoCaminhao {
  const p = e.param ?? FISCAL_PADRAO;
  const minimo = e.minimo ?? MARGEM_MINIMA;
  const piso = pisoDoCaminhao(e.rota, e.tabela, c.eixos);
  const fm = freteDoCaminhao(c, piso);
  const fe = c.peso * e.precoPorTonelada;
  const cte = entradaCTe(e.rota, c, fe, fm, e.valorMercadoriaPorTonelada);
  const r = calcularCTe(cte, p);
  const situacao: SituacaoCaminhao =
    !(fe > 0) || !(fm > 0)
      ? "faltam"
      : fm < piso - 0.005
        ? "abaixo_piso"
        : r.resultadoLiquido < 0
          ? "prejuizo"
          : r.margemLiquida < minimo
            ? "negociar"
            : "contratar";
  return {
    piso,
    freteMotorista: fm,
    pedagio: cte.pedagio,
    freteEmpresa: fe,
    resultado: r,
    tetoMotorista: freteMotoristaMaximo(cte, p, minimo),
    situacao,
    acimaDaCapacidade: c.peso > c.capacidade + 0.005,
  };
}

export type VereditoLote = "contratar" | "negociar" | "ajustar" | "nao_contratar" | "incompleto";

export type Totais = {
  capacidade: number;
  peso: number;
  freteEmpresa: number;
  freteMotorista: number;
  pedagio: number;
  icms: number;
  impostoFederal: number;
  inssPatronal: number;
  taxaPanCard: number;
  seguroCarga: number;
  resultado: number;
  irpjCsll: number;
  resultadoLiquido: number;
  margemLiquida: number;
};

export type AvaliacaoLote = {
  caminhoes: AvaliacaoCaminhao[];
  totais: Totais;
  /** Peso do lote − peso alocado (positivo = falta). */
  falta: number;
  /** Menor preço por tonelada que deixa o lote na margem mínima com todos os motoristas pelo menos no piso. */
  precoMinimo: number | null;
  veredito: VereditoLote;
  titulo: string;
  texto: string;
};

function somar(av: AvaliacaoCaminhao[], cs: readonly Caminhao[]): Totais {
  const t: Totais = {
    capacidade: 0,
    peso: 0,
    freteEmpresa: 0,
    freteMotorista: 0,
    pedagio: 0,
    icms: 0,
    impostoFederal: 0,
    inssPatronal: 0,
    taxaPanCard: 0,
    seguroCarga: 0,
    resultado: 0,
    irpjCsll: 0,
    resultadoLiquido: 0,
    margemLiquida: 0,
  };
  av.forEach((a, i) => {
    t.capacidade += cs[i].capacidade;
    t.peso += cs[i].peso;
    t.freteEmpresa += a.freteEmpresa;
    t.freteMotorista += a.freteMotorista;
    t.pedagio += a.pedagio;
    t.icms += a.resultado.icms;
    t.impostoFederal += a.resultado.impostoFederal;
    t.inssPatronal += a.resultado.inssPatronal;
    t.taxaPanCard += a.resultado.taxaPanCard;
    t.seguroCarga += a.resultado.seguroCarga;
    t.resultado += a.resultado.resultado;
    t.irpjCsll += a.resultado.irpjCsll;
    t.resultadoLiquido += a.resultado.resultadoLiquido;
  });
  t.margemLiquida = t.freteEmpresa ? t.resultadoLiquido / t.freteEmpresa : 0;
  return t;
}

/** Preço por tonelada que põe o lote na margem mínima (motoristas pelo menos no piso); bissecção. */
export function precoMinimoDoLote(e: EntradaLote): number | null {
  if (!e.caminhoes.length || !e.caminhoes.some((c) => c.peso > 0)) return null;
  const p = e.param ?? FISCAL_PADRAO;
  const minimo = e.minimo ?? MARGEM_MINIMA;
  const folga = (preco: number) => {
    let fe = 0;
    let liq = 0;
    for (const c of e.caminhoes) {
      const piso = pisoDoCaminhao(e.rota, e.tabela, c.eixos);
      const f = c.peso * preco;
      fe += f;
      liq += calcularCTe(entradaCTe(e.rota, c, f, Math.max(freteDoCaminhao(c, piso), piso), e.valorMercadoriaPorTonelada), p).resultadoLiquido;
    }
    return fe ? liq / fe - minimo : -1;
  };
  let hi = 1000;
  for (let i = 0; i < 20 && folga(hi) < 0; i++) hi *= 2;
  if (folga(hi) < 0) return null;
  let lo = 0;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (folga(m) >= 0) hi = m;
    else lo = m;
  }
  return hi;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const toneladas = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`;

export function avaliarLote(e: EntradaLote): AvaliacaoLote {
  const minimo = e.minimo ?? MARGEM_MINIMA;
  const caminhoes = e.caminhoes.map((c) => avaliarCaminhao(e, c));
  const totais = somar(caminhoes, e.caminhoes);
  const falta = e.pesoTotal - totais.peso;
  const precoMinimo = precoMinimoDoLote(e);
  const abaixo = caminhoes.filter((c) => c.situacao === "abaixo_piso").length;
  const acima = caminhoes.filter((c) => c.acimaDaCapacidade).length;
  const base = { caminhoes, totais, falta, precoMinimo };

  if (!e.caminhoes.length || !(e.pesoTotal > 0) || !(e.precoPorTonelada > 0))
    return { ...base, veredito: "incompleto", titulo: "Faltam valores", texto: "Informe o peso do lote, o preço por tonelada e os caminhões." };
  if (!(e.rota.km > 0)) return { ...base, veredito: "incompleto", titulo: "Faltam dados da rota", texto: "Informe o km para calcular o piso da ANTT." };
  if (abaixo)
    return {
      ...base,
      veredito: "nao_contratar",
      titulo: "Não contratar",
      texto: `${abaixo} ${plural(abaixo, "caminhão está", "caminhões estão")} com o frete do motorista abaixo do piso da ANTT.`,
    };
  if (totais.resultadoLiquido < 0) return { ...base, veredito: "nao_contratar", titulo: "Não contratar", texto: "O lote dá prejuízo com estes valores." };
  if (acima)
    return {
      ...base,
      veredito: "ajustar",
      titulo: "Ajustar a composição",
      texto: `${acima} ${plural(acima, "caminhão está carregado", "caminhões estão carregados")} acima da capacidade.`,
    };
  if (Math.abs(falta) >= 0.005)
    return {
      ...base,
      veredito: "ajustar",
      titulo: "Ajustar a composição",
      texto: falta > 0 ? `A composição não leva o lote todo: faltam ${toneladas(falta)}.` : `A composição passa do lote em ${toneladas(-falta)}.`,
    };
  if (totais.margemLiquida < minimo)
    return {
      ...base,
      veredito: "negociar",
      titulo: "Negociar",
      texto: "O lote está dentro da lei, mas abaixo da margem mínima. Suba o preço por tonelada ou baixe os fretes dos motoristas.",
    };
  return { ...base, veredito: "contratar", titulo: "Pode contratar", texto: "Todos os motoristas acima do piso, lote completo e margem dentro do mínimo." };
}

/** Piso + pedágio por tonelada de cada tipo de caminhão na rota (o mais barato primeiro na decisão). */
export function custoPorTonelada(rota: Rota, tabela: readonly Coeficiente[]): { eixos: number; capacidade: number; valor: number }[] {
  if (!(rota.km > 0)) return [];
  return EIXOS_LOTE.map((eixos) => {
    const capacidade = CAPACIDADE_PADRAO[eixos];
    const valor = (pisoDoCaminhao(rota, tabela, eixos) + pedagioEstimado(rota.km, eixos, rota.pedagioEixoKm)) / capacidade;
    return { eixos, capacidade, valor };
  });
}

/** Reparte o lote pela capacidade: cabendo tudo, cada um leva a capacidade; senão, proporcional (o último
   fecha a conta ao centésimo). */
export function distribuirPeso(caminhoes: readonly Caminhao[], pesoTotal: number): Caminhao[] {
  const cap = caminhoes.reduce((a, c) => a + c.capacidade, 0);
  if (!(cap > 0)) return [...caminhoes];
  if (cap <= pesoTotal) return caminhoes.map((c) => ({ ...c, peso: c.capacidade }));
  let acumulado = 0;
  return caminhoes.map((c, i) => {
    const peso = i < caminhoes.length - 1 ? Math.round(((pesoTotal * c.capacidade) / cap) * 100) / 100 : Math.round((pesoTotal - acumulado) * 100) / 100;
    acumulado += peso;
    return { ...c, peso };
  });
}

export function novoCaminhao(eixos: number): Caminhao {
  return { eixos, capacidade: CAPACIDADE_PADRAO[eixos] ?? 0, peso: 0, freteMotorista: null, pf: false };
}
