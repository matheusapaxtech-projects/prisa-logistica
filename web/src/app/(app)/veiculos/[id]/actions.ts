"use server";

import { revalidatePath } from "next/cache";
import { comSessao } from "@/lib/acao";
import { tipado, type Database } from "@/lib/banco";
import { FichaVeiculo, ehId, errosPorCampo, textosDe } from "../schema";

type Atualizacao = Database["public"]["Tables"]["veiculo"]["Update"];

export type ResultadoSalvar =
  | { ok: true; dados?: undefined }
  | { ok: false; erro: string; campos?: Record<string, string> };

const SEM_PERMISSAO = { code: "42501", message: "row-level security" };
const aviso = (message: string) => ({ code: "P0001", message });

/** Rótulos para dizer em que campo está o erro quando a pessoa está em outra aba. */
const ROTULOS: Record<string, string> = {
  renavam: "Renavam",
  placa: "Placa",
  exercicio_doc: "Exercício",
  dt_emissao_crlv: "Emissão do CRLV",
  ano_fabricacao: "Ano de fabricação",
  ano_modelo: "Ano do modelo",
  nr_certificado_doc: "Nº do certificado",
  nr_seguranca_crlv: "Nº de segurança",
  nr_registro_crlv: "Nº de registro",
  chassi: "Chassi",
  modelo: "Modelo",
  proprietario_posse_id: "Proprietário da posse",
  proprietario_documento_id: "Proprietário do documento",
  comprimento_m: "Comprimento",
  largura_m: "Largura",
  altura_m: "Altura",
  pbt_t: "PBT",
  tara_t: "Tara",
  capacidade_carga_t: "Capacidade de carga",
  cmt_t: "CMT",
  seguro_validade: "Validade do seguro",
  hp: "HP",
  litros_tanque: "Tanque",
  media_padrao_carregado: "Média carregado",
  media_padrao_vazio: "Média vazio",
  km_inicial: "Km inicial",
  aquisicao: "Aquisição",
  vl_compra: "Valor de compra",
  vl_mercado: "Valor de mercado",
  venc_ipva: "Vencimento do IPVA",
};

/**
 * Grava a ficha (`veiculo.html`, barra "Salvar alterações"): um formulário só para as seis abas
 * editáveis. Campo ausente não é tocado (a aba pode não mostrá-lo: CMT só no cavalo, assoalho só na
 * carreta). Capacidade: "calcular pelo PBT e tara" marcado grava nulo (o banco calcula).
 */
export async function salvarVeiculo(id: string, form: FormData): Promise<ResultadoSalvar> {
  if (!ehId(id)) return { ok: false, erro: "Veículo não encontrado." };
  const texto = textosDe(form);
  const lido = FichaVeiculo.safeParse(texto);
  if (!lido.success) {
    const campos = errosPorCampo(lido.error);
    const lista = Object.entries(campos)
      .map(([k, m]) => `${ROTULOS[k] ?? k}: ${m}`)
      .slice(0, 4)
      .join(" ");
    return { ok: false, erro: `Corrija os campos antes de salvar. ${lista}`.trim(), campos };
  }
  const { cap_auto, capacidade_carga_t, ...resto } = lido.data;
  const mudancas: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(resto)) if (v !== undefined) mudancas[k] = v;
  if (cap_auto !== undefined) mudancas.capacidade_carga_t = null;
  else if (capacidade_carga_t !== undefined) mudancas.capacidade_carga_t = capacidade_carga_t;
  if (!Object.keys(mudancas).length) return { ok: true };

  const r = await comSessao(async ({ supabase }) => {
    const db = tipado(supabase);

    // Placa e Renavam são únicos: diz de qual veículo é, em vez de "já existe um cadastro".
    if (typeof mudancas.placa === "string") {
      const { data, error } = await db.from("veiculo").select("id").eq("placa", mudancas.placa).neq("id", id).limit(1);
      if (error) throw error;
      if (data?.length) throw aviso(`A placa ${mudancas.placa} já está cadastrada em outro veículo.`);
    }
    if (typeof mudancas.renavam === "string") {
      const { data, error } = await db.from("veiculo").select("placa").eq("renavam", mudancas.renavam).neq("id", id).limit(1);
      if (error) throw error;
      if (data?.length) throw aviso(`Renavam já cadastrado na placa ${data[0].placa}. Confira o documento.`);
    }

    // Trocar a categoria de quem está num conjunto aberto deixaria o conjunto inválido.
    if (typeof mudancas.tipo_veiculo_id === "number") {
      const [atual, novo] = await Promise.all([
        db.from("veiculo").select("tipo_veiculo(categoria)").eq("id", id).maybeSingle(),
        db.from("tipo_veiculo").select("categoria").eq("id", mudancas.tipo_veiculo_id).maybeSingle(),
      ]);
      if (atual.error) throw atual.error;
      if (novo.error) throw novo.error;
      const cat = (Array.isArray(atual.data?.tipo_veiculo) ? atual.data?.tipo_veiculo[0] : atual.data?.tipo_veiculo)?.categoria;
      if (novo.data && cat && novo.data.categoria !== cat) {
        const [comoCavalo, comoItem] = await Promise.all([
          db.from("conjunto").select("id", { count: "exact", head: true }).eq("cavalo_id", id).is("fim", null),
          db.from("conjunto_item").select("conjunto_id, conjunto!inner(fim)", { count: "exact", head: true }).eq("veiculo_id", id).is("conjunto.fim", null),
        ]);
        if (comoCavalo.error) throw comoCavalo.error;
        if (comoItem.error) throw comoItem.error;
        if ((comoCavalo.count ?? 0) + (comoItem.count ?? 0) > 0)
          throw aviso("Este veículo está num conjunto aberto. Encerre o conjunto antes de trocar a categoria.");
      }
    }

    const { data, error } = await db
      .from("veiculo")
      .update(mudancas as Atualizacao)
      .eq("id", id)
      .select("id");
    if (error) {
      if (error.code === "23505") {
        throw aviso(/renavam/i.test(error.message) ? "Este Renavam já está cadastrado em outro veículo." : "Esta placa já está cadastrada em outro veículo.");
      }
      throw error;
    }
    // O RLS não avisa quando nega um UPDATE: sem linha afetada, o papel não pode editar.
    if (!data?.length) throw SEM_PERMISSAO;
    revalidatePath("/veiculos");
    revalidatePath(`/veiculos/${id}`);
  });
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}
