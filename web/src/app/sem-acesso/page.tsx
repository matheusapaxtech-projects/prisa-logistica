import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut, UserRoundX } from "lucide-react";
import "@/styles/paginas/login.css";
import { sair } from "@/app/login/actions";
import { PlacaEntrada } from "@/app/login/placa-entrada";
import { getPerfil } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sem acesso" };

// Logado, mas sem perfil ou com o acesso desativado: explica o que houve em vez de mostrar telas vazias.
// Não chama exigirPerfil() (seria um laço de redirecionamento).
export default async function PaginaSemAcesso() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const perfil = await getPerfil();
  if (perfil?.ativo) redirect("/");

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const desativado = perfil !== null;

  return (
    <main className="entrada-grade">
      <PlacaEntrada />

      <section className="entrada-form">
        <div className="entrada-caixa">
          <h1>{desativado ? "Seu acesso foi desativado" : "Seu acesso ainda não foi liberado"}</h1>
          <p className="sub">
            {email ? (
              <>
                Você entrou como <b>{email}</b>
                {desativado
                  ? ", mas o administrador desativou o seu acesso ao NILT."
                  : ", mas o administrador ainda não definiu o que você pode fazer no NILT."}
              </>
            ) : desativado ? (
              "O administrador desativou o seu acesso ao NILT."
            ) : (
              "O administrador ainda não definiu o que você pode fazer no NILT."
            )}
          </p>

          <form action={sair}>
            <div className="aviso aviso-info">
              <UserRoundX />
              <p>
                {desativado
                  ? "Se você ainda precisa do NILT, peça ao administrador para reativar o seu acesso. Depois é só entrar de novo."
                  : "Peça ao administrador para liberar o seu acesso: ele escolhe o seu papel na tela de usuários. Depois é só entrar de novo."}
              </p>
            </div>
            <button className="btn btn-entrar" type="submit">
              <LogOut />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
