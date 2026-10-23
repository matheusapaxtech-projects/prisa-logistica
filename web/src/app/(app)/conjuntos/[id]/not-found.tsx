import type { Metadata } from "next";
import Link from "next/link";
import { IdPedido } from "./id-pedido";
import "@/styles/paginas/conjuntos.css";

export const metadata: Metadata = { title: "Conjunto não encontrado" };

/* Id que não é de nenhum conjunto (ou nem é um id): `renderNaoAchado` de prototipo/conjunto.html. */
export default function ConjuntoNaoEncontrado() {
  return (
    <main>
      <div className="titulo">
        <div>
          <div className="migalha">
            <Link href="/conjuntos">Conjuntos</Link>
            <span className="sep">/</span>
            <h1 id="h1" tabIndex={-1}>
              Conjunto não encontrado
            </h1>
          </div>
        </div>
      </div>
      <div className="vazio-bloco" style={{ flexWrap: "wrap" }}>
        <span>
          Não há conjunto com o código <IdPedido />. Confira o endereço ou abra o conjunto pela lista.
        </span>
      </div>
      <div className="opcoes" style={{ marginTop: 16 }}>
        <Link className="btn" href="/conjuntos">
          Ver conjuntos
        </Link>
        <Link className="btn btn-primario" href="/conjuntos/novo">
          Montar conjunto
        </Link>
      </div>
    </main>
  );
}
