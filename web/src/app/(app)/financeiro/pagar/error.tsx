"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import "@/styles/paginas/proprietarios.css";

/* Falha ao carregar as contas a pagar (banco fora do ar, rede…). O menu continua na tela; "Tentar de novo"
   busca tudo outra vez. Sem stack nem código: só o que fazer. */
export default function ErroContasPagar({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <h1>Contas a pagar</h1>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          <b>Não foi possível carregar as contas a pagar.</b> Não conseguimos buscar os dados agora. Confira a conexão e tente de novo; se
          continuar, avise o administrador.
        </div>
        <div className="acoes">
          <button className="btn btn-primario" type="button" onClick={() => retry()}>
            <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      </div>
    </main>
  );
}
