"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import "@/styles/paginas/proprietarios.css";

/* Falha ao carregar a ficha da viagem (banco fora do ar, rede…). "Tentar de novo" busca tudo outra vez. */
export default function ErroFichaViagem({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/viagens">Viagens</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Ficha da viagem</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          <b>Não foi possível carregar a viagem.</b> Não conseguimos buscar os dados agora. Confira a conexão e tente de novo; se continuar,
          avise o administrador.
        </div>
        <div className="acoes">
          <button className="btn btn-primario" type="button" onClick={() => retry()}>
            <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
            Tentar de novo
          </button>
          <Link className="btn" href="/viagens">
            Voltar para viagens
          </Link>
        </div>
      </div>
    </main>
  );
}
