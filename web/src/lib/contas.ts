/* Contas a pagar e a receber: rótulos, situações, somas em centavos e o simulador de antecipação.
   Puro (sem servidor): pode ser usado em Client Components. As regras de verdade (quem aprova, quando paga)
   estão no banco (migrations 20261101000200 e 0300); aqui só o que a tela mostra. */
import type { TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";

export type FormaPagamento =
  | "pix"
  | "boleto"
  | "transferencia"
  | "cartao_frete"
  | "cartao_credito"
  | "debito_automatico"
  | "dinheiro"
  | "outro";

/** Mesma ordem e rótulos de `rotulo_forma()` no banco. */
export const FORMAS: readonly { id: FormaPagamento; rotulo: string }[] = [
  { id: "pix", rotulo: "Pix" },
  { id: "boleto", rotulo: "Boleto" },
  { id: "transferencia", rotulo: "Transferência" },
  { id: "cartao_frete", rotulo: "Cartão-frete" },
  { id: "cartao_credito", rotulo: "Cartão de crédito" },
  { id: "debito_automatico", rotulo: "Débito automático" },
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "outro", rotulo: "Outro" },
];

export function ehForma(v: unknown): v is FormaPagamento {
  return FORMAS.some((f) => f.id === v);
}

export function rotuloForma(f: string): string {
  return FORMAS.find((x) => x.id === f)?.rotulo ?? "Outro";
}

export type OrigemPagar = "manual" | "frete_adiantamento" | "frete_saldo" | "taxa_cartao";

export const ROTULO_ORIGEM: Record<OrigemPagar, string> = {
  manual: "Lançada à mão",
  frete_adiantamento: "Adiantamento do frete (70% + pedágio)",
  frete_saldo: "Saldo do frete (30%)",
  taxa_cartao: "Taxa do cartão-frete",
};

/** Situação das views `v_fin_pagar` e `v_fin_receber` (o banco calcula com o dia de Brasília). */
export type SituacaoPagar = "cancelada" | "paga" | "vencida" | "falta_aprovar" | "a_vencer";
export type SituacaoReceber = "cancelada" | "recebida" | "vencida" | "a_vencer";

/** Coluna "Aprovação" do contas a pagar: forma + cor (DESIGN.md). `venceuHa` (dias de atraso, só quando a conta em
   aberto já venceu) acrescenta o atraso a "Falta aprovar": o banco chama de `falta_aprovar` a conta vencida que ainda
   não foi aprovada, e a pessoa precisa ver as duas coisas. `canceladoAutomatico`: o NILT cancelou sozinho. */
export function sinalAprovacao(
  c: { canceladoEm: string | null; pagoEm: string | null; aprovadoEm: string | null; canceladoAutomatico?: boolean },
  venceuHa?: number | null,
): {
  tipo: TipoSinal;
  texto: string;
} {
  if (c.canceladoEm) return { tipo: "neutro", texto: c.canceladoAutomatico ? "Cancelada pelo NILT" : "Cancelada" };
  if (c.pagoEm) return { tipo: "normal", texto: "Paga" };
  if (c.aprovadoEm) return { tipo: "normal", texto: "Aprovada" };
  if (venceuHa !== null && venceuHa !== undefined && venceuHa < 0) return { tipo: "pendente", texto: `Falta aprovar · ${formato.dias(venceuHa)}` };
  return { tipo: "pendente", texto: "Falta aprovar" };
}

/** Frase da parte já descontada do saldo do frete de motorista autônomo (INSS, SEST e SENAT); o NILT recolhe na guia do mês. */
export function fraseRetencao(valor: number): string {
  return `Já descontadas as retenções do autônomo (INSS, SEST e SENAT): ${formato.reais(valor)}`;
}

/** Situação do título a receber, para o sinal. */
export function sinalReceber(s: SituacaoReceber): { tipo: TipoSinal; texto: string } {
  switch (s) {
    case "cancelada":
      return { tipo: "neutro", texto: "Cancelado" };
    case "recebida":
      return { tipo: "normal", texto: "Recebido" };
    case "vencida":
      return { tipo: "bloqueado", texto: "Vencido" };
    default:
      return { tipo: "info", texto: "A vencer" };
  }
}

