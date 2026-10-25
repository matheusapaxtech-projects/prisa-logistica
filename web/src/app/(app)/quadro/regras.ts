/* Regras puras da tela do Quadro (servidor e cliente): filtros na URL, aba do celular, minutos na
   coluna e o nível de cada cartão. As regras de negócio ficam em `@/lib/quadro` (Task 6) e no banco. */
import { chaveDoLimite, COLUNAS, nivelDoTempo, rotuloDe, type Cartao, type Filtros, type Nivel, type StatusCampo } from "@/lib/quadro";
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

/* ---------- tempo real (recargas) ---------- */

/** Mudanças em sequência viram uma recarga só: espera 300 ms de calma, mas nunca mais que 2 s depois da
   primeira mudança ainda não recarregada (com mudanças sem parar, o quadro não fica para trás). */
export const AGRUPAR_MS = 300;
export const ESPERA_MAXIMA_MS = 2_000;

/** Espera antes de tentar de novo uma recarga que falhou: 2 s, 5 s, 15 s e depois a cada 15 s. */
const ESPERAS_NOVA_TENTATIVA = [2_000, 5_000, 15_000] as const;
export function esperaDaNovaTentativa(falhasSeguidas: number): number {
  return ESPERAS_NOVA_TENTATIVA[Math.min(Math.max(falhasSeguidas, 1), ESPERAS_NOVA_TENTATIVA.length) - 1];
}

/** Folga depois da meia-noite: o relógio do aparelho pode estar um pouco adiantado em relação ao banco. */
export const FOLGA_MEIA_NOITE_MS = 5_000;
const RELOGIO_BRASILIA = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Milissegundos até a próxima meia-noite de Brasília (quando "Frete finalizado" troca de dia). */
export function msAteMeiaNoiteBrasilia(agora: number): number {
  const p = Object.fromEntries(RELOGIO_BRASILIA.formatToParts(agora).map((x) => [x.type, Number(x.value)]));
  const passados = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + (((agora % 1000) + 1000) % 1000);
  return 86_400_000 - passados;
}

/** Evento do tempo real em `arquivo`: só conta o arquivo de uma viagem (o canhoto); os de cadastro não. */
export function ehArquivoDeViagem(evento: { new?: unknown; old?: unknown }): boolean {
  const viagemDe = (linha: unknown) =>
    linha && typeof linha === "object" ? (linha as { viagem_id?: unknown }).viagem_id : undefined;
  return Boolean(viagemDe(evento.new) ?? viagemDe(evento.old));
}

/* ---------- tempos-limite (diálogo do admin) ---------- */

/** As 10 linhas de `quadro_limite`, na ordem das colunas; a Pausa tem uma linha por tipo. */
export const CHAVES_LIMITE: readonly { chave: string; rotulo: string }[] = [
  { chave: "aguardando_carregamento", rotulo: rotuloDe("aguardando_carregamento") },
  { chave: "em_carregamento", rotulo: rotuloDe("em_carregamento") },
  { chave: "aguardando_nf_pagamento", rotulo: rotuloDe("aguardando_nf_pagamento") },
  { chave: "pausa_programada", rotulo: "Pausa programada" },
  { chave: "pausa_nao_programada", rotulo: "Pausa não programada" },
  { chave: "aguardando_descarga", rotulo: rotuloDe("aguardando_descarga") },
  { chave: "descarregando", rotulo: rotuloDe("descarregando") },
  { chave: "aguardando_contagem", rotulo: rotuloDe("aguardando_contagem") },
  { chave: "resolucao_divergencia", rotulo: rotuloDe("resolucao_divergencia") },
  { chave: "aguardando_saldo", rotulo: rotuloDe("aguardando_saldo") },
];

export const MSG_VERMELHO_MAIOR = "O vermelho precisa ser maior que o âmbar.";
const MAX_MINUTOS = 100000;

export type LimiteDigitado = { chave: string; ambar: number; vermelho: number };
export type LeituraLimites = { ok: true; limites: LimiteDigitado[] } | { ok: false; erro: string; chave?: string };

function lerMinutos(v: FormDataEntryValue | null): number | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_MINUTOS ? n : null;
}

/** Lê `ambar_<chave>` e `vermelho_<chave>` do formulário (a mesma conta na tela e na ação): minutos
   inteiros de 1 a 100000 e vermelho maior que o âmbar. O banco repete as duas travas. */
export function lerLimites(form: FormData): LeituraLimites {
  const limites: LimiteDigitado[] = [];
  for (const { chave, rotulo } of CHAVES_LIMITE) {
    const ambar = lerMinutos(form.get(`ambar_${chave}`));
    const vermelho = lerMinutos(form.get(`vermelho_${chave}`));
    const invalido = (qual: string) => ({ ok: false as const, chave, erro: `Informe minutos inteiros (de 1 a ${MAX_MINUTOS}) para o ${qual} de “${rotulo}”.` });
    if (ambar === null) return invalido("âmbar");
    if (vermelho === null) return invalido("vermelho");
    if (vermelho <= ambar) return { ok: false, chave, erro: MSG_VERMELHO_MAIOR };
    limites.push({ chave, ambar, vermelho });
  }
  return { ok: true, limites };
}
