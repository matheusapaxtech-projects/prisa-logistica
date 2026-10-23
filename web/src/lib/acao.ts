import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MSG_SESSAO_EXPIRADA, mensagemDeErro, type OpcoesErro } from "@/lib/erros";

/** Resultado de toda Server Action de gravação: nunca lança para a tela, nunca redireciona por sessão. */
export type ResultadoAcao<T = void> = { ok: true; dados: T } | { ok: false; erro: string };

export type ContextoAcao = {
  /** Cliente do servidor com a sessão do usuário (o RLS vale para tudo que ele fizer). */
  supabase: SupabaseClient;
  /** `auth.uid()` do usuário logado (claim `sub`). */
  userId: string;
};

function respostaComErro(v: unknown): v is { error: NonNullable<unknown> } {
  return typeof v === "object" && v !== null && "error" in v && Boolean((v as { error: unknown }).error);
}

/**
 * Contrato das Server Actions de gravação do NILT (Tasks 5–11 usam este helper).
 *
 * 1. Confere a sessão com `getClaims()`. Sem sessão (ou JWT vencido) devolve
 *    `{ ok: false, erro: MSG_SESSAO_EXPIRADA }`, sem lançar e sem `redirect`: o proxy deixa passar
 *    POSTs com o cabeçalho `Next-Action`, então a resposta chega ao formulário e nada se perde.
 * 2. Roda `fn({ supabase, userId })`. Se `fn` lançar um erro (ou devolver uma resposta do Supabase com
 *    `error` preenchido), ele vira `{ ok: false, erro: mensagemDeErro(e, opcoes) }`. Passe
 *    `{ somenteAdmin: true }` nas ações que só o administrador faz (apagar, arquivo restrito, usuários)
 *    para o erro de RLS virar "Só o administrador pode fazer isso.".
 * 3. Senão devolve `{ ok: true, dados }` com o que `fn` retornou.
 *    `redirect()`/`notFound()` chamados dentro de `fn` passam adiante normalmente.
 *
 * Exemplo (Server Action):
 * ```ts
 * "use server";
 * export async function salvarMotorista(_antes: ResultadoAcao<string> | null, form: FormData) {
 *   return comSessao(async ({ supabase }) => {
 *     const { data, error } = await supabase.from("pessoa").insert({ ... }).select("id").single();
 *     if (error) throw error;
 *     revalidatePath("/motoristas");
 *     return data.id;
 *   });
 * }
 * ```
 *
 * Exemplo (formulário, Client Component) — os campos não podem se perder:
 * - `const [estado, enviar, enviando] = useActionState(salvarMotorista, null)`;
 * - inputs não controlados, com `defaultValue` vindo do registro;
 * - enviar por `onSubmit` com `e.preventDefault()` e `startTransition(() => enviar(new FormData(e.currentTarget)))`.
 *   Não use `<form action={enviar}>`: o React 19 limpa os campos não controlados depois de uma action
 *   passada no `action` do form, e a pessoa perderia o que digitou quando a sessão expira.
 * - mostrar `estado.erro` num `.aviso` com `role="alert"` quando `estado?.ok === false`.
 */
export async function comSessao<T>(
  fn: (ctx: ContextoAcao) => Promise<T>,
  opcoes: OpcoesErro = {},
): Promise<ResultadoAcao<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { ok: false, erro: MSG_SESSAO_EXPIRADA };

  try {
    const dados = await fn({ supabase, userId });
    if (respostaComErro(dados)) return { ok: false, erro: mensagemDeErro(dados.error, opcoes) };
    return { ok: true, dados };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, erro: mensagemDeErro(e, opcoes) };
  }
}

/**
 * Para Route Handlers fora do matcher do proxy (`/api/cnpj`, `/api/cep`): sem sessão devolve
 * a resposta 401 `{ erro: MSG_SESSAO_EXPIRADA }`; com sessão devolve `null` e a rota segue.
 */
export async function semSessaoNaRota(): Promise<Response | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (!error && data?.claims?.sub) return null;
  return Response.json({ erro: MSG_SESSAO_EXPIRADA }, { status: 401 });
}
