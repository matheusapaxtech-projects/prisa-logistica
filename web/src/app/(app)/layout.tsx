import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { contarPendencias } from "@/lib/consultas";
import { exigirPerfil } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

/** O selo é um extra: se a contagem falhar, o shell abre sem número e o erro fica no log do servidor. */
async function seloPendencias(): Promise<number> {
  try {
    return await contarPendencias(await createClient());
  } catch (e) {
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
