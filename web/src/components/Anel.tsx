"use client";

import { motion } from "motion/react";

/** Anel de progresso (0 a 1) que cresce ao aparecer, com a porcentagem no meio. */
export function Anel({ fracao, rotulo, tamanho = 76 }: { fracao: number; rotulo: string; tamanho?: number }) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <span className="anel" style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" className="anel-trilho" strokeWidth="12" />
        <motion.circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          className="anel-valor"
          strokeWidth="12"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: f }}
          transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1], delay: 0.25 }}
        />
      </svg>
      <b className="num" aria-hidden="true">
        {Math.round(f * 100)}%
      </b>
    </span>
  );
}
