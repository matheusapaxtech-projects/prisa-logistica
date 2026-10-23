"use client";

import { useEffect } from "react";

/* Falha ao carregar as pendências: o menu continua; "Tentar de novo" busca outra vez. */
export default function ErroPendencias({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Pendências</h1>
        </div>
      </div>
      <div className="vazio-bloco" role="alert">
        <span>Não conseguimos buscar as pendências agora. Confira a conexão e tente de novo.</span>
        <button className="btn" type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
