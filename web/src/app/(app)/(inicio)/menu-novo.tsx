"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Building2, IdCard, Plus, Truck } from "lucide-react";

/* Menu "Novo cadastro" (botão verde do Início). Igual ao protótipo: abre e foca o primeiro item,
   fecha ao clicar fora e no Esc (devolvendo o foco ao botão). */
export function MenuNovo() {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector("a")?.focus();
    const fechar = () => setAberto(false);
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, [aberto]);

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      botao.current?.focus();
    }
  }

  const icone = { size: 16, strokeWidth: 1.6, "aria-hidden": true } as const;
  const item = { gridTemplateColumns: "20px 1fr" } as const;

  return (
    <div className="menu-novo" style={{ position: "relative" }}>
      <button
        ref={botao}
        className="btn btn-primario"
        type="button"
        id="btn-novo"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={(e) => {
          e.stopPropagation();
          setAberto((a) => !a);
        }}
      >
        <Plus {...icone} />
        Novo cadastro
      </button>
      <div
        ref={menu}
        className="busca-resultados"
        id="menu-novo"
        role="menu"
        hidden={!aberto}
        style={{ left: "auto", right: 0, width: 240 }}
        onKeyDown={aoTeclar}
      >
        <Link role="menuitem" href="/motoristas/novo" style={item}>
          <IdCard {...icone} />
          <span>Motorista</span>
        </Link>
        <Link role="menuitem" href="/proprietarios/novo" style={item}>
          <Building2 {...icone} />
          <span>Proprietário</span>
        </Link>
        <Link role="menuitem" href="/veiculos/novo" style={item}>
          <Truck {...icone} />
          <span>Veículo</span>
        </Link>
      </div>
    </div>
  );
}
