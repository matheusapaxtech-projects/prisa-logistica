"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

type Props = {
  valor: number;
  /** Formato do número (padrão: inteiro pt-BR, "1.234"). */
  formato?: "inteiro" | "moeda";
};

const FORMATOS = {
  inteiro: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }),
  moeda: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
};

/** Número que conta até o valor com mola: ao aparecer (de 0) e a cada mudança (do valor anterior).
   O servidor já manda o valor final no texto; a contagem escreve direto no nó, sem re-render.
   Com "reduzir movimento", mostra o valor sem contar. */
export function Numero({ valor, formato = "inteiro" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  /** O valor que está na tela agora (no meio da contagem, o intermediário). */
  const exibido = useRef<number | null>(null);
  const reduz = useReducedMotion();
  const fmt = FORMATOS[formato];

  useEffect(() => {
    const no = ref.current;
    if (!no) return;
    const de = exibido.current ?? 0;
    if (reduz || de === valor) {
      exibido.current = valor;
      no.textContent = fmt.format(valor);
      return;
    }
    const ctl = animate(de, valor, {
      type: "spring",
      stiffness: 70,
      damping: 18,
      mass: 0.9,
      onUpdate: (v) => {
        exibido.current = v;
        no.textContent = fmt.format(Math.round(v));
      },
    });
    return () => ctl.stop();
  }, [valor, reduz, fmt]);

  return (
    <span ref={ref} className="num">
      {fmt.format(valor)}
    </span>
  );
}
