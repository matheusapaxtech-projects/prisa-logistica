"use client";

import { useEffect } from "react";
import Link from "next/link";

/* Falha ao carregar (banco fora do ar, sessão inválida…): o menu continua; "Tentar de novo" busca outra vez.
   Sem stack nem código: só o que fazer. */
export function ErroTela({ error, retry, titulo, frase }: { error: unknown; retry: () => void; titulo: string; frase: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main>
      <div className="titulo">
        <div>
          {titulo === "Conjuntos" ? (
            <h1>Conjuntos</h1>
          ) : (
            <div className="migalha">
              <Link href="/conjuntos">Conjuntos</Link>
              <span className="sep">/</span>
              <h1>{titulo}</h1>
            </div>
          )}
        </div>
      </div>
      <div className="vazio-bloco" role="alert">
        <span>{frase}</span>
        <button className="btn" type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
