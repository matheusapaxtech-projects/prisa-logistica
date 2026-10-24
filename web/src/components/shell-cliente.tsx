"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Columns3,
  History,
  IdCard,
  Link2,
  Menu,
  Route,
  Signpost,
  Store,
  TriangleAlert,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { Toaster } from "@/components/Toast";

type Item = { href: string; rotulo: string; Icone: LucideIcon };

/* Itens, rótulos e ícones do `NAV`/`ADMIN` de nilt.js, com a operação (Quadro, Pedidos, Viagens,
   Clientes) logo depois do Início. */
const NAV: Item[] = [
  { href: "/", rotulo: "Início", Icone: Signpost },
  { href: "/quadro", rotulo: "Quadro", Icone: Columns3 },
  { href: "/pedidos", rotulo: "Pedidos", Icone: ClipboardList },
  { href: "/viagens", rotulo: "Viagens", Icone: Route },
  { href: "/clientes", rotulo: "Clientes", Icone: Store },
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
      {/* A pílula clara é um só elemento que desliza de um item para o outro ao trocar de página. */}
      {ativo(href, caminho) && (
        <motion.span
          layoutId="nav-pilula"
          className="nav-pilula"
          aria-hidden="true"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
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
    <LayoutGroup id="nav-principal">
      <nav className="nav">
        {NAV.map(item)}
        {admin && (
          <>
            <div className="nav-grupo">Administração</div>
            {ADMIN.map(item)}
          </>
        )}
      </nav>
    </LayoutGroup>
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
    // reducedMotion="user": com "reduzir movimento" ligado no sistema, o Motion tira deslocamento e layout.
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
