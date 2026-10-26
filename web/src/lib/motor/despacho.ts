/* Ranking de motoristas e composição de lote (motor de despacho, ranking.ts e composicao.ts), com os dados do
   NILT: o motorista vem do conjunto aberto (eixos e capacidade das peças), a disponibilidade é o registro
   da operação (motorista_disponibilidade) e o piso é a Tabela A vigente do banco. Puro e testado contra o
   cenário do próprio motor (tests/unit/motor/despacho.test.ts). */
import { estradaKm } from "@/lib/calculadora/rota";
import {
  calcularCTe,
  coeficientePara,
  FISCAL_PADRAO,
  pisoAntt,
  type Coeficiente,
  type ParamFiscais,
  type ResultadoCTe,
  type TipoCarga,
} from "@/lib/calculadora/regras";

export type Ponto = { lat: number; lon: number; uf: string; cidade?: string };

export type MotoristaDespacho = {
  id: string;
  nome: string;
  conjuntoId: string;
  placaCavalo: string;
  /** PF = contratado pessoa física (INSS patronal de 4% entra no custo). */
  tipo: "PF" | "PJ";
  eixos: number;
  capacidadeT: number;
  rntrc: string | null;
  cnhValidade: string | null;
  viagensPrisa: number;
  ocorrencias: number;
  /** Cadastro fora do normal ou motorista já em viagem: motivo do bloqueio. */
  bloqueio?: string;
};

export type Disponibilidade = { motoristaId: string; posicao: Ponto; em: string; livreDesde?: string; livreAte?: string };

export type CargaDespacho = {
  origem: Ponto;
  destino: Ponto;
  pesoT: number;
  tipo: TipoCarga;
  embarqueEm: string;
  fretePorT?: number;
  valorMercadoriaPorT?: number;
  kmViagem: number;
  pedagioEixoKm: number;
};

export type ParamRanking = {
  raioMaxKm: number;
  validadeHoras: number;
  velocidadeKmH: number;
  pesos: { distancia: number; frescor: number; ocupacao: number; custo: number; historico: number };
};

export const RANKING_PADRAO: ParamRanking = {
  raioMaxKm: 300,
  validadeHoras: 24,
  velocidadeKmH: 60,
  pesos: { distancia: 0.4, frescor: 0.2, ocupacao: 0.2, custo: 0.1, historico: 0.1 },
};

export type Candidato = {
  motorista: MotoristaDespacho;
  disponibilidade: Disponibilidade;
  kmAteEmbarque: number;
  chegaNoPrazo: boolean;
  horasDesdeRegistro: number;
  pesoAtendidoT: number;
  ocupacao: number;
  piso: number;
  pedagio: number;
  custoMinimoPorT: number;
  score: number;
  motivos: string[];
  alertas: string[];
};

export type Descartado = { motorista: MotoristaDespacho; motivo: string };

