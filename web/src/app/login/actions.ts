"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { MSG_CREDENCIAIS, MSG_EMAIL_NAO_CONFIRMADO, validarEntrada, type ErrosEntrada } from "./regras";

export type EstadoEntrada = { erro?: string; campos?: ErrosEntrada } | null;

/** Entrar com e-mail e senha (useActionState). Erro de credencial não diz qual dos dois está errado. */
export async function entrar(_antes: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");

  const campos = validarEntrada(email, senha);
  if (campos.email || campos.senha) return { campos };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    // E-mail não confirmado: a conta existe, mas o administrador precisa confirmá-la (frase própria).
    if (error.code === "email_not_confirmed") return { erro: MSG_EMAIL_NAO_CONFIRMADO };
    // 400 invalid_credentials (e outros 400 de credencial) → a frase do protótipo; o resto, a genérica.
    const credencial = error.code === "invalid_credentials" || error.status === 400;
    return { erro: credencial ? MSG_CREDENCIAIS : mensagemDeErro(error) };
  }

  redirect("/");
}

/** Sair: encerra a sessão e volta para a entrada. Usado pelo shell (Task 5) e por /sem-acesso. */
export async function sair(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
