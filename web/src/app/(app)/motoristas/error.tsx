"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import "@/styles/paginas/motoristas.css";

/* Falha ao carregar uma tela de Motoristas (banco fora do ar, rede…). O menu continua na tela;
   "Tentar de novo" busca tudo outra vez. Sem stack nem código: só o que fazer. */
export default function ErroMotoristas({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Motoristas</h1>
        </div>
      </div>
      <div className="grade">
        <section className="bloco erro-ficha c6" role="alert">
          <h2>Não foi possível carregar os motoristas</h2>
          <p>Não conseguimos buscar os dados agora. Confira a conexão e tente de novo; se continuar, avise o administrador.</p>
          <div className="acoes">
            <button className="btn btn-primario" type="button" onClick={() => retry()}>
              <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
              Tentar de novo
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
