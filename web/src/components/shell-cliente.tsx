"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  History,
  IdCard,
  Link2,
  Menu,
  Signpost,
  TriangleAlert,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "@/components/Toast";

type Item = { href: string; rotulo: string; Icone: LucideIcon };

/* Mesmos itens, rótulos e ícones do `NAV`/`ADMIN` de nilt.js. */
const NAV: Item[] = [
  { href: "/", rotulo: "Início", Icone: Signpost },
  { href: "/motoristas", rotulo: "Motoristas", Icone: IdCard },
  { href: "/proprietarios", rotulo: "Proprietários", Icone: Building2 },
  { href: "/veiculos", rotulo: "Veículos", Icone: Truck },
  { href: "/conjuntos", rotulo: "Conjuntos", Icone: Link2 },
  { href: "/pendencias", rotulo: "Pendências", Icone: TriangleAlert },
];
const ADMIN: Item[] = [
  { href: "/usuarios", rotulo: "Usuários", Icone: Users },
  { href: "/auditoria", rotulo: "Auditoria", Icone: History },
];

/** A rota atual pertence ao item? "/" só na raiz; os demais também nas fichas (/motoristas/<id>). */
function ativo(href: string, caminho: string) {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/");
}

/** Menu principal com o item atual marcado (`aria-current="page"`) e o selo de pendências. */
export function NavPrincipal({ pendencias, admin }: { pendencias: number; admin: boolean }) {
  const caminho = usePathname();
  const item = ({ href, rotulo, Icone }: Item) => (
    <Link key={href} href={href} aria-current={ativo(href, caminho) ? "page" : undefined}>
      <Icone size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{rotulo}</span>
      {href === "/pendencias" && pendencias > 0 && (
        <span className="contagem" aria-label={`${pendencias} pendências`}>
          {pendencias}
        </span>
      )}
    </Link>
  );
  return (
    <nav className="nav">
      {NAV.map(item)}
      {admin && (
        <>
          <div className="nav-grupo">Administração</div>
          {ADMIN.map(item)}
        </>
      )}
    </nav>
  );
}

/** Estrutura `.shell` com o menu lateral que abre por cima no celular/tablet (`.menu-aberto`):
   abre no botão, fecha ao clicar fora da sidebar e ao trocar de página. */
export function MolduraShell({ sidebar, busca, children }: { sidebar: ReactNode; busca: ReactNode; children: ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setAberto(false);
  }

  function aoClicar(e: MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (aberto && !alvo.closest(".sidebar") && !alvo.closest(".menu-btn")) setAberto(false);
  }

  return (
    <div className={`shell${aberto ? " menu-aberto" : ""}`} onClick={aoClicar}>
      <aside className="sidebar" aria-label="Menu principal">
        {sidebar}
      </aside>
      <header className="topbar">
        <button
          className="btn btn-icone menu-btn"
          type="button"
          aria-label="Abrir menu"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
        >
          <Menu size={16} strokeWidth={1.6} aria-hidden="true" />
        </button>
        {busca}
      </header>
      <section className="sheet">
        <div className="sheet-inner">{children}</div>
      </section>
      <Toaster />
    </div>
  );
}
