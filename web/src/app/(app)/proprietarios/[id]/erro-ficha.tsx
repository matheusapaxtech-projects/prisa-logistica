import type { ReactNode } from "react";
import Link from "next/link";
import "@/styles/paginas/proprietarios.css";

/* "Erro amigável" da ficha (prototipo/proprietario.html): migalha com o título e, abaixo, o motivo e as
   saídas. Serve ao "não encontrado" e à pessoa que ainda não é proprietária. */
export function ErroFicha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/proprietarios">Proprietários</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>{titulo}</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        {children}
      </div>
    </main>
  );
}
