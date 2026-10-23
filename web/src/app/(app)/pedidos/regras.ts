/* Regras puras das telas de Pedidos (servidor e cliente): rótulos, os esquemas de validação do pedido
   e da nova viagem e o peso sugerido. Fora de actions.ts porque um arquivo "use server" só exporta
   funções assíncronas (e os testes usam os esquemas direto). Pesos e dinheiro chegam como texto pt-BR
   e saem como número (Ruling R7). */
import { z } from "zod";
import type { Database } from "@/lib/banco";
import { lerNumeroBr } from "@/lib/formato";
import { rotuloDe, type StatusCampo } from "@/lib/quadro";
import { RE_ID } from "../_pessoa/formulario";

type TipoTarifa = Database["public"]["Enums"]["tipo_tarifa"];

/** Tipo do frete (enum `tipo_tarifa`), na ordem da tela. */
export const TIPOS_TARIFA = {
  por_tonelada: "Por tonelada",
  total: "Total",
} as const satisfies Record<TipoTarifa, string>;

/** "R$ 150,00 por tonelada" / "R$ 4.500,00 no total". */
export const SUFIXO_TARIFA: Record<TipoTarifa, string> = { por_tonelada: "por tonelada", total: "no total" };

export const NAO_ACHADO = "Pedido não encontrado. Atualize a página.";

const casasDe = (v: string) => {
  const t = v.replace(/\s|R\$/g, "");
  return t.includes(",") ? t.length - t.indexOf(",") - 1 : 0;
};

/** Número digitado em pt-BR (peso ou dinheiro) → número. `vazio` = mensagem quando obrigatório
   (sem ela, vazio vira `null`); `casas` = casas decimais da coluna; `positivo` = maior que zero. */
function numero(o: { vazio?: string; casas: 1 | 2; positivo: boolean }) {
  return z
    .string()
    .default("")
    .superRefine((v, ctx) => {
      const n = lerNumeroBr(v);
      const erro = (message: string) => ctx.addIssue({ code: "custom", message });
      if (n === null) return void (o.vazio && erro(o.vazio));
      if (Number.isNaN(n)) return erro(o.casas === 1 ? "Use números como 30.000 ou 37.000,5." : "Use números como 150 ou 1.234,56.");
      if (casasDe(v) > o.casas)
        return erro(o.casas === 1 ? "Use no máximo uma casa depois da vírgula." : "Use no máximo duas casas depois da vírgula.");
      if (o.positivo && n <= 0) return erro("O peso precisa ser maior que zero.");
      if (n >= 1e10) erro("Valor grande demais: confira os dígitos.");
    })
    .transform((v) => lerNumeroBr(v));
}

const id = (msg: string) => z.string().default("").refine((v) => RE_ID.test(v), msg);
const data = z.union([z.literal(""), z.iso.date("Data inválida.")]).default("");
const tarifa = (msg: string) => z.enum(["por_tonelada", "total"], msg);
const nulo = (v: string) => (v ? v : null);

/** Formulário "Novo pedido". Saída já no formato da tabela `pedido` (pesos e frete como número). */
export const esquemaPedido = z
  .object({
    tomador_id: id("Escolha o tomador"),
    remetente_id: id("Escolha o remetente"),
    destinatario_id: id("Escolha o destinatário"),
    local_coleta_id: id("Escolha o local de coleta"),
    local_descarga_id: id("Escolha o local de descarga"),
    produto: z.string().default("").pipe(z.string().min(1, "Informe o produto.").max(200, "Até 200 caracteres.")),
    peso_total_kg: numero({ vazio: "Informe o peso total em kg.", casas: 1, positivo: true }),
    coleta_prevista: data,
    entrega_prevista: data,
    frete_empresa_valor: numero({ vazio: "Informe o frete da empresa.", casas: 2, positivo: false }),
    frete_empresa_tipo: tarifa("Escolha se o frete é por tonelada ou total."),
    observacao: z.string().max(2000, "Até 2000 caracteres.").default(""),
  })
  .superRefine((v, ctx) => {
    if (v.coleta_prevista && v.entrega_prevista && v.entrega_prevista < v.coleta_prevista)
      ctx.addIssue({ code: "custom", path: ["entrega_prevista"], message: "A entrega não pode ser antes da coleta." });
  })
  .transform((v) => ({
    tomador_id: v.tomador_id,
    remetente_id: v.remetente_id,
    destinatario_id: v.destinatario_id,
    local_coleta_id: v.local_coleta_id,
    local_descarga_id: v.local_descarga_id,
    produto: v.produto.replace(/\s+/g, " "),
    peso_total_kg: v.peso_total_kg as number,
    coleta_prevista: nulo(v.coleta_prevista),
    entrega_prevista: nulo(v.entrega_prevista),
    frete_empresa_valor: v.frete_empresa_valor as number,
    frete_empresa_tipo: v.frete_empresa_tipo,
    // Enquanto a tabela de frete não está integrada, o valor é sempre digitado (spec 6.1).
    frete_empresa_origem: "manual" as const,
    observacao: nulo(v.observacao),
  }));

