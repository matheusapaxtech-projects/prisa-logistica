import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { validacao } from "@/lib/validacao";
import { listarClientes, type LinhaCliente } from "./consultas";
import { CONDICOES } from "./regras";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Clientes" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const docDe = (l: LinhaCliente) => (l.tipo === "pj" ? formato.cnpj(l.documento) : formato.cpf(l.documento));

/** "4 clientes · 1 exige GR · 2 sem local de coleta ou descarga": o que pede atenção na lista. */
function achado(linhas: LinhaCliente[]): string[] {
  const gr = linhas.filter((l) => l.exigeGr).length;
  const semLocal = linhas.filter((l) => !l.locais).length;
  const partes = [`${linhas.length} ${plural(linhas.length, "cliente", "clientes")}`];
  if (gr) partes.push(`${gr} ${plural(gr, "exige", "exigem")} GR`);
  if (semLocal) partes.push(`${semLocal} sem local de coleta ou descarga`);
  return partes;
}

function passa(l: LinhaCliente, termo: string): boolean {
  if (!termo) return true;
  const t = termo.toLowerCase();
  const dig = validacao.soDigitos(t);
  return (
    l.nome.toLowerCase().includes(t) ||
    (l.nomeFantasia ?? "").toLowerCase().includes(t) ||
    l.cidades.some((c) => c.toLowerCase().includes(t)) ||
    (dig.length >= 3 && l.documento.includes(dig))
  );
}

/* Lista de clientes: busca pela URL (?q=), uma linha por cliente com faturamento, exigências e locais. */
export default async function ClientesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [perfil, linhas] = await Promise.all([getPerfil(), listarClientes(tipado(await createClient()))]);
  const busca = um(sp.q).trim();
  const vis = linhas.filter((l) => passa(l, busca));

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <h1>Clientes</h1>
          <p className="sub" id="achado">
            {achado(linhas).map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        {pode(perfil, "editar") && (
          <div className="acoes">
            <Link className="btn btn-primario" href="/clientes/novo">
              <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              Novo cliente
            </Link>
          </div>
        )}
      </div>

      <form className="ferramentas" role="search" method="get">
        <label className="busca-lista">
          <span className="sr-only">Buscar por nome, nome fantasia, cidade, CPF ou CNPJ</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Nome, fantasia, cidade, CPF ou CNPJ" defaultValue={busca} />
        </label>
        <span className="total" id="total" aria-live="polite">
          {vis.length} {plural(vis.length, "cliente", "clientes")}
        </span>
      </form>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop" id="tabela" aria-describedby="total">
          <thead>
            <tr>
              <th className="col-prop" scope="col">
                Cliente
              </th>
              <th className="col-doc some-tablet" scope="col">
                Documento
              </th>
              <th className="some-celular" scope="col">
                Faturamento
              </th>
              <th className="some-celular" scope="col">
                Exigências
              </th>
              <th className="num" scope="col">
                Locais
              </th>
            </tr>
          </thead>
          <tbody id="linhas">
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={5}>
                  <EstadoVazio>
                    {busca
                      ? `Nenhum cliente com “${busca}”. Confira o nome, a cidade ou os dígitos do documento.`
                      : "Nenhum cliente cadastrado. Comece pelo botão “Novo cliente”."}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link className="id" href={`/clientes/${l.id}`}>
                      {l.nomeFantasia || l.nome}
                    </Link>
                    <span className="linha2">
                      {l.nomeFantasia ? l.nome : l.tipo === "pj" ? "empresa" : "pessoa física"}
                      <span className="p-estreito">
                        <Ponto />
                        <span className="cod" style={{ fontSize: 12 }}>
                          {docDe(l)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="some-tablet">
                    <span className="cod">{docDe(l)}</span>
                  </td>
                  <td className="some-celular">{CONDICOES[l.condicao]}</td>
                  <td className="some-celular">
                    {!l.exigeGr && !l.exigeSm ? (
                      <span className="dash">—</span>
                    ) : (
                      <span>
                        {l.exigeGr && <Sinal tipo="info" texto={l.gerenciadora ? `GR: ${l.gerenciadora}` : "Exige GR"} />}{" "}
                        {l.exigeSm && <Sinal tipo="info" texto="Exige SM" />}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {l.locais ? (
                      <>
                        <b>{l.locais}</b>
                        <span className="linha2">
                          {l.cidades.slice(0, 2).join(", ")}
                          {l.cidades.length > 2 && ` e mais ${l.cidades.length - 2}`}
                        </span>
                      </>
                    ) : (
                      <Sinal situacao="pendente" texto="Sem local" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
