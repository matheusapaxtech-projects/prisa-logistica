"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import "@/styles/paginas/proprietarios.css";

/* Falha ao carregar a ficha do pedido (banco fora do ar, rede…). "Tentar de novo" busca tudo outra vez. */
export default function ErroFichaPedido({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/pedidos">Pedidos</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Ficha do pedido</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          <b>Não foi possível carregar o pedido.</b> Não conseguimos buscar os dados agora. Confira a conexão e tente de novo; se continuar,
          avise o administrador.
        </div>
        <div className="acoes">
          <button className="btn btn-primario" type="button" onClick={() => retry()}>
            <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
            Tentar de novo
          </button>
          <Link className="btn" href="/pedidos">
            Voltar para pedidos
          </Link>
        </div>
      </div>
    </main>
  );
}
