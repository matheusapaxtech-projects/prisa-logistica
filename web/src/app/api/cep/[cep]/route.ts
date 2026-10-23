import { consultarCep } from "@/lib/brasilapi";
import { semSessaoNaRota } from "@/lib/acao";

// Resultado por consulta: nada de cache compartilhado entre usuários.
export const dynamic = "force-dynamic";

// Next 16: `params` é uma Promise. Fora do matcher do proxy: sem sessão responde 401 em JSON.
export async function GET(_request: Request, ctx: { params: Promise<{ cep: string }> }) {
  const semSessao = await semSessaoNaRota();
  if (semSessao) return semSessao;
  const { cep } = await ctx.params;
  return consultarCep(cep);
}
