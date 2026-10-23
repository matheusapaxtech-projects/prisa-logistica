"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { SITUACAO_OPERACIONAL } from "./rotulos";

/* Ferramentas da lista (`.ferramentas` de veiculos.html): busca e situação operacional. Gravam na URL
   (`?q=` e `?situacao=`) e o servidor refaz a lista; o filtro por tipo (`?filtro=`) é mantido. */
export function Ferramentas({ q, situacao, total }: { q: string; situacao: string; total: number }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [, iniciar] = useTransition();
  const [texto, setTexto] = useState(q);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voltar/avançar do navegador (ou "Limpar filtros") muda `q` por fora: o campo acompanha.
  const [qAnterior, setQAnterior] = useState(q);
  if (q !== qAnterior) {
    setQAnterior(q);
    setTexto(q);
  }
  useEffect(() => () => void (espera.current && clearTimeout(espera.current)), []);

  function ir(mudar: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params.toString());
    mudar(p);
    const qs = p.toString();
    iniciar(() => router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false }));
  }

  return (
    <div className="ferramentas">
      <div className="busca-lista">
        <Search aria-hidden="true" size={16} strokeWidth={1.6} />
        <input
          id="busca"
          type="search"
          autoComplete="off"
          placeholder="Placa, Renavam, chassi ou modelo"
          aria-label="Buscar por placa, Renavam, chassi ou modelo"
          value={texto}
          onChange={(e) => {
            const v = e.target.value;
            setTexto(v);
            if (espera.current) clearTimeout(espera.current);
            espera.current = setTimeout(() => ir((p) => (v.trim() ? p.set("q", v) : p.delete("q"))), 250);
          }}
        />
      </div>
      <select
        id="situacao"
        aria-label="Situação operacional"
        value={situacao}
        onChange={(e) => ir((p) => (e.target.value ? p.set("situacao", e.target.value) : p.delete("situacao")))}
      >
        <option value="">Todas as situações</option>
        {SITUACAO_OPERACIONAL.map(([k, r]) => (
          <option key={k} value={k}>
            {r}
          </option>
        ))}
      </select>
      <span className="total" id="total" aria-live="polite">
        {total} {total === 1 ? "veículo" : "veículos"}
      </span>
    </div>
  );
}

/** "Limpar filtros" do estado vazio: apaga busca, situação e filtro de tipo. */
export function LimparFiltros() {
  const router = useRouter();
  const caminho = usePathname();
  return (
    <button className="btn btn-texto" type="button" id="limpar" onClick={() => router.replace(caminho, { scroll: false })}>
      Limpar filtros
    </button>
  );
}
