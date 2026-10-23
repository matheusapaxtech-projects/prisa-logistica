import { Sinal } from "@/components/Sinal";
import { CabPainel } from "../../_pessoa/partes";
import type { ItemAptidao, NivelAptidao } from "../regras";

const NIVEL: Record<NivelAptidao, { tipo: "bloqueado" | "vencendo"; texto: string }> = {
  trava_legal: { tipo: "bloqueado", texto: "Trava legal" },
  trava: { tipo: "bloqueado", texto: "Trava" },
  aviso: { tipo: "vencendo", texto: "Aviso" },
};

type Props = {
  itens: ItemAptidao[];
  titulo: string;
  /** Frase sob o título (ex.: o que cada nível significa). */
  explica?: string;
  /** Texto quando não há nada (padrão: "Apta: nenhuma trava nem aviso."). */
  vazio?: string;
};

/* Bloco de aptidão da ficha da viagem: travas e avisos com as mensagens do banco (aptidao_da_viagem
   para a planejada; liberacao_aptidao para a que já começou), na ordem do banco (trava legal, trava,
   aviso). */
export function BlocoAptidao({ itens, titulo, explica, vazio = "Apta: nenhuma trava nem aviso." }: Props) {
  return (
    <section className="subsecao aptidao">
      <CabPainel titulo={titulo} />
      {explica && <p className="explica">{explica}</p>}
      {itens.length === 0 ? (
        <p className="apta">
          <Sinal tipo="normal" texto="Apta" />
          <span>{vazio}</span>
        </p>
      ) : (
        <ul className="lista-aptidao">
          {itens.map((a, i) => (
            <li key={`${a.codigo}-${i}`}>
              <Sinal tipo={NIVEL[a.nivel].tipo} texto={NIVEL[a.nivel].texto} />
              <span>{a.mensagem}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
