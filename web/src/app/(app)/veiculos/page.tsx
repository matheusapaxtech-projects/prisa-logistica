import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Link2, Plus } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/veiculos.css";
import { AbasFiltro } from "./abas-filtro";
import { ABAS, casaBusca, contarArrendadosSemContrato, listarVeiculos, type Filtro, type LinhaVeiculo } from "./consultas";
import { Ferramentas, LimparFiltros } from "./filtros";
import { LinhaClicavel } from "./linha-clicavel";
import { SITUACAO_OPERACIONAL, rotuloSituacaoOperacional } from "./rotulos";

export const metadata: Metadata = { title: "Veículos" };

/** Linhas desenhadas de uma vez; acima disso a tela pede para refinar a busca. */
const MAX_LINHAS = 300;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Partes({ itens }: { itens: string[] }) {
  return (
    <>
      {itens.filter(Boolean).map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <Ponto />}
          {t}
        </Fragment>
      ))}
    </>
  );
}

/** "CMT 74,0 t" / "36,6 t de carga" / "" (o `capCurta` do protótipo, para o celular). */
function capacidadeCurta(v: LinhaVeiculo): string {
  if (v.categoria === "cavalo") return v.cmt_t != null ? `CMT ${formato.t(v.cmt_t)}` : "";
  if (v.categoria === "dolly") return "";
  return v.capacidade_t != null ? `${formato.t(v.capacidade_t)} de carga` : "";
}

const engata = (v: LinhaVeiculo) => v.categoria === "cavalo" || v.categoria === "carreta" || v.categoria === "dolly";
const pecas = (n: number) => `${n} ${n === 1 ? "peça engatada" : "peças engatadas"}`;

/** Texto curto do conjunto, para as linhas de apoio do tablet e do celular. */
function conjuntoCurto(v: LinhaVeiculo): string {
  if (!engata(v)) return "";
  if (!v.conjunto) return "livre";
  return v.conjunto.papel === "cavalo" ? pecas(v.conjunto.total) : `no cavalo ${v.conjunto.cavaloPlaca}`;
}

