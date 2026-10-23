"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronsLeftRight, ChevronsRightLeft } from "lucide-react";

/* Coluna do Quadro: rótulo do usuário, contador e os cartões. Durante um arraste, a coluna que pode
   receber o cartão fica marcada e as outras ficam apagadas (soltar nelas não faz nada). As colunas de
   espera podem ser estreitadas (a tela lembra a escolha). */

type Props = {
  rotulo: string;
  quantidade: number;
  /** Coluna de espera: tem o botão de estreitar. */
  espera: boolean;
  estreita: boolean;
  aoAlternarEstreita: () => void;
  /** Durante um arraste: "permitida" (aceita o cartão) ou "proibida" (apagada); fora dele, `null`. */
  arraste: "permitida" | "proibida" | null;
  aoSoltar: () => void;
  /** No celular, só a coluna ativa aparece. */
  ativa: boolean;
  children: ReactNode;
};

export function Coluna({ rotulo, quantidade, espera, estreita, aoAlternarEstreita, arraste, aoSoltar, ativa, children }: Props) {
  const id = useId();
  const [sobre, setSobre] = useState(false);
  const classes = [
    "quadro-coluna",
    espera ? "espera" : "",
    estreita ? "estreita" : "",
    arraste ?? "",
    sobre && arraste === "permitida" ? "alvo" : "",
    ativa ? "ativa" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={classes}
      aria-labelledby={id}
      onDragOver={(e) => {
        if (arraste !== "permitida") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!sobre) setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        setSobre(false);
        if (arraste !== "permitida") return;
        e.preventDefault();
        aoSoltar();
      }}
    >
      <header className="quadro-coluna-cab">
        <h2 id={id}>{rotulo}</h2>
        <span className="n" data-testid="contador">
          {quantidade}
        </span>
        <span className="sr-only">{quantidade === 1 ? "viagem" : "viagens"}</span>
        {espera && (
          <button
            className="btn btn-texto btn-icone estreitar"
            type="button"
            onClick={aoAlternarEstreita}
            aria-pressed={estreita}
            aria-label={`Estreitar a coluna ${rotulo}`}
            title={estreita ? "Alargar a coluna" : "Estreitar a coluna"}
          >
            {estreita ? (
              <ChevronsLeftRight size={16} strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <ChevronsRightLeft size={16} strokeWidth={1.6} aria-hidden="true" />
            )}
          </button>
        )}
      </header>
      <div className="quadro-coluna-corpo">{children}</div>
    </section>
  );
}
