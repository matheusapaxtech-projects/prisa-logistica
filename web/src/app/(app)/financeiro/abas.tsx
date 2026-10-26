import { Abas } from "@/components/Abas";

export type AbaFinanceiroId = "resultado" | "pagar" | "receber" | "lancamentos" | "regras" | "retencoes";

type Props = {
  ativa: AbaFinanceiroId;
  /** Mês "aaaa-mm" que as abas do extrato e das retenções mantêm (sem ele, o padrão de cada tela). */
  mes?: string;
  /** Contagem mostrada ao lado do nome da aba. */
  contagens?: Partial<Record<AbaFinanceiroId, number>>;
};

/* As partes do Financeiro, iguais em todas as telas dele. Cada aba é uma rota (ou `?aba=` na página do
   resultado); o mês vai junto onde a tela usa mês. */
export function AbasFinanceiro({ ativa, mes, contagens = {} }: Props) {
  const comMes = (base: string, extra?: string) => {
    const u = new URLSearchParams(extra);
    if (mes) u.set("mes", mes);
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <Abas
      rotulo="Partes do financeiro"
      ativa={ativa}
      abas={[
        { id: "resultado", rotulo: "Resultado", href: comMes("/financeiro") },
        { id: "pagar", rotulo: "A pagar", n: contagens.pagar, href: "/financeiro/pagar" },
        { id: "receber", rotulo: "A receber", n: contagens.receber, href: "/financeiro/receber" },
        { id: "lancamentos", rotulo: "Lançamentos", n: contagens.lancamentos, href: comMes("/financeiro", "aba=lancamentos") },
        { id: "regras", rotulo: "Regras", n: contagens.regras, href: comMes("/financeiro", "aba=regras") },
        { id: "retencoes", rotulo: "Retenções", href: comMes("/financeiro/retencoes") },
      ]}
    />
  );
}
