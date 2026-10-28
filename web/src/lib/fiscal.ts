/* Regras puras das retenções do frete pago a autônomo PF (tela, planilha e testes). O cálculo de cada
   viagem é do banco (`fiscal_retencoes`, migration 20261107000100); aqui só se soma, agrupa e exporta. */

/** Uma linha de `fiscal_retencoes`: uma viagem finalizada no mês com contratado pessoa física. */
export type LinhaRetencao = {
  viagemId: string;
  viagemNumero: number;
  data: string;
  cteNumero: number | null;
  contratadoId: string;
  contratadoNome: string;
  contratadoCpf: string;
  frete: number;
  base: number;
  inss: number;
  sest: number;
  senat: number;
  patronal: number;
  baseIrrf: number;
};

export type TotaisRetencao = Pick<LinhaRetencao, "frete" | "base" | "inss" | "sest" | "senat" | "patronal" | "baseIrrf"> & {
  quantidade: number;
  /** Guia do INSS: retido do motorista + patronal da PRISA. */
  guiaInss: number;
  /** Guia do SEST/SENAT: só o retido do motorista. */
  guiaSestSenat: number;
};

/** Soma em centavos para não acumular erro de ponto flutuante. */
const somar = (linhas: LinhaRetencao[], campo: keyof TotaisRetencao & keyof LinhaRetencao) =>
  linhas.reduce((t, l) => t + Math.round(Number(l[campo]) * 100), 0) / 100;

export function somarRetencoes(linhas: LinhaRetencao[]): TotaisRetencao {
  const t = {
    quantidade: linhas.length,
    frete: somar(linhas, "frete"),
    base: somar(linhas, "base"),
    inss: somar(linhas, "inss"),
    sest: somar(linhas, "sest"),
    senat: somar(linhas, "senat"),
    patronal: somar(linhas, "patronal"),
    baseIrrf: somar(linhas, "baseIrrf"),
  };
  return {
    ...t,
    guiaInss: Math.round((t.inss + t.patronal) * 100) / 100,
    guiaSestSenat: Math.round((t.sest + t.senat) * 100) / 100,
  };
}

export type IrrfContratado = { contratadoId: string; nome: string; cpf: string; fretes: number; quantidade: number; baseIrrf: number };

/** IRRF por contratado: soma os fretes do mês (a tabela progressiva vale sobre o total do mês). Maior base primeiro. */
export function irrfPorContratado(linhas: LinhaRetencao[]): IrrfContratado[] {
  const por = new Map<string, IrrfContratado>();
  for (const l of linhas) {
    const c = por.get(l.contratadoId) ?? { contratadoId: l.contratadoId, nome: l.contratadoNome, cpf: l.contratadoCpf, fretes: 0, quantidade: 0, baseIrrf: 0 };
    c.fretes = Math.round((c.fretes + l.frete) * 100) / 100;
    c.baseIrrf = Math.round((c.baseIrrf + l.baseIrrf) * 100) / 100;
    c.quantidade += 1;
    por.set(l.contratadoId, c);
  }
  return [...por.values()].sort((a, b) => b.baseIrrf - a.baseIrrf || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* ---------- planilha para o contador ---------- */

const numeroBr = (v: number) => v.toFixed(2).replace(".", ",");
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const cpfBr = (c: string) => (/^\d{11}$/.test(c) ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c);

/** Célula CSV: aspas quando há separador, aspas ou quebra de linha; fórmula ("=", "+", "-", "@") vira texto. */
function celula(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const linhaCsv = (cols: (string | number)[]) => cols.map(celula).join(";");

/**
 * Planilha CSV que o Excel em português abre direto: separador ";", vírgula decimal e BOM UTF-8 (acentos).
 * Primeiro o detalhe por viagem com o total do mês; depois a base do IRRF por contratado.
 */
export function planilhaRetencoes(linhas: LinhaRetencao[], mes: string): string {
  const t = somarRetencoes(linhas);
  const saida: string[] = [
    linhaCsv([`Retenções do frete pago a autônomo pessoa física - competência ${mes.slice(5, 7)}/${mes.slice(0, 4)}`]),
    "",
    linhaCsv(["Data", "Viagem", "CT-e", "Contratado", "CPF", "Frete", "Base 20%", "INSS 11%", "SEST 1,5%", "SENAT 1,0%", "INSS patronal 20%", "Base IRRF 10%"]),
    ...linhas.map((l) =>
      linhaCsv([
        dataBr(l.data),
        l.viagemNumero,
        l.cteNumero ?? "",
        l.contratadoNome,
        cpfBr(l.contratadoCpf),
        numeroBr(l.frete),
        numeroBr(l.base),
        numeroBr(l.inss),
        numeroBr(l.sest),
        numeroBr(l.senat),
        numeroBr(l.patronal),
        numeroBr(l.baseIrrf),
      ]),
    ),
    linhaCsv(["Total do mês", "", "", "", "", numeroBr(t.frete), numeroBr(t.base), numeroBr(t.inss), numeroBr(t.sest), numeroBr(t.senat), numeroBr(t.patronal), numeroBr(t.baseIrrf)]),
    "",
    linhaCsv(["Guia do INSS (retido + patronal)", numeroBr(t.guiaInss)]),
    linhaCsv(["Guia do SEST/SENAT", numeroBr(t.guiaSestSenat)]),
    "",
    linhaCsv(["IRRF por contratado (tabela progressiva sobre a soma do mês)"]),
    linhaCsv(["Contratado", "CPF", "Fretes no mês", "Valor dos fretes", "Base IRRF"]),
    ...irrfPorContratado(linhas).map((c) => linhaCsv([c.nome, cpfBr(c.cpf), c.quantidade, numeroBr(c.fretes), numeroBr(c.baseIrrf)])),
  ];
  return "﻿" + saida.join("\r\n") + "\r\n";
}
