/* Regras da calculadora de frete (Calculadora de Frete PRISA, `regras/frete.ts` e `regras/antt.ts`): piso
   da ANTT, resultado do CT-e, os limites que fecham a margem mínima, o checklist do CIOT e o veredito da
   contratação. Puro: roda no navegador a cada tecla. As mesmas contas existem no banco (`piso_antt`,
   `calcular_cte`, migration 20261027000100) e valem para a viagem; aqui é a cotação, antes de haver
   pedido. Os casos de `tests/unit/calculadora/casos.json` conferem as duas ao centavo. */
import type { TipoSinal } from "@/components/Sinal";
import type { Database } from "@/lib/banco";

export type TipoCarga = Database["public"]["Enums"]["tipo_carga_antt"];
export type UF = Database["public"]["Enums"]["uf"];

/** Colunas da Tabela A da ANTT (não há 8 eixos). */
export const EIXOS_ANTT = [2, 3, 4, 5, 6, 7, 9] as const;

/** Margem líquida mínima para contratar (decisão do usuário em 2026-10-24: o limite de "Abaixo do mínimo"). */
export const MARGEM_MINIMA = 0.085;
/** Margem (antes do IRPJ/CSLL) mínima para descontar a duplicata, como na calculadora original. */
export const MARGEM_DUPLICATA = 0.11;
/** Frete sugerido = piso × (1 + 40%) + pedágio, como na calculadora original. */
export const ACRESCIMO_SUGERIDO = 0.4;
/** Prazo máximo para quitar o saldo (Lei 15.485/2026). */
export const PRAZO_MAXIMO_DIAS = 30;

/* ---------- piso ANTT ---------- */

export type Coeficiente = { tipo: TipoCarga; eixos: number; ccd: number; cc: number; portaria: string };
export type CoeficienteUsado = { ccd: number; cc: number; eixosTabela: number; portaria: string };

/** Coluna para o número de eixos: a inferior (ou igual) mais próxima com valor; sem ela, a superior mais
   próxima (mesma regra de `antt_coeficiente_para`). `tabela` traz só a vigência atual de cada tipo. */
export function coeficientePara(tabela: readonly Coeficiente[], tipo: TipoCarga, eixos: number): CoeficienteUsado | null {
  const doTipo = tabela.filter((c) => c.tipo === tipo);
  const abaixo = doTipo.filter((c) => c.eixos <= eixos).sort((a, b) => b.eixos - a.eixos)[0];
  const acima = doTipo.filter((c) => c.eixos > eixos).sort((a, b) => a.eixos - b.eixos)[0];
  const c = abaixo ?? acima;
  return c ? { ccd: c.ccd, cc: c.cc, eixosTabela: c.eixos, portaria: c.portaria } : null;
}

/** Piso = km × CCD + CC (+ 0,92 × km × CCD com retorno vazio). O pedágio não entra: é vale-pedágio. */
export function pisoAntt(c: CoeficienteUsado | null, km: number, retornoVazio = false): number {
  if (!c || !(km > 0)) return 0;
  return km * c.ccd + c.cc + (retornoVazio ? 0.92 * km * c.ccd : 0);
}

/** Frete sugerido para cobrar do cliente: piso × (1 + 40%) + pedágio. */
export function freteSugerido(piso: number, pedagio: number): number {
  return piso > 0 ? piso * (1 + ACRESCIMO_SUGERIDO) + pedagio : 0;
}

/** Frete contratado (o negociado com o cliente) frente ao mínimo da ANTT e ao sugerido, como o `fcSub` da
   calculadora original: abaixo do mínimo é proibido; entre o mínimo e o sugerido, atenção. */
