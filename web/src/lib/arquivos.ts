/* Caminho dos documentos no bucket `documentos` (convenção da migration 0800 e do
   "Fluxo canônico de upload" em supabase/tests/README.md):
   pessoa/<pessoa_id>/<arquivo_id>-<nome> ou veiculo/<veiculo_id>/<arquivo_id>-<nome>. */

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

/** MIME pelo nome quando o navegador não informa (HEIC costuma vir vazio). */
export function mimeDoArquivo(nome: string, tipo: string): string {
  if (tipo) return tipo;
  const ext = nome.toLowerCase().split(".").pop();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "heic" ? "image/heic" : "image/jpeg";
}
