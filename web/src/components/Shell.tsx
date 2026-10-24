import type { ReactNode } from "react";
import { pode, type Papel, type Perfil } from "@/lib/papeis";
import { BuscaGlobal } from "@/components/BuscaGlobal";
import { MolduraShell } from "@/components/shell-cliente";

const PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  operacao: "Operação",
  financeiro: "Financeiro",
  leitura: "Leitura",
};

type Props = {
  /** Perfil ativo do usuário logado (`exigirPerfil()` no layout). */
  perfil: Perfil;
  /** Número do selo de "Pendências" (`contarPendencias()` de lib/consultas.ts); 0 esconde o selo. */
  badgePendencias: number;
  children: ReactNode;
};

/* Moldura do sistema: topo com a marca, as seções em pílulas, a busca global e o usuário; trilho escuro
   à esquerda com cadastros, administração, trocar senha e sair (no celular, a gaveta com tudo). */
export function Shell({ perfil, badgePendencias, children }: Props) {
  return (
    <MolduraShell
      usuario={{ nome: perfil.nome, papel: PAPEL[perfil.papel] }}
      pendencias={badgePendencias}
      admin={pode(perfil, "admin")}
      busca={<BuscaGlobal />}
    >
      {children}
    </MolduraShell>
  );
}
