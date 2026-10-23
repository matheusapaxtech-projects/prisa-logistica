import type { Metadata } from "next";
import "@/styles/paginas/login.css";
import { FormularioEntrar } from "./formulario-entrar";
import { PlacaEntrada } from "./placa-entrada";

export const metadata: Metadata = { title: "Entrar" };

// Tela de entrada, sem shell (prototipo/login.html). Logado aqui → o proxy manda para "/".
export default function PaginaEntrar() {
  return (
    <main className="entrada-grade">
      <PlacaEntrada />

      <section className="entrada-form">
        <div className="entrada-caixa">
          <h1>Entrar no NILT</h1>
          <p className="sub">Use o e-mail e a senha que o administrador criou para você.</p>

          <FormularioEntrar />

          <p className="legal">
            Acesso só para a equipe da Prisa Logística. Toda alteração e toda abertura de documento fica registrada.
          </p>
        </div>
      </section>
    </main>
  );
}
