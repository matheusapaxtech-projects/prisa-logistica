"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calculator,
  ClipboardList,
  Columns3,
  History,
  IdCard,
  KeyRound,
  Landmark,
  Link2,
  LogOut,
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
import { sair } from "@/app/login/actions";
import { Avatar } from "@/components/Avatar";
import { Toaster } from "@/components/Toast";

type Item = { href: string; rotulo: string; Icone: LucideIcon };

/* Seções do dia a dia (pílulas no topo) e cadastros/administração (trilho à esquerda). */
const SECOES: Item[] = [
  { href: "/", rotulo: "Início", Icone: Signpost },
  { href: "/quadro", rotulo: "Quadro", Icone: Columns3 },
  { href: "/pedidos", rotulo: "Pedidos", Icone: ClipboardList },
  { href: "/viagens", rotulo: "Viagens", Icone: Route },
  { href: "/calculadora", rotulo: "Calcular frete", Icone: Calculator },
  { href: "/clientes", rotulo: "Clientes", Icone: Store },
  { href: "/pendencias", rotulo: "Pendências", Icone: TriangleAlert },
];
/** Só para admin e financeiro (`pode(perfil, "financeiro")`): mais uma pílula no topo. */
const FINANCEIRO: Item = { href: "/financeiro", rotulo: "Financeiro", Icone: Landmark };
const CADASTROS: Item[] = [
  { href: "/motoristas", rotulo: "Motoristas", Icone: IdCard },
  { href: "/proprietarios", rotulo: "Proprietários", Icone: Building2 },
  { href: "/veiculos", rotulo: "Veículos", Icone: Truck },
  { href: "/conjuntos", rotulo: "Conjuntos", Icone: Link2 },
];
const ADMIN: Item[] = [
  { href: "/usuarios", rotulo: "Usuários", Icone: Users },
  { href: "/auditoria", rotulo: "Auditoria", Icone: History },
];

/** A rota atual pertence ao item? "/" só na raiz; os demais também nas fichas (/motoristas/<id>). */
function ativo(href: string, caminho: string) {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/");
}

function Selo({ n }: { n: number }) {
  return n > 0 ? (
    <span className="contagem" aria-label={`${n} pendências`}>
      {n}
    </span>
  ) : null;
}

/** Seções em pílulas no topo: a pílula preta é um só elemento que desliza até o item atual. */
function NavSecoes({ secoes, caminho, pendencias }: { secoes: Item[]; caminho: string; pendencias: number }) {
  return (
    <LayoutGroup id="nav-secoes">
      <nav className="nav nav-topo" aria-label="Seções">
        {secoes.map(({ href, rotulo }) => {
          const atual = ativo(href, caminho);
          return (
            <Link key={href} href={href} aria-current={atual ? "page" : undefined}>
              {atual && (
                <motion.span
                  layoutId="nav-pilula"
                  className="nav-pilula"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span>{rotulo}</span>
              {href === "/pendencias" && <Selo n={pendencias} />}
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}

/** Item do trilho: só o ícone na tela grande (o nome aparece como dica); na gaveta do celular, ícone e nome. */
function ItemTrilho({ item, caminho, pendencias, gaveta }: { item: Item; caminho: string; pendencias?: number; gaveta?: boolean }) {
  const { href, rotulo, Icone } = item;
  return (
    <Link href={href} className={gaveta ? "so-gaveta" : undefined} aria-current={ativo(href, caminho) ? "page" : undefined}>
      <Icone size={18} strokeWidth={1.7} aria-hidden="true" />
      <span className="rotulo">{rotulo}</span>
      {pendencias !== undefined && <Selo n={pendencias} />}
    </Link>
  );
}

type Props = {
  usuario: { nome: string; papel: string };
  pendencias: number;
  admin: boolean;
  /** Mostra o Financeiro (admin e financeiro). */
  financeiro?: boolean;
  busca: ReactNode;
  children: ReactNode;
};

/** Estrutura `.shell`: topo + trilho (gaveta no celular, `.menu-aberto`): abre no botão, fecha ao clicar
   fora do trilho e ao trocar de página. */
export function MolduraShell({ usuario, pendencias, admin, financeiro = false, busca, children }: Props) {
  const caminho = usePathname();
  const secoes = financeiro ? [...SECOES, FINANCEIRO] : SECOES;
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
          <Link className="marca" href="/" aria-label="NILT, início">
            <span className="marca-sinal" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V8" />
                <path d="M12 8l-4 4" />
                <path d="M12 8l4 4" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <span className="marca-nome">NILT</span>
          </Link>
          <NavSecoes secoes={secoes} caminho={caminho} pendencias={pendencias} />
          <div className="topo-dir">
            {busca}
            <span className="usuario-topo" role="img" aria-label={`${usuario.nome}, ${usuario.papel}`} title={`${usuario.nome} · ${usuario.papel}`}>
              <Avatar nome={usuario.nome} />
            </span>
          </div>
        </header>

        <aside className="sidebar" aria-label="Menu principal">
          <div className="gaveta-cab so-gaveta">
            <span className="marca-sinal" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V8" />
                <path d="M12 8l-4 4" />
                <path d="M12 8l4 4" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <span className="usuario-nome">
              <b>{usuario.nome}</b>
              <span>{usuario.papel}</span>
            </span>
          </div>
          <nav className="trilho-nav" aria-label="Cadastros e administração">
            {secoes.map((item) => (
              <ItemTrilho key={item.href} item={item} caminho={caminho} gaveta pendencias={item.href === "/pendencias" ? pendencias : undefined} />
            ))}
            <hr className="so-gaveta" />
            {CADASTROS.map((item) => (
              <ItemTrilho key={item.href} item={item} caminho={caminho} />
            ))}
            {admin && (
              <>
                <hr />
                <span className="trilho-grupo">Administração</span>
                {ADMIN.map((item) => (
                  <ItemTrilho key={item.href} item={item} caminho={caminho} />
                ))}
              </>
            )}
          </nav>
          <div className="trilho-pe">
            <hr />
            <Link href="/nova-senha" aria-label="Trocar senha">
              <KeyRound size={18} strokeWidth={1.7} aria-hidden="true" />
              <span className="rotulo">Trocar senha</span>
            </Link>
            <form action={sair}>
              <button type="submit" aria-label="Sair">
                <LogOut size={18} strokeWidth={1.7} aria-hidden="true" />
                <span className="rotulo">Sair</span>
              </button>
            </form>
          </div>
        </aside>

        <section className="sheet">
          <div className="sheet-inner">{children}</div>
        </section>
        <Toaster />
      </div>
    </MotionConfig>
  );
}
