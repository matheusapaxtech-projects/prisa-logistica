"use client";

import { motion } from "motion/react";

type Props = {
  /** De 0 a 1. */
  fracao: number;
  /** Texto para leitor de tela ("8 de 49 documentos conferidos"). */
  rotulo: string;
  tamanho?: number;
  /** Linha pequena abaixo da porcentagem ("8 de 49"). */
  legenda?: string;
};

/** Anel de progresso que cresce ao aparecer, com a porcentagem no meio (o "Team quota" do template). */
export function Anel({ fracao, rotulo, tamanho = 76, legenda }: Props) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <span className="anel" style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" className="anel-trilho" strokeWidth="11" />
        <motion.circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          className="anel-valor"
          strokeWidth="11"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: f }}
          transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
        />
      </svg>
      <span className="anel-txt" aria-hidden="true">
        <b className="num">{Math.round(f * 100)}%</b>
        {legenda && <span>{legenda}</span>}
      </span>
    </span>
  );
}
