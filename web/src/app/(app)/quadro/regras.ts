/* Regras puras da tela do Quadro (servidor e cliente): filtros na URL, aba do celular, minutos na
   coluna e o nível de cada cartão. As regras de negócio ficam em `@/lib/quadro` (Task 6) e no banco. */
import { chaveDoLimite, COLUNAS, nivelDoTempo, type Cartao, type Filtros, type Nivel, type StatusCampo } from "@/lib/quadro";
import type { Limite } from "./consultas";

/** Filtros do Quadro como ficam na URL: `?cliente=&motorista=&unidade=&problema=1&minhas=1`. */
export type EstadoFiltros = {
  cliente?: string;
  motorista?: string;
  unidade?: number;
  problema: boolean;
  minhas: boolean;
};

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function lerFiltros(sp: Busca): EstadoFiltros {
  const cliente = um(sp.cliente).trim();
  const motorista = um(sp.motorista).trim();
  const unidade = Number(um(sp.unidade));
  return {
    ...(cliente ? { cliente } : {}),
    ...(motorista ? { motorista } : {}),
    ...(Number.isInteger(unidade) && unidade > 0 ? { unidade } : {}),
    problema: um(sp.problema) === "1",
    minhas: um(sp.minhas) === "1",
  };
}

const STATUS: readonly string[] = COLUNAS.map((c) => c.status);

/** Coluna mostrada no celular (`?aba=`); inválida ou ausente = nenhuma escolhida. */
export function lerAba(sp: Busca): StatusCampo | null {
  const a = um(sp.aba);
  return STATUS.includes(a) ? (a as StatusCampo) : null;
}

/** A busca da URL (`?…`) com os filtros e a aba; vazia quando não há nada. */
export function buscaDe(f: EstadoFiltros, aba: StatusCampo | null): string {
  const p = new URLSearchParams();
  if (f.cliente) p.set("cliente", f.cliente);
  if (f.motorista) p.set("motorista", f.motorista);
  if (f.unidade) p.set("unidade", String(f.unidade));
  if (f.problema) p.set("problema", "1");
  if (f.minhas) p.set("minhas", "1");
  if (aba) p.set("aba", aba);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Filtros da tela → filtros de `filtrarCartoes` ("só as minhas" = iniciadas pelo usuário). */
export function paraFiltros(f: EstadoFiltros, userId: string): Filtros {
  return {
    cliente: f.cliente,
    motorista: f.motorista,
    unidade: f.unidade,
    soProblema: f.problema,
    minhasDe: f.minhas ? userId : undefined,
  };
}

export const algumFiltro = (f: EstadoFiltros) => Boolean(f.cliente || f.motorista || f.unidade || f.problema || f.minhas);

/** Minutos inteiros desde `desde` (sem data = 0). */
export function minutosDesde(desde: string | null, agora: number): number {
  if (!desde) return 0;
  return Math.max(0, Math.floor((agora - Date.parse(desde)) / 60000));
}

/** Nível do cartão pelo tempo na coluna, com o limite da coluna (ou do tipo de pausa). */
export function nivelDoCartao(c: Cartao, limites: Map<string, Limite>, agora: number): Nivel {
  if (!c.status_campo) return "normal";
  const chave = chaveDoLimite({ status_campo: c.status_campo, pausa_programada: c.pausa_programada });
  return nivelDoTempo(minutosDesde(c.status_desde, agora), limites.get(chave));
}

/** Nomes distintos (para os selects de cliente e motorista), em ordem alfabética pt-BR. */
export function opcoesDe(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Recusa do banco por tela atrasada (mover_viagem: "…; o quadro foi atualizado"): a tela recarrega. */
export { foiAtualizado } from "../viagens/regras";