export type DadosPedido = z.output<typeof esquemaPedido>;

/** Diálogo "Nova viagem". Cavalo e motorista não vêm do formulário: a ação copia do conjunto. */
export const esquemaViagem = z
  .object({
    pedido_id: id(NAO_ACHADO),
    conjunto_id: id("Escolha o conjunto"),
    peso_previsto_kg: numero({ vazio: "Informe o peso previsto em kg.", casas: 1, positivo: true }),
    frete_motorista_valor: numero({ casas: 2, positivo: false }),
    frete_motorista_tipo: tarifa("Escolha se o frete do motorista é por tonelada ou total.").default("por_tonelada"),
  })
  .transform((v) => ({
    pedido_id: v.pedido_id,
    conjunto_id: v.conjunto_id,
    peso_previsto_kg: v.peso_previsto_kg as number,
    // Sem valor, o tipo não significa nada: os dois ficam nulos.
    frete_motorista_valor: v.frete_motorista_valor,
    frete_motorista_tipo: v.frete_motorista_valor === null ? null : v.frete_motorista_tipo,
  }));

export type DadosViagem = z.output<typeof esquemaViagem>;

/** Peso que o diálogo de nova viagem sugere: o saldo do pedido, limitado à capacidade do conjunto
   (toneladas → kg). Capacidade nula ou zero (sem carreta com capacidade informada) não limita. */
export function pesoSugerido(saldoKg: number, capacidadeT: number | null): number {
  const saldo = Math.max(0, saldoKg);
  if (capacidadeT == null || capacidadeT <= 0) return saldo;
  return Math.min(saldo, Math.round(capacidadeT * 1000 * 10) / 10);
}

type ViagemCancelamento = { numero: number; status_campo: StatusCampo | null; cancelada_em: string | null };

/** Por que o pedido não pode ser cancelado agora (Ruling R4), ou `null` se pode: viagem que já começou
   impede; viagem planejada também, até ser cancelada na ficha dela. Canceladas não contam. */
export function bloqueioDoCancelamento(viagens: ViagemCancelamento[]): string | null {
  const vivas = viagens.filter((v) => !v.cancelada_em).sort((a, b) => a.numero - b.numero);
  const iniciada = vivas.find((v) => v.status_campo !== null);
  if (iniciada) return `O pedido não pode ser cancelado: a viagem #${iniciada.numero} já começou (está em "${rotuloDe(iniciada.status_campo)}").`;
  if (!vivas.length) return null;
  const nums = vivas.map((v) => `#${v.numero}`).join(", ");
  return vivas.length === 1
    ? `O pedido tem a viagem ${nums} planejada. Cancele a viagem na ficha dela e depois cancele o pedido.`
    : `O pedido tem ${vivas.length} viagens planejadas (${nums}). Cancele as viagens nas fichas delas e depois cancele o pedido.`;
}

/** Situação da viagem na ficha do pedido: "Cancelada", "Planejada" ou o nome da coluna do Quadro. */
export function situacaoDaViagem(v: { status_campo: StatusCampo | null; cancelada_em: string | null }): string {
  return v.cancelada_em ? "Cancelada" : rotuloDe(v.status_campo);
}
