"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Filtro } from "./consultas";

type Aba = { id: Filtro; rotulo: string; n: number };

/* Abas da lista por tipo (`?filtro=`), com a contagem que segue a busca e a situação escolhidas.
   Mesmo desenho das `Abas` dos componentes (links `.abas`, máscara de "tem mais" no celular), mas
   guardando `q` e `situacao` na URL. */
export function AbasFiltro({ abas, ativa }: { abas: Aba[]; ativa: Filtro }) {
  const caminho = usePathname();
  const params = useSearchParams();
  const faixa = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    const fim = () => el.classList.toggle("fim", el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    const atual = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (atual && el.scrollWidth > el.clientWidth) atual.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.addEventListener("scroll", fim, { passive: true });
    window.addEventListener("resize", fim);
    const quadro = requestAnimationFrame(fim);
    return () => {
      el.removeEventListener("scroll", fim);
      window.removeEventListener("resize", fim);
      cancelAnimationFrame(quadro);
    };
  }, [ativa]);

  function href(id: Filtro) {
    const p = new URLSearchParams(params.toString());
    if (id === "todos") p.delete("filtro");
    else p.set("filtro", id);
    const qs = p.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  }

  return (
    <nav className="abas" id="abas" aria-label="Filtrar por tipo de veículo" ref={faixa}>
      {abas.map((a) => (
        <Link key={a.id} href={href(a.id)} data-filtro={a.id} scroll={false} replace aria-current={a.id === ativa ? "page" : undefined}>
          {a.rotulo}
          <span className="n">{a.n}</span>
        </Link>
      ))}
    </nav>
  );
}
