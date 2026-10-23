"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import "@/styles/paginas/login.css";
import { MolduraEntrada } from "@/app/login/moldura-entrada";

/* Falha fora das telas que têm o próprio aviso (ex.: o layout do sistema não conseguiu ler o perfil
   porque o banco não respondeu). Sem stack nem código: só o que aconteceu e o que fazer. */
export default function ErroGeral({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MolduraEntrada>
      <h1>Não foi possível abrir o NILT</h1>
      <p className="sub">Algo falhou ao carregar esta tela. Seus dados continuam guardados.</p>

      <div className="aviso aviso-bloqueado" role="alert" style={{ marginTop: 28 }}>
        <CircleAlert />
        <p>Confira a conexão e tente de novo. Se continuar, avise o administrador.</p>
      </div>

      <button className="btn btn-primario btn-entrar" type="button" onClick={() => retry()} style={{ marginTop: 20 }}>
        Tentar de novo
      </button>
      <Link className="btn btn-texto" href="/" style={{ marginTop: 12, width: "100%" }}>
        Ir para o Início
      </Link>
    </MolduraEntrada>
  );
}
