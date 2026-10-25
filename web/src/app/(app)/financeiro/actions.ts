"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado, type Json } from "@/lib/banco";
import { chaveDaDescricao, ehCategoria, type Categoria } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { decodificarOfx, ErroOfx, lerOfx } from "@/lib/ofx";
import { RE_ID } from "../_pessoa/formulario";
import { TAMANHO_MAXIMO, type Classificado, type Importado } from "./regras";

/* Gravações do Financeiro. Toda escrita passa por `comSessao` (a sessão é conferida antes de qualquer
   trabalho); quem pode é o RLS (pode_financeiro(): admin e financeiro). A importação e a classificação
   rodam numa função do banco cada uma (tudo ou nada). */

const NAO_ACHADO = "Lançamento não encontrado. Atualize a página.";
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };
/** Erro com frase pronta para a tela (`mensagemDeErro` mostra a mensagem de P0001 como está). */
const recusa = (message: string) => ({ code: "P0001", message });

function revalidar() {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/importar");
}

/** Lê o OFX enviado e grava: conta (nasce sozinha), importação e lançamentos novos, já com a
   categoria das regras. Lançamento que já estava no NILT (mesmo id do banco, data e valor) não repete;
   o que parece repetido com outro id (mesma data, valor e histórico) entra e é contado à parte. */
export async function importarExtrato(_antes: ResultadoAcao<Importado> | null, form: FormData): Promise<ResultadoAcao<Importado>> {
  return comSessao(async ({ supabase }) => {
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw recusa("Escolha o arquivo OFX do extrato.");
    if (arquivo.size > TAMANHO_MAXIMO) throw recusa("O arquivo passa de 4 MB. Exporte um período menor (um mês por vez) e importe de novo.");

    let extrato;
    try {
      extrato = lerOfx(decodificarOfx(new Uint8Array(await arquivo.arrayBuffer())));
    } catch (e) {
      if (e instanceof ErroOfx) throw recusa(e.message);
      throw e;
    }
    if (extrato.lancamentos.length === 0) throw recusa("O extrato não tem lançamentos. Confira o período escolhido no banco.");

    const r = await tipado(supabase).rpc("fin_importar_extrato", {
      p: {
        banco: extrato.banco,
        agencia: extrato.agencia,
        numero: extrato.numero,
        nome_arquivo: arquivo.name.slice(0, 200),
        inicio: extrato.inicio,
        fim: extrato.fim,
        saldo: extrato.saldo,
        saldo_em: extrato.saldoEm,
        lancamentos: extrato.lancamentos.map((l) => ({ ...l, chave: chaveDaDescricao(l.descricao) })),
      } as Json,
    });
    if (r.error) throw r.error;
    const d = r.data as { total: number; novos: number; classificados: number; suspeitos?: number };
    revalidar();
    const meses = extrato.lancamentos.map((l) => l.data.slice(0, 7)).sort();
    return {
      total: d.total,
      novos: d.novos,
      repetidos: d.total - d.novos,
      classificados: d.classificados,
      suspeitos: d.suspeitos ?? 0,
      banco: extrato.banco,
      agencia: extrato.agencia,
      numero: extrato.numero,
      primeiroMes: meses[0],
      ultimoMes: meses[meses.length - 1],
    };
  });
}

/** Põe (ou tira, com `categoria` vazia) a categoria de um lançamento. Com `lembrar`, grava a regra pela
   descrição e classifica os parecidos ainda sem categoria (o banco recusa a regra quando a descrição é
   genérica, como "PIX RECEBIDO"). Devolve quantos outros foram classificados e se a regra foi gravada. */
export async function classificarLancamento(id: string, categoria: Categoria | "", lembrar: boolean): Promise<ResultadoAcao<Classificado>> {
  if (!RE_ID.test(id)) return { ok: false, erro: NAO_ACHADO };
  if (categoria !== "" && !ehCategoria(categoria)) return { ok: false, erro: "Escolha uma categoria da lista." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).rpc("fin_classificar_lancamento", {
      p_id: id,
      // O tipo gerado não aceita null, mas a função aceita: null tira a categoria.
      p_categoria: (categoria || null) as Categoria,
      p_lembrar: lembrar && categoria !== "",
    });
    if (r.error) throw r.error;
    revalidar();
    const d = (r.data ?? {}) as { outros?: number; regra?: boolean };
    return { outros: d.outros ?? 0, regra: !!d.regra, pediuRegra: lembrar && categoria !== "" };
  });
}

/** Apaga uma regra aprendida. Os lançamentos já classificados por ela continuam como estão. */
export async function apagarRegra(id: string): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Regra não encontrada. Atualize a página." };
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("fin_regra").delete().eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidar();
  });
}

/** Desfaz uma importação: apaga a linha da importação e os lançamentos que ela trouxe. Só a mais
   recente de cada conta: um lançamento que uma importação anterior trouxe pode ter vindo de novo numa
   posterior (como repetido), e apagá-lo sumiria com o que o arquivo mais novo também tem. */
export async function desfazerImportacao(id: string): Promise<ResultadoAcao<number>> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Importação não encontrada. Atualize a página." };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const imp = await db.from("fin_importacao").select("id, conta_id").eq("id", id).maybeSingle();
    if (imp.error) throw imp.error;
    if (!imp.data) throw recusa("Importação não encontrada. Atualize a página.");
    const ultima = await db
      .from("fin_importacao")
      .select("id, nome_arquivo, created_at")
      .eq("conta_id", imp.data.conta_id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (ultima.error) throw ultima.error;
    if (ultima.data.id !== id) {
      throw recusa(
        `Desfaça antes a importação mais recente desta conta (${ultima.data.nome_arquivo}, de ${formato.dataHora(ultima.data.created_at)}).`,
      );
    }
    const n = await db.from("fin_lancamento").select("id", { count: "exact", head: true }).eq("importacao_id", id);
    if (n.error) throw n.error;
    const r = await db.from("fin_importacao").delete().eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidar();
    return n.count ?? 0;
  });
}
