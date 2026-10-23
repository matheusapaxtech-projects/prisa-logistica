"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buscar } from "@/components/busca-acoes";
import { Placa } from "@/components/Placa";
import type { ResultadoBusca } from "@/lib/busca";

const ESPERA_MS = 180;

type Resposta = { termo: string; itens: ResultadoBusca[]; erro?: string };

/* Busca global da topbar (`montarBusca` do protótipo): placa, CPF, CNPJ ou nome; setas escolhem,
   Enter abre, Esc limpa; "/" em qualquer lugar fora de um campo foca a busca. */
export function BuscaGlobal() {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);
  const [valor, setValor] = useState("");
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [sel, setSel] = useState(-1);

  // Pede ao servidor um pouco depois da última tecla; respostas antigas são descartadas.
  useEffect(() => {
    const termo = valor.trim();
    const n = ++pedido.current;
    if (!termo) return;
    const espera = setTimeout(async () => {
      const r = await buscar(termo).catch(() => null);
      if (n !== pedido.current) return;
      setSel(-1);
      if (!r) setResposta({ termo, itens: [], erro: "A busca não respondeu. Tente de novo em instantes." });
      else setResposta(r.ok ? { termo, itens: r.dados } : { termo, itens: [], erro: r.erro });
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [valor]);

  useEffect(() => {
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      const ativo = document.activeElement?.tagName ?? "";
      if (e.key === "/" && !/input|textarea|select/i.test(ativo)) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".busca")) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("click", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("click", aoClicar);
    };
  }, []);

  // Enquanto a resposta do termo novo não chega, a lista anterior continua na tela (sem piscar).
  const termo = valor.trim();
  const itens = resposta?.itens ?? [];
  const visivel = aberto && !!termo && !!resposta;

  function limpar() {
    setValor("");
    setResposta(null);
    setSel(-1);
    setAberto(false);
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!itens.length) return;
      setSel((s) => (s + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length);
    }
    if (e.key === "Enter" && itens.length && resposta?.termo === termo) {
      e.preventDefault();
      const alvo = itens[sel] ?? itens[0];
      limpar();
      campo.current?.blur();
      router.push(alvo.href);
    }
    if (e.key === "Escape") {
      limpar();
      campo.current?.blur();
    }
  }

  return (
    <div className="busca" role="search">
      <Search size={16} strokeWidth={1.6} aria-hidden="true" />
      <input
        ref={campo}
        id="busca-global"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Buscar placa, CPF, CNPJ ou nome"
        aria-label="Buscar placa, CPF, CNPJ ou nome"
        aria-controls="busca-resultados"
        aria-expanded={visivel}
        aria-activedescendant={visivel && sel >= 0 ? `br-${sel}` : undefined}
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
      />
      <kbd>/</kbd>
      <div className="busca-resultados" id="busca-resultados" role="listbox" hidden={!visivel}>
        {itens.length ? (
          itens.map((x, i) => (
            <Link key={x.href} href={x.href} role="option" id={`br-${i}`} aria-selected={i === sel} onClick={limpar}>
              {x.placa ? <Placa placa={x.placa} /> : <span className="cod">{x.cod}</span>}
              <span>{x.nome}</span>
              <span className="tipo">{x.tipo}</span>
            </Link>
          ))
        ) : (
          <div className="busca-vazio">
            {resposta?.erro ?? `Nada encontrado para “${resposta?.termo ?? termo}”. Confira a placa ou o documento.`}
          </div>
        )}
      </div>
    </div>
  );
}
