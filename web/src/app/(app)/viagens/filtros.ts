/* Regras puras da lista de Viagens (servidor e cliente): filtros e página na URL, filtragem,
   ordenação e paginação. Tudo pela busca da URL, para o endereço guardar a tela como ela está
   (dá para mandar o link a alguém):
   `?aba=&q=&cliente=&motorista=&origem=&destino=&situacao=&periodo=&de=&ate=&ordem=&pagina=&por=`. */
import { hojeISO } from "@/lib/datas";
import { COLUNAS } from "@/lib/quadro";
import type { LinhaViagem } from "./consultas";
import { ABAS, abaDaViagem, type AbaViagens } from "./regras";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const PERIODOS = [
  { id: "tudo", rotulo: "Qualquer data" },
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "Últimos 7 dias" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "90d", rotulo: "Últimos 90 dias" },
  { id: "ano", rotulo: "Este ano" },
  { id: "datas", rotulo: "Escolher datas" },
] as const;
export type Periodo = (typeof PERIODOS)[number]["id"];

export type Ordem = "recentes" | "antigas";
export const POR_PAGINA = [25, 50, 100] as const;
const POR_PADRAO = 25;

export type FiltrosViagens = {
  aba: AbaViagens;
  q: string;
  cliente: string;
  motorista: string;
  origem: string;
  destino: string;
  /** Aptidão (planejadas) ou coluna do Quadro (no quadro); vazio nas outras abas. */
  situacao: string;
  periodo: Periodo;
  /** Só com `periodo = "datas"`: "yyyy-mm-dd" (qualquer um pode ficar vazio). */
  de: string;
  ate: string;
  ordem: Ordem;
  pagina: number;
  porPagina: number;
};

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** "No quadro" mostra primeiro quem está há mais tempo na coluna (como o Quadro); as outras, a mais nova. */
export const ordemPadrao = (aba: AbaViagens): Ordem => (aba === "no_quadro" ? "antigas" : "recentes");

/** Aptidão das planejadas, na ordem do filtro. */
export const SITUACOES_PLANEJADAS = [
  { valor: "aptas", rotulo: "Aptas" },
  { valor: "com_aviso", rotulo: "Aptas com aviso" },
  { valor: "com_trava", rotulo: "Com trava" },
] as const;

/** Opções de "Situação" da aba (vazia = a aba não tem esse filtro). */
export function situacoesDaAba(aba: AbaViagens): { valor: string; rotulo: string }[] {
  if (aba === "planejadas") return [...SITUACOES_PLANEJADAS];
  if (aba === "no_quadro") return COLUNAS.filter((c) => c.status !== "frete_finalizado").map((c) => ({ valor: c.status, rotulo: c.rotulo }));
  return [];
}

export function lerFiltros(sp: Busca): FiltrosViagens {
  const pedida = um(sp.aba) as AbaViagens;
  const aba: AbaViagens = ABAS.includes(pedida) ? pedida : "planejadas";
  // `?trava=1` é o link antigo de "Ver só as com trava" (o Início ainda pode apontar para ele).
  const situacaoPedida = um(sp.situacao) || (aba === "planejadas" && um(sp.trava) === "1" ? "com_trava" : "");
  const situacao = situacoesDaAba(aba).some((s) => s.valor === situacaoPedida) ? situacaoPedida : "";
  const periodoPedido = um(sp.periodo) as Periodo;
  const periodo: Periodo = PERIODOS.some((p) => p.id === periodoPedido) ? periodoPedido : "tudo";
  const dia = (v: string) => (RE_DIA.test(v) ? v : "");
  const ordemPedida = um(sp.ordem);
  const pagina = Number(um(sp.pagina));
  const por = Number(um(sp.por));
  return {
    aba,
    q: um(sp.q).trim(),
    cliente: um(sp.cliente).trim(),
    motorista: um(sp.motorista).trim(),
    origem: um(sp.origem).trim(),
    destino: um(sp.destino).trim(),
    situacao,
    periodo,
    de: periodo === "datas" ? dia(um(sp.de)) : "",
    ate: periodo === "datas" ? dia(um(sp.ate)) : "",
    ordem: ordemPedida === "recentes" || ordemPedida === "antigas" ? ordemPedida : ordemPadrao(aba),
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : 1,
    porPagina: (POR_PAGINA as readonly number[]).includes(por) ? por : POR_PADRAO,
  };
}

