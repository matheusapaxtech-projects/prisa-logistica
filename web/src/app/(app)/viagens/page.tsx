import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { rotuloDe } from "@/lib/quadro";
import { createClient } from "@/lib/supabase/server";
import { Dash } from "../_pessoa/partes";
import { listarViagens, type LinhaViagem } from "./consultas";
import { ABAS, abaDaViagem, duracao, seloAptidao, type AbaViagens } from "./regras";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";
import "@/styles/paginas/viagens.css";

export const metadata: Metadata = { title: "Viagens" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

function passa(v: LinhaViagem, termo: string): boolean {
  if (!termo) return true;
  const t = termo.toLowerCase().replace(/^#/, "");
  const placa = t.replace(/[^a-z0-9]/g, "");
  return (
    String(v.numero) === t ||
    String(v.pedido?.numero ?? "") === t ||
    (v.pedido?.cliente ?? "").toLowerCase().includes(t) ||
    (v.motorista ?? "").toLowerCase().includes(t) ||
    (placa.length >= 3 && (v.placa ?? "").toLowerCase().includes(placa)) ||
    (v.pedido?.origem ?? "").toLowerCase().includes(t) ||
    (v.pedido?.destino ?? "").toLowerCase().includes(t)
  );
}

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

/* Lista de viagens: abas "Planejadas" (com o selo de aptidão; `?trava=1` mostra só as com trava),
   "No quadro" (em andamento), "Finalizadas" e "Canceladas"; busca pela URL (?q=) por número da viagem
   ou do pedido, cliente, motorista, placa ou cidade. */
export default async function ViagensPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const linhas = await listarViagens(tipado(await createClient()));
  const pedida = um(sp.aba) as AbaViagens;
  const aba: AbaViagens = ABAS.includes(pedida) ? pedida : "planejadas";
  const busca = um(sp.q).trim();
  const soTrava = aba === "planejadas" && um(sp.trava) === "1";

  const porAba = Object.fromEntries(ABAS.map((a) => [a, linhas.filter((l) => abaDaViagem(l) === a)])) as Record<AbaViagens, LinhaViagem[]>;
  let vis = porAba[aba].filter((l) => passa(l, busca));
  if (soTrava) vis = vis.filter((l) => (l.travas ?? 0) > 0);
  // Na coluna há mais tempo primeiro (como o Quadro); nas outras abas, a mais nova primeiro.
  if (aba === "no_quadro") vis = [...vis].sort((a, b) => (a.statusDesde ?? "").localeCompare(b.statusDesde ?? ""));

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
          { id: "planejadas", rotulo: "Planejadas", n: porAba.planejadas.length },
          { id: "no_quadro", rotulo: "No quadro", n: porAba.no_quadro.length },
          { id: "finalizadas", rotulo: "Finalizadas", n: porAba.finalizadas.length },
          { id: "canceladas", rotulo: "Canceladas", n: porAba.canceladas.length },
        ]}
      />

      <form className="ferramentas" role="search" method="get">
        <input type="hidden" name="aba" value={aba} />
        {soTrava && <input type="hidden" name="trava" value="1" />}
        <label className="busca-lista">
          <span className="sr-only">Buscar por número, pedido, cliente, motorista, placa ou cidade</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Número, cliente, motorista, placa ou cidade" defaultValue={busca} />
        </label>
        {aba === "planejadas" &&
          (soTrava ? (
            <Link className="btn btn-texto filtro-ativo" href={`?aba=planejadas${busca ? `&q=${encodeURIComponent(busca)}` : ""}`}>
              Só com trava
              <X size={14} strokeWidth={1.6} aria-label="tirar o filtro" />
            </Link>
          ) : (
            comTrava > 0 && (
              <Link className="btn btn-texto" href={`?aba=planejadas&trava=1${busca ? `&q=${encodeURIComponent(busca)}` : ""}`}>
                Ver só as com trava
              </Link>
            )
          ))}
        <span className="total" id="total" aria-live="polite">
          {vis.length} {plural(vis.length, "viagem", "viagens")}
        </span>
      </form>

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
                    {busca
                      ? `Nenhuma viagem com “${busca}” nesta aba. Confira o número, o cliente ou a placa.`
                      : soTrava
                        ? "Nenhuma viagem planejada com trava."
                        : VAZIO[aba]}
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
    </main>
  );
}
