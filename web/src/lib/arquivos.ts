/* Caminho dos documentos no bucket `documentos` (convenção da migration 0800 e do
   "Fluxo canônico de upload" em supabase/tests/README.md):
   pessoa/<pessoa_id>/<arquivo_id>-<nome> ou veiculo/<veiculo_id>/<arquivo_id>-<nome>. */
import { formato } from "@/lib/formato";

export type DonoArquivo = { pessoaId: string; veiculoId?: undefined } | { veiculoId: string; pessoaId?: undefined };

const MAX_NOME = 80;

/** Nome de arquivo seguro para o caminho: minúsculas, sem acento, só [a-z0-9.-], extensão preservada. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-*\.-*/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!limpo) return "arquivo";
  if (limpo.length <= MAX_NOME) return limpo;
  const ponto = limpo.lastIndexOf(".");
  const ext = ponto > 0 && limpo.length - ponto <= 8 ? limpo.slice(ponto) : "";
  return limpo.slice(0, MAX_NOME - ext.length).replace(/[-.]+$/, "") + ext;
}

export function caminhoArquivo(dono: DonoArquivo, arquivoId: string, nome: string): string {
  const pasta = dono.pessoaId ? `pessoa/${dono.pessoaId}` : `veiculo/${dono.veiculoId}`;
  return `${pasta}/${arquivoId}-${nomeSeguro(nome)}`;
}

/** Limite do bucket (20 MB) e tipos aceitos (migration 0800). */
export const LIMITE_BYTES = 20e6;
export const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/heic";

/** MIME pelo nome quando o navegador não informa (HEIC costuma vir vazio). Extensão desconhecida → "". */
export function mimeDoArquivo(nome: string, tipo: string): string {
  if (tipo) return tipo;
  const ext = nome.toLowerCase().split(".").pop();
  const MIME: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
  };
  return (ext && MIME[ext]) || "";
}

/** Confere um arquivo escolhido contra os limites do bucket (envio e "Enviar de novo").
   Nulo = pode enviar; senão a frase do erro (textos do protótipo). */
export function erroDoArquivo(arquivo: { name: string; size: number; type: string } | null | undefined): string | null {
  if (!arquivo || !arquivo.size) return "Escolha o arquivo antes de enviar.";
  if (arquivo.size > LIMITE_BYTES)
    return `O arquivo tem ${formato.kb(arquivo.size)}; o limite é 20 MB. Reduza ou envie em partes.`;
  if (!TIPOS_ACEITOS.split(",").includes(mimeDoArquivo(arquivo.name, arquivo.type)))
    return "Envie o arquivo em PDF, JPG, PNG ou HEIC.";
  return null;
}
