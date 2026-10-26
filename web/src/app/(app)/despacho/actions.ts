"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { calcularCTe, type TipoCarga } from "@/lib/calculadora/regras";
import { RE_ID } from "../_pessoa/formulario";
import { parametros } from "../calculadora/consultas";
import { TIPOS_CARGA_ANTT } from "../pedidos/regras";

/* Gravações do Despacho (migration 20261030000200): contratar o lote sugerido, as negociações com o motorista
   e a aprovação do conjunto. As regras ficam no banco (contratar_lote, registrar/responder_negociacao,
   informar_cte_negociacao, aprovar_conjunto); aqui só a conferência dos dados que chegam da tela. */

function revalidar(pedidoId?: string | null) {
  revalidatePath("/despacho");
  revalidatePath("/despacho/negociacoes");
  revalidatePath("/quadro");
  revalidatePath("/viagens");
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
}

const positivo = (v: unknown, max = 1e9) => typeof v === "number" && Number.isFinite(v) && v > 0 && v < max;

export type ItemLote = { conjuntoId: string; pesoKg: number; freteMotorista: number; km: number; pedagio: number };

/** Cria as viagens do lote (planejadas, no Quadro). Devolve quantas. */
export async function contratarLote(pedidoId: string, itens: ItemLote[]): Promise<ResultadoAcao<number>> {
  if (!RE_ID.test(pedidoId)) return { ok: false, erro: "Pedido não encontrado." };
  if (!Array.isArray(itens) || !itens.length || itens.length > 30) return { ok: false, erro: "Escolha pelo menos um caminhão." };
  for (const i of itens) {
    if (!RE_ID.test(i.conjuntoId) || !positivo(i.pesoKg, 200000) || !positivo(i.freteMotorista) || !positivo(i.km, 10000) || !(i.pedagio >= 0))
      return { ok: false, erro: "Algum caminhão do lote está sem peso, frete ou km. Confira a simulação." };
  }
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("contratar_lote", {
      p_pedido: pedidoId,
      p_itens: itens.map((i) => ({ conjunto_id: i.conjuntoId, peso_kg: Math.round(i.pesoKg), frete_motorista: i.freteMotorista, km: i.km, pedagio: i.pedagio })),
    });
    if (r.error) throw r.error;
    revalidar(pedidoId);
    return r.data?.length ?? 0;
  });
}

export type DadosNegociacao = {
  motoristaId: string;
  conjuntoId: string | null;
  pedidoId: string | null;
  origem: string;
  destino: string;
  km: number;
  eixos: number;
  pedagio: number;
  tipoCarga: TipoCarga;
  pesoKg: number;
  valorMercadoriaT: number | null;
  freteClienteT: number | null;
  piso: number;
  freteMotorista: number;
  motoristaPF: boolean;
};

const UF = /\/([A-Z]{2})$/;

/** Grava a proposta. O resultado do CT-e é calculado aqui, com as alíquotas vigentes do banco. */
export async function registrarNegociacao(d: DadosNegociacao): Promise<ResultadoAcao<string>> {
  if (!RE_ID.test(d.motoristaId)) return { ok: false, erro: "Escolha o motorista do acervo: o histórico fica no motorista." };
  if (d.conjuntoId && !RE_ID.test(d.conjuntoId)) return { ok: false, erro: "Conjunto inválido." };
  if (d.pedidoId && !RE_ID.test(d.pedidoId)) return { ok: false, erro: "Frete da fila inválido." };
  const origem = String(d.origem ?? "").trim().slice(0, 120);
  const destino = String(d.destino ?? "").trim().slice(0, 120);
  if (!origem || !destino) return { ok: false, erro: "Informe a carga inicial e a final." };
  if (!positivo(d.km, 10000)) return { ok: false, erro: "Informe o km do trecho." };
  if (!(d.eixos >= 2 && d.eixos <= 9)) return { ok: false, erro: "Escolha os eixos." };
  if (!positivo(d.pesoKg, 200000)) return { ok: false, erro: "Informe o peso." };
  if (!positivo(d.freteMotorista)) return { ok: false, erro: "Informe o frete do motorista." };
  if (!(d.tipoCarga in TIPOS_CARGA_ANTT)) return { ok: false, erro: "Escolha o tipo de carga." };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const pesoT = d.pesoKg / 1000;
    let resultado: { liquido: number; margem: number } | null = null;
    if (positivo(d.freteClienteT)) {
      const { fiscal } = await parametros(db);
      const r = calcularCTe(
        {
          freteEmpresa: d.freteClienteT! * pesoT,
          freteMotorista: d.freteMotorista,
          pedagio: Math.max(0, d.pedagio || 0),
          origemUF: origem.match(UF)?.[1] ?? "",
          destinoUF: destino.match(UF)?.[1] ?? "",
          motoristaPF: d.motoristaPF,
          valorMercadoria: (d.valorMercadoriaT ?? 0) * pesoT,
        },
        fiscal,
      );
      resultado = { liquido: r.resultadoLiquido, margem: r.margemLiquida };
    }
    const r = await db.rpc("registrar_negociacao", {
      p: {
        motorista_id: d.motoristaId,
        conjunto_id: d.conjuntoId,
        pedido_id: d.pedidoId,
        origem,
        destino,
        km: Math.round(d.km),
        eixos: d.eixos,
        pedagio: Math.max(0, d.pedagio || 0),
        tipo_carga: d.tipoCarga,
        peso_kg: Math.round(d.pesoKg),
        valor_mercadoria_t: positivo(d.valorMercadoriaT) ? d.valorMercadoriaT : null,
        frete_cliente_t: positivo(d.freteClienteT) ? d.freteClienteT : null,
        piso: d.piso,
        frete_motorista: d.freteMotorista,
      },
      ...(resultado ? { p_resultado_liquido: resultado.liquido, p_margem_liquida: resultado.margem } : {}),
    });
    if (r.error) throw r.error;
    revalidar(d.pedidoId);
    return r.data;
  });
}

/** Aceitou (vira viagem quando tem pedido e conjunto) ou recusou (com o valor que pediu e o motivo). */
export async function responderNegociacao(id: string, aceita: boolean, valorPedido: number | null, motivo: string): Promise<ResultadoAcao<string | null>> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Negociação não encontrada." };
  if (valorPedido !== null && !positivo(valorPedido)) return { ok: false, erro: "O valor pedido precisa ser maior que zero." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("responder_negociacao", {
      p_id: id,
      p_aceita: aceita,
      ...(valorPedido ? { p_valor_pedido: valorPedido } : {}),
      ...(motivo.trim() ? { p_motivo: motivo.trim().slice(0, 500) } : {}),
    });
    if (r.error) throw r.error;
    revalidar();
    return r.data ?? null;
  });
}

/** Número do CT-e: a negociação fica congelada. */
export async function informarCte(id: string, numero: string): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Negociação não encontrada." };
  const n = String(numero ?? "").trim().slice(0, 30);
  if (!n) return { ok: false, erro: "Informe o número do CT-e." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("informar_cte_negociacao", { p_id: id, p_numero: n });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Aprova (ou volta para pendente) o conjunto depois de conferir os documentos. */
export async function aprovarConjunto(id: string, aprovar: boolean): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Conjunto não encontrado." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("aprovar_conjunto", { p_conjunto: id, p_aprovar: aprovar });
    if (r.error) throw r.error;
    revalidatePath(`/conjuntos/${id}`);
    revalidatePath("/conjuntos");
    revalidar();
  });
}
