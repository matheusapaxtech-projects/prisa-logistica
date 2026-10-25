"use server";

import { revalidatePath } from "next/cache";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { prepararEnvio, type DadosEnvio } from "@/components/documentos-acoes";
import { errosDoZod, lerForm, RE_ID, type ResultadoForm } from "../_pessoa/formulario";
import { esquemaFreteViagem } from "../pedidos/regras";
import { esquemaOcorrencia, NAO_ACHADA, textoLimpo } from "./regras";

/* Gravações das telas de Viagens (reusadas pelo Quadro, Task 10). Iniciar, cancelar e confirmar o
   pagamento de saída são RPCs do banco (security definer): a recusa delas (em pt-BR) aparece como
   está. Canhoto e foto da ocorrência seguem o "Fluxo canônico de upload": a ação grava a linha de
   `arquivo` e devolve o caminho; o navegador envia o objeto (`./envio.ts`). O arquivo nunca passa
   pela Server Action (limite de corpo da requisição). */

const SEM_PERMISSAO = { code: "42501", message: "row-level security" };
const recusa = (message: string) => ({ code: "P0001", message });

const TIPO_CANHOTO = 15;
const TIPO_OUTROS = 14;

function revalidarViagem(id?: string) {
  revalidatePath("/viagens");
  if (id) revalidatePath(`/viagens/${id}`);
  revalidatePath("/quadro");
  revalidatePath("/pedidos/[id]", "page");
}

const idValido = (id: unknown): id is string => typeof id === "string" && RE_ID.test(id);

/** Planejada → Trânsito (`iniciar_viagem`). Com trava, só admin e só com justificativa (o banco confere). */
export async function iniciarViagem(viagemId: string, justificativa?: string): Promise<ResultadoAcao> {
  if (!idValido(viagemId)) return { ok: false, erro: NAO_ACHADA };
  const just = textoLimpo(justificativa);
  if (just.length > 1000) return { ok: false, erro: "A justificativa tem até 1000 caracteres." };
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("iniciar_viagem", just ? { p_viagem: viagemId, p_justificativa: just } : { p_viagem: viagemId });
    if (error) throw error;
    revalidarViagem(viagemId);
  });
}

/** Cancela a viagem (`cancelar_viagem`): planejada ou até "Aguardando NF e pagamento", com motivo. */
export async function cancelarViagem(viagemId: string, motivo: string): Promise<ResultadoAcao> {
  if (!idValido(viagemId)) return { ok: false, erro: NAO_ACHADA };
  const m = textoLimpo(motivo);
  if (!m) return { ok: false, erro: "Informe o motivo do cancelamento." };
  if (m.length > 500) return { ok: false, erro: "O motivo tem até 500 caracteres." };
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("cancelar_viagem", { p_viagem: viagemId, p_motivo: m });
    if (error) throw error;
    revalidarViagem(viagemId);
  });
}

/** Saldo de 30% pago (`confirmar_saldo`, motor de despacho): admin, operação ou financeiro, em "Aguardando saldo". */
export async function confirmarSaldo(viagemId: string): Promise<ResultadoAcao> {
  if (!idValido(viagemId)) return { ok: false, erro: NAO_ACHADA };
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("confirmar_saldo", { p_viagem: viagemId });
    if (error) throw error;
    revalidarViagem(viagemId);
  });
}

/** Adiantamento e vale-pedágio resolvidos (`confirmar_pagamento_saida`): admin, operação ou financeiro. */
export async function confirmarPagamentoSaida(viagemId: string): Promise<ResultadoAcao> {
  if (!idValido(viagemId)) return { ok: false, erro: NAO_ACHADA };
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase).rpc("confirmar_pagamento_saida", { p_viagem: viagemId });
    if (error) throw error;
    revalidarViagem(viagemId);
  });
}

/** Frete do motorista, km e pedágio da viagem planejada (o banco também recusa depois do início:
   gatilho `frete_so_planejada`). */
export async function salvarFreteViagem(_antes: ResultadoForm<null> | null, form: FormData): Promise<ResultadoForm<null>> {
  const v = esquemaFreteViagem.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const { viagem_id, ...dados } = v.data;
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase)
      .from("viagem")
      .update(dados)
      .eq("id", viagem_id)
      .is("status_campo", null)
      .is("cancelada_em", null)
      .select("id");
    if (r.error) throw r.error;
    if (!r.data.length) throw recusa("O frete só muda enquanto a viagem está Planejada. Atualize a página.");
    revalidarViagem(viagem_id);
    return null;
  });
}

