/* Regras puras das telas de Viagens (servidor e cliente): próximo passo, aptidão e liberação com
   exceção, descrição dos eventos da linha do tempo, abas da lista e o esquema da ocorrência. Fora de
   actions.ts porque um arquivo "use server" só exporta funções assíncronas. O banco é a autoridade
   (iniciar_viagem, cancelar_viagem, confirmar_pagamento_saida, mover_viagem): aqui só decidimos o
   que mostrar e que botão oferecer. */
import { z } from "zod";
import type { Database } from "@/lib/banco";
import type { TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import type { Papel } from "@/lib/papeis";
import { rotuloDe, type StatusCampo } from "@/lib/quadro";
import { RE_ID } from "../_pessoa/formulario";

type Enums = Database["public"]["Enums"];
export type TipoOcorrencia = Enums["tipo_ocorrencia"];
export type TipoPausa = Enums["tipo_pausa"];

export const NAO_ACHADA = "Viagem não encontrada. Atualize a página.";
export const AVISO_FINANCEIRO = "Avise o financeiro: pode virar desconto ou prejuízo.";
export const MSG_SO_ADMIN_EXCECAO = "Só o administrador pode liberar com exceção.";

/* ---------- próximo passo ---------- */

/** O que a viagem espera agora (destaque da ficha); `null` = nada a fazer fora do Quadro. Não vale
   para viagem cancelada (status nulo também): a ficha não chama nesse caso. */
export function proximoPasso(v: {
  status_campo: StatusCampo | null;
  pagamento_saida: boolean;
  tem_canhoto: boolean;
  saldo_pago?: boolean;
  /** Parcela no Contas a pagar (viagem contratada depois da migration 20261101000300): quem paga é o financeiro. */
  adiantamento_no_financeiro?: boolean;
  saldo_no_financeiro?: boolean;
}): string | null {
  if (v.status_campo === null) return "Iniciar trânsito";
  if (v.status_campo === "aguardando_carregamento") return "Conferir o checklist do veículo";
  if (v.status_campo === "aguardando_nf_pagamento") {
    if (v.pagamento_saida) return "Informar CT-e, MDF-e, NF-e, CIOT e averbação";
    return v.adiantamento_no_financeiro ? "Esperar o financeiro pagar o adiantamento" : "Confirmar pagamento de saída";
  }
  if ((v.status_campo === "aguardando_descarga" || v.status_campo === "descarregando") && !v.tem_canhoto) return "Enviar canhoto";
  if (v.status_campo === "aguardando_saldo") {
    if (v.saldo_pago) return "Encerrar MDF-e e CIOT e finalizar";
    return v.saldo_no_financeiro ? "Esperar o financeiro pagar o saldo" : "Confirmar o pagamento do saldo";
  }
  return null;
}

/** Ruling R13 (mesma regra de `canhoto_enviado` no banco): só conta canhoto cujo arquivo chegou ao
   Storage; a linha com "envio falhou" não conta. */
export function temCanhotoEnviado(canhotos: { envioFalhou: boolean }[]): boolean {
  return canhotos.some((c) => !c.envioFalhou);
}

/* ---------- aptidão ---------- */

export type NivelAptidao = "trava_legal" | "trava" | "aviso";
export type ItemAptidao = { codigo: string; nivel: NivelAptidao; mensagem: string };

const NIVEIS: readonly string[] = ["trava_legal", "trava", "aviso"];

/** jsonb de `aptidao_da_viagem` / `v_viagem_planejada.aptidao` / `viagem.liberacao_aptidao` → linhas. */
export function lerAptidao(json: unknown): ItemAptidao[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (e): e is ItemAptidao =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as ItemAptidao).codigo === "string" &&
      typeof (e as ItemAptidao).mensagem === "string" &&
      NIVEIS.includes((e as ItemAptidao).nivel),
  );
}

/** Liberação com exceção: só admin, só com trava e nunca com trava_legal (mesma regra de iniciar_viagem). */
export function podeLiberarComExcecao(aptidao: ItemAptidao[], papel: Papel | null | undefined): boolean {
  if (aptidao.some((a) => a.nivel === "trava_legal")) return false;
  return papel === "admin" && aptidao.some((a) => a.nivel === "trava");
}

/** Botão "Iniciar trânsito" da ficha: direto (apta ou só avisos), com justificativa (admin com trava),
   desabilitado com "Só o administrador…" (trava, não admin) ou bloqueado (trava legal). */
export type ModoInicio = "iniciar" | "excecao" | "so_admin" | "bloqueado";

