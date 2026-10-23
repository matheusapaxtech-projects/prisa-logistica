import type { Metadata } from "next";
import Link from "next/link";
import { getPerfil, pode } from "@/lib/permissoes";
import { validacao } from "@/lib/validacao";
import { FormularioNovo } from "./formulario-novo";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Novo cliente" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/* `?tipo=pj&cnpj=…` ou `?tipo=pf&cpf=…`: vindo da ficha de quem ainda não é cliente. */
export default async function NovoClientePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
            <Link href="/clientes">Clientes</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Novo cliente</h1>
          </nav>
          <p className="sub">Comece pelo documento. Se a empresa ou a pessoa já estiver no NILT, você só liga o papel de cliente a ela.</p>
        </div>
      </div>
      {pode(perfil, "editar") ? (
        <FormularioNovo tipoInicial={tipo} documentoInicial={documento} />
      ) : (
        <div className="vazio-bloco" role="alert">
          Seu papel não permite cadastrar clientes. Peça a um administrador ou à operação.
          <Link className="btn btn-texto" href="/clientes">
            Voltar para a lista
          </Link>
        </div>
      )}
    </main>
  );
}
