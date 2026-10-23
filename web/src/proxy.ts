import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - _next/static, _next/image (arquivos do build e imagens otimizadas)
     * - favicon.ico e arquivos estáticos por extensão
     * - /api/cep/… e /api/cnpj/… (ancorados com a barra: as rotas conferem a sessão e respondem 401 em JSON)
     *
     * Rota de API nova (Route Handler que responde JSON): entra nesta exclusão, com a barra no fim
     * (ex.: `api/nova/`), e chama `semSessaoNaRota()` de `@/lib/acao` no início. Sem isso, o proxy
     * responderia com um redirecionamento para /login em vez de 401 JSON.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/cep/|api/cnpj/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
