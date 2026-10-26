"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { hojeISO } from "@/lib/datas";
import { mesValido } from "@/lib/financeiro";
import { ehIdConta, lerAjusteGerada, lerConta, lerMotivo, lerPagamento } from "./regras";

/* Gravações do contas a pagar. Toda escrita passa por `comSessao` (a sessão é conferida antes de qualquer
   trabalho). Quem pode o quê é do banco: o lançamento e a edição vão pela API (RLS e gatilhos conferem as
   colunas), o resto pelas funções `fin_*`, que já devolvem a frase pronta quando recusam. */

const NAO_ACHADO = "Conta não encontrada. Atualize a página.";
/** Erro com frase pronta para a tela (`mensagemDeErro` mostra a mensagem de P0001 como está). */
const recusa = (message: string) => ({ code: "P0001", message });
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };

function revalidar() {
  revalidatePath("/financeiro/pagar");
}

/** Primeira frase de erro de um formulário recusado (a tela já mostrou campo a campo antes de enviar). */
const primeiroErro = (erros: Record<string, string | undefined>) => Object.values(erros).find(Boolean) ?? "Confira os campos do formulário.";

/** Lança uma conta a pagar à mão. Só as colunas do formulário: quem lançou o banco grava sozinho. Devolve o id. */
export async function lancarConta(form: FormData): Promise<ResultadoAcao<string>> {
  return comSessao(async ({ supabase }) => {
    const lido = lerConta(form, hojeISO());
    if (!lido.ok) throw recusa(primeiroErro(lido.erros));
    const d = lido.dados;
    const r = await tipado(supabase)
      .from("fin_pagar")
      .insert({
        descricao: d.descricao,
        favorecido_nome: d.favorecidoNome,
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

/** Edita uma conta ainda não aprovada. Nas contas geradas pelo NILT (parcela do frete, taxa do cartão) só forma,
   centro de custo e observação mudam: a origem vem do banco, não do formulário. */
export async function editarConta(id: string, form: FormData): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const atual = await db.from("fin_pagar").select("origem").eq("id", id).maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data) throw recusa(NAO_ACHADO);

    let mudancas;
    if (atual.data.origem === "manual") {
      const lido = lerConta(form, hojeISO());
      if (!lido.ok) throw recusa(primeiroErro(lido.erros));
      const d = lido.dados;
      mudancas = {
        descricao: d.descricao,
        favorecido_nome: d.favorecidoNome,
        plano_id: d.planoId,
        centro_custo_id: d.centroId,
        forma: d.forma,
        vencimento: d.vencimento,
        valor: d.valor,
        observacao: d.observacao,
      };
    } else {
      const lido = lerAjusteGerada(form);
      if (!lido.ok) throw recusa(primeiroErro(lido.erros));
      mudancas = { centro_custo_id: lido.dados.centroId, forma: lido.dados.forma, observacao: lido.dados.observacao };
    }

    const r = await db.from("fin_pagar").update(mudancas).eq("id", id).select("id");
    if (r.error) throw r.error;
    // O RLS esconde a linha em vez de dar erro: nada atualizado = sem permissão (ou a conta sumiu).
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidar();
  });
}

/** Aprova a conta (quem lançou ou alterou por último não aprova: o banco recusa). */
export async function aprovar(id: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_aprovar_pagar", { p_id: id });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Desfaz a aprovação (só quem aprovou ou o administrador; conta paga primeiro desfaz o pagamento). */
export async function desaprovar(id: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_desaprovar_pagar", { p_id: id });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Paga a conta aprovada: data (não pode ser no futuro), conta bancária opcional (cartão-frete e dinheiro não têm) e a forma. */
export async function pagar(id: string, form: FormData): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const lido = lerPagamento(form, hojeISO());
    if (!lido.ok) throw recusa(primeiroErro(lido.erros));
    const d = lido.dados;
    const r = await tipado(supabase).rpc("fin_pagar_conta", {
      p_id: id,
      p_data: d.data,
      p_conta: d.contaId ?? undefined,
      p_forma: d.forma,
    });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Desfaz o pagamento (só o administrador). */
export async function desfazerPagamento(id: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(
    async ({ supabase }) => {
      const r = await tipado(supabase).rpc("fin_desfazer_pagamento", { p_id: id });
      if (r.error) throw r.error;
      revalidar();
    },
    { somenteAdmin: true },
  );
}

/** Cancela a conta com o motivo (parcela do frete: só o administrador). Sem exclusão: a conta fica na lista. */
export async function cancelar(id: string, motivo: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  const m = lerMotivo(motivo, "cancelamento");
  if (!m.ok) return { ok: false, erro: m.erro };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_cancelar_pagar", { p_id: id, p_motivo: m.motivo });
    if (r.error) throw r.error;
    revalidar();
  });
}

/** Libera o pagamento do saldo do frete antes da entrega conferida (só o administrador). */
export async function liberarAntecipacao(id: string, motivo: string): Promise<ResultadoAcao> {
  if (!ehIdConta(id)) return { ok: false, erro: NAO_ACHADO };
  const m = lerMotivo(motivo, "liberação");
  if (!m.ok) return { ok: false, erro: m.erro };
  return comSessao(
    async ({ supabase }) => {
      const r = await tipado(supabase).rpc("fin_liberar_antecipacao", { p_id: id, p_motivo: m.motivo });
      if (r.error) throw r.error;
      revalidar();
    },
    { somenteAdmin: true },
  );
}

/** Lança (ou atualiza o valor, enquanto não aprovada) a conta da taxa do cartão-frete do mês "aaaa-mm". Devolve o id. */
export async function lancarTaxaCartao(mes: string): Promise<ResultadoAcao<string>> {
  if (!mesValido(mes)) return { ok: false, erro: "Mês inválido. Atualize a página." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_lancar_taxa_cartao", { p_mes: `${mes}-01` });
    if (r.error) throw r.error;
    revalidar();
    return r.data;
  });
}
