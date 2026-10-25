"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import "@/styles/paginas/proprietarios.css";

/* Falha ao carregar a ficha do cliente (banco fora do ar, rede…). "Tentar de novo" busca tudo outra vez. */
export default function ErroFichaCliente({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/clientes">Clientes</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Ficha do cliente</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          <b>Não foi possível carregar a ficha.</b> Não conseguimos buscar os dados agora. Confira a conexão e tente de novo; se continuar,
          avise o administrador.
        </div>
        <div className="acoes">
          <button className="btn btn-primario" type="button" onClick={() => retry()}>
            <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
            Tentar de novo
          </button>
          <Link className="btn" href="/clientes">
            Voltar para clientes
          </Link>
        </div>
      </div>
    </main>
  );
}
