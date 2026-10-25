import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { rotuloDe } from "@/lib/quadro";
import { createClient } from "@/lib/supabase/server";
import { Dash } from "../_pessoa/partes";
import { listarViagens, type LinhaViagem } from "./consultas";
import { BarraFiltros } from "./barra-filtros";
import { filtrarViagens, filtrosLigados, hrefDaAba, hrefDe, hrefSemFiltros, lerFiltros, numerosDePagina, opcoesDaAba, paginar, POR_PAGINA } from "./filtros";
import { ABAS, abaDaViagem, duracao, seloAptidao, type AbaViagens } from "./regras";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/viagens.css";

export const metadata: Metadata = { title: "Viagens" };

const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

const VAZIO: Record<AbaViagens, string> = {
  planejadas: "Nenhuma viagem planejada. Crie viagens na ficha do pedido (“Nova viagem”).",
  no_quadro: "Nenhuma viagem em andamento no Quadro.",
  finalizadas: "Nenhum frete finalizado ainda.",
  canceladas: "Nenhuma viagem cancelada.",
};

const ROTULO_DATA: Record<AbaViagens, string> = {
  planejadas: "Criada em",
  no_quadro: "Na coluna",
  finalizadas: "Finalizada em",
  canceladas: "Cancelada em",
};

function Situacao({ v, aba }: { v: LinhaViagem; aba: AbaViagens }) {
  if (aba === "planejadas") {
    const s = seloAptidao({ travas: v.travas ?? 0, avisos: v.avisos ?? 0 });
    return <Sinal tipo={s.tipo} texto={s.texto} />;
  }
  if (aba === "canceladas") return <Sinal situacao="cancelado" texto="Cancelada" />;
  if (aba === "finalizadas") return <Sinal tipo="normal" texto="Frete finalizado" />;
  return <Sinal tipo={v.status_campo === "pausa" ? "pendente" : "info"} texto={rotuloDe(v.status_campo)} />;
}

function Data({ v, aba }: { v: LinhaViagem; aba: AbaViagens }) {
  if (aba === "planejadas") return <>{formato.dataHora(v.criadaEm)}</>;
  if (aba === "canceladas") return v.cancelada_em ? <>{formato.dataHora(v.cancelada_em)}</> : <Dash />;
  if (aba === "finalizadas") return v.finalizadaEm ? <>{formato.dataHora(v.finalizadaEm)}</> : <Dash />;
  return v.statusDesde ? (
    <>
      {duracao(v.statusDesde)}
      <span className="linha2">desde {formato.dataHora(v.statusDesde)}</span>
    </>
  ) : (
    <Dash />
  );
}

/* Lista de viagens: abas "Planejadas" (com o selo de aptidão), "No quadro" (em andamento),
   "Finalizadas" e "Canceladas"; filtros, ordem e página na URL (filtros.ts): busca por número da
   viagem ou do pedido, cliente, motorista, placa ou cidade; cliente, motorista, origem, destino,
   situação e período. 25, 50 ou 100 por página. */
