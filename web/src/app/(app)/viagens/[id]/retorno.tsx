import Link from "next/link";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { CabPainel, Dash } from "../../_pessoa/partes";
import type { Retorno } from "../retorno";

/* Previsão de chegada e frete de retorno (motor de despacho, rotinas 6 e 9). Sem o app do motorista, a
   previsão sai da hora em que a viagem entrou em "Em rota", do km e da regra de descanso; o retorno sugere
   os pedidos abertos perto do destino, de preferência voltando para perto de onde ele saiu. */

export function BlocoRetorno({ r }: { r: Retorno }) {
  const atraso = r.atrasoH;
  return (
    <section className="subsecao retorno-viagem">
      <CabPainel titulo="Chegada e frete de retorno" />
      <dl className="kv">
        <dt>Previsão de chegada</dt>
        <dd>
          {r.previsao ? (
            <>
              {formato.dataHora(r.previsao)}
              <span className="linha2">
                {r.km.toLocaleString("pt-BR")} km a 60 km/h, com as paradas da Lei do Motorista; sem rastreamento, é uma estimativa
              </span>
              {atraso !== null &&
                (atraso > 0.5 ? (
                  <span className="linha2">
                    <Sinal tipo="bloqueado" texto={`${atraso.toLocaleString("pt-BR")} h depois da entrega prevista`} />
                  </span>
                ) : (
                  <span className="linha2">
                    <Sinal tipo="normal" texto="Dentro da entrega prevista" />
                  </span>
                ))}
            </>
          ) : (
            <Dash>informe o km da viagem</Dash>
          )}
        </dd>
        <dt>Cargas de retorno</dt>
        <dd>
          {r.sugestoes.length === 0 ? (
            <Dash>nenhum pedido aberto a até 150 km do destino no período</Dash>
          ) : (
            <ol className="retorno-lista">
              {r.sugestoes.map((s) => (
                <li key={s.carga.id}>
                  <Link href={`/pedidos/${s.carga.id}`}>Pedido #{s.numero}</Link>: {s.origem} → {s.destino}
                  <span className="linha2">
                    nota {s.score.toLocaleString("pt-BR")} · {s.motivos.join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </dd>
      </dl>
    </section>
  );
}
