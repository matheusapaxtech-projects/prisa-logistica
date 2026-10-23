import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase do servidor (Server Components, Server Actions, Route Handlers), com a sessão
 * do usuário nos cookies. Crie um por requisição; nunca guarde em variável global.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component: não dá para gravar cookie aqui.
            // O proxy (src/proxy.ts) renova a sessão e grava os cookies em toda requisição.
          }
        },
      },
    },
  );
}