/** Quantos filtros estão ligados (a busca por texto não conta: ela tem o próprio campo). */
export function filtrosLigados(f: FiltrosViagens): number {
  return [f.cliente, f.motorista, f.origem, f.destino, f.situacao, f.periodo === "tudo" ? "" : f.periodo].filter(Boolean).length;
}

/** A busca da URL (`?…`) com o que muda; mudar qualquer filtro volta para a página 1. Só entra na URL
   o que foge do padrão. */
export function hrefDe(f: FiltrosViagens, mudar: Partial<FiltrosViagens> = {}): string {
  const n = { ...f, ...("pagina" in mudar ? {} : { pagina: 1 }), ...mudar };
  if (n.periodo !== "datas") {
    n.de = "";
    n.ate = "";
  }
  const p = new URLSearchParams();
  p.set("aba", n.aba);
  if (n.q) p.set("q", n.q);
  if (n.cliente) p.set("cliente", n.cliente);
  if (n.motorista) p.set("motorista", n.motorista);
  if (n.origem) p.set("origem", n.origem);
  if (n.destino) p.set("destino", n.destino);
  if (n.situacao) p.set("situacao", n.situacao);
  if (n.periodo !== "tudo") p.set("periodo", n.periodo);
  if (n.de) p.set("de", n.de);
  if (n.ate) p.set("ate", n.ate);
  if (n.ordem !== ordemPadrao(n.aba)) p.set("ordem", n.ordem);
  if (n.pagina > 1) p.set("pagina", String(n.pagina));
  if (n.porPagina !== POR_PADRAO) p.set("por", String(n.porPagina));
  return `?${p.toString()}`;
}

/** Endereço de outra aba: leva a busca, cliente, motorista, cidades e período; a situação e a ordem
   são de cada aba e ficam para trás. */
export function hrefDaAba(f: FiltrosViagens, aba: AbaViagens): string {
  return hrefDe(f, { aba, situacao: "", ordem: ordemPadrao(aba), pagina: 1 });
}

/** Endereço sem nenhum filtro (fica a aba e quantas por página). */
export function hrefSemFiltros(f: FiltrosViagens): string {
  return hrefDe(f, { q: "", cliente: "", motorista: "", origem: "", destino: "", situacao: "", periodo: "tudo", ordem: ordemPadrao(f.aba) });
}

/* ---------- filtragem ---------- */

/** A data que a aba mostra (e que o período filtra): criada, na coluna desde, finalizada ou cancelada. */
export function dataDaAba(v: LinhaViagem, aba: AbaViagens): string | null {
  if (aba === "planejadas") return v.criadaEm;
  if (aba === "no_quadro") return v.statusDesde;
  if (aba === "finalizadas") return v.finalizadaEm;
  return v.cancelada_em;
}

const somaDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Primeiro e último dia (Brasília, "yyyy-mm-dd") do período; vazio = sem limite daquele lado. */
export function intervaloDe(f: Pick<FiltrosViagens, "periodo" | "de" | "ate">, agora: Date = new Date()): { de: string; ate: string } {
  const hoje = hojeISO(agora);
  switch (f.periodo) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: somaDias(hoje, -6), ate: hoje };
    case "30d":
      return { de: somaDias(hoje, -29), ate: hoje };
    case "90d":
      return { de: somaDias(hoje, -89), ate: hoje };
    case "ano":
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
    case "datas":
      // Datas trocadas (de depois de até) valem como o intervalo entre elas.
      return f.de && f.ate && f.de > f.ate ? { de: f.ate, ate: f.de } : { de: f.de, ate: f.ate };
    default:
      return { de: "", ate: "" };
  }
}

