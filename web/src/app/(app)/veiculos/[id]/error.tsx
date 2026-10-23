"use client";

import { useEffect } from "react";

/* Falha ao carregar a ficha (banco fora do ar, sessão inválida…). O menu continua na tela. */
export default function ErroFicha({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Veículo</h1>
        </div>
      </div>
      <div className="vazio-bloco" role="alert">
        <span>Não conseguimos carregar este veículo agora. Confira a conexão e tente de novo.</span>
        <button className="btn" type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
