"use client";

import { useEffect } from "react";

/* Falha ao carregar o Início (banco fora do ar, sessão inválida…). O menu continua na tela;
   "Tentar de novo" busca tudo outra vez. Sem stack nem código: só o que fazer. */
export default function ErroInicio({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Início</h1>
        </div>
      </div>
      <div className="grade">
        <section className="bloco c12" aria-labelledby="h-erro">
          <div className="bloco-cab">
            <h2 id="h-erro">Não foi possível carregar o Início</h2>
          </div>
          <div className="bloco-corpo">
            <div className="vazio-bloco" role="alert">
              <span>Não conseguimos buscar as pendências agora. Confira a conexão e tente de novo.</span>
              <button className="btn" type="button" onClick={() => retry()}>
                Tentar de novo
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
