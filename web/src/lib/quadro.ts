/* Regras puras do Quadro da operação (sem servidor, sem React). Espelham o banco:
   - passagens e dados exigidos: `public.mover_viagem` (supabase/migrations/20261025000400_mover_viagem.sql);
   - chave do CT-e/MDF-e: `public.chave_dfe_valida` (mesmo arquivo);
   - chaves dos tempos-limite: `public.quadro_limite` (…000500_quadro.sql).
   O banco é a autoridade: aqui só decidimos o que mostrar e que formulário abrir. */
import type { Database } from "./banco";

export type StatusCampo = Database["public"]["Enums"]["status_campo"];

/** As 12 colunas, na ordem e com os nomes do usuário. `espera` = coluna de espera (pode estreitar). Descarregando e
   Aguardando saldo vêm do motor de despacho (migration 20261029000300). */
export const COLUNAS: readonly { status: StatusCampo; rotulo: string; espera: boolean }[] = [
  { status: "transito", rotulo: "Trânsito", espera: false },
  { status: "aguardando_carregamento", rotulo: "Aguardando carregamento", espera: true },
  { status: "em_carregamento", rotulo: "Em carregamento", espera: false },
  { status: "aguardando_nf_pagamento", rotulo: "Aguardando NF e pagamento", espera: true },
  { status: "em_rota", rotulo: "Em rota", espera: false },
  { status: "pausa", rotulo: "Pausa", espera: false },
  { status: "aguardando_descarga", rotulo: "Aguardando descarga", espera: true },
  { status: "descarregando", rotulo: "Descarregando", espera: false },
  { status: "aguardando_contagem", rotulo: "Aguardando contagem de divergência", espera: true },
  { status: "resolucao_divergencia", rotulo: "Resolução de divergência na carga", espera: false },
  { status: "aguardando_saldo", rotulo: "Aguardando saldo (30%)", espera: true },
  { status: "frete_finalizado", rotulo: "Frete finalizado", espera: false },
];

/** Rótulo da coluna; sem coluna (viagem ainda não iniciada) é "Planejada". */
export function rotuloDe(s: StatusCampo | null): string {
  if (s === null) return "Planejada";
  return COLUNAS.find((c) => c.status === s)?.rotulo ?? s;
}

/** Para onde a viagem pode ir, sem as voltas. Pausa só volta para a coluna de onde saiu (`origemDaPausa`). */
export function destinosPermitidos(de: StatusCampo, origemDaPausa?: StatusCampo): StatusCampo[] {
  switch (de) {
    case "transito":
      return ["aguardando_carregamento", "pausa"];
    case "aguardando_carregamento":
      return ["em_carregamento"];
    case "em_carregamento":
      return ["aguardando_nf_pagamento"];
    case "aguardando_nf_pagamento":
      return ["em_rota"];
    case "em_rota":
      return ["pausa", "aguardando_descarga"];
    case "pausa":
      return origemDaPausa ? [origemDaPausa] : [];
    case "aguardando_descarga":
      return ["descarregando"];
    case "descarregando":
      return ["aguardando_contagem"];
    case "aguardando_contagem":
      return ["resolucao_divergencia", "aguardando_saldo"];
    case "resolucao_divergencia":
      return ["aguardando_saldo"];
    case "aguardando_saldo":
      return ["frete_finalizado"];
    case "frete_finalizado":
      return [];
  }
}

const VOLTAS: Partial<Record<StatusCampo, StatusCampo>> = {
  aguardando_carregamento: "transito",
  em_carregamento: "aguardando_carregamento",
  aguardando_nf_pagamento: "em_carregamento",
  descarregando: "aguardando_descarga",
};

/** Coluna para onde "voltar" leva; só as voltas que o banco permite (sempre com motivo). */
export function colunaAnterior(de: StatusCampo): StatusCampo | null {
  return VOLTAS[de] ?? null;
}

export type Formulario =
  | "checklist"
  | "peso_saida"
  | "documentos"
  | "pausa"
  | "chegada"
  | "contagem"
  | "resolucao"
  | "encerramento"
  | "motivo"
  | null;

