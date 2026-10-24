import type { ReactNode } from "react";
import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { sair } from "@/app/login/actions";
import { pode, type Papel, type Perfil } from "@/lib/papeis";
import { Avatar } from "@/components/Avatar";
import { BuscaGlobal } from "@/components/BuscaGlobal";
import { MolduraShell, NavPrincipal } from "@/components/shell-cliente";

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

/* Moldura do sistema (`montarShell()` do protótipo): sidebar com marca, menu e usuário; topbar com o
   botão de menu (até 1100px) e a busca global; a folha branca com a página; os avisos rápidos. */
export function Shell({ perfil, badgePendencias, children }: Props) {
  const sidebar = (
    <>
      <Link className="marca" href="/" aria-label="NILT, início">
        <span className="marca-sinal" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21V8" />
            <path d="M12 8l-4 4" />
            <path d="M12 8l4 4" />
            <path d="M5 21h14" />
          </svg>
        </span>
        <span className="marca-nome">
          <b>NILT</b>
          <span>Prisa Logística</span>
        </span>
      </Link>
      <NavPrincipal pendencias={badgePendencias} admin={pode(perfil, "admin")} financeiro={pode(perfil, "financeiro")} />
      <div className="sidebar-pe">
        <div className="usuario">
          <Avatar nome={perfil.nome} />
          <span className="usuario-nome">
            <b>{perfil.nome}</b>
            <span>{PAPEL[perfil.papel]}</span>
          </span>
          <Link
            className="btn btn-texto btn-icone"
            href="/nova-senha"
            aria-label="Trocar senha"
            title="Trocar senha"
            style={{ marginLeft: "auto" }}
          >
            <KeyRound size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <form action={sair} style={{ display: "flex" }}>
            <button className="btn btn-texto btn-icone" type="submit" aria-label="Sair" title="Sair">
              <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <MolduraShell sidebar={sidebar} busca={<BuscaGlobal />}>
      {children}
    </MolduraShell>
  );
}
