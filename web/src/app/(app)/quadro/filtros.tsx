"use client";

import { X } from "lucide-react";
import { algumFiltro, type EstadoFiltros } from "./regras";

/* Barra de filtros do Quadro: cliente, motorista, unidade operacional, "Só com problema" e "Só as
   minhas". Muda na hora (sem botão de aplicar); a tela guarda os filtros na URL. */

type Props = {
  filtros: EstadoFiltros;
  aoMudar: (f: EstadoFiltros) => void;
  clientes: string[];
  motoristas: string[];
  unidades: { id: number; nome: string }[];
  /** Quantas viagens aparecem com os filtros (e quantas há no quadro). */
  visiveis: number;
  total: number;
};

const plural = (n: number) => (n === 1 ? "viagem" : "viagens");

export function FiltrosQuadro({ filtros: f, aoMudar, clientes, motoristas, unidades, visiveis, total }: Props) {
  // Um nome filtrado que saiu do quadro continua na lista (senão o select mostraria outro valor).
  const comAtual = (lista: string[], atual?: string) => (atual && !lista.includes(atual) ? [atual, ...lista] : lista);

  return (
    <form className="ferramentas quadro-filtros" role="search" aria-label="Filtros do quadro" onSubmit={(e) => e.preventDefault()}>
      <label>
        <span className="sr-only">Cliente</span>
        <select
          value={f.cliente ?? ""}
          onChange={(e) => aoMudar({ ...f, cliente: e.currentTarget.value || undefined })}
        >
          <option value="">Todos os clientes</option>
          {comAtual(clientes, f.cliente).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Motorista</span>
        <select
          value={f.motorista ?? ""}
          onChange={(e) => aoMudar({ ...f, motorista: e.currentTarget.value || undefined })}
        >
          <option value="">Todos os motoristas</option>
          {comAtual(motoristas, f.motorista).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Unidade operacional</span>
        <select
          value={f.unidade ? String(f.unidade) : ""}
          onChange={(e) => aoMudar({ ...f, unidade: Number(e.currentTarget.value) || undefined })}
        >
          <option value="">Todas as unidades</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </label>
      <button className="btn filtro-chave" type="button" aria-pressed={f.problema} onClick={() => aoMudar({ ...f, problema: !f.problema })}>
        Só com problema
      </button>
      <button className="btn filtro-chave" type="button" aria-pressed={f.minhas} onClick={() => aoMudar({ ...f, minhas: !f.minhas })}>
        Só as minhas
      </button>
      {algumFiltro(f) && (
        <button className="btn btn-texto" type="button" onClick={() => aoMudar({ problema: false, minhas: false })}>
          <X size={14} strokeWidth={1.6} aria-hidden="true" />
          Limpar filtros
        </button>
      )}
      <span className="total" aria-live="polite">
        {visiveis === total ? `${total} ${plural(total)}` : `${visiveis} de ${total} ${plural(total)}`}
      </span>
    </form>
  );
}
