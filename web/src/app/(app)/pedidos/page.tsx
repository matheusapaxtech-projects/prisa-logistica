import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { listarPedidos, type LinhaPedido } from "./consultas";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";

export const metadata: Metadata = { title: "Pedidos" };

const ABAS = ["a_planejar", "atendidos", "cancelados"] as const;
type AbaPedidos = (typeof ABAS)[number];

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

/** Aba do pedido: aberto com saldo a carregar, aberto já todo alocado em viagens, ou cancelado. */
function abaDe(p: LinhaPedido): AbaPedidos {
  if (p.situacao === "cancelado") return "cancelados";
  return p.saldoKg > 0 ? "a_planejar" : "atendidos";
}

/** A planejar: a coleta mais próxima primeiro (sem data por último). As outras: o mais novo primeiro. */
function ordenar(aba: AbaPedidos, linhas: LinhaPedido[]): LinhaPedido[] {
  if (aba !== "a_planejar") return linhas;
  return [...linhas].sort((a, b) => {
    if (a.coletaPrevista !== b.coletaPrevista) {
      if (!a.coletaPrevista) return 1;
      if (!b.coletaPrevista) return -1;
      return a.coletaPrevista < b.coletaPrevista ? -1 : 1;
    }
    return a.numero - b.numero;
  });
}

function passa(p: LinhaPedido, termo: string): boolean {
  if (!termo) return true;
  const t = termo.toLowerCase().replace(/^#/, "");
  return (
    String(p.numero) === t ||
    p.tomador.toLowerCase().includes(t) ||
    p.produto.toLowerCase().includes(t) ||
    p.origem.toLowerCase().includes(t) ||
    p.destino.toLowerCase().includes(t)
  );
}

const VAZIO: Record<AbaPedidos, string> = {
  a_planejar: "Nenhum pedido esperando viagem. Pedido novo entra aqui até todo o peso estar em viagens.",
  atendidos: "Nenhum pedido com todo o peso já em viagens.",
  cancelados: "Nenhum pedido cancelado.",
};

/* Lista de pedidos: abas "A planejar" (aberto com saldo), "Atendidos" (aberto sem saldo) e
   "Cancelados"; busca pela URL (?q=) por número, tomador, produto ou cidade. */
export default async function PedidosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [perfil, linhas] = await Promise.all([getPerfil(), listarPedidos(tipado(await createClient()))]);
  const pedida = um(sp.aba) as AbaPedidos;
  const aba: AbaPedidos = ABAS.includes(pedida) ? pedida : "a_planejar";
  const busca = um(sp.q).trim();

  const porAba = Object.fromEntries(ABAS.map((a) => [a, linhas.filter((l) => abaDe(l) === a)])) as Record<AbaPedidos, LinhaPedido[]>;
  const vis = ordenar(aba, porAba[aba].filter((l) => passa(l, busca)));
  const aCarregar = porAba.a_planejar.reduce((s, l) => s + l.saldoKg, 0);
  const achado = [
    `${porAba.a_planejar.length} ${plural(porAba.a_planejar.length, "pedido a planejar", "pedidos a planejar")}`,
    ...(aCarregar > 0 ? [`${formato.kg(aCarregar)} a carregar`] : []),
  ];

  return (
    <main className="prop ped">
      <div className="titulo">
        <div>
          <h1>Pedidos</h1>
          <p className="sub" id="achado">
            {achado.map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        {pode(perfil, "editar") && (
          <div className="acoes">
            <Link className="btn btn-primario" href="/pedidos/novo">
              <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
              Novo pedido
            </Link>
          </div>
        )}
      </div>

      <Abas
        rotulo="Situação dos pedidos"
        ativa={aba}
        abas={[
          { id: "a_planejar", rotulo: "A planejar", n: porAba.a_planejar.length },
          { id: "atendidos", rotulo: "Atendidos", n: porAba.atendidos.length },
          { id: "cancelados", rotulo: "Cancelados", n: porAba.cancelados.length },
        ]}
      />

      <form className="ferramentas" role="search" method="get">
        <input type="hidden" name="aba" value={aba} />
        <label className="busca-lista">
          <span className="sr-only">Buscar por número, tomador, produto ou cidade</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Número, tomador, produto ou cidade" defaultValue={busca} />
        </label>
        <span className="total" id="total" aria-live="polite">
          {vis.length} {plural(vis.length, "pedido", "pedidos")}
        </span>
      </form>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop" id="tabela" aria-describedby="total">
          <thead>
            <tr>
              <th className="col-num" scope="col">
                Nº
              </th>
              <th scope="col">Tomador</th>
              <th className="some-celular" scope="col">
                Origem → destino
              </th>
              <th className="some-tablet" scope="col">
                Produto
              </th>
              <th className="num" scope="col">
                Peso total
              </th>
              <th className="num" scope="col">
                Saldo
              </th>
              <th className="num some-celular" scope="col">
                Coleta prevista
              </th>
            </tr>
          </thead>
          <tbody id="linhas">
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={7}>
                  <EstadoVazio>{busca ? `Nenhum pedido com “${busca}” nesta aba. Confira o número, o tomador ou a cidade.` : VAZIO[aba]}</EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="id" href={`/pedidos/${p.id}`} aria-label={`Pedido ${p.numero}`}>
                      #{p.numero}
                    </Link>
                  </td>
                  <td>
                    {p.tomador}
                    <span className="linha2 p-cel">
                      {p.origem} → {p.destino}
                    </span>
                  </td>
                  <td className="some-celular">
                    <span className="rota">
                      {p.origem}
                      <span className="seta" aria-label="para">
                        →
                      </span>
                      {p.destino}
                    </span>
                  </td>
                  <td className="some-tablet">{p.produto}</td>
                  <td className="num">{formato.kg(p.pesoTotalKg)}</td>
                  <td className={`num${p.saldoKg <= 0 ? " saldo-zero" : ""}`}>{formato.kg(p.saldoKg)}</td>
                  <td className="num data some-celular">{formato.data(p.coletaPrevista)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
