/* Piso ANTT e resultado do CT-e da viagem: leitura do jsonb de `frete_da_viagem` e
   `resultado_cte_da_viagem` (migration 20261027000100) e as situações que a ficha mostra. As contas são
   do banco (a validação é no servidor); aqui só se lê e se escolhe o sinal. */
import type { TipoSinal } from "@/components/Sinal";
import type { Json } from "@/lib/banco";

export type FreteViagem = {
  pesoT: number;
  /** R$ da viagem: por tonelada × peso, ou o total do pedido rateado pelo peso. */
  freteEmpresa: number;
  /** R$ total do motorista (nulo = não informado). */
  freteMotorista: number | null;
  km: number | null;
  pedagio: number | null;
  eixos: number;
  tipoCargaRotulo: string;
  ufOrigem: string;
  ufDestino: string;
  contratadoPf: boolean;
  frotaPropria: boolean;
  piso: number | null;
  /** Coluna da tabela usada (8 eixos → 7, por exemplo); nula = sem coeficiente vigente. */
  pisoEixosTabela: number | null;
  pisoPortaria: string | null;
  abaixoDoPiso: boolean;
};

export type ResultadoCte = {
  icms: number;
  aliquotaIcms: number;
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
  faixa: string;
};

type Obj = Record<string, Json | undefined>;

const ehObj = (j: Json | undefined): j is Obj => typeof j === "object" && j !== null && !Array.isArray(j);
const num = (v: Json | undefined): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const zero = (v: Json | undefined): number => num(v) ?? 0;
const txt = (v: Json | undefined): string | null => (typeof v === "string" ? v : null);

export function lerFrete(j: Json | null | undefined): FreteViagem | null {
  if (!ehObj(j ?? undefined)) return null;
  const o = j as Obj;
  return {
    pesoT: zero(o.peso_t),
    freteEmpresa: zero(o.frete_empresa),
    freteMotorista: num(o.frete_motorista),
    km: num(o.km),
    pedagio: num(o.pedagio),
    eixos: zero(o.eixos),
    tipoCargaRotulo: txt(o.tipo_carga_rotulo) ?? "",
    ufOrigem: txt(o.uf_origem) ?? "",
    ufDestino: txt(o.uf_destino) ?? "",
    contratadoPf: o.contratado_pf === true,
    frotaPropria: o.frota_propria === true,
    piso: num(o.piso),
    pisoEixosTabela: num(o.piso_eixos_tabela),
    pisoPortaria: txt(o.piso_portaria),
    abaixoDoPiso: o.abaixo_do_piso === true,
  };
}

/** O "resultado" de `resultado_cte_da_viagem` (nulo em frota própria ou sem frete do motorista). */
export function lerResultado(j: Json | null | undefined): ResultadoCte | null {
  const r = ehObj(j ?? undefined) ? (j as Obj).resultado : undefined;
  if (!ehObj(r)) return null;
  return {
    icms: zero(r.icms),
    aliquotaIcms: zero(r.aliquota_icms),
    impostoFederal: zero(r.imposto_federal),
    inssPatronal: zero(r.inss_patronal),
    retencoesMotorista: zero(r.retencoes_motorista),
    freteMotoristaDevido: zero(r.frete_motorista_devido),
    taxaPanCard: zero(r.taxa_pan_card),
    seguroCarga: zero(r.seguro_carga),
    descontoDuplicata: zero(r.desconto_duplicata),
    resultado: zero(r.resultado),
    margem: zero(r.margem),
    irpjCsll: zero(r.irpj_csll),
    resultadoLiquido: zero(r.resultado_liquido),
    margemLiquida: zero(r.margem_liquida),
    faixa: txt(r.faixa) ?? "",
  };
}

/** Situação do frete do motorista frente ao piso (a mesma regra da aptidão no banco). */
export function situacaoDoPiso(f: FreteViagem): { tipo: TipoSinal; texto: string } {
  if (f.frotaPropria) return { tipo: "neutro", texto: "Frota própria: sem piso" };
  if (f.freteMotorista === null) return { tipo: "pendente", texto: "Sem frete do motorista" };
  if (f.km === null) return { tipo: "pendente", texto: "Sem km da viagem" };
  if (f.piso === null) return { tipo: "vencendo", texto: "Sem piso na tabela" };
  return f.abaixoDoPiso ? { tipo: "bloqueado", texto: "Abaixo do piso" } : { tipo: "normal", texto: "Acima do piso" };
}

/** Faixa da margem líquida → sinal: abaixo do mínimo trava a atenção; mínimo aceitável avisa. */
export function sinalDaFaixa(faixa: string): TipoSinal {
  if (faixa === "Prejuízo" || faixa === "Abaixo do mínimo") return "bloqueado";
  if (faixa === "Mínimo aceitável") return "vencendo";
  return "normal";
}

/** 0,0835 → "8,35%"; 0,07 → "7%". */
export function porcento(p: number): string {
  return (p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
}
