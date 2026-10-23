// Regras do formulário de entrada (mesmos textos de prototipo/login.html), usadas no navegador e na action.

export const MSG_CREDENCIAIS = "E-mail ou senha incorretos. Confira e tente de novo.";
export const MSG_EMAIL_NAO_CONFIRMADO =
  "Seu e-mail ainda não foi confirmado. Peça ao administrador para confirmar sua conta.";

export type ErrosEntrada = { email?: string; senha?: string };

export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function validarEntrada(email: string, senha: string): ErrosEntrada {
  const erros: ErrosEntrada = {};
  if (!email) erros.email = "Digite o seu e-mail.";
  else if (!emailValido(email)) erros.email = "Esse e-mail parece incompleto. Confira o @ e o que vem depois dele.";
  if (!senha) erros.senha = "Digite a sua senha.";
  return erros;
}
