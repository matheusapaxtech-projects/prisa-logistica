/* Estado da conexão em tempo real do Quadro. O Quadro nunca finge estar em dia: se a conexão cai, mostra
   "Desatualizado desde hh:mm" (Brasília) e, ao reconectar, recarrega sozinho antes de voltar a "Ao vivo".
   Quem usa: `inscrito` = canal conectado; depois de `inscrito` (ou de reconectar) recarrega os cartões e só
   então dispara `recarregou`. `inscrito` sozinho nunca vira "ao vivo". */

export type EstadoConexao =
  | { tipo: "conectando" }
  | { tipo: "ao_vivo"; atualizadoEm: Date }
  | { tipo: "desatualizado"; desde: Date };

export type EventoConexao = { tipo: "inscrito" | "erro" | "fechado" | "recarregou"; em: Date };

export function proximoEstado(atual: EstadoConexao, evento: EventoConexao): EstadoConexao {
  switch (evento.tipo) {
    case "recarregou":
      return { tipo: "ao_vivo", atualizadoEm: evento.em };
    case "erro":
    case "fechado":
      if (atual.tipo === "ao_vivo") return { tipo: "desatualizado", desde: atual.atualizadoEm };
      if (atual.tipo === "conectando") return { tipo: "desatualizado", desde: evento.em };
      return atual;
    case "inscrito":
      return atual;
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
