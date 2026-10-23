"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type Aba = { id: string; rotulo: string; n?: number };

type Props = {
  abas: Aba[];
  /** Id da aba ativa (a página lê `searchParams.aba` e passa aqui; sem `?aba=`, a primeira). */
  ativa: string;
  /** `aria-label` da faixa de abas (ex.: "Partes da ficha"). */
  rotulo?: string;
  /** Endereço de cada aba (padrão `?aba=<id>`), para manter outros parâmetros da busca (filtros). */
  hrefDe?: (id: string) => string;
  /** Troca de aba sem navegação (a tela guarda a aba no estado e atualiza a URL sozinha). */
  aoEscolher?: (id: string) => void;
};

/* Abas por `?aba=` (o `montarAbas` do protótipo): links que trocam só a busca da URL, sem rolar
   a página; a ativa leva `aria-current="page"`. Cada página renderiza só o painel da aba ativa.
   No celular, a máscara de "tem mais à direita" some quando a faixa chega ao fim (`.fim`). */
export function Abas({ abas, ativa, rotulo, hrefDe, aoEscolher }: Props) {
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

  return (
    <nav className="abas" aria-label={rotulo} ref={faixa}>
      {abas.map((a) => (
        <Link
          key={a.id}
          href={hrefDe ? hrefDe(a.id) : `?aba=${a.id}`}
          id={`aba-${a.id}`}
          scroll={false}
          replace
          aria-current={a.id === ativa ? "page" : undefined}
          onClick={
            aoEscolher
              ? (e) => {
                  e.preventDefault();
                  aoEscolher(a.id);
                }
              : undefined
          }
        >
          {a.rotulo}
          {a.n !== undefined && <span className="n">{a.n}</span>}
        </Link>
      ))}
    </nav>
  );
}