export function situacaoContratado(contratado: number, piso: number, sugerido: number): { tipo: TipoSinal; texto: string } | null {
  if (!(contratado > 0) || !(piso > 0)) return null;
  const pct = (v: number) => `${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (contratado < piso - 0.005) return { tipo: "bloqueado", texto: `${pct(contratado / piso - 1)} abaixo do mínimo: contratação proibida` };
  if (contratado < sugerido - 0.005) return { tipo: "vencendo", texto: `${pct(contratado / piso - 1)} acima do mínimo, abaixo do sugerido` };
  return { tipo: "normal", texto: `${pct(contratado / piso - 1)} acima do mínimo` };
}

/* ---------- resultado do CT-e ---------- */

export type ParamFiscais = {
  pisCofins: number; // cumulativo, sobre (frete − pedágio − ICMS)
  irpjCsll: number; // presumido, sobre (frete − pedágio)
  panCardPct: number; // sobre (frete do motorista devido + pedágio)
  panCardTransferencia: number; // R$ por transferência ao motorista
  panCardTransferencias: number; // adiantamento + saldo
  descontoDuplicata: number; // sobre o frete da empresa
  seguroRctrc: number; // sobre o valor da mercadoria
  seguroRcdc: number; // sobre o valor da mercadoria
};

/** Valores de partida (os mesmos da linha de 2026-01-01 de `parametro_fiscal`). A tela usa os do banco. */
export const FISCAL_PADRAO: ParamFiscais = {
  pisCofins: 0.0365,
  irpjCsll: 0.0228,
  panCardPct: 0.01,
  panCardTransferencia: 0.5,
  panCardTransferencias: 2,
  descontoDuplicata: 0.053,
  seguroRctrc: 0.0003,
  seguroRcdc: 0.0005,
};

const SUL_SUDESTE: readonly string[] = ["PR", "SC", "RS", "SP", "RJ", "MG"];

/** ICMS do transporte: de S/SE (fora o ES) para N/NE/CO ou ES, 7%; demais interestaduais, 12%; dentro do
   PR, 0; dentro de outra UF, 12% (a conferir caso a caso). */
export function aliquotaIcms(origem: string, destino: string): number {
  if (origem === destino) return origem === "PR" ? 0 : 0.12;
  return SUL_SUDESTE.includes(origem) && !SUL_SUDESTE.includes(destino) ? 0.07 : 0.12;
}

export type EntradaCTe = {
  freteEmpresa: number;
  freteMotorista: number;
  pedagio: number;
  origemUF: string;
  destinoUF: string;
  motoristaPF: boolean;
  repassarInss?: boolean;
  descontarDuplicata?: boolean;
  complementoCobrado?: number;
  outrosCustos?: number;
  valorMercadoria?: number;
};

export type Faixa = "Prejuízo" | "Abaixo do mínimo" | "Mínimo aceitável" | "Esperado" | "Ideal" | "Excelente";

export type ResultadoCTe = {
  aliquotaIcms: number;
  icms: number;
  impostoFederal: number;
  inssPatronal: number;
  retencoesMotorista: number;
  freteMotoristaDevido: number;
  taxaPanCard: number;
  seguroCarga: number;
  descontoDuplicata: number;
  resultado: number;
  margem: number;
  irpjCsll: number;
  resultadoLiquido: number;
  margemLiquida: number;
  faixa: Faixa;
};

export function faixaMargem(m: number): Faixa {
  if (m < 0) return "Prejuízo";
  if (m < MARGEM_MINIMA) return "Abaixo do mínimo";
  if (m < 0.11) return "Mínimo aceitável";
  if (m < 0.12) return "Esperado";
  if (m < 0.15) return "Ideal";
  return "Excelente";
}

/** Sem arredondar (como o motor); quem mostra arredonda. */
export function calcularCTe(e: EntradaCTe, p: ParamFiscais = FISCAL_PADRAO): ResultadoCTe {
  const fe = e.freteEmpresa;
  const fm = e.freteMotorista;
  const pd = e.pedagio;
  const al = aliquotaIcms(e.origemUF, e.destinoUF);
  const icms = Math.max(0, fe - pd) * al;
  const impostoFederal = Math.max(0, fe - pd - icms) * p.pisCofins;
  const inssPatronal = e.motoristaPF ? fm * 0.2 * 0.2 : 0; // 20% sobre 20% do frete
  const retencoesMotorista = e.motoristaPF ? fm * 0.2 * (0.11 + 0.025) : 0; // INSS 11% + SEST/SENAT 2,5%
  const repasse = e.motoristaPF && e.repassarInss ? inssPatronal : 0;
  const freteMotoristaDevido = fm - retencoesMotorista - repasse;
  const taxaPanCard = fm > 0 ? (freteMotoristaDevido + pd) * p.panCardPct + p.panCardTransferencia * p.panCardTransferencias : 0;
  const seguroCarga = (e.valorMercadoria ?? 0) * (p.seguroRctrc + p.seguroRcdc);
  const base =
    fe + (e.complementoCobrado ?? 0) - fm - pd - icms - impostoFederal - inssPatronal - taxaPanCard - seguroCarga - (e.outrosCustos ?? 0) + repasse;
  const descontoDuplicata = e.descontarDuplicata ? fe * p.descontoDuplicata : 0;
  const resultado = base - descontoDuplicata;
  const irpjCsll = Math.max(0, fe - pd) * p.irpjCsll;
  const resultadoLiquido = resultado - irpjCsll;
  const margem = fe ? resultado / fe : 0;
  const margemLiquida = fe ? resultadoLiquido / fe : 0;
  return {
    aliquotaIcms: al,
    icms,
    impostoFederal,
    inssPatronal,
    retencoesMotorista,
    freteMotoristaDevido,
    taxaPanCard,
    seguroCarga,
    descontoDuplicata,
    resultado,
    margem,
    irpjCsll,
    resultadoLiquido,
    margemLiquida,
    faixa: faixaMargem(margemLiquida),
  };
}

/** Margem com a duplicata descontada, para decidir se vale descontar (mínimo de 11%). */
export function margemComDuplicata(e: EntradaCTe, p: ParamFiscais = FISCAL_PADRAO): number {
  return calcularCTe({ ...e, descontarDuplicata: true }, p).margem;
}

/* ---------- limites que fecham a margem mínima ---------- */

/* A margem líquida é linear por partes no frete do motorista (cai) e no da empresa (sobe): a bissecção sobre
   o próprio calcularCTe acha o ponto exato sem repetir a fórmula (Pan Card, INSS e impostos entram juntos). */
function bisseccao(f: (v: number) => number, lo: number, hi: number, crescente: boolean): number {
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (f(m) >= 0 === crescente) hi = m;
    else lo = m;
  }
  return crescente ? hi : lo;
}

/** Maior frete do motorista que ainda deixa a margem líquida no mínimo; nulo = nem com zero fecha. */
export function freteMotoristaMaximo(e: EntradaCTe, p: ParamFiscais = FISCAL_PADRAO, minimo = MARGEM_MINIMA): number | null {
  if (!(e.freteEmpresa > 0)) return null;
  const folga = (fm: number) => calcularCTe({ ...e, freteMotorista: fm }, p).margemLiquida - minimo;
  if (folga(0) < 0) return null;
  return bisseccao(folga, 0, e.freteEmpresa, false);
}

/** Menor frete da empresa que deixa a margem líquida no mínimo com o frete do motorista dado. */
export function freteEmpresaMinimo(e: EntradaCTe, p: ParamFiscais = FISCAL_PADRAO, minimo = MARGEM_MINIMA): number | null {
  const custo = e.freteMotorista + e.pedagio;
  if (!(custo > 0)) return null;
  const folga = (fe: number) => calcularCTe({ ...e, freteEmpresa: fe }, p).margemLiquida - minimo;
  let hi = custo * 2 + 1000;
  for (let i = 0; i < 20 && folga(hi) < 0; i++) hi *= 2;
  if (folga(hi) < 0) return null;
  return bisseccao(folga, 0, hi, true);
}

/* ---------- checklist do CIOT ---------- */

export type ItemCiot = { tipo: Extract<TipoSinal, "normal" | "pendente" | "vencendo" | "bloqueado">; texto: string; detalhe?: string };

export type EntradaCiot = {
  km: number;
  piso: number;
  freteMotorista: number;
  pedagio: number;
  prazoSaldoDias: number;
  rntrcConferido: boolean;
  motoristaPF: boolean;
};

const reais = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O que a ANTT confere ao emitir o CIOT (`calcCiot` da calculadora original). */
export function checklistCiot(c: EntradaCiot): ItemCiot[] {
  const itens: ItemCiot[] = [];
  if (!(c.km > 0) || !(c.piso > 0)) itens.push({ tipo: "pendente", texto: "Informe o km e os eixos para calcular o piso" });
  else if (!(c.freteMotorista > 0)) itens.push({ tipo: "pendente", texto: "Informe o frete do motorista" });
  else if (c.freteMotorista < c.piso - 0.005)
    itens.push({
      tipo: "bloqueado",
      texto: `Frete abaixo do piso: faltam ${reais(c.piso - c.freteMotorista)}`,
      detalhe: "A ANTT bloqueia o CIOT e a Prisa, como contratante, fica sujeita a multa.",
    });
  else itens.push({ tipo: "normal", texto: `Frete ${reais(c.freteMotorista - c.piso)} acima do piso` });

  if (c.km > 0 && !(c.pedagio > 0))
    itens.push({
      tipo: "bloqueado",
      texto: "Vale-pedágio zerado",
      detalhe: "Rota com pedágio: o vale-pedágio é obrigatório e pago à parte (Lei 10.209/2001). Embutido no frete, gera multa.",
    });
  else if (c.pedagio > 0) itens.push({ tipo: "normal", texto: `Vale-pedágio de ${reais(c.pedagio)} separado do frete` });

  if (c.prazoSaldoDias > PRAZO_MAXIMO_DIAS)
    itens.push({
      tipo: "bloqueado",
      texto: `Saldo em ${c.prazoSaldoDias} dias úteis`,
      detalhe: `A Lei 15.485/2026 limita a quitação a ${PRAZO_MAXIMO_DIAS} dias úteis.`,
    });
  else itens.push({ tipo: "normal", texto: `Saldo em ${c.prazoSaldoDias} dias úteis (limite: ${PRAZO_MAXIMO_DIAS})` });

  itens.push(
    c.rntrcConferido
      ? { tipo: "normal", texto: "RNTRC do motorista conferido" }
      : { tipo: "vencendo", texto: "RNTRC do motorista não conferido", detalhe: "Contratar transportador sem RNTRC válido é infração para o contratante." },
  );
  if (c.motoristaPF)
    itens.push({
      tipo: "vencendo",
      texto: "Motorista pessoa física",
      detalhe: "Recolher o INSS patronal de 4% e reter do motorista INSS 11% e SEST/SENAT 2,5% sobre 20% do frete, além do IRRF se houver.",
    });
  return itens;
}

/* ---------- veredito ---------- */

export type Veredito = "contratar" | "negociar" | "ajustar" | "nao_contratar" | "incompleto";

export type Limite = {
  rotulo: string;
  /** R$; nulo = não há valor que resolva (mostra "—"). */
  valor: number | null;
  /** O limite que responde à decisão (maior na tela). */
  principal?: boolean;
  /** Mostrar também por tonelada (frete do cliente). */
  porTonelada?: boolean;
};

export type Decisao = { veredito: Veredito; titulo: string; texto: string; limites: Limite[] };

export type EntradaDecisao = {
  cte: EntradaCTe;
  piso: number;
  ciot: readonly ItemCiot[];
  param?: ParamFiscais;
  minimo?: number;
};

/** Pode contratar (verde), negociar ou ajustar (mostarda) ou não contratar (ferrugem). Os limites saem em
   reais para que a operação decida sem ver a margem. */
export function decidir({ cte, piso, ciot, param = FISCAL_PADRAO, minimo = MARGEM_MINIMA }: EntradaDecisao): Decisao {
  const fe = cte.freteEmpresa;
  const fm = cte.freteMotorista;
  const pisoLimite: Limite = { rotulo: "Piso ANTT do motorista", valor: piso > 0 ? piso : null };
  if (!(piso > 0))
    return { veredito: "incompleto", titulo: "Faltam dados da rota", texto: "Informe o km e os eixos para calcular o piso da ANTT.", limites: [] };
  if (!(fe > 0) || !(fm > 0))
    return {
      veredito: "incompleto",
      titulo: "Faltam os fretes",
      texto: "Informe o frete do cliente e o do motorista para ver a decisão.",
      limites: [pisoLimite],
    };

  const r = calcularCTe(cte, param);
  const fmMax = freteMotoristaMaximo(cte, param, minimo);
  const fmLegal = Math.max(fm, piso);
  const feMin = freteEmpresaMinimo({ ...cte, freteMotorista: fmLegal }, param, minimo);
  const cobrar = (rotulo: string, principal = false): Limite => ({ rotulo, valor: feMin, principal, porTonelada: true });
  const motoristaCabe = fmMax !== null && fmMax >= piso - 0.005;

  if (fm < piso - 0.005) {
    const limites: Limite[] = [{ rotulo: "Pague ao motorista pelo menos", valor: piso, principal: true }];
    if (!motoristaCabe) limites.push(cobrar("Para isso, cobre do cliente pelo menos"));
    return {
      veredito: "nao_contratar",
      titulo: "Não contratar",
      texto: "O frete do motorista está abaixo do piso da ANTT. Contratar assim é proibido por lei.",
      limites,
    };
  }
  if (r.resultadoLiquido < 0) {
    return {
      veredito: "nao_contratar",
      titulo: "Não contratar",
      texto: "Com estes valores a viagem dá prejuízo.",
      limites: [
        ...(motoristaCabe ? [{ rotulo: "Pague ao motorista no máximo", valor: fmMax, principal: true }] : []),
        cobrar(motoristaCabe ? "Ou cobre do cliente pelo menos" : "Cobre do cliente pelo menos", !motoristaCabe),
        pisoLimite,
      ],
    };
  }
  if (r.margemLiquida < minimo) {
    return {
      veredito: "negociar",
      titulo: "Negociar",
      texto: motoristaCabe
        ? "Está dentro da lei, mas abaixo da margem mínima. Baixe o frete do motorista ou suba o do cliente."
        : "O piso da ANTT não deixa baixar o motorista o suficiente: só subindo o frete do cliente.",
      limites: [
        ...(motoristaCabe ? [{ rotulo: "Pague ao motorista no máximo", valor: fmMax, principal: true }] : []),
        cobrar(motoristaCabe ? "Ou cobre do cliente pelo menos" : "Cobre do cliente pelo menos", !motoristaCabe),
        pisoLimite,
      ],
    };
  }
  const folga: Limite = { rotulo: "Folga para pagar ao motorista", valor: Math.max(0, (fmMax ?? fm) - fm), principal: true };
  if (ciot.some((i) => i.tipo === "bloqueado")) {
    return {
      veredito: "ajustar",
      titulo: "Ajustar antes do CIOT",
      texto: "O frete fecha a conta, mas há impedimento na lista do CIOT.",
      limites: [folga, pisoLimite],
    };
  }
  return {
    veredito: "contratar",
    titulo: "Pode contratar",
    texto: "Frete acima do piso, margem dentro do mínimo e nada impede o CIOT.",
    limites: [folga, { rotulo: "Teto do frete do motorista", valor: fmMax }, pisoLimite],
  };
}

/* ---------- apoio da viagem ---------- */

/** Horas de direção com uma parada de 30 min a cada 5h30 (Lei do Motorista), como na calculadora original. */
export function horasDeViagem(km: number, velocidade = 80): number {
  if (!(km > 0) || !(velocidade > 0)) return 0;
  const h = km / velocidade;
  return h + Math.max(0, Math.ceil(h / 5.5) - 1) * 0.5;
}

/** 7,5 → "7h30". */
export function horasTexto(h: number): string {
  if (!(h > 0)) return "—";
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, "0")}`;
}
