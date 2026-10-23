import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { exigirPerfil } from "@/lib/permissoes";
import { resumoDaRequisicao } from "@/lib/resumo-da-requisicao";

/** O selo é um extra: se a contagem falhar, o shell abre sem número e o erro fica no log do servidor. */
async function seloPendencias(): Promise<number> {
  try {
    return (await resumoDaRequisicao()).total;
  } catch (e) {
    // Erros de controle do Next (redirect, notFound, renderização dinâmica) não são falha da contagem.
    unstable_rethrow(e);
    console.error("Falha ao contar as pendências do menu:", e);
    return 0;
  }
}

// Todas as telas do sistema (com shell). /login e /sem-acesso ficam fora deste grupo.
// Sem sessão → /login; sem perfil ativo → /sem-acesso (exigirPerfil). Perfil e selo em paralelo.
export default async function LayoutSistema({ children }: { children: ReactNode }) {
  const [perfil, badgePendencias] = await Promise.all([exigirPerfil(), seloPendencias()]);
  return (
    <Shell perfil={perfil} badgePendencias={badgePendencias}>
      {children}
    </Shell>
  );
}
