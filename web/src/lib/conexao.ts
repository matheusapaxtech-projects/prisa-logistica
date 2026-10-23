/* Estado da conexão em tempo real do Quadro. O Quadro nunca finge estar em dia: se a conexão cai, mostra
   "Desatualizado desde hh:mm" (Brasília) e, ao reconectar, recarrega sozinho antes de voltar a "Ao vivo".
   Quem garante isso é `proximoEstado`, não quem chama:
   - `inscrito` (canal conectado) só marca `inscrito: true`; o tipo do estado não muda;
   - `recarregou` só leva a "ao_vivo" se o canal está inscrito (ou se já está ao vivo, quando só renova o
     horário). Um recarregamento avulso (foco da janela, botão) com o canal fora do ar não muda nada;
   - `erro`/`fechado` derrubam o canal (`inscrito` volta a falso). */

export type EstadoConexao =
  | { tipo: "conectando"; inscrito?: boolean }
  | { tipo: "ao_vivo"; atualizadoEm: Date }
  | { tipo: "desatualizado"; desde: Date; inscrito?: boolean };

export type EventoConexao = { tipo: "inscrito" | "erro" | "fechado" | "recarregou"; em: Date };

export function proximoEstado(atual: EstadoConexao, evento: EventoConexao): EstadoConexao {
  switch (evento.tipo) {
    case "inscrito":
      if (atual.tipo === "ao_vivo") return atual;
      return { ...atual, inscrito: true };
    case "recarregou":
      if (atual.tipo === "ao_vivo" || atual.inscrito) return { tipo: "ao_vivo", atualizadoEm: evento.em };
      return atual;
    case "erro":
    case "fechado":
      if (atual.tipo === "ao_vivo") return { tipo: "desatualizado", desde: atual.atualizadoEm, inscrito: false };
      if (atual.tipo === "conectando") return { tipo: "desatualizado", desde: evento.em, inscrito: false };
      return { tipo: "desatualizado", desde: atual.desde, inscrito: false };
  }
}

const HORA_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function textoConexao(e: EstadoConexao): string {
  switch (e.tipo) {
    case "ao_vivo":
      return "Ao vivo";
    case "conectando":
      return "Conectando…";
    case "desatualizado":
      return `Desatualizado desde ${HORA_BRASILIA.format(e.desde)}`;
  }
}
