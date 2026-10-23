import type { Metadata } from "next";
import Link from "next/link";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { validacao } from "@/lib/validacao";
import { idTipoArquivo } from "../consultas";
import { FormularioNovo } from "./formulario-novo";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/motoristas.css";

export const metadata: Metadata = { title: "Novo motorista" };

export default async function NovoMotoristaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cpf = validacao.soDigitos(Array.isArray(sp.cpf) ? sp.cpf[0] : sp.cpf);
  const [perfil, tipoCnhId] = await Promise.all([getPerfil(), idTipoArquivo(tipado(await createClient()), "CNH")]);

  return (
    <main className="novo">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/motoristas">Motoristas</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Novo motorista</h1>
          </nav>
          <p className="sub">Comece pelo CPF. O NILT confere se a pessoa já está cadastrada antes de criar outra.</p>
        </div>
      </div>
      {pode(perfil, "editar") ? (
        <FormularioNovo cpfInicial={cpf.length === 11 ? cpf : ""} tipoCnhId={tipoCnhId} />
      ) : (
        <div className="vazio-bloco" role="alert">
          Seu papel não permite cadastrar motoristas. Peça a um administrador ou à operação.
          <Link className="btn btn-texto" href="/motoristas">
            Voltar para a lista
          </Link>
        </div>
      )}
    </main>
  );
}
