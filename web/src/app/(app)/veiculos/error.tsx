"use client";

import { useEffect } from "react";

/* Falha ao carregar a lista de veículos. O menu continua na tela; "Tentar de novo" busca outra vez. */
export default function ErroVeiculos({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Veículos</h1>
        </div>
      </div>
      <div className="vazio-bloco" role="alert">
        <span>Não conseguimos carregar os veículos agora. Confira a conexão e tente de novo.</span>
        <button className="btn" type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
