/* Sinal de situação (`N.desenhar.sinal` / `sinalTipo` do protótipo): forma + cor, nunca só cor. */

/** Classes de sinal de nilt.css (significado fixo das cores em prototipo/CONVENCOES.md). */
export type TipoSinal = "normal" | "pendente" | "vencendo" | "bloqueado" | "info" | "neutro";

/** Situação (valor do banco) → [classe, rótulo]. Cópia de `SIT` em nilt.js. */
export const SITUACOES: Record<string, readonly [TipoSinal, string]> = {
  normal: ["normal", "Normal"],
  pendente: ["pendente", "Pendente"],
  cancelado: ["bloqueado", "Cancelado"],
  vencido: ["bloqueado", "Vencido"],
  vencendo: ["vencendo", "Vencendo"],
  habilitado: ["normal", "Habilitado"],
  sem_consulta: ["neutro", "Sem consulta"],
  arrendado: ["info", "Arrendado"],
  ativo: ["normal", "Ativo"],
  parado: ["neutro", "Parado"],
  ag_motorista: ["pendente", "Aguardando motorista"],
  sinistro: ["bloqueado", "Sinistro"],
  apreendido: ["bloqueado", "Apreendido"],
  vendido: ["neutro", "Vendido"],
  a_venda: ["neutro", "À venda"],
  devolvido: ["neutro", "Devolvido"],
};

type Props =
  /** `<Sinal situacao="pendente" />` → classe e rótulo de `SITUACOES`; `texto` troca o rótulo. */
  | { situacao: string; texto?: string; tipo?: never }
  /** `<Sinal tipo="vencendo" texto="CNH vence em 3 dias" />` → `sinalTipo` (classe direta). */
  | { tipo: TipoSinal; texto: string; situacao?: never };

export function Sinal(props: Props) {
  const [classe, rotulo] =
    props.tipo !== undefined ? [props.tipo, props.texto] : (SITUACOES[props.situacao] ?? ["neutro", props.situacao]);
  return <span className={`sinal sinal-${classe}`}>{props.texto || rotulo}</span>;
}