const H = 36e5;
const t = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const reaisT = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/t`;

/** Filtra e dá nota de 0 a 100 (distância 40%, frescor 20%, ocupação 20%, custo 10%, histórico 10%). */
export function rankearMotoristas(
  carga: CargaDespacho,
  motoristas: readonly MotoristaDespacho[],
  disponibilidades: readonly Disponibilidade[],
  tabela: readonly Coeficiente[],
  agora: Date = new Date(),
  p: ParamRanking = RANKING_PADRAO,
): { candidatos: Candidato[]; descartados: Descartado[] } {
  const ultima = new Map<string, Disponibilidade>();
  for (const d of disponibilidades) {
    const atual = ultima.get(d.motoristaId);
    if (!atual || Date.parse(d.em) > Date.parse(atual.em)) ultima.set(d.motoristaId, d);
  }
  const embarque = Date.parse(carga.embarqueEm);
  const descartados: Descartado[] = [];
  const brutos: Omit<Candidato, "score" | "motivos">[] = [];

  for (const m of motoristas) {
    const fora = (motivo: string) => descartados.push({ motorista: m, motivo });
    if (m.bloqueio) {
      fora(m.bloqueio);
      continue;
    }
    const d = ultima.get(m.id);
    if (!d) {
      fora("Sem disponibilidade registrada");
      continue;
    }
    const horasDesde = (agora.getTime() - Date.parse(d.em)) / H;
    const livreAte = d.livreAte ? Date.parse(d.livreAte) : Date.parse(d.em) + p.validadeHoras * H;
    if (horasDesde > p.validadeHoras && !d.livreAte) {
      fora(`Disponibilidade de ${Math.round(horasDesde)} h atrás`);
      continue;
    }
    if (livreAte < agora.getTime()) {
      fora("Disponibilidade vencida");
      continue;
    }
    if (livreAte < embarque) {
      fora("Disponibilidade termina antes do embarque");
      continue;
    }
    if (!m.rntrc) {
      fora("RNTRC não informado");
      continue;
    }
    if (m.cnhValidade && Date.parse(`${m.cnhValidade}T23:59:59Z`) < embarque) {
      fora("CNH vencida na data do embarque");
      continue;
    }
    if (!(m.capacidadeT > 0) || !(m.eixos > 0)) {
      fora("Capacidade ou eixos não informados");
      continue;
    }
    const km = estradaKm(d.posicao, { ...carga.origem });
    if (km > p.raioMaxKm) {
      fora(`A ${km} km do embarque (raio de ${p.raioMaxKm} km)`);
      continue;
    }
    const livreDesde = d.livreDesde ? Date.parse(d.livreDesde) : Date.parse(d.em);
    const chegada = Math.max(agora.getTime(), livreDesde) + (km / p.velocidadeKmH) * H;
    const pesoAtendidoT = Math.min(carga.pesoT, m.capacidadeT);
    const piso = pisoAntt(coeficientePara(tabela, carga.tipo, m.eixos), carga.kmViagem);
    const pedagio = carga.kmViagem * m.eixos * carga.pedagioEixoKm;
    const inss = m.tipo === "PF" ? piso * 0.04 : 0;
    const alertas: string[] = [];
    if (chegada > embarque) alertas.push("Pode não chegar a tempo para o embarque");
    if (m.cnhValidade && Date.parse(m.cnhValidade) - embarque < 30 * 864e5) alertas.push("CNH vence em menos de 30 dias");
    if (carga.pesoT > m.capacidadeT) alertas.push(`Leva só ${t(m.capacidadeT)} t das ${t(carga.pesoT)} t: compor lote`);
    brutos.push({
      motorista: m,
      disponibilidade: d,
      kmAteEmbarque: km,
      chegaNoPrazo: chegada <= embarque,
      horasDesdeRegistro: horasDesde,
      pesoAtendidoT,
      ocupacao: pesoAtendidoT / m.capacidadeT,
      piso,
      pedagio,
      custoMinimoPorT: (piso + pedagio + inss) / pesoAtendidoT,
      alertas,
    });
  }

  const melhorCusto = Math.min(...brutos.map((b) => b.custoMinimoPorT));
  const maxViagens = Math.max(1, ...brutos.map((b) => b.motorista.viagensPrisa));
  const w = p.pesos;
  const candidatos: Candidato[] = brutos
    .map((b) => {
      const nDist = Math.max(0, 1 - b.kmAteEmbarque / p.raioMaxKm);
      const nFresc = Math.pow(0.5, b.horasDesdeRegistro / 8);
      const nCusto = Number.isFinite(melhorCusto) && b.custoMinimoPorT > 0 ? melhorCusto / b.custoMinimoPorT : 0;
      const v = b.motorista.viagensPrisa;
      const nHist = Math.max(0, Math.min(1, (v - 2 * b.motorista.ocorrencias) / maxViagens));
      let score = 100 * (w.distancia * nDist + w.frescor * nFresc + w.ocupacao * b.ocupacao + w.custo * nCusto + w.historico * nHist);
      if (!b.chegaNoPrazo) score *= 0.5;
      const h = b.horasDesdeRegistro;
      const motivos = [
        `a ${b.kmAteEmbarque} km do embarque`,
        `avisou há ${h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h)} h`}`,
        `${t(b.motorista.capacidadeT)} t (${Math.round(b.ocupacao * 100)}% ocupado)`,
        `custo mínimo ${reaisT(b.custoMinimoPorT)}`,
        v ? `${v} ${v === 1 ? "viagem" : "viagens"} com a Prisa` : "sem histórico com a Prisa",
      ];
      return { ...b, score: Math.round(score * 10) / 10, motivos };
    })
    .sort((a, b) => b.score - a.score || a.kmAteEmbarque - b.kmAteEmbarque);
  return { candidatos, descartados };
}

/* ---------- composição de lote ---------- */

export type CaminhaoNoLote = { candidato: Candidato; pesoT: number; freteMotorista: number; freteEmpresa: number; cte: ResultadoCTe | null };

export type Composicao = {
  caminhoes: CaminhaoNoLote[];
  capacidadeT: number;
  pesoAlocadoT: number;
  faltaT: number;
  custoMotoristaPedagio: number;
  custoPorT: number;
  freteEmpresa: number;
  resultadoLiquido: number;
  margemLiquida: number;
  observacoes: string[];
};

/** `acimaDoPiso`: frete do motorista acima do piso da ANTT (0,05 = 5%), como na negociação real. */
export type OpcoesComposicao = { maxCaminhoes?: number; aceitarAtrasados?: boolean; penalidadeKm?: number; param?: ParamFiscais; acimaDoPiso?: number };

/** Menor custo total que cobre o lote (frete no piso, ou `acimaDoPiso` acima dele, + pedágio + INSS de PF + R$ 0,50/km até o embarque),
   por programação dinâmica sobre a capacidade em décimos de tonelada; empate → menos caminhões → maior nota. */
