"use server";

import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { validacao } from "@/lib/validacao";
import { buscarOpcoes, type OpcaoPessoa, type TipoSeletor } from "./pessoas";
import { nomeCurto, rotuloTipo, um, type TipoVeiculo } from "./rotulos";
import { marcaCurta, rotuloSituacaoCadastro } from "./rotulos";

/* Consultas que as telas de veículo fazem enquanto a pessoa digita (somente leitura, com a sessão do
   usuário: o RLS vale). */

/** Seletor de proprietário ou de motorista: nome, apelido, nome fantasia ou CPF/CNPJ. */
export async function buscarPessoas(tipo: TipoSeletor, termo: string): Promise<ResultadoAcao<OpcaoPessoa[]>> {
  if (tipo !== "proprietario" && tipo !== "motorista") return { ok: true, dados: [] };
  return comSessao(({ supabase }) => buscarOpcoes(tipado(supabase), tipo, termo));
}

export type PlacaExistente = {
  id: string;
  placa: string;
  tipo: string;
  marcaModelo: string;
  posse: string;
  cadastro: string;
};

type Embutido<T> = T | T[] | null;

/** Veículo já cadastrado com esta placa (nulo = placa livre). A placa precisa estar completa e válida. */
export async function consultarPlaca(placa: string): Promise<ResultadoAcao<PlacaExistente | null>> {
  const p = validacao.normalizarPlaca(placa);
  if (!validacao.placa(p)) return { ok: true, dados: null };
  return comSessao(async ({ supabase }) => {
    const { data, error } = await tipado(supabase)
      .from("veiculo")
      .select(
        "id, placa, modelo, situacao_cadastro, tipo_veiculo(nome, categoria, configuracao_cavalo), marca_veiculo(nome), posse:proprietario!veiculo_proprietario_posse_id_fkey(pessoa(nome, nome_fantasia, tipo))",
      )
      .eq("placa", p)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const tipo = um(data.tipo_veiculo as Embutido<Pick<TipoVeiculo, "nome" | "categoria" | "configuracao_cavalo">>);
    const marca = um(data.marca_veiculo as Embutido<{ nome: string }>);
    const posse = um(um(data.posse as Embutido<{ pessoa: Embutido<{ nome: string; nome_fantasia: string | null; tipo: string }> }>)?.pessoa);
    return {
      id: data.id,
      placa: data.placa,
      tipo: tipo ? rotuloTipo(tipo) : "Veículo",
      marcaModelo: [marcaCurta(marca?.nome), data.modelo].filter(Boolean).join(" "),
      posse: nomeCurto(posse),
      cadastro: rotuloSituacaoCadastro(data.situacao_cadastro).toLowerCase(),
    };
  });
}

/** Placa do veículo que já usa este Renavam (nulo = livre). */
export async function consultarRenavam(renavam: string): Promise<ResultadoAcao<string | null>> {
  const r = validacao.soDigitos(renavam);
  if (r.length !== 11) return { ok: true, dados: null };
  return comSessao(async ({ supabase }) => {
    const { data, error } = await tipado(supabase).from("veiculo").select("placa").eq("renavam", r).maybeSingle();
    if (error) throw error;
    return data?.placa ?? null;
  });
}
