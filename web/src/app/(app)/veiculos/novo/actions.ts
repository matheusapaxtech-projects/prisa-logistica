"use server";

import { revalidatePath } from "next/cache";
import { comSessao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { MSG_GENERICA } from "@/lib/erros";
import { NovoVeiculo, errosPorCampo, textosDe } from "../schema";

/** Falha de validação por campo, ou erro geral; `ok: true` devolve o id do veículo criado. */
export type ResultadoCriar =
  | { ok: true; dados: { id: string; arrendado: boolean } }
  | { ok: false; erro: string; campos?: Record<string, string> };

const MSG_PLACA_JA = "Esta placa já está cadastrada. Abra a ficha do veículo em vez de cadastrar de novo.";
const MSG_RENAVAM_JA = "Este Renavam já está cadastrado em outro veículo. Confira o documento.";

/**
 * Cria o veículo (`veiculo-novo.html`): nasce com cadastro pendente até a ficha ser conferida;
 * posse diferente do documento (ANTT) nasce arrendado. O contrato, se houver, é enviado depois pela
 * tela (`prepararEnvio` + upload), já com o id devolvido aqui.
 */
export async function criarVeiculo(form: FormData): Promise<ResultadoCriar> {
  const lido = NovoVeiculo.safeParse(textosDe(form));
  if (!lido.success) {
    return { ok: false, erro: "Confira os campos marcados em vermelho.", campos: errosPorCampo(lido.error) };
  }
  const v = lido.data;
  const documento = v.proprietario_documento_id ?? v.proprietario_posse_id;
  const arrendado = v.proprietario_posse_id !== documento;

  const r = await comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const { data, error } = await db
      .from("veiculo")
      .insert({
        placa: v.placa,
        tipo_veiculo_id: v.tipo_veiculo_id,
        marca_id: v.marca_id,
        modelo: v.modelo,
        cor: v.cor,
        ano_fabricacao: v.ano_fabricacao,
        ano_modelo: v.ano_modelo,
        renavam: v.renavam,
        chassi: v.chassi,
        uf_emplacamento: v.uf_emplacamento,
        cidade_emplacamento: v.cidade_emplacamento,
        proprietario_posse_id: v.proprietario_posse_id,
        proprietario_documento_id: documento,
        situacao_operacional: arrendado ? "arrendado" : "ativo",
        situacao_cadastro: "pendente",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw { code: "P0001", message: /renavam/i.test(error.message) ? MSG_RENAVAM_JA : MSG_PLACA_JA };
      }
      throw error;
    }
    revalidatePath("/veiculos");
    return { id: data.id, arrendado };
  });
  return r.ok ? r : { ok: false, erro: r.erro || MSG_GENERICA };
}
