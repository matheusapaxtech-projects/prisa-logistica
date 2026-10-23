/* Tipos e funções puras dos seletores de pessoa (servem a Server e Client Components). */
export type TipoPessoaDoc = "pf" | "pj";

/** Uma pessoa/empresa nas opções de proprietário ou motorista, com o que o cartão da ficha mostra. */
export type OpcaoPessoa = {
  id: string;
  /** Nome curto (fantasia, se for empresa). */
  nome: string;
  nomeCompleto: string;
  tipo: TipoPessoaDoc;
  /** CPF ou CNPJ já formatado. */
  doc: string;
  situacao_cadastro: string;
  rntrc: string | null;
  enquadramento: string | null;
  rntrc_validade: string | null;
};

export function nomeCurto(p: { nome: string; nome_fantasia?: string | null; tipo: string } | null | undefined): string {
  if (!p) return "—";
  return p.tipo === "pj" ? p.nome_fantasia || p.nome : p.nome;
}

export function um<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}
