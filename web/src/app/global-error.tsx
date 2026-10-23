"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
import "./globals.css";
import "@/styles/paginas/login.css";
import { MolduraEntrada } from "@/app/login/moldura-entrada";

/* Falha no layout raiz: substitui o documento inteiro (por isso tem <html> e <body> e importa os
   estilos de novo). Sem stack nem código. O link do Início é <a> comum: recarrega tudo do zero. */
export default function ErroGlobal({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <title>Erro · NILT</title>
        <MolduraEntrada>
          <h1>Não foi possível abrir o NILT</h1>
          <p className="sub">Algo falhou ao carregar o sistema. Seus dados continuam guardados.</p>

          <div className="aviso aviso-bloqueado" role="alert" style={{ marginTop: 28 }}>
            <CircleAlert />
            <p>Confira a conexão e tente de novo. Se continuar, avise o administrador.</p>
          </div>

          <button className="btn btn-primario btn-entrar" type="button" onClick={() => retry()} style={{ marginTop: 20 }}>
            Tentar de novo
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarregar a página inteira é o objetivo */}
          <a className="btn btn-texto" href="/" style={{ marginTop: 12, width: "100%" }}>
            Ir para o Início
          </a>
        </MolduraEntrada>
      </body>
    </html>
  );
}