/** Formulário que a passagem pede antes de chamar `mover_viagem` (null = passa direto). */
export function formularioDaPassagem(de: StatusCampo, para: StatusCampo): Formulario {
  if (VOLTAS[de] === para) return "motivo";
  if ((de === "transito" || de === "em_rota") && para === "pausa") return "pausa";
  if (de === "aguardando_carregamento" && para === "em_carregamento") return "checklist";
  if (de === "em_carregamento" && para === "aguardando_nf_pagamento") return "peso_saida";
  if (de === "aguardando_nf_pagamento" && para === "em_rota") return "documentos";
  if (de === "descarregando" && para === "aguardando_contagem") return "chegada";
  if (de === "aguardando_contagem" && (para === "aguardando_saldo" || para === "resolucao_divergencia")) {
    return "contagem";
  }
  if (de === "resolucao_divergencia" && para === "aguardando_saldo") return "resolucao";
  if (de === "aguardando_saldo" && para === "frete_finalizado") return "encerramento";
  return null;
}

export type Nivel = "normal" | "ambar" | "vermelho";

/** Cor do cartão pelo tempo na coluna. Sem limite (ou limite sem minutos) nunca muda de cor. */
export function nivelDoTempo(
  minutos: number,
  limite: { minutos_ambar: number | null; minutos_vermelho: number | null } | undefined,
): Nivel {
  if (!limite) return "normal";
  if (limite.minutos_vermelho !== null && minutos >= limite.minutos_vermelho) return "vermelho";
  if (limite.minutos_ambar !== null && minutos >= limite.minutos_ambar) return "ambar";
  return "normal";
}

/** Chave da linha de `quadro_limite` do cartão: pausa depende de ser programada; o resto é o próprio status. */
export function chaveDoLimite(c: { status_campo: StatusCampo; pausa_programada: boolean | null }): string {
  if (c.status_campo === "pausa") return c.pausa_programada ? "pausa_programada" : "pausa_nao_programada";
  return c.status_campo;
}

/** Só os dígitos (espaços e pontos copiados do DACTE não contam). */
export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Mesma regra de `chave_dfe_valida`: 44 dígitos, modelo nas posições 21-22 e dígito verificador módulo 11. */
export function chaveDfeValida(chave: string, modelo: "55" | "57" | "58"): boolean {
  const d = somenteDigitos(chave);
  if (d.length !== 44 || d.slice(20, 22) !== modelo) return false;
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(d[i]) * (2 + ((42 - i) % 8));
  let dv = 11 - (soma % 11);
  if (dv >= 10) dv = 0;
  return Number(d[43]) === dv;
}

export type Cartao = Database["public"]["Views"]["v_quadro"]["Row"];

export type Filtros = {
  cliente?: string;
  motorista?: string;
  unidade?: number;
  soProblema?: boolean;
  minhasDe?: string;
};

function temProblema(c: Cartao, nivelDe: (c: Cartao) => Nivel): boolean {
  return (
    nivelDe(c) !== "normal" ||
    c.pausa_programada === false ||
    (c.divergencia !== null && c.divergencia !== "sem_divergencia") ||
    (c.ocorrencias_abertas ?? 0) > 0
  );
}

/** Filtros do Quadro (todos combinam com "e"). `soProblema`: nível ≠ normal, pausa não programada, divergência ou ocorrência aberta. */
export function filtrarCartoes(cartoes: Cartao[], f: Filtros, nivelDe: (c: Cartao) => Nivel): Cartao[] {
  return cartoes.filter(
    (c) =>
      (f.cliente === undefined || c.cliente_nome === f.cliente) &&
      (f.motorista === undefined || c.motorista_nome === f.motorista) &&
      (f.unidade === undefined || c.unidade_operacional_id === f.unidade) &&
      (f.minhasDe === undefined || c.iniciada_por === f.minhasDe) &&
      (!f.soProblema || temProblema(c, nivelDe)),
  );
}

/** Cartões por coluna, o que está há mais tempo na coluna primeiro. Viagem sem coluna (planejada) fica de fora. */
export function agruparPorColuna(cartoes: Cartao[]): Record<StatusCampo, Cartao[]> {
  const grupos = Object.fromEntries(COLUNAS.map((c) => [c.status, [] as Cartao[]])) as Record<StatusCampo, Cartao[]>;
  for (const c of cartoes) {
    if (c.status_campo) grupos[c.status_campo].push(c);
  }
  const instante = (c: Cartao) => (c.status_desde ? Date.parse(c.status_desde) : 0);
  for (const lista of Object.values(grupos)) lista.sort((a, b) => instante(a) - instante(b));
  return grupos;
}
