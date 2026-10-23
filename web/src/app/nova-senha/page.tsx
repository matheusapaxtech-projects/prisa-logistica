import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/styles/paginas/login.css";
import { MolduraEntrada } from "@/app/login/moldura-entrada";
import { createClient } from "@/lib/supabase/server";
import { FormularioNovaSenha } from "./formulario-nova-senha";

export const metadata: Metadata = { title: "Senha nova" };

// Senha nova, sem shell: quem chega pelo link de recuperação (/auth/confirm abriu a sessão) e quem
// troca a própria senha pelo link "Trocar senha" do shell. Sem sessão o proxy já manda para /login;
// a conferência aqui é a do servidor (o proxy não é a fronteira de segurança).
export default async function PaginaNovaSenha() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  return (
    <MolduraEntrada>
      <h1>Criar uma senha nova</h1>
      <p className="sub">
        {email ? (
          <>
            Você entrou como <b>{email}</b>. Escolha a senha que vai usar no NILT daqui em diante.
          </>
        ) : (
          "Escolha a senha que vai usar no NILT daqui em diante."
        )}
      </p>

      <FormularioNovaSenha email={email} />

      <p className="legal">Depois de salvar, você segue para o Início. Na próxima entrada, use a senha nova.</p>
    </MolduraEntrada>
  );
}
