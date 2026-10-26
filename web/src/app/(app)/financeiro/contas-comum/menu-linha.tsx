"use client";

import { useId, useRef, type ToggleEvent } from "react";
import { Ellipsis } from "lucide-react";

export type ItemMenu = { rotulo: string; aoEscolher: () => void; perigo?: boolean };

/* Menu "…" da linha das contas a pagar e a receber. Usa o popover do navegador (camada de cima): a tabela rola para os
   lados e cortaria um menu comum. Fecha sozinho com Esc, clique fora ou ao escolher; ao rolar a página ele fecha também. */
export function MenuLinha({ rotulo, itens }: { rotulo: string; itens: ItemMenu[] }) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const ouvintes = useRef<AbortController | null>(null);

  function aoAlternar(e: ToggleEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    ouvintes.current?.abort();
    if (e.newState !== "open") {
      delete el.dataset.pronto;
      return;
    }
    const b = botao.current;
    if (b) {
      const r = b.getBoundingClientRect();
      const esquerda = Math.max(8, Math.min(r.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8));
      const abaixo = r.bottom + 4;
      el.style.left = `${esquerda}px`;
      el.style.top = `${abaixo + el.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - el.offsetHeight - 4) : abaixo}px`;
    }
    el.dataset.pronto = "";
    const ctl = new AbortController();
    ouvintes.current = ctl;
    const fechar = () => el.hidePopover();
    window.addEventListener("scroll", fechar, { capture: true, signal: ctl.signal });
    window.addEventListener("resize", fechar, { signal: ctl.signal });
  }

  return (
    <>
      <button ref={botao} className="btn btn-icone btn-texto btn-pequeno" type="button" popoverTarget={id} aria-label={rotulo} title="Mais ações">
        <Ellipsis size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div ref={lista} id={id} popover="auto" className="contas-menu" onToggle={aoAlternar}>
        {itens.map((i) => (
          <button
            key={i.rotulo}
            type="button"
            className={i.perigo ? "perigo" : undefined}
            onClick={() => {
              lista.current?.hidePopover();
              i.aoEscolher();
            }}
          >
            {i.rotulo}
          </button>
        ))}
      </div>
    </>
  );
}
