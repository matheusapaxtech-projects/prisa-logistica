import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off } from "lucide-react";
import "@/styles/paginas/login.css";
import { MolduraEntrada } from "@/app/login/moldura-entrada";

export const metadata: Metadata = { title: "Link inválido" };

// Destino de /auth/confirm quando o link do e-mail não vale (vencido, já usado ou incompleto).
// Fica fora do desvio de sessão do proxy: quem chega aqui normalmente ainda não entrou.
export default function PaginaLinkInvalido() {
  return (
    <MolduraEntrada>
      <h1>Esse link não vale mais</h1>
      <p className="sub">O link para criar uma senha nova venceu, já foi usado ou chegou incompleto.</p>

      <div className="aviso aviso-info" style={{ marginTop: 28 }}>
        <Link2Off />
        <p>
          Cada link vale uma vez só e por pouco tempo. Peça ao administrador do NILT um link novo e abra o mais recente
          que chegar no seu e-mail. Se você lembrou a senha, é só entrar.
        </p>
      </div>

      <Link className="btn btn-primario btn-entrar" href="/login" style={{ marginTop: 20 }}>
        Ir para a entrada
      </Link>
    </MolduraEntrada>
  );
}
