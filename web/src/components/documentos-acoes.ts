"use server";

import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { caminhoArquivo, LIMITE_BYTES } from "@/lib/arquivos";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";

/* Ações dos documentos (bucket privado "documentos"). Toda escrita passa por `comSessao`.
   Ordem do upload (supabase/tests/README.md, "Fluxo canônico de upload"): a linha de `arquivo` é
   gravada antes do objeto; o navegador envia o objeto para o caminho devolvido por `prepararEnvio`. */

// guid (formato 8-4-4-4-12 sem exigir versão/variante): as seeds usam ids fora da RFC.
const ID = z.guid();
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };

const MSG_JA_CONFERIDO = "Este documento já foi conferido. Atualize a página para ver quem conferiu.";
const MSG_ARQUIVO_AUSENTE =
  "Este documento não está no armazenamento: o envio não terminou. Use “Enviar de novo”.";

/** Registra a visualização (`registrar_visualizacao`, exigido pela LGPD) e devolve um link de 60 s. */
export async function abrirDocumento(arquivoId: string): Promise<ResultadoAcao<string>> {
  if (!ID.safeParse(arquivoId).success) return { ok: false, erro: "Documento não encontrado." };
  const r = await comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const { error: erroVis } = await db.rpc("registrar_visualizacao", { p_arquivo: arquivoId });
    if (erroVis) throw erroVis;
    const { data, error } = await db.from("arquivo").select("storage_path").eq("id", arquivoId).single();
    if (error) throw error;
    const link = await supabase.storage.from("documentos").createSignedUrl(data.storage_path, 60);
    return link.error || !link.data ? null : link.data.signedUrl;
  });
  if (r.ok && r.dados === null) return { ok: false, erro: MSG_ARQUIVO_AUSENTE };
  return r as ResultadoAcao<string>;
}

const Envio = z
  .object({
    pessoaId: ID.optional(),
    veiculoId: ID.optional(),
    viagemId: ID.optional(),
    tipoArquivoId: z.number().int().positive(),
    nome: z.string().trim().min(1).max(255),
    mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic"]),
    tamanho: z.number().int().min(0).max(LIMITE_BYTES),
    validade: z.iso.date().nullable(),
    numero: z.string().trim().max(60).nullable(),
    restrito: z.boolean(),
  })
  .refine((e) => [e.pessoaId, e.veiculoId, e.viagemId].filter(Boolean).length === 1, "um dono só");

export type DadosEnvio = z.input<typeof Envio>;

/** Grava a linha de `arquivo` (id gerado aqui) e devolve o caminho onde o navegador deve enviar o
   objeto. `restrito: true` só o administrador pode pedir: para os demais a ação recusa com
   "Só o administrador pode fazer isso." (não grava nada). Dono `viagemId`: o tipo precisa ser de
   viagem (`tipo_arquivo.aplica_viagem`: CANHOTO e OUTROS); o banco não confere tipo × dono. */
export async function prepararEnvio(dados: DadosEnvio): Promise<ResultadoAcao<{ id: string; caminho: string }>> {
  const v = Envio.safeParse(dados);
  if (!v.success) return { ok: false, erro: "Confira o tipo e o arquivo: envie PDF, JPG, PNG ou HEIC de até 20 MB." };
  const e = v.data;
  return comSessao(async ({ supabase }) => {
    const admin = pode(await getPerfil(), "admin");
    if (e.restrito && !admin) throw SEM_PERMISSAO;
    const db = tipado(supabase);
    if (e.viagemId) {
      const t = await db.from("tipo_arquivo").select("aplica_viagem").eq("id", e.tipoArquivoId).maybeSingle();
      if (t.error) throw t.error;
      if (!t.data?.aplica_viagem) throw { code: "P0001", message: "Este tipo de arquivo não é de viagem. Escolha Canhoto ou Outros." };
    }
    const id = crypto.randomUUID();
    const dono = e.pessoaId ? { pessoaId: e.pessoaId } : e.veiculoId ? { veiculoId: e.veiculoId } : { viagemId: e.viagemId! };
    const caminho = caminhoArquivo(dono, id, e.nome);
    const { error } = await db
      .from("arquivo")
      .insert({
        id,
        tipo_arquivo_id: e.tipoArquivoId,
        pessoa_id: e.pessoaId ?? null,
        veiculo_id: e.veiculoId ?? null,
        viagem_id: e.viagemId ?? null,
        storage_path: caminho,
        nome_original: e.nome,
        mime: e.mime,
        tamanho_bytes: e.tamanho,
        validade: e.validade,
        numero: e.numero || null,
        restrito: e.restrito,
      });
    if (error) throw error;
    return { id, caminho };
  }, { somenteAdmin: e.restrito });
}

/** Marca o documento como conferido por quem está logado (validado_em/validado_por). Só confere o
   que ainda não foi conferido: a primeira conferência fica (quem e quando). */
export async function conferirDocumento(arquivoId: string): Promise<ResultadoAcao<void>> {
  if (!ID.safeParse(arquivoId).success) return { ok: false, erro: "Documento não encontrado." };
  return comSessao(async ({ supabase, userId }) => {
    const db = tipado(supabase);
    const atual = await db.from("arquivo").select("validado_em").eq("id", arquivoId).maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data) throw { code: "P0001", message: "Documento não encontrado." };
    if (atual.data.validado_em) throw { code: "P0001", message: MSG_JA_CONFERIDO };
    const { data, error } = await db
      .from("arquivo")
      .update({ validado_em: new Date().toISOString(), validado_por: userId })
      .eq("id", arquivoId)
      .is("validado_em", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw SEM_PERMISSAO;
  });
}

/** Apaga o documento (só administrador): primeiro a linha, depois o objeto. Se a remoção do objeto
   falhar, ele fica invisível para quem não é admin (política fail-closed da migration 0801). */
export async function apagarDocumento(arquivoId: string): Promise<ResultadoAcao<void>> {
  if (!ID.safeParse(arquivoId).success) return { ok: false, erro: "Documento não encontrado." };
  return comSessao(
    async ({ supabase }) => {
      const { data, error } = await tipado(supabase).from("arquivo").delete().eq("id", arquivoId).select("storage_path");
      if (error) throw error;
      if (!data?.length) throw SEM_PERMISSAO;
      await supabase.storage.from("documentos").remove([data[0].storage_path]);
    },
    { somenteAdmin: true },
  );
}
