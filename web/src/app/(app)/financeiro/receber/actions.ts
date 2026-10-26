"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { hojeISO } from "@/lib/datas";
import { ehIdConta, lerMotivo } from "../pagar/regras";
import { lerRecebimento, lerTitulo } from "./regras";

/* Gravações do contas a receber. Toda escrita passa por `comSessao` (a sessão é conferida antes de qualquer
   trabalho). Quem pode o quê é do banco: o lançamento e a edição vão pela API (RLS e gatilhos conferem as
   colunas), o resto pelas funções `fin_*`, que já devolvem a frase pronta quando recusam. */

const NAO_ACHADO = "Título não encontrado. Atualize a página.";
/** Erro com frase pronta para a tela (`mensagemDeErro` mostra a mensagem de P0001 como está). */
const recusa = (message: string) => ({ code: "P0001", message });
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };

function revalidar() {
  revalidatePath("/financeiro/receber");
}

/** Primeira frase de erro de um formulário recusado (a tela já mostrou campo a campo antes de enviar). */
const primeiroErro = (erros: Record<string, string | undefined>) => Object.values(erros).find(Boolean) ?? "Confira os campos do formulário.";

/** Lança uma conta a receber à mão. Só as colunas do formulário: quem lançou o banco grava sozinho. Devolve o id. */
export async function lancarTitulo(form: FormData): Promise<ResultadoAcao<string>> {
  return comSessao(async ({ supabase }) => {
    const lido = lerTitulo(form, hojeISO());
    if (!lido.ok) throw recusa(primeiroErro(lido.erros));
    const d = lido.dados;
    const r = await tipado(supabase)
      .from("fin_receber")
      .insert({
        cliente_id: d.clienteId,
        titulo: d.titulo,
        plano_id: d.planoId,
        centro_custo_id: d.centroId,
        forma: d.forma,
        vencimento: d.vencimento,
        valor: d.valor,
        observacao: d.observacao,
      })
      .select("id")
      .single();
    if (r.error) throw r.error;
    revalidar();
    return r.data.id;
  });
}

/** Edita um título ainda em aberto (recebido ou cancelado o banco recusa com a frase pronta). */
export async function editarTitulo(id: string, form: FormData): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const lido = lerTitulo(form, hojeISO());
    if (!lido.ok) throw recusa(primeiroErro(lido.erros));
    const d = lido.dados;
    const r = await tipado(supabase)
      .from("fin_receber")
      .update({
        cliente_id: d.clienteId,
        titulo: d.titulo,
        plano_id: d.planoId,
        centro_custo_id: d.centroId,
        forma: d.forma,
        vencimento: d.vencimento,
        valor: d.valor,
        observacao: d.observacao,
      })
      .eq("id", id)
      .select("id");
    if (r.error) throw r.error;
    // O RLS esconde a linha em vez de dar erro: nada atualizado = sem permissão (ou o título sumiu).
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidar();
  });
}

/** Registra o recebimento: data (não pode ser no futuro) e conta bancária opcional (dinheiro não tem). */
export async function receberTitulo(id: string, form: FormData): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const lido = lerRecebimento(form, hojeISO());
    if (!lido.ok) throw recusa(primeiroErro(lido.erros));
    const d = lido.dados;
    const r = await tipado(supabase).rpc("fin_receber_conta", { p_id: id, p_data: d.data, p_conta: d.contaId ?? undefined });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Desfaz o recebimento (o título volta para em aberto). */
export async function desfazerRecebimento(id: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_desfazer_recebimento", { p_id: id });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Cancela o título com o motivo. Sem exclusão: ele fica na lista. */
export async function cancelarReceber(id: string, motivo: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  const m = lerMotivo(motivo, "cancelamento");
  if (!m.ok) return { ok: false, erro: m.erro };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_cancelar_receber", { p_id: id, p_motivo: m.motivo });
    if (r.error) throw r.error;
    revalidar();
  });
}
