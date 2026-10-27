"use client";

import { useTransition } from "react";
import { CreditCard } from "lucide-react";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { sinalAprovacao } from "@/lib/contas";
import { nomeDoMes } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { lancarTaxaCartao } from "./actions";
import type { TaxaCartao } from "./consultas";
import { ROTULO_SITUACAO_PAGAR } from "./regras";

const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const percentual = (fracao: number) => `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/* Taxa do cartão-frete (Pan Card) do mês: o que foi pago pelo cartão-frete, a taxa calculada (percentual sobre o pago
   mais um valor por transferência) e a conta da taxa, que o botão lança ou atualiza. Só há botão enquanto a conta não
   foi aprovada: depois, mudar o valor exige desfazer a aprovação (o banco recusa). */
export function TaxaCartaoBloco({ taxa }: { taxa: TaxaCartao }) {
  const [enviando, iniciar] = useTransition();
  const nome = nomeDoMes(taxa.mes);

  if (taxa.pagamentos === 0 || taxa.totalPago === 0) {
    return (
      <section className="contas-taxa contas-taxa-vazia" aria-label="Taxa do cartão-frete">
        <CreditCard size={16} strokeWidth={1.7} aria-hidden="true" />
        <p className="nota">Nada foi pago pelo cartão-frete em {nome}, então não há taxa da Pan Card a lançar.</p>
      </section>
    );
  }

  const c = taxa.conta;
  const calculada = taxa.pct !== null && taxa.taxa !== null;
  const podeLancar = calculada && (!c || (!c.aprovadoEm && !c.pagoEm && !c.canceladoEm));

  function lancar() {
    iniciar(async () => {
      const r = await lancarTaxaCartao(taxa.mes);
      if (!r.ok) toast(r.erro, "circle-alert");
      else toast(c ? "Valor da taxa atualizado." : "Taxa lançada. Outra pessoa precisa aprová-la antes do pagamento.");
    });
  }

  return (
    <section className="contas-taxa" aria-label="Taxa do cartão-frete">
      <CreditCard size={16} strokeWidth={1.7} aria-hidden="true" />
      <div className="contas-taxa-texto">
        <p>
          Pago pelo cartão-frete em {nome}: <b>{formato.reais(taxa.totalPago)}</b> em {taxa.pagamentos} {plural(taxa.pagamentos, "pagamento", "pagamentos")}.{" "}
          {calculada ? (
            <>
              Taxa da Pan Card: {percentual(taxa.pct!)} ({formato.reais(taxa.valorPct ?? 0)}) + {formato.reais(taxa.porTransferencia ?? 0)} por transferência (
              {formato.reais(taxa.valorTransferencias ?? 0)}) = <b>{formato.reais(taxa.taxa!)}</b>.
            </>
          ) : (
            <>A taxa da Pan Card ainda não está cadastrada nos parâmetros fiscais: peça ao administrador.</>
          )}
        </p>
        {c && (
          <p className="nota contas-taxa-conta">
            Lançada na conta {c.numero} ({ROTULO_SITUACAO_PAGAR[c.situacao] ?? c.situacao}), valor {formato.reais(c.valor)}.{" "}
            <Sinal {...sinalAprovacao({ canceladoEm: c.canceladoEm, pagoEm: c.pagoEm, aprovadoEm: c.aprovadoEm })} />
            {podeLancar && taxa.taxa !== null && Math.round(c.valor * 100) !== Math.round(taxa.taxa * 100) && (
              <> O valor lançado está diferente da taxa calculada agora.</>
            )}
          </p>
        )}
      </div>
      {podeLancar && (
        <button className="btn" type="button" onClick={lancar} disabled={enviando} aria-busy={enviando}>
          {c ? "Atualizar o valor" : "Lançar a taxa"}
        </button>
      )}
    </section>
  );
}
