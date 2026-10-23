// Tradução de erros do Supabase (PostgREST, Auth, Storage) para frases da interface.
// Regra: a pessoa nunca vê inglês, código nem stack; só o que aconteceu e o que fazer.

export const MSG_SESSAO_EXPIRADA =
  "Sua sessão expirou. Entre de novo; o que você digitou continua na tela.";
export const MSG_SO_ADMIN = "Só o administrador pode fazer isso.";
export const MSG_PAPEL = "Seu papel não permite essa alteração.";
export const MSG_DUPLICADO = "Já existe um cadastro com esse documento.";
export const MSG_GENERICA =
  "Não foi possível concluir agora. Tente de novo em instantes; se continuar, avise o administrador.";

export type OpcoesErro = {
  /**
   * A ação só é permitida ao administrador (apagar, arquivo restrito, usuários)?
   * Decide qual frase o erro de RLS (42501) recebe.
   */
  somenteAdmin?: boolean;
};

// Códigos do PostgREST para JWT inválido/expirado (PGRST303 nas versões novas).
const CODIGOS_SESSAO_PG = new Set(["PGRST301", "PGRST302", "PGRST303"]);
// Códigos do Supabase Auth que significam "não há sessão válida".
const CODIGOS_SESSAO_AUTH = new Set([
  "session_expired",
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
  "no_authorization",
]);

type ErroLike = { code?: unknown; message?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Converte qualquer erro vindo do Supabase (ou lançado numa Server Action) na frase pt-BR da tela.
 *
 * - 42501 / "row-level security" → `MSG_SO_ADMIN` se `opcoes.somenteAdmin`, senão `MSG_PAPEL`;
 * - 23505 → `MSG_DUPLICADO`;
 * - JWT expirado (PGRST301/302/303, "JWT expired", status 401, erros de sessão do Auth) → `MSG_SESSAO_EXPIRADA`;
 * - P0001 (`raise exception` das funções do banco, já escritas em pt-BR) → a mensagem como está;
 * - qualquer outra coisa → `MSG_GENERICA`.
 */
export function mensagemDeErro(e: unknown, opcoes: OpcoesErro = {}): string {
  if (!e || typeof e !== "object") return MSG_GENERICA;
  const erro = e as ErroLike;
  const code = texto(erro.code);
  const message = texto(erro.message);
  const status = Number(erro.status ?? erro.statusCode);

  if (code === "42501" || /row-level security/i.test(message)) {
    return opcoes.somenteAdmin ? MSG_SO_ADMIN : MSG_PAPEL;
  }
  if (code === "23505") return MSG_DUPLICADO;
  if (
    CODIGOS_SESSAO_PG.has(code) ||
    CODIGOS_SESSAO_AUTH.has(code) ||
    status === 401 ||
    /jwt expired/i.test(message) ||
    texto(erro.name) === "AuthSessionMissingError"
  ) {
    return MSG_SESSAO_EXPIRADA;
  }
  if (code === "P0001" && message.trim()) return message;
  return MSG_GENERICA;
}
