/* Envio do objeto ao bucket "documentos" pelo navegador (passo 3 do "Fluxo canônico de upload" em
   supabase/tests/README.md: a linha de `arquivo` já foi gravada por uma Server Action, que devolveu o
   caminho). Só para Client Components: usa o cliente Supabase do navegador, com a sessão do usuário. */
import { mimeDoArquivo } from "@/lib/arquivos";
import { createBrowserClient } from "@/lib/supabase/client";

/** Envia o objeto ao caminho já registrado em `arquivo` (sem sobrescrever). Objeto já existente conta como enviado. */
export async function enviarObjeto(caminho: string, arquivo: File): Promise<boolean> {
  const { error } = await createBrowserClient()
    .storage.from("documentos")
    .upload(caminho, arquivo, { upsert: false, contentType: mimeDoArquivo(arquivo.name, arquivo.type) });
  return !error || /exists|duplicate/i.test(error.message);
}
