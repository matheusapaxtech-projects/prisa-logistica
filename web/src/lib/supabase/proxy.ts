import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const CABECALHOS_CACHE = ["cache-control", "expires", "pragma"];

/**
 * Renova a sessão do Supabase em toda requisição (padrão da documentação do Supabase para Next.js)
 * e faz o desvio de entrada:
 * - sem sessão → `/login`, exceto a própria `/login` e POSTs de Server Action (cabeçalho `Next-Action`):
 *   esses seguem para a action responder "Sua sessão expirou…" sem o formulário perder os campos
 *   (toda action confere a sessão com `comSessao`, e o RLS protege os dados de qualquer jeito).
 *   Só POST: o Next só trata como Server Action um POST com esse cabeçalho; um GET com ele é página
 *   comum e passa pelo desvio normalmente;
 * - com sessão em `/login` → `/`.
 *
 * O proxy NÃO é a fronteira de segurança (é otimista e tem exceções). Toda página do sistema confere
 * o acesso no servidor: o layout `(app)` precisa chamar `exigirPerfil()` (de `@/lib/permissoes`),
 * cada Server Action usa `comSessao()` e cada Route Handler fora do matcher usa `semSessaoNaRota()`
 * (de `@/lib/acao`). O RLS do banco é a última palavra.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Um cliente novo por requisição; nada de variável global.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([chave, valor]) => supabaseResponse.headers.set(chave, valor));
        },
      },
    },
  );

  // Não coloque código entre createServerClient e getClaims(): isso causa logouts aleatórios.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);

  if (request.method === "POST" && request.headers.has("next-action")) return supabaseResponse;

  const caminho = request.nextUrl.pathname;
  if (!logado && caminho !== "/login") return redirecionar(request, "/login", supabaseResponse);
  if (logado && caminho === "/login") return redirecionar(request, "/", supabaseResponse);

  return supabaseResponse;
}

// Redireciona levando os cookies renovados e os cabeçalhos anti-cache da resposta do Supabase.
function redirecionar(request: NextRequest, destino: string, supabaseResponse: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  const resposta = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => resposta.cookies.set(cookie));
  for (const cabecalho of CABECALHOS_CACHE) {
    const valor = supabaseResponse.headers.get(cabecalho);
    if (valor) resposta.headers.set(cabecalho, valor);
  }
  return resposta;
}
