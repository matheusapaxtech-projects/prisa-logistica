import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import "@/styles/paginas/login.css";
import { MolduraEntrada } from "@/app/login/moldura-entrada";

export const metadata: Metadata = { title: "Página não encontrada" };

// Endereço que não é de nenhuma tela do NILT (as fichas têm o próprio "não encontrado").
export default function PaginaNaoEncontrada() {
  return (
    <MolduraEntrada>
      <h1>Página não encontrada</h1>
      <p className="sub">Não há nenhuma tela do NILT neste endereço.</p>

      <div className="aviso aviso-info" style={{ marginTop: 28 }}>
        <SearchX />
        <p>Confira o endereço digitado ou o link que você abriu. Pelo Início você chega a todas as telas.</p>
      </div>

      <Link className="btn btn-primario btn-entrar" href="/" style={{ marginTop: 20 }}>
        Ir para o Início
      </Link>
    </MolduraEntrada>
  );
}
