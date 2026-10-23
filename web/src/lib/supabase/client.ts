import { createBrowserClient as criarClienteNavegador } from "@supabase/ssr";

/** Cliente Supabase do navegador (Client Components), com a mesma sessão dos cookies. */
export function createBrowserClient() {
  return criarClienteNavegador(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
