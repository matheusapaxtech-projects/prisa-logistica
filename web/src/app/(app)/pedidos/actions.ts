"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { errosDoZod, lerForm, RE_ID, type ResultadoForm } from "../_pessoa/formulario";
import { listarLocais, type Local } from "../clientes/consultas";
import { bloqueioDoCancelamento, esquemaPedido, esquemaViagem, NAO_ACHADO } from "./regras";

/* Gravações das telas de Pedidos. Toda escrita passa por `comSessao` (RLS: pedido e viagem =
   admin/operação). Pesos e dinheiro chegam como texto pt-BR e vão ao banco como número (Ruling R7,
   em `regras.ts`). */

const SEM_PERMISSAO = { code: "42501", message: "row-level security" };
const recusa = (message: string) => ({ code: "P0001", message });

function revalidarPedido(id: string) {
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

/** Locais de coleta/descarga de um cliente (o formulário pede ao escolher remetente ou destinatário). */
export async function locaisDoCliente(pessoaId: string): Promise<ResultadoAcao<Local[]>> {
  if (typeof pessoaId !== "string" || !RE_ID.test(pessoaId)) return { ok: false, erro: "Cliente não encontrado. Escolha de novo." };
  return comSessao(({ supabase }) => listarLocais(tipado(supabase), pessoaId));
}

/** Cria o pedido. Devolve o id; o banco confere (validar_pedido) que cada local é do cliente certo. */
export async function salvarPedido(_antes: ResultadoForm<string> | null, form: FormData): Promise<ResultadoForm<string>> {
  const v = esquemaPedido.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("pedido").insert(v.data).select("id").single();
    if (r.error) throw r.error;
    revalidarPedido(r.data.id);
    return r.data.id;
  });
}

/**
 * Cancela o pedido (Ruling R4). Só quando nenhuma viagem dele está viva: viagem que já começou
 * recusa; viagem planejada também recusa, pedindo para cancelá-la antes na ficha da viagem (a
 * `cancelar_viagem` aceita viagem até "Aguardando NF e pagamento", então cancelar as planejadas daqui,
 * fora de uma transação, poderia cancelar uma que alguém acabou de iniciar). O pedido não tem coluna
 * de motivo: o motivo vai para a observação, com data e hora de Brasília (e fica na auditoria).
 */
export async function cancelarPedido(id: string, motivo: string): Promise<ResultadoAcao> {
  if (typeof id !== "string" || !RE_ID.test(id)) return { ok: false, erro: NAO_ACHADO };
  const m = String(motivo ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!m) return { ok: false, erro: "Informe o motivo do cancelamento." };
  if (m.length > 500) return { ok: false, erro: "O motivo tem até 500 caracteres." };

  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const p = await db.from("pedido").select("numero, situacao, observacao").eq("id", id).maybeSingle();
    if (p.error) throw p.error;
    if (!p.data) throw recusa(NAO_ACHADO);
    if (p.data.situacao !== "aberto") throw recusa(`O pedido #${p.data.numero} já está cancelado.`);

    const vs = await db.from("viagem").select("numero, status_campo, cancelada_em").eq("pedido_id", id);
    if (vs.error) throw vs.error;
    const bloqueio = bloqueioDoCancelamento(vs.data ?? []);
    if (bloqueio) throw recusa(bloqueio);

    const nota = `Pedido cancelado em ${formato.dataHora(new Date().toISOString())}: ${m}`;
    const observacao = p.data.observacao ? `${p.data.observacao}\n\n${nota}` : nota;
    const r = await db.from("pedido").update({ situacao: "cancelado", observacao }).eq("id", id).eq("situacao", "aberto").select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidarPedido(id);
  });
}

/**
 * Cria uma viagem planejada do pedido (só pedido aberto, Ruling R4) num conjunto aberto e com
 * motorista. Cavalo e motorista são copiados do conjunto (o banco confere em validar_viagem).
 * Devolve o id da viagem; a tela abre `/viagens/<id>`.
 */
export async function criarViagem(_antes: ResultadoForm<string> | null, form: FormData): Promise<ResultadoForm<string>> {
  const v = esquemaViagem.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const d = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const [p, c] = await Promise.all([
      db.from("pedido").select("numero, situacao").eq("id", d.pedido_id).maybeSingle(),
      db.from("conjunto").select("cavalo_id, motorista_id, fim").eq("id", d.conjunto_id).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    if (c.error) throw c.error;
    if (!p.data) throw recusa(NAO_ACHADO);
    if (p.data.situacao !== "aberto") throw recusa(`O pedido #${p.data.numero} está cancelado; não dá para criar viagem nele.`);
    if (!c.data || c.data.fim) throw recusa("Este conjunto foi encerrado. Escolha um conjunto aberto.");
    if (!c.data.motorista_id) throw recusa("Este conjunto está sem motorista. Escolha o motorista na ficha do conjunto ou outro conjunto.");

    const r = await db
      .from("viagem")
      .insert({
        pedido_id: d.pedido_id,
        conjunto_id: d.conjunto_id,
        cavalo_id: c.data.cavalo_id,
        motorista_id: c.data.motorista_id,
        peso_previsto_kg: d.peso_previsto_kg,
        frete_motorista_valor: d.frete_motorista_valor,
        frete_motorista_tipo: d.frete_motorista_tipo,
      })
      .select("id")
      .single();
    if (r.error) throw r.error;
    revalidarPedido(d.pedido_id);
    revalidatePath("/viagens");
    return r.data.id;
  });
}
