"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* Caixa de rolagem da tabela do ano que abre já mostrando o mês escolhido (a coluna `.atual`): em
   tela estreita a tabela não cabe e, sem isso, o mês da tela ficaria escondido à direita. */
export function RolarAteMes({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current;
    const atual = el?.querySelector<HTMLElement>("thead th.atual");
    const rotulo = el?.querySelector<HTMLElement>("thead .col-rotulo");
    if (!el || !atual || el.scrollWidth <= el.clientWidth) return;
    // Centraliza o mês na parte que rola (a largura da caixa menos a coluna fixa do rótulo). Medido na
    // tela: offsetLeft conta a partir do primeiro ancestral posicionado, que não é esta caixa.
    const caixaR = el.getBoundingClientRect();
    const mesR = atual.getBoundingClientRect();
    const fixo = rotulo?.getBoundingClientRect().width ?? 0;
    const livre = caixaR.width - fixo;
    const posicao = mesR.left - caixaR.left + el.scrollLeft - fixo;
    el.scrollLeft = Math.max(0, posicao - (livre - mesR.width) / 2);
  });
  return (
    <div className="tabela-wrap" ref={caixa}>
      {children}
    </div>
  );
}
