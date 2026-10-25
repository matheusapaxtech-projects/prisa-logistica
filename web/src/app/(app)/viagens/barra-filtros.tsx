"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Search, X } from "lucide-react";
import { filtrosLigados, hrefDe, hrefSemFiltros, PERIODOS, type FiltrosViagens, type OpcoesFiltros, type Periodo } from "./filtros";

/* Barra de filtros da lista de Viagens: busca (aplica no Enter), cliente, motorista, origem,
   destino, situação (aptidão ou coluna do Quadro), período e ordem. Cada seletor muda na hora e a
   tela guarda tudo na URL (`hrefDe`); seletor ligado fica escuro, como "Só com problema" no Quadro. */

type Props = {
  filtros: FiltrosViagens;
  opcoes: OpcoesFiltros;
  /** Rótulo da data da aba no período (ex.: "Finalizada em"). */
  rotuloData: string;
  /** Quantas viagens passam nos filtros e quantas a aba tem. */
  achadas: number;
  daAba: number;
};

const plural = (n: number) => (n === 1 ? "viagem" : "viagens");

export function BarraFiltros({ filtros: f, opcoes, rotuloData, achadas, daAba }: Props) {
  const router = useRouter();
  const [mudando, iniciar] = useTransition();
  const ir = (mudar: Partial<FiltrosViagens>) => iniciar(() => router.replace(`/viagens${hrefDe(f, mudar)}`, { scroll: false }));
  const limpar = () => iniciar(() => router.replace(`/viagens${hrefSemFiltros(f)}`, { scroll: false }));
  const ligados = filtrosLigados(f) + (f.q ? 1 : 0);

  const seletor = (campo: "cliente" | "motorista" | "origem" | "destino", rotulo: string, todos: string, lista: string[]) => (
    <label className="filtro-pilula">
      <span className="sr-only">{rotulo}</span>
      <select className={f[campo] ? "ligado" : undefined} value={f[campo]} onChange={(e) => ir({ [campo]: e.currentTarget.value })}>
        <option value="">{todos}</option>
        {lista.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="filtros-viagens" aria-busy={mudando}>
      <form
        className="ferramentas"
        role="search"
        aria-label="Filtros das viagens"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          ir({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
        }}
      >
        <label className="busca-lista">
          <span className="sr-only">Buscar por número, pedido, cliente, motorista, placa ou cidade</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          {/* `key`: quando a busca muda por fora (Limpar filtros, outra aba), o campo acompanha. */}
          <input
            key={f.q}
            id="busca"
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Número, cliente, motorista, placa ou cidade"
            defaultValue={f.q}
            onChange={(e) => {
              // O "x" do campo de busca limpa na hora; o resto espera o Enter.
              if (e.currentTarget.value === "" && f.q) ir({ q: "" });
            }}
          />
        </label>
        <button className="sr-only" type="submit">
          Buscar
        </button>

        {seletor("cliente", "Cliente", "Cliente", opcoes.clientes)}
        {seletor("motorista", "Motorista", "Motorista", opcoes.motoristas)}
        {seletor("origem", "Origem", "Origem", opcoes.origens)}
        {seletor("destino", "Destino", "Destino", opcoes.destinos)}

        {opcoes.situacoes.length > 0 && (
          <label className="filtro-pilula">
            <span className="sr-only">Situação</span>
            <select className={f.situacao ? "ligado" : undefined} value={f.situacao} onChange={(e) => ir({ situacao: e.currentTarget.value })}>
              <option value="">{f.aba === "no_quadro" ? "Coluna do Quadro" : "Aptidão"}</option>
              {opcoes.situacoes.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="filtro-pilula">
          <span className="sr-only">Período ({rotuloData.toLowerCase()})</span>
          <select
            className={f.periodo !== "tudo" ? "ligado" : undefined}
            value={f.periodo}
            onChange={(e) => ir({ periodo: e.currentTarget.value as Periodo })}
          >
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === "tudo" ? rotuloData : p.rotulo}
              </option>
            ))}
          </select>
        </label>

        {f.periodo === "datas" && (
          <span className="filtro-datas">
            <label>
              <span>De</span>
              <input type="date" value={f.de} max={f.ate || undefined} onChange={(e) => ir({ de: e.currentTarget.value })} />
            </label>
            <label>
              <span>até</span>
              <input type="date" value={f.ate} min={f.de || undefined} onChange={(e) => ir({ ate: e.currentTarget.value })} />
            </label>
          </span>
        )}

        {ligados > 0 && (
          <button className="btn btn-texto" type="button" onClick={limpar}>
            <X size={14} strokeWidth={1.6} aria-hidden="true" />
            Limpar filtros
          </button>
        )}

        <span className="total" id="total" aria-live="polite">
          {achadas === daAba ? `${daAba} ${plural(daAba)}` : `${achadas} de ${daAba} ${plural(daAba)}`}
        </span>

        <label className="filtro-pilula ordem">
          <span className="sr-only">Ordem pela data</span>
          <select value={f.ordem} onChange={(e) => ir({ ordem: e.currentTarget.value as FiltrosViagens["ordem"] })}>
            <option value="recentes">Mais recentes</option>
            <option value="antigas">Mais antigas</option>
          </select>
        </label>
      </form>
    </div>
  );
}
