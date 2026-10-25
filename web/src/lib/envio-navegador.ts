/* Arquivos do bucket "documentos" pelo navegador (só Client Components):
   - `enviarObjeto`: passo 3 do "Fluxo canônico de upload" (supabase/tests/README.md): a linha de
     `arquivo` já foi gravada por uma Server Action, que devolveu o caminho;
   - `abrirEmNovaJanela`: abrir um documento (registra a visualização e usa o link de 60 s);
   - `useReenvio`: o "Enviar de novo" de uma linha cujo objeto não chegou ao Storage.
   Usados pela lista de documentos (documentos-cliente.tsx) e pelo canhoto da viagem. */
import { useRef, useState, type TransitionStartFunction } from "react";
import { abrirDocumento } from "@/components/documentos-acoes";
import { toast } from "@/components/Toast";
import type { ResultadoAcao } from "@/lib/acao";
import { erroDoArquivo, mimeDoArquivo } from "@/lib/arquivos";
import { createBrowserClient } from "@/lib/supabase/client";

/** Envia o objeto ao caminho já registrado em `arquivo` (sem sobrescrever). Objeto já existente conta como enviado. */
export async function enviarObjeto(caminho: string, arquivo: File): Promise<boolean> {
  const { error } = await createBrowserClient()
    .storage.from("documentos")
    .upload(caminho, arquivo, { upsert: false, contentType: mimeDoArquivo(arquivo.name, arquivo.type) });
  return !error || /exists|duplicate/i.test(error.message);
}

/**
 * Abre o documento numa janela nova. Chame direto no clique: a janela abre na hora (senão o navegador
 * bloqueia) e recebe o link quando ele chega (`abrirDocumento` registra a visualização). Com erro, a
 * janela fecha e o resultado traz a frase da tela.
 */
export function abrirEmNovaJanela(arquivoId: string): Promise<ResultadoAcao<string>> {
  const janela = window.open("", "_blank");
  return abrirDocumento(arquivoId).then((r) => {
    if (!r.ok) {
      janela?.close();
      return r;
    }
    if (janela) {
      janela.opener = null;
      janela.location.href = r.dados;
    } else window.open(r.dados, "_blank", "noopener");
    return r;
  });
}

/**
 * "Enviar de novo": `escolher(linha)` abre a escolha de arquivo; `aoEscolher` (no onChange do
 * `<input type="file" ref={campo} hidden>`) confere o arquivo e o envia ao caminho já registrado.
 * Erros viram toast (`msgFalha` quando o objeto não chega); `aoEnviar` roda depois de enviar.
 */
export function useReenvio<T extends { caminho: string }>(o: {
  iniciar: TransitionStartFunction;
  msgFalha: string;
  aoEnviar: (arquivo: File) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<T | null>(null);

  function escolher(linha: T) {
    setAlvo(linha);
    campo.current?.click();
  }

  function aoEscolher(arquivo: File | undefined) {
    const a = alvo;
    if (campo.current) campo.current.value = "";
    if (!a || !arquivo) return;
    const erro = erroDoArquivo(arquivo);
    if (erro) return toast(erro, "alert-circle");
    o.iniciar(async () => {
      const ok = await enviarObjeto(a.caminho, arquivo);
      setAlvo(null);
      if (!ok) return toast(o.msgFalha, "alert-circle");
      o.aoEnviar(arquivo);
    });
  }

  return { campo, escolher, aoEscolher };
}
