"use server";

import { redirect } from "next/navigation";
import { comSessao } from "@/lib/acao";
import { mensagemDeErro } from "@/lib/erros";
import { MSG_REAUTENTICAR, MSG_SENHA_FRACA, MSG_SENHA_IGUAL, validarNovaSenha, type ErrosNovaSenha } from "./regras";

export type EstadoNovaSenha = { erro?: string; campos?: ErrosNovaSenha } | null;

/** Frase da tela para um erro do Supabase Auth ao trocar a senha. */
function mensagemDaTroca(e: { code?: string }): string {
  if (e.code === "same_password") return MSG_SENHA_IGUAL;
  if (e.code === "weak_password") return MSG_SENHA_FRACA;
  if (e.code === "reauthentication_needed" || e.code === "reauthentication_not_valid") return MSG_REAUTENTICAR;
  return mensagemDeErro(e);
}

/**
 * Grava a senha nova do usuário logado (useActionState). Serve para quem chegou pelo link de
 * recuperação (/auth/confirm já abriu a sessão) e para quem troca a própria senha pelo shell.
 * Sem sessão: "Sua sessão expirou…" (comSessao). Deu certo: vai para o Início.
 */
export async function definirNovaSenha(_antes: EstadoNovaSenha, form: FormData): Promise<EstadoNovaSenha> {
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");

  const campos = validarNovaSenha(senha, confirmacao);
  if (campos.senha || campos.confirmacao) return { campos };

  const r = await comSessao(async ({ supabase }) => {
    const { error } = await supabase.auth.updateUser({ password: senha });
    return error ? mensagemDaTroca(error) : null;
  });
  if (!r.ok) return { erro: r.erro };
  if (r.dados) return { erro: r.dados };

  redirect("/");
}
