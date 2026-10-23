// Regras da tela "Criar uma senha nova", usadas no navegador e na Server Action.

export const SENHA_MINIMO = 8;

export type ErrosNovaSenha = { senha?: string; confirmacao?: string };

export function validarNovaSenha(senha: string, confirmacao: string): ErrosNovaSenha {
  const erros: ErrosNovaSenha = {};
  if (!senha) erros.senha = "Digite a senha nova.";
  else if (senha.length < SENHA_MINIMO) erros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`;
  if (!confirmacao) erros.confirmacao = "Repita a senha nova.";
  else if (senha && confirmacao !== senha) erros.confirmacao = "As duas senhas não são iguais. Digite de novo.";
  return erros;
}

export const MSG_SENHA_IGUAL = "A senha nova precisa ser diferente da atual.";
export const MSG_SENHA_FRACA =
  "Essa senha é fraca demais. Use uma senha mais longa, misturando letras, números e símbolos.";
export const MSG_REAUTENTICAR =
  "Por segurança, entre de novo antes de trocar a senha: saia, entre com a senha atual e volte aqui.";
