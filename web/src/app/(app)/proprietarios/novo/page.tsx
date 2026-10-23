import type { Metadata } from "next";
import Link from "next/link";
import { getPerfil, pode } from "@/lib/permissoes";
import { validacao } from "@/lib/validacao";
import { FormularioNovo } from "./formulario-novo";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Novo proprietário" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/* `?tipo=pf&cpf=…` ou `?tipo=pj&cnpj=…`: vindo da ficha de quem ainda não é proprietário. */
export default async function NovoProprietarioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  const t = um(sp.tipo);
  const tipo = t === "pf" || t === "pj" ? t : null;
  const doc = tipo ? validacao.soDigitos(um(tipo === "pf" ? sp.cpf : sp.cnpj)) : "";
  const documento = (tipo === "pf" && doc.length === 11) || (tipo === "pj" && doc.length === 14) ? doc : "";

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/proprietarios">Proprietários</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Novo proprietário</h1>
          </nav>
          <p className="sub">Comece pelo tipo e pelo documento. Se a pessoa já estiver no NILT, você só liga o papel de proprietário a ela.</p>
        </div>
      </div>
      {pode(perfil, "editar") ? (
        <FormularioNovo tipoInicial={tipo} documentoInicial={documento} />
      ) : (
        <div className="vazio-bloco" role="alert">
          Seu papel não permite cadastrar proprietários. Peça a um administrador ou à operação.
          <Link className="btn btn-texto" href="/proprietarios">
            Voltar para a lista
          </Link>
        </div>
      )}
    </main>
  );
}
