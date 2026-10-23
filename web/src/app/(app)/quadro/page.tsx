import type { Metadata } from "next";
import { tipado } from "@/lib/banco";
import { exigirPerfil } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarQuadro } from "./consultas";
import { QuadroCliente } from "./quadro-cliente";
import { lerAba, lerFiltros } from "./regras";

export const metadata: Metadata = { title: "Quadro" };

/* Quadro da operação (spec 3.5): as 10 colunas do usuário, com os cartões das viagens em andamento.
   A primeira carga vem do servidor; dali em diante o navegador recarrega a cada mudança (tempo real).
   Filtros e a coluna do celular ficam na URL (?cliente=&motorista=&unidade=&problema=1&minhas=1&aba=). */
export default async function QuadroPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await exigirPerfil();
  const db = tipado(await createClient());
  const [dados, unidades] = await Promise.all([carregarQuadro(db), db.from("unidade_operacional").select("id, nome").order("nome")]);
  if (unidades.error) throw unidades.error;
  const agora = new Date();

  return (
    <main className="quadro-pagina">
      <QuadroCliente
        inicial={dados}
        carregadoEm={agora.toISOString()}
        agoraInicial={agora.getTime()}
        perfil={{ userId: perfil.userId, papel: perfil.papel, ativo: perfil.ativo }}
        unidades={unidades.data ?? []}
        filtrosIniciais={lerFiltros(sp)}
        abaInicial={lerAba(sp)}
      />
    </main>
  );
}