export function modoDeInicio(aptidao: ItemAptidao[], papel: Papel | null | undefined): ModoInicio {
  if (aptidao.some((a) => a.nivel === "trava_legal")) return "bloqueado";
  if (!aptidao.some((a) => a.nivel === "trava")) return "iniciar";
  return podeLiberarComExcecao(aptidao, papel) ? "excecao" : "so_admin";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Selo da lista de planejadas (contagens de `v_viagem_planejada`; trava legal conta como trava). */
export function seloAptidao(c: { travas: number; avisos: number }): { tipo: TipoSinal; texto: string } {
  if (c.travas > 0) return { tipo: "bloqueado", texto: plural(c.travas, "trava", "travas") };
  if (c.avisos > 0) return { tipo: "vencendo", texto: `Apta · ${plural(c.avisos, "aviso", "avisos")}` };
  return { tipo: "normal", texto: "Apta" };
}

/* ---------- cancelamento ---------- */

const ANTES_DE_EM_ROTA: readonly StatusCampo[] = ["transito", "aguardando_carregamento", "em_carregamento", "aguardando_nf_pagamento"];

/** Mesma janela de cancelar_viagem e confirmar_pagamento_saida: planejada, Trânsito até Aguardando NF e
   pagamento, ou Pausa aberta a partir de Trânsito. */
export function podeCancelar(status: StatusCampo | null, origemDaPausa: StatusCampo | null): boolean {
  if (status === null) return true;
  if (status === "pausa") return origemDaPausa === "transito";
  return ANTES_DE_EM_ROTA.includes(status);
}

/* ---------- lista ---------- */

export const ABAS = ["planejadas", "no_quadro", "finalizadas", "canceladas"] as const;
export type AbaViagens = (typeof ABAS)[number];

export function abaDaViagem(v: { status_campo: StatusCampo | null; cancelada_em: string | null }): AbaViagens {
  if (v.cancelada_em) return "canceladas";
  if (v.status_campo === null) return "planejadas";
  return v.status_campo === "frete_finalizado" ? "finalizadas" : "no_quadro";
}

/** Tempo desde um instante: "há 5 min", "há 2 h 15 min", "há 2 dias e 4 h". */
export function duracao(desdeIso: string, agora: Date = new Date()): string {
  const min = Math.floor((agora.getTime() - new Date(desdeIso).getTime()) / 60000);
  if (min < 1) return "há menos de 1 min";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `há ${h} h ${m} min` : `há ${h} h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return `há ${plural(d, "dia", "dias")}${hr ? ` e ${hr} h` : ""}`;
}

/* ---------- pausas e ocorrências ---------- */

export const TIPOS_PAUSA = {
  almoco: "Almoço",
  banheiro: "Banheiro",
  descanso_pernoite: "Descanso ou pernoite",
  abastecimento: "Abastecimento",
  manutencao: "Manutenção",
  problema: "Problema",
  outro: "Outro",
} as const satisfies Record<TipoPausa, string>;

export const TIPOS_OCORRENCIA = {
  atraso: "Atraso",
  avaria: "Avaria",
  recusa: "Recusa",
  sinistro: "Sinistro",
  parada_nao_prevista: "Parada não prevista",
  outro: "Outro",
} as const satisfies Record<TipoOcorrencia, string>;

/** Avaria e sinistro podem virar desconto ou prejuízo: a tela mostra `AVISO_FINANCEIRO`. */
export function avisaFinanceiro(tipo: string): boolean {
  return tipo === "avaria" || tipo === "sinistro";
}

/** Formulário "Registrar ocorrência". A foto (opcional) não vem aqui: só o nome, o tipo e o tamanho dela. */
export const esquemaOcorrencia = z.object({
  viagem_id: z.string().default("").refine((v) => RE_ID.test(v), NAO_ACHADA),
  tipo: z.enum(Object.keys(TIPOS_OCORRENCIA) as [TipoOcorrencia, ...TipoOcorrencia[]], "Escolha o tipo da ocorrência."),
  descricao: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Descreva a ocorrência.").max(2000, "Até 2000 caracteres.")),
});

/** Texto livre (motivo, justificativa, resolução): sem espaços nas pontas; vazio → "". */
export function textoLimpo(v: unknown): string {
  return String(v ?? "").trim();
}

/** Recusa do banco por tela atrasada (mover_viagem: "…; o quadro foi atualizado"): a tela recarrega. */
export function foiAtualizado(mensagem: string): boolean {
  return mensagem.includes("o quadro foi atualizado");
}

/* ---------- linha do tempo ---------- */

export type EventoBanco = { de: StatusCampo | null; para: StatusCampo | null; motivo: string | null; dados: unknown };

const RESULTADOS: Record<string, string> = { sem_divergencia: "Sem divergência", falta: "Falta", sobra: "Sobra", avaria: "Avaria" };

const kgDe = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? formato.kg(n) : String(v);
};

/** Título e detalhes de uma linha de `viagem_evento` (quem e quando a tela acrescenta). */
export function descreverEvento(e: EventoBanco): { titulo: string; detalhes: string[] } {
  const d = (typeof e.dados === "object" && e.dados !== null ? e.dados : {}) as Record<string, unknown>;
  const detalhes: string[] = [];

  // Pagamentos pelo Contas a pagar trazem o número da conta; os confirmados à mão no Quadro, não.
  const conta = typeof d.conta_pagar === "number" || typeof d.conta_pagar === "string" ? ` (conta a pagar ${d.conta_pagar})` : "";
  if (d.tipo === "pagamento_saida") {
    return { titulo: conta ? `Adiantamento e vale-pedágio pagos${conta}` : "Adiantamento e vale-pedágio confirmados", detalhes };
  }
  if (d.tipo === "saldo_pago") return { titulo: conta ? `Saldo de 30% pago${conta}` : "Saldo de 30% confirmado", detalhes };
  if (d.tipo === "pagamento_saida_desfeito") return { titulo: `Pagamento do adiantamento desfeito${conta}`, detalhes };
  if (d.tipo === "saldo_pago_desfeito") return { titulo: `Pagamento do saldo desfeito${conta}`, detalhes };

  if (e.de === null && e.para !== null) {
    const travas = lerAptidao(d.aptidao).filter((a) => a.nivel === "trava");
    const excecao = Boolean(e.motivo) || travas.length > 0;
    for (const t of travas) detalhes.push(`Trava liberada: ${t.mensagem}`);
    if (e.motivo) detalhes.push(`Justificativa: ${e.motivo}`);
    return { titulo: `Viagem iniciada${excecao ? " com exceção" : ""}: ${rotuloDe(e.para)}`, detalhes };
  }

  if (e.para === null) {
    if (e.motivo) detalhes.push(`Motivo: ${e.motivo}`);
    return { titulo: e.de === null ? "Viagem cancelada (estava planejada)" : `Viagem cancelada (estava em ${rotuloDe(e.de)})`, detalhes };
  }

  if (d.peso_saida_kg != null) detalhes.push(`Peso de saída: ${kgDe(d.peso_saida_kg)}`);
  if (d.peso_chegada_kg != null) detalhes.push(`Peso de chegada: ${kgDe(d.peso_chegada_kg)}`);
  if (typeof d.chave_cte === "string") detalhes.push(`CT-e: ${d.chave_cte.replace(/\D/g, "")}`);
  if (typeof d.chave_mdfe === "string") detalhes.push(`MDF-e: ${d.chave_mdfe.replace(/\D/g, "")}`);
  if (typeof d.chave_nfe === "string") detalhes.push(`NF-e: ${d.chave_nfe.replace(/\D/g, "")}`);
  if (typeof d.ciot === "string") detalhes.push(`CIOT: ${d.ciot.replace(/\D/g, "")}`);
  if (typeof d.averbacao === "string" && d.averbacao.trim()) detalhes.push(`Averbação: ${d.averbacao.trim()}`);
  if (d.checklist_veiculo === true) detalhes.push("Checklist do veículo conferido");
  if (d.mdfe_encerrado === true && d.ciot_encerrado === true) detalhes.push("MDF-e e CIOT encerrados");
  if (typeof d.pausa_tipo === "string") {
    const tipo = TIPOS_PAUSA[d.pausa_tipo as TipoPausa] ?? d.pausa_tipo;
    detalhes.push(d.pausa_programada === true ? `${tipo}, programada` : d.pausa_programada === false ? `${tipo}, não programada` : tipo);
  }
  if (typeof d.divergencia === "string") detalhes.push(`Contagem: ${RESULTADOS[d.divergencia] ?? d.divergencia}`);
  if (typeof d.divergencia_descricao === "string" && d.divergencia_descricao.trim()) detalhes.push(`Divergência: ${d.divergencia_descricao.trim()}`);
  if (typeof d.resolucao === "string" && d.resolucao.trim()) detalhes.push(`Resolução: ${d.resolucao.trim()}`);
  if (e.motivo) detalhes.push(`Motivo: ${e.motivo}`);
  return { titulo: `${rotuloDe(e.de)} → ${rotuloDe(e.para)}`, detalhes };
}
