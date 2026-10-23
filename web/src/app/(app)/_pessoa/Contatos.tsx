import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarContatos } from "./consultas";
import { ContatosPainel, type TextosContatos } from "./contatos-cliente";

type Props = {
  pessoaId: string;
  /** Pode incluir (normalmente `pode(perfil, "editar")`: admin e operação). */
  podeEditar: boolean;
  /** Caminhos a revalidar depois de gravar (ex.: [`/motoristas/${id}`, "/motoristas"]). */
  revalidar: string[];
  /** Frases das listas vazias (cada ficha tem a sua). */
  textos?: Partial<TextosContatos>;
};

const TEXTOS: TextosContatos = {
  enderecos: "Nenhum endereço cadastrado.",
  telefones: "Nenhum telefone cadastrado.",
  emails: "Nenhum e-mail cadastrado.",
};

/* Aba Contatos de uma pessoa (endereços, telefones, e-mails), para as fichas de motorista e de
   proprietário. Telefone restrito só aparece para o administrador. */
export async function Contatos({ pessoaId, podeEditar, revalidar, textos }: Props) {
  const [perfil, dados] = await Promise.all([getPerfil(), carregarContatos(tipado(await createClient()), pessoaId)]);
  const admin = pode(perfil, "admin");
  return (
    <ContatosPainel
      pessoaId={pessoaId}
      enderecos={dados.enderecos}
      telefones={admin ? dados.telefones : dados.telefones.filter((t) => !t.restrito)}
      emails={dados.emails}
      podeEditar={podeEditar}
      revalidar={revalidar}
      textos={{ ...TEXTOS, ...textos }}
    />
  );
}