/** Dias de `de` até `ate` (datas "aaaa-mm-dd"); negativo quando `ate` já passou. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate.slice(0, 10) + "T00:00:00Z") - Date.parse(de.slice(0, 10) + "T00:00:00Z")) / 864e5);
}

/** Vencimento de uma conta em aberto: vencida (ferrugem), vence em até 7 dias (mostarda) ou normal.
   Conta paga, recebida ou cancelada não tem prazo (neutro). */
export function estadoVencimento(
  vencimento: string,
  hoje: string,
  aberta: boolean,
): { estado: "vencida" | "vencendo" | "normal" | "neutro"; dias: number } {
  const dias = diasEntre(hoje, vencimento);
  if (!aberta) return { estado: "neutro", dias };
  return { estado: dias < 0 ? "vencida" : dias <= 7 ? "vencendo" : "normal", dias };
}

const centavos = (v: number) => Math.round(v * 100);

/** Soma em centavos (0,1 + 0,2 = 0,3). */
export function somarValores(itens: readonly { valor: number }[]): number {
  return itens.reduce((s, i) => s + centavos(i.valor), 0) / 100;
}

export type Grupo<T> = { id: string; rotulo: string; itens: T[]; total: number };

/** Agrupa (por centro de custo, tipo de despesa…) com o subtotal de cada grupo; grupos na ordem do id. */
export function agrupar<T extends { valor: number }>(itens: readonly T[], chave: (t: T) => { id: string; rotulo: string }): Grupo<T>[] {
  const mapa = new Map<string, Grupo<T>>();
  for (const item of itens) {
    const { id, rotulo } = chave(item);
    const g = mapa.get(id) ?? { id, rotulo, itens: [], total: 0 };
    g.itens.push(item);
    mapa.set(id, g);
  }
  return [...mapa.values()]
    .map((g) => ({ ...g, total: somarValores(g.itens) }))
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
}

/* ---------- simulador de antecipação (fomento) ---------- */

export type LinhaSimulacao = { id: string; valor: number; dias: number; desagio: number; tarifa: number; liquido: number };

export type Simulacao = {
  linhas: LinhaSimulacao[];
  bruto: number;
  desagio: number;
  tarifas: number;
  liquido: number;
  /** Prazo médio em dias, ponderado pelo valor. */
  prazoMedio: number;
  /** Custo efetivo ao mês, em % ((bruto/líquido − 1) por 30 dias de prazo médio); null sem títulos. */
  custoEfetivoMesPct: number | null;
};

/**
 * Simula antecipar os títulos no fomento: deságio simples (valor × taxa ao mês × dias / 30, arredondado por
 * título) e uma tarifa fixa por título. Título que vence hoje ou já venceu conta 0 dia (sem deságio).
 */
export function simularAntecipacao(
  titulos: readonly { id: string; valor: number; vencimento: string }[],
  taxaMesPct: number,
  tarifaPorTitulo: number,
  hoje: string,
): Simulacao {
  const linhas = titulos.map((t) => {
    const dias = Math.max(0, diasEntre(hoje, t.vencimento));
    const desagio = centavos((t.valor * (taxaMesPct / 100) * dias) / 30) / 100;
    const tarifa = centavos(tarifaPorTitulo) / 100;
    return { id: t.id, valor: t.valor, dias, desagio, tarifa, liquido: (centavos(t.valor) - centavos(desagio) - centavos(tarifa)) / 100 };
  });
  const bruto = somarValores(linhas);
  const desagio = somarValores(linhas.map((l) => ({ valor: l.desagio })));
  const tarifas = somarValores(linhas.map((l) => ({ valor: l.tarifa })));
  const liquido = (centavos(bruto) - centavos(desagio) - centavos(tarifas)) / 100;
  const prazoMedio = bruto > 0 ? linhas.reduce((s, l) => s + l.valor * l.dias, 0) / bruto : 0;
  const custoEfetivoMesPct = linhas.length > 0 && liquido > 0 && prazoMedio > 0 ? ((bruto / liquido - 1) / (prazoMedio / 30)) * 100 : null;
  return { linhas, bruto, desagio, tarifas, liquido, prazoMedio, custoEfetivoMesPct };
}