export default async function ViagensPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = lerFiltros(await searchParams);
  const { aba } = f;
  const linhas = await listarViagens(tipado(await createClient()));

  const porAba = Object.fromEntries(ABAS.map((a) => [a, linhas.filter((l) => abaDaViagem(l) === a)])) as Record<AbaViagens, LinhaViagem[]>;
  const achadas = filtrarViagens(linhas, f);
  const pag = paginar(achadas, f.pagina, f.porPagina);
  const vis = pag.itens;
  const comFiltro = filtrosLigados(f) > 0 || Boolean(f.q);

  const comTrava = porAba.planejadas.filter((l) => (l.travas ?? 0) > 0).length;
  const aptas = porAba.planejadas.length - comTrava;
  const achado = [
    `${porAba.planejadas.length} ${plural(porAba.planejadas.length, "planejada", "planejadas")}`,
    ...(porAba.planejadas.length ? [`${aptas} ${plural(aptas, "apta", "aptas")}`, `${comTrava} com trava`] : []),
    `${porAba.no_quadro.length} no Quadro`,
  ];

  return (
    <main className="prop ped via">
      <div className="titulo">
        <div>
          <h1>Viagens</h1>
          <p className="sub" id="achado">
            {achado.map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        <div className="acoes">
          <Link className="btn" href="/quadro">
            Abrir o Quadro
          </Link>
        </div>
      </div>

      <Abas
        rotulo="Situação das viagens"
        ativa={aba}
        abas={[
          { id: "planejadas", rotulo: "Planejadas", n: porAba.planejadas.length, href: hrefDaAba(f, "planejadas") },
          { id: "no_quadro", rotulo: "No quadro", n: porAba.no_quadro.length, href: hrefDaAba(f, "no_quadro") },
          { id: "finalizadas", rotulo: "Finalizadas", n: porAba.finalizadas.length, href: hrefDaAba(f, "finalizadas") },
          { id: "canceladas", rotulo: "Canceladas", n: porAba.canceladas.length, href: hrefDaAba(f, "canceladas") },
        ]}
      />

      <BarraFiltros filtros={f} opcoes={opcoesDaAba(linhas, f)} rotuloData={ROTULO_DATA[aba]} achadas={achadas.length} daAba={porAba[aba].length} />

      <div className="tabela-wrap">
        <table className="tabela tabela-prop" id="tabela" aria-describedby="total">
          <thead>
            <tr>
              <th className="col-num" scope="col">
                Nº
              </th>
              <th scope="col">Pedido e cliente</th>
              <th scope="col">Cavalo e motorista</th>
              <th className="some-celular" scope="col">
                Origem → destino
              </th>
              <th scope="col">Situação</th>
              <th className="num some-tablet" scope="col">
                {ROTULO_DATA[aba]}
              </th>
            </tr>
          </thead>
          <tbody id="linhas">
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={6}>
                  <EstadoVazio>
                    {comFiltro ? (
                      <>
                        {f.q
                          ? `Nenhuma viagem com “${f.q}” e esses filtros nesta aba. Confira o número, o cliente ou a placa.`
                          : "Nenhuma viagem com esses filtros nesta aba."}{" "}
                        <Link href={hrefSemFiltros(f)} scroll={false}>
                          Limpar filtros
                        </Link>
                      </>
                    ) : (
                      VAZIO[aba]
                    )}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link className="id" href={`/viagens/${v.id}`} aria-label={`Viagem ${v.numero}`}>
                      #{v.numero}
                    </Link>
                  </td>
                  <td>
                    {v.pedido ? (
                      <>
                        {v.pedido.cliente}
                        <span className="linha2">
                          Pedido #{v.pedido.numero}
                          <span className="p-cel">
                            <Ponto />
                            {v.pedido.origem} → {v.pedido.destino}
                          </span>
                        </span>
                      </>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td>
                    <span className="viagem-cel">{v.placa ? <Placa placa={v.placa} /> : <Dash />}</span>
                    <span className="linha2">{v.motorista ?? "—"}</span>
                  </td>
                  <td className="some-celular">
                    {v.pedido ? (
                      <span className="rota">
                        {v.pedido.origem}
                        <span className="seta" aria-label="para">
                          →
                        </span>
                        {v.pedido.destino}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td>
                    <Situacao v={v} aba={aba} />
                  </td>
                  <td className="num data some-tablet">
                    <Data v={v} aba={aba} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginacao
        pagina={pag.pagina}
        paginas={pag.paginas}
        inicio={pag.inicio}
        fim={pag.fim}
        total={pag.total}
        plural="viagens"
        numeros={numerosDePagina(pag.pagina, pag.paginas)}
        href={(p) => hrefDe(f, { pagina: p })}
        porPagina={f.porPagina}
        porPaginaHrefs={Object.fromEntries(POR_PAGINA.map((n) => [n, `/viagens${hrefDe(f, { porPagina: n })}`]))}
      />
    </main>
  );
}
