import { consultarCnpj } from "@/lib/brasilapi";

// Resultado por consulta: nada de cache compartilhado entre usuários.
export const dynamic = "force-dynamic";

// Next 16: `params` é uma Promise. A checagem de sessão entra na Task 4.
export async function GET(_request: Request, ctx: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await ctx.params;
  return consultarCnpj(cnpj);
}
