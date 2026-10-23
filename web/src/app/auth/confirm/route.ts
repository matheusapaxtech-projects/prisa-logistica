import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Para onde vai quem abriu um link válido. Fixo: o endereço não aceita destino (sem redirecionamento aberto). */
const DESTINO_OK = "/nova-senha";
/** Link vencido, já usado, adulterado ou incompleto. */
const DESTINO_INVALIDO = "/auth/link-invalido";

/**
 * Volta do e-mail "Reset Password" do Supabase (modelo do e-mail:
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`, ver web/README.md).
 * Troca o token por uma sessão (cookies, padrão SSR do Supabase) e leva para a tela de senha nova.
 * Só aceita `type=recovery`; qualquer outro parâmetro (inclusive `next`) é ignorado.
 * Fica fora do desvio de sessão do proxy (quem chega aqui ainda não entrou).
 */
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (token_hash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
    if (!error) redirect(DESTINO_OK);
  }

  redirect(DESTINO_INVALIDO);
}