/** Nome, tipo e tamanho do arquivo escolhido (o arquivo em si fica no navegador). */
function metadados(form: FormData, prefixo: string): { nome: string; mime: string; tamanho: number } | null {
  const f = form.get(prefixo === "" ? "arquivo" : `${prefixo}arquivo`);
  if (f && typeof f === "object" && "size" in f && f.size > 0) return { nome: f.name, mime: f.type, tamanho: f.size };
  const nome = textoLimpo(form.get(`${prefixo}nome`));
  if (!nome) return null;
  return { nome, mime: textoLimpo(form.get(`${prefixo}mime`)), tamanho: Number(form.get(`${prefixo}tamanho`)) };
}

async function registrarArquivo(viagemId: string, tipo: number, m: { nome: string; mime: string; tamanho: number }) {
  return prepararEnvio({
    viagemId,
    tipoArquivoId: tipo,
    nome: m.nome,
    mime: m.mime as DadosEnvio["mime"],
    tamanho: m.tamanho,
    validade: null,
    numero: null,
    restrito: false,
  });
}

/**
 * Registra o canhoto da viagem: grava a linha de `arquivo` (tipo CANHOTO, dono viagem) e devolve o
 * caminho `viagem/<viagem_id>/<arquivo_id>-<nome>` onde o navegador envia o objeto (use
 * `enviarCanhotoDoNavegador` de `./envio.ts`, que faz os dois passos). `form`: `nome`, `mime` e
 * `tamanho` do arquivo escolhido.
 */
export async function enviarCanhoto(viagemId: string, form: FormData): Promise<ResultadoAcao<string>> {
  if (!idValido(viagemId)) return { ok: false, erro: NAO_ACHADA };
  const m = metadados(form, "");
  if (!m) return { ok: false, erro: "Escolha o arquivo do canhoto antes de enviar." };
  const r = await registrarArquivo(viagemId, TIPO_CANHOTO, m);
  if (!r.ok) return r;
  revalidarViagem(viagemId);
  return { ok: true, dados: r.dados.caminho };
}

export type OcorrenciaRegistrada = {
  id: string;
  /** Caminho onde o navegador envia a foto (arquivo OUTROS da viagem); nulo sem foto. */
  caminhoFoto: string | null;
  /** A ocorrência foi gravada, mas a linha da foto não: o motivo. */
  erroFoto: string | null;
};

/** Registra uma ocorrência (tipo, descrição) e, se houver foto, a linha de `arquivo` OUTROS da viagem.
   `form`: `viagem_id`, `tipo`, `descricao` e, para a foto, `foto_nome`, `foto_mime`, `foto_tamanho`. */
export async function registrarOcorrencia(
  _antes: ResultadoForm<OcorrenciaRegistrada> | null,
  form: FormData,
): Promise<ResultadoForm<OcorrenciaRegistrada>> {
  const v = esquemaOcorrencia.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const foto = metadados(form, "foto_");
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("viagem_ocorrencia").insert(v.data).select("id").single();
    if (r.error) throw r.error;
    let caminhoFoto: string | null = null;
    let erroFoto: string | null = null;
    if (foto) {
      const a = await registrarArquivo(v.data.viagem_id, TIPO_OUTROS, foto);
      if (a.ok) caminhoFoto = a.dados.caminho;
      else erroFoto = a.erro;
    }
    revalidarViagem(v.data.viagem_id);
    return { id: r.data.id, caminhoFoto, erroFoto };
  });
}

/** Resolve a ocorrência com o texto da resolução (quem e quando ficam gravados). Só a que ainda está aberta. */
export async function resolverOcorrencia(ocorrenciaId: string, resolucao: string): Promise<ResultadoAcao> {
  if (!idValido(ocorrenciaId)) return { ok: false, erro: "Ocorrência não encontrada. Atualize a página." };
  const texto = textoLimpo(resolucao);
  if (!texto) return { ok: false, erro: "Descreva como a ocorrência foi resolvida." };
  if (texto.length > 2000) return { ok: false, erro: "A resolução tem até 2000 caracteres." };
  return comSessao(async ({ supabase, userId }) => {
    const db = tipado(supabase);
    const r = await db
      .from("viagem_ocorrencia")
      .update({ resolucao: texto, resolvida_em: new Date().toISOString(), resolvida_por: userId })
      .eq("id", ocorrenciaId)
      .is("resolvida_em", null)
      .select("id, viagem_id");
    if (r.error) throw r.error;
    if (!r.data?.length) {
      const atual = await db.from("viagem_ocorrencia").select("resolvida_em").eq("id", ocorrenciaId).maybeSingle();
      if (atual.error) throw atual.error;
      if (!atual.data) throw recusa("Ocorrência não encontrada. Atualize a página.");
      if (atual.data.resolvida_em) throw recusa("Esta ocorrência já foi resolvida. Atualize a página para ver a resolução.");
      throw SEM_PERMISSAO;
    }
    revalidarViagem(r.data[0].viagem_id);
  });
}
