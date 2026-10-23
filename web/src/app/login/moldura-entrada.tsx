import type { ReactNode } from "react";
import { PlacaEntrada } from "./placa-entrada";

/* Moldura das telas sem shell (entrada, senha nova, link inválido, páginas de erro): a placa verde do
   NILT ao lado de uma folha branca, como em prototipo/login.html. Quem usa importa
   "@/styles/paginas/login.css". */
export function MolduraEntrada({ children }: { children: ReactNode }) {
  return (
    <main className="entrada-grade">
      <PlacaEntrada />
      <section className="entrada-form">
        <div className="entrada-caixa">{children}</div>
      </section>
    </main>
  );
}
