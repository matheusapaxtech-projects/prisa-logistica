import { formato } from "@/lib/formato";
import { CabPainel } from "../../_pessoa/partes";
import type { EventoDaViagem } from "../consultas";
import { descreverEvento } from "../regras";

/* Linha do tempo da viagem (viagem_evento, na ordem em que aconteceu): quando (Brasília), o que mudou,
   quem e o motivo ou os dados da passagem. Mesma marcação da `.linha-tempo` do <Historico>. */
export function LinhaDoTempo({ eventos, criadaEm }: { eventos: EventoDaViagem[]; criadaEm: string }) {
  return (
    <section className="subsecao">
      <CabPainel titulo="Linha do tempo" />
      <ol className="linha-tempo">
        <li>
          <time dateTime={criadaEm}>{formato.dataHora(criadaEm)}</time>
          <span className="ponto-acao" aria-hidden="true" />
          <span>
            <b>Viagem planejada</b>
          </span>
        </li>
        {eventos.map((e) => {
          const d = descreverEvento(e);
          return (
            <li key={e.id}>
              <time dateTime={e.em}>{formato.dataHora(e.em)}</time>
              <span className="ponto-acao insert" aria-hidden="true" />
              <span>
                <b>{d.titulo}</b>
                <span className="meta">{e.por ? `por ${e.por}` : "Sistema"}</span>
                {d.detalhes.map((t, i) => (
                  <span key={i} className="meta detalhe">
                    {t}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
