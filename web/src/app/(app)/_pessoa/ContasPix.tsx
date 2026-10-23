import { tipado } from "@/lib/banco";
import { createClient } from "@/lib/supabase/server";
import { carregarContas } from "./consultas";
import { ContasPainel, type Quem, type TextosContas } from "./contas-cliente";

type Props = {
  pessoaId: string;
  /** Nome da pessoa (favorecido sugerido) e documento só com dígitos (CPF ou CNPJ). */
  nome: string;
  documento: string;
  quem: Quem;
  /** Pode incluir conta e Pix: `pode(perfil, "editarFinanceiro")` (admin, operação e financeiro). */
  podeEditarFinanceiro: boolean;
  /** Caminhos a revalidar depois de gravar. */
  revalidar: string[];
  textos?: Partial<TextosContas>;
};

const TEXTOS: TextosContas = {
  contas: "Nenhuma conta cadastrada. Sem conta, o frete não tem para onde ir.",
  pix: "Nenhuma chave Pix cadastrada.",
};

/* Aba Contas e Pix de uma pessoa (motorista ou proprietário). */
export async function ContasPix({ pessoaId, nome, documento, quem, podeEditarFinanceiro, revalidar, textos }: Props) {
  const dados = await carregarContas(tipado(await createClient()), pessoaId);
  return (
    <ContasPainel
      pessoaId={pessoaId}
      nome={nome}
      documento={documento}
      quem={quem}
      contas={dados.contas}
      pix={dados.pix}
      bancos={dados.bancos}
      podeEditar={podeEditarFinanceiro}
      revalidar={revalidar}
      textos={{ ...TEXTOS, ...textos }}
    />
  );
}