function CelulaCapacidade({ v }: { v: LinhaVeiculo }) {
  if (v.categoria === "cavalo")
    return v.cmt_t != null ? (
      <>
        <span className="valor">CMT {formato.t(v.cmt_t)}</span>
        <span className="linha2">tara {formato.t(v.tara_t)}</span>
      </>
    ) : (
      <>
        <span className="dash">—</span>
        <span className="linha2">CMT não informado</span>
      </>
    );
  if (v.categoria === "dolly")
    return (
      <>
        <span className="dash">—</span>
        <span className="linha2">não leva carga</span>
      </>
    );
  const num = (n: number | null) => (n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  return v.capacidade_t != null ? (
    <>
      <span className="valor">{formato.t(v.capacidade_t)}</span>
      <span className="linha2">
        <Partes itens={[`PBT ${num(v.pbt_t)}`, `tara ${num(v.tara_t)}`]} />
      </span>
    </>
  ) : (
    <>
      <span className="dash">—</span>
      <span className="linha2">sem PBT ou tara</span>
    </>
  );
}

function CelulaConjunto({ v }: { v: LinhaVeiculo }) {
  if (!engata(v))
    return (
      <>
        <span className="dash">—</span>
        <span className="linha2">não engata</span>
      </>
    );
  const c = v.conjunto;
  if (!c) return <span className="muted">livre</span>;
  if (c.papel === "cavalo")
    return (
      <>
        <span>{pecas(c.total)}</span>
        <span className="linha2">desde {formato.dataHora(c.inicio).slice(0, 10)}</span>
      </>
    );
  return (
    <>
      <span className="cod">{c.cavaloPlaca}</span>
      <span className="linha2">
        posição {c.posicao} de {c.total}
      </span>
    </>
  );
}

function Linha({ v }: { v: LinhaVeiculo }) {
  const modelo = `${v.marca} ${v.modelo}`.trim();
  const conjCurto = conjuntoCurto(v) || (!engata(v) ? "não engata" : "");
  const resumoCelular = [
    v.arrendado ? `${v.posse}, arrendado (ANTT: ${v.documento})` : v.posse,
    capacidadeCurta(v),
    conjuntoCurto(v),
  ].filter(Boolean);
  return (
    <LinhaClicavel href={`/veiculos/${v.id}`}>
      <td className="col-placa">
        <Placa placa={v.placa} />
        <span className="linha2 so-tablet">
          <Partes itens={[v.tipo, modelo, v.anos]} />
        </span>
        <span className="linha2 so-tablet">
          <Partes itens={[`${v.eixos} eixos`, conjCurto]} />
        </span>
        <span className="linha2 so-celular">
          <Partes itens={[v.tipo, modelo]} />
        </span>
        <span className="linha2 so-celular">
          <Partes itens={resumoCelular} />
        </span>
      </td>
      <td className="some-tablet">
        <span>{v.tipo}</span>
        <span className="linha2">{v.eixos} eixos</span>
      </td>
      <td className="some-tablet">
        <span>{modelo}</span>
        <span className="linha2">{v.anos || "—"}</span>
      </td>
      <td className="some-celular col-prop">
        <span className="id-prop">{v.posse}</span>
        {v.arrendado ? (
          <span className="linha2 arr">
            <Sinal situacao="arrendado" />
            <span>ANTT: {v.documento}</span>
          </span>
        ) : (
          <span className="linha2">mesmo dono na ANTT</span>
        )}
      </td>
      <td className="num some-celular">
        <CelulaCapacidade v={v} />
      </td>
      <td className="some-tablet">
        <CelulaConjunto v={v} />
      </td>
      <td>
        <Sinal situacao={v.situacao_cadastro} />
        <span className="linha2">{rotuloSituacaoOperacional(v.situacao_operacional).toLowerCase()}</span>
      </td>
    </LinhaClicavel>
  );
}

export default async function PaginaVeiculos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filtro: Filtro = ABAS.some((a) => a.id === um("filtro")) ? (um("filtro") as Filtro) : "todos";
  const situacao = SITUACAO_OPERACIONAL.some(([k]) => k === um("situacao")) ? um("situacao") : "";
  const q = um("q").slice(0, 80);

  const perfil = await getPerfil();
  const db = tipado(await createClient());
  const [todos, semContrato] = await Promise.all([listarVeiculos(db), contarArrendadosSemContrato(db)]);

  // achado: o total e o que pede atenção (não segue os filtros)
  const arrendados = todos.filter((v) => v.arrendado).length;
  const pendentes = todos.filter((v) => v.situacao_cadastro === "pendente").length;
  const achado = [
    plural(todos.length, "veículo cadastrado", "veículos cadastrados"),
    `${plural(arrendados, "arrendado", "arrendados")}${semContrato ? `, ${semContrato} sem contrato anexado` : ""}`,
    pendentes ? `${pendentes} com cadastro pendente` : "",
  ];

  // a contagem das abas segue a busca e a situação escolhidas
  const base = todos.filter((v) => (!situacao || v.situacao_operacional === situacao) && casaBusca(v, q));
  const casa = ABAS.find((a) => a.id === filtro)!.casa;
  const linhas = base.filter(casa);
  const podeEditar = pode(perfil, "editar");

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Veículos</h1>
          <p className="sub" id="achado">
            <Partes itens={achado} />
          </p>
        </div>
        {podeEditar && (
          <div className="acoes">
            <Link className="btn" href="/conjuntos/novo">
              <Link2 size={16} strokeWidth={1.6} />
              Montar conjunto
            </Link>
            <Link className="btn btn-primario" href="/veiculos/novo">
              <Plus size={16} strokeWidth={1.6} />
              Novo veículo
            </Link>
          </div>
        )}
      </div>

      <AbasFiltro abas={ABAS.map((a) => ({ id: a.id, rotulo: a.rotulo, n: base.filter(a.casa).length }))} ativa={filtro} />

      <Ferramentas q={q} situacao={situacao} total={linhas.length} />

      <div className="tabela-wrap">
        <table className="tabela tabela-veiculos">
          <thead>
            <tr>
              <th scope="col">Placa</th>
              <th scope="col" className="some-tablet">Tipo</th>
              <th scope="col" className="some-tablet">Marca e modelo</th>
              <th scope="col" className="some-celular">Proprietário</th>
              <th scope="col" className="num some-celular">Carga ou CMT</th>
              <th scope="col" className="some-tablet">Conjunto atual</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody id="linhas">
            {linhas.length ? (
              linhas.slice(0, MAX_LINHAS).map((v) => <Linha key={v.id} v={v} />)
            ) : (
              <tr className="sem-linhas">
                <td colSpan={7}>
                  {todos.length ? (
                    <div className="vazio-bloco">
                      Nenhum veículo com esses filtros.
                      {q ? ` Confira a placa ou o Renavam “${q}”.` : ""}
                      <LimparFiltros />
                    </div>
                  ) : (
                    <div className="vazio-bloco">Nenhum veículo cadastrado ainda.{podeEditar ? " Comece por “Novo veículo”." : ""}</div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {linhas.length > MAX_LINHAS && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Mostrando {MAX_LINHAS} de {linhas.length}. Busque pela placa ou filtre por tipo para ver os demais.
        </p>
      )}
    </main>
  );
}
