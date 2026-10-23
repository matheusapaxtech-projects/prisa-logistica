/* Envio de arquivos da viagem pelo navegador (só Client Components: a ficha e, na Task 10, o diálogo
   de chegada do Quadro). Ordem do "Fluxo canônico de upload": a Server Action grava a linha de
   `arquivo` e devolve o caminho; aqui o navegador envia o objeto para esse caminho. O arquivo não
   passa pela Server Action (limite de corpo da requisição). */
import type { ResultadoAcao } from "@/lib/acao";
import { erroDoArquivo, mimeDoArquivo } from "@/lib/arquivos";
import { enviarObjeto } from "@/lib/envio-navegador";
import { enviarCanhoto } from "./actions";

export const MSG_FALHA_ENVIO_CANHOTO =
  "O arquivo do canhoto não chegou ao armazenamento. Ele ficou marcado como “envio falhou” na ficha da viagem: use “Enviar de novo”.";
export const MSG_FALHA_ENVIO_FOTO =
  "A ocorrência foi registrada, mas a foto não chegou ao armazenamento. Ela ficou marcada como “envio falhou” em Arquivos da viagem: use “Enviar de novo”.";

/** Nome, tipo e tamanho do arquivo, no FormData que `enviarCanhoto` espera (`prefixo` "foto_" para a ocorrência). */
export function metadadosDoArquivo(arquivo: File, prefixo = ""): FormData {
  const fd = new FormData();
  fd.set(`${prefixo}nome`, arquivo.name);
  fd.set(`${prefixo}mime`, mimeDoArquivo(arquivo.name, arquivo.type));
  fd.set(`${prefixo}tamanho`, String(arquivo.size));
  return fd;
}

/** Registra e envia o canhoto da viagem. Devolve o caminho no Storage; erro com a frase da tela. */
export async function enviarCanhotoDoNavegador(viagemId: string, arquivo: File | null | undefined): Promise<ResultadoAcao<string>> {
  const erro = erroDoArquivo(arquivo);
  if (erro || !arquivo) return { ok: false, erro: erro ?? "Escolha o arquivo antes de enviar." };
  const r = await enviarCanhoto(viagemId, metadadosDoArquivo(arquivo));
  if (!r.ok) return r;
  if (!(await enviarObjeto(r.dados, arquivo))) return { ok: false, erro: MSG_FALHA_ENVIO_CANHOTO };
  return r;
}
