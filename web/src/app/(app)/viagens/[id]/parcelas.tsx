import Link from "next/link";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { rotuloDaParcela, sinalDaParcela, type ParcelaViagem } from "../parcelas";

/* "Pagamento ao motorista": as duas parcelas do frete no Contas a pagar (adiantamento de 70% + pedágio e saldo de 30%).
   Só aparece para a viagem que tem parcelas; a antiga (confirmação manual no Quadro) não mostra nada. Dinheiro sem cor:
   a cor fica no sinal da situação. A operação vê as parcelas (o banco deixa), mas não o resto do financeiro, por isso o
   link para o Contas a pagar é só de admin e financeiro. */

export function BlocoParcelas({ parcelas, verFinanceiro }: { parcelas: ParcelaViagem[]; verFinanceiro: boolean }) {
  if (parcelas.length === 0) return null;
  return (
    <section className="subsecao parcelas-via" aria-labelledby="h-parcelas">
      <div className="painel-cab">
        <h2 id="h-parcelas">Pagamento ao motorista</h2>
        {verFinanceiro && (
          <span className="dir">
            <Link className="btn btn-texto" href="/financeiro/pagar?filtro=aberto">
              Abrir no Contas a pagar
            </Link>
          </span>
        )}
      </div>
      <dl className="kv">
        {parcelas.map((p) => {
          const s = sinalDaParcela(p);
          return <ParcelaLinha key={p.origem} p={p} tipo={s.tipo} texto={s.texto} />;
        })}
      </dl>
    </section>
  );
}

function ParcelaLinha({ p, tipo, texto }: { p: ParcelaViagem; tipo: TipoSinal; texto: string }) {
  return (
    <>
      <dt>{rotuloDaParcela(p.origem)}</dt>
      <dd>
        {formato.reais(p.valor)}
        {p.partePedagio > 0 && <span className="linha2">inclui {formato.reais(p.partePedagio)} de pedágio</span>}
        <span className="linha2">vence {formato.data(p.vencimento)}</span>
        <Sinal tipo={tipo} texto={texto} />
        {p.antecipacaoLiberada && <span className="linha2">Antecipação liberada</span>}
      </dd>
    </>
  );
}