/** Busca por número da viagem ou do pedido, cliente, motorista, placa ou cidade. */
export function passaNaBusca(v: LinhaViagem, termo: string): boolean {
  if (!termo) return true;
  const t = termo.toLowerCase().replace(/^#/, "");
  const placa = t.replace(/[^a-z0-9]/g, "");
  return (
    String(v.numero) === t ||
    String(v.pedido?.numero ?? "") === t ||
    (v.pedido?.cliente ?? "").toLowerCase().includes(t) ||
    (v.motorista ?? "").toLowerCase().includes(t) ||
    (placa.length >= 3 && (v.placa ?? "").toLowerCase().includes(placa)) ||
    (v.pedido?.origem ?? "").toLowerCase().includes(t) ||
    (v.pedido?.destino ?? "").toLowerCase().includes(t)
  );
}

function passaNaSituacao(v: LinhaViagem, situacao: string): boolean {
  if (!situacao) return true;
  const travas = v.travas ?? 0;
  const avisos = v.avisos ?? 0;
  if (situacao === "aptas") return travas === 0 && avisos === 0;
  if (situacao === "com_aviso") return travas === 0 && avisos > 0;
  if (situacao === "com_trava") return travas > 0;
  return v.status_campo === situacao;
}

/** As viagens da aba que passam em todos os filtros, já na ordem pedida. */
export function filtrarViagens(linhas: LinhaViagem[], f: FiltrosViagens, agora: Date = new Date()): LinhaViagem[] {
  const { de, ate } = intervaloDe(f, agora);
  const lista = linhas.filter((v) => {
    if (abaDaViagem(v) !== f.aba) return false;
    if (!passaNaBusca(v, f.q)) return false;
    if (f.cliente && v.pedido?.cliente !== f.cliente) return false;
    if (f.motorista && v.motorista !== f.motorista) return false;
    if (f.origem && v.pedido?.origem !== f.origem) return false;
    if (f.destino && v.pedido?.destino !== f.destino) return false;
    if (!passaNaSituacao(v, f.situacao)) return false;
    if (de || ate) {
      const data = dataDaAba(v, f.aba);
      if (!data) return false;
      const dia = hojeISO(new Date(data));
      if ((de && dia < de) || (ate && dia > ate)) return false;
    }
    return true;
  });
  // Sem data (caso raro de dado antigo) vai para o fim; empate, pelo número.
  const chave = (v: LinhaViagem) => dataDaAba(v, f.aba) ?? "";
  const sinal = f.ordem === "recentes" ? -1 : 1;
  return lista.sort((a, b) => {
    const ca = chave(a);
    const cb = chave(b);
    if (ca !== cb) {
      if (!ca) return 1;
      if (!cb) return -1;
      return ca < cb ? -sinal : sinal;
    }
    return (a.numero - b.numero) * sinal;
  });
}

/** Opções dos filtros da aba (em ordem alfabética), mais o valor filtrado se ele não estiver mais na
   lista (senão o seletor mostraria outro valor). */
export function opcoesDaAba(linhas: LinhaViagem[], f: FiltrosViagens) {
  const daAba = linhas.filter((v) => abaDaViagem(v) === f.aba);
  const lista = (valores: (string | null | undefined)[], atual: string) => {
    const unicos = new Set(valores.filter((x): x is string => Boolean(x) && x !== "—"));
    if (atual) unicos.add(atual);
    return [...unicos].sort((a, b) => a.localeCompare(b, "pt-BR"));
  };
  return {
    clientes: lista(daAba.map((v) => v.pedido?.cliente), f.cliente),
    motoristas: lista(daAba.map((v) => v.motorista), f.motorista),
    origens: lista(daAba.map((v) => v.pedido?.origem), f.origem),
    destinos: lista(daAba.map((v) => v.pedido?.destino), f.destino),
    situacoes: situacoesDaAba(f.aba),
  };
}

export type OpcoesFiltros = ReturnType<typeof opcoesDaAba>;

/* ---------- paginação ---------- */

export type Pagina<T> = { itens: T[]; pagina: number; paginas: number; inicio: number; fim: number; total: number };

/** Recorte da página pedida; página além da última vira a última. `inicio`/`fim` contam de 1 (0 se vazio). */
export function paginar<T>(lista: T[], pagina: number, porPagina: number): Pagina<T> {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  const de = (atual - 1) * porPagina;
  const itens = lista.slice(de, de + porPagina);
  return { itens, pagina: atual, paginas, inicio: total ? de + 1 : 0, fim: de + itens.length, total };
}

/** Números a mostrar no seletor de páginas: todas até 7; acima disso, a primeira, a última e as
   vizinhas da atual, com "…" no buraco. */
export function numerosDePagina(atual: number, paginas: number): (number | "…")[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const meio = new Set([1, paginas, atual - 1, atual, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => meio.add(n));
  if (atual >= paginas - 2) [paginas - 3, paginas - 2, paginas - 1].forEach((n) => meio.add(n));
  const ordem = [...meio].filter((n) => n >= 1 && n <= paginas).sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  ordem.forEach((n, i) => {
    if (i > 0 && n - ordem[i - 1] > 1) saida.push("…");
    saida.push(n);
  });
  return saida;
}
