import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { contarPendencias } from "@/lib/consultas";
import { exigirPerfil } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";

// Todas as telas do sistema (com shell). /login e /sem-acesso ficam fora deste grupo.
// Sem sessão → /login; sem perfil ativo → /sem-acesso (exigirPerfil).
export default async function LayoutSistema({ children }: { children: ReactNode }) {
  const perfil = await exigirPerfil();
  const badgePendencias = await contarPendencias(await createClient());
  return (
    <Shell perfil={perfil} badgePendencias={badgePendencias}>
      {children}
    </Shell>
  );
}
