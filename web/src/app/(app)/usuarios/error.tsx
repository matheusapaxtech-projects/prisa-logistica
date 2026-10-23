"use client";

import { useEffect } from "react";

/* Falha ao carregar /usuarios (banco fora do ar, sessão inválida…). Sem stack nem código: só o que fazer. */
export default function ErroUsuarios({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Usuários</h1>
        </div>
      </div>
      <div className="vazio-bloco" role="alert">
        <span>Não conseguimos carregar os usuários agora. Confira a conexão e tente de novo.</span>
        <button className="btn" type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
