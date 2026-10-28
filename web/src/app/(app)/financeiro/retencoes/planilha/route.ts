import { tipado } from "@/lib/banco";
import { mesValido } from "@/lib/financeiro";
import { planilhaRetencoes } from "@/lib/fiscal";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { retencoesDoMes } from "../consultas";

/* Planilha das retenções do mês para o contador: GET /financeiro/retencoes/planilha?mes=aaaa-mm (CSV). */
export async function GET(request: Request) {
  const perfil = await getPerfil();
  if (!pode(perfil, "financeiro")) return new Response("Sem permissão.", { status: 403 });
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  if (!mesValido(mes)) return new Response("Mês inválido.", { status: 400 });

  const linhas = await retencoesDoMes(tipado(await createClient()), mes);
  return new Response(planilhaRetencoes(linhas, mes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="retencoes-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