export function comporLote(carga: CargaDespacho, candidatos: readonly Candidato[], op: OpcoesComposicao = {}): Composicao {
  const fiscal = op.param ?? FISCAL_PADRAO;
  const pen = op.penalidadeKm ?? 0.5;
  const fator = 1 + Math.max(0, op.acimaDoPiso ?? 0);
  const freteDe = (c: Candidato) => Math.ceil(c.piso * fator);
  const pool = candidatos.filter((c) => op.aceitarAtrasados || c.chegaNoPrazo);
  const U = 10;
  const alvo = Math.ceil(carga.pesoT * U);
  const custo = pool.map((c) => freteDe(c) * (c.motorista.tipo === "PF" ? 1.04 : 1) + c.pedagio + pen * c.kmAteEmbarque);
  const cap = pool.map((c) => Math.floor(c.motorista.capacidadeT * U));
  const maxN = op.maxCaminhoes ?? Infinity;

  type Sol = { custo: number; n: number; score: number; itens: number[] };
  let dp: (Sol | null)[] = Array(alvo + 1).fill(null);
  dp[0] = { custo: 0, n: 0, score: 0, itens: [] };
  const melhor = (a: Sol | null, b: Sol) =>
    !a || b.custo < a.custo - 1e-6 || (Math.abs(b.custo - a.custo) <= 1e-6 && (b.n < a.n || (b.n === a.n && b.score > a.score)));
  for (let i = 0; i < pool.length; i++) {
    const nd = dp.slice();
    for (let t = 0; t <= alvo; t++) {
      const s = dp[t];
      if (!s || s.n >= maxN) continue;
      const t2 = Math.min(alvo, t + cap[i]);
      const cand: Sol = { custo: s.custo + custo[i], n: s.n + 1, score: s.score + pool[i].score, itens: [...s.itens, i] };
      if (melhor(nd[t2], cand)) nd[t2] = cand;
    }
    dp = nd;
  }

  const obs: string[] = [];
  let sol = dp[alvo];
  if (!sol) {
    const idx = pool
      .map((_, i) => i)
      .sort((a, b) => pool[b].score - pool[a].score)
      .slice(0, Number.isFinite(maxN) ? maxN : pool.length);
    sol = { custo: idx.reduce((s, i) => s + custo[i], 0), n: idx.length, score: 0, itens: idx };
    obs.push("Os motoristas disponíveis não fecham o lote: registre mais disponibilidades ou aumente o raio.");
  }

  const escolhidos = sol.itens.map((i) => pool[i]);
  const capTotal = escolhidos.reduce((s, c) => s + c.motorista.capacidadeT, 0);
  const pesoTotal = Math.min(carga.pesoT, capTotal);
  let acc = 0;
  const caminhoes: CaminhaoNoLote[] = escolhidos.map((c, k) => {
    const peso =
      k < escolhidos.length - 1
        ? Math.round(((pesoTotal * c.motorista.capacidadeT) / capTotal) * 100) / 100
        : Math.round((pesoTotal - acc) * 100) / 100;
    acc += peso;
    const freteMotorista = freteDe(c);
    const freteEmpresa = (carga.fretePorT ?? 0) * peso;
    const cte =
      freteEmpresa > 0
        ? calcularCTe(
            {
              freteEmpresa,
              freteMotorista,
              pedagio: c.pedagio,
              origemUF: carga.origem.uf,
              destinoUF: carga.destino.uf,
              motoristaPF: c.motorista.tipo === "PF",
              valorMercadoria: (carga.valorMercadoriaPorT ?? 0) * peso,
            },
            fiscal,
          )
        : null;
    return { candidato: c, pesoT: peso, freteMotorista, freteEmpresa, cte };
  });
  const custoMP = caminhoes.reduce((s, c) => s + c.freteMotorista + c.candidato.pedagio, 0);
  const fe = caminhoes.reduce((s, c) => s + c.freteEmpresa, 0);
  const liq = caminhoes.reduce((s, c) => s + (c.cte?.resultadoLiquido ?? 0), 0);
  for (const c of caminhoes) if (c.cte && c.cte.resultadoLiquido < 0) obs.push(`${c.candidato.motorista.placaCavalo}: dá prejuízo com este preço por tonelada.`);
  obs.push(
    fator > 1
      ? `Frete do motorista ${Math.round((fator - 1) * 1000) / 10}% acima do piso da ANTT.`
      : "Frete do motorista calculado no piso da ANTT: o negociado costuma ser maior, então a margem real tende a ser menor.",
  );
  return {
    caminhoes,
    capacidadeT: capTotal,
    pesoAlocadoT: pesoTotal,
    faltaT: Math.max(0, Math.round((carga.pesoT - pesoTotal) * 100) / 100),
    custoMotoristaPedagio: custoMP,
    custoPorT: pesoTotal ? custoMP / pesoTotal : 0,
    freteEmpresa: fe,
    resultadoLiquido: liq,
    margemLiquida: fe ? liq / fe : 0,
    observacoes: obs,
  };
}
