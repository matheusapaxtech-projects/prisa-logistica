"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { validacao } from "@/lib/validacao";
import type { OpcaoCliente } from "./consultas";

type Props = {
  /** `id` do campo de busca (o rótulo `<label htmlFor>` aponta para ele). */
  id: string;
  /** `name` do campo escondido que leva o id escolhido no `FormData`. */
  nome: string;
  opcoes: OpcaoCliente[];
  valor: OpcaoCliente | null;
  aoMudar: (o: OpcaoCliente | null) => void;
  /** `aria-describedby` do campo (ajuda ou erro). */
  descritoPor?: string;
  invalido?: boolean;
};

const MAX = 50;
const rotulo = (o: OpcaoCliente) => `${o.nome} (${o.doc})`;

function filtrar(opcoes: OpcaoCliente[], termo: string): OpcaoCliente[] {
  const t = termo.trim().toLowerCase();
  if (!t) return opcoes.slice(0, MAX);
  const dig = validacao.soDigitos(t);
  return opcoes
    .filter(
      (o) => o.nome.toLowerCase().includes(t) || o.nomeCompleto.toLowerCase().includes(t) || (dig.length >= 3 && validacao.soDigitos(o.doc).includes(dig)),
    )
    .slice(0, MAX);
}

/* Escolha de cliente por busca (nome, razão social ou CPF/CNPJ), como o seletor de proprietário dos
   veículos, mas filtrando na própria tela: a lista de clientes é curta e já vem inteira com a página.
   Padrão combobox + listbox: setas, Enter e Esc. O valor vai no campo escondido `nome`. */
export function SeletorCliente({ id, nome, opcoes, valor, aoMudar, descritoPor, invalido }: Props) {
  const lista = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const achados = aberto ? filtrar(opcoes, busca) : [];

  function fechar() {
    setAberto(false);
    setBusca("");
    setAtivo(0);
  }

  function escolher(o: OpcaoCliente) {
    aoMudar(o);
    fechar();
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (aberto) e.preventDefault();
      fechar();
      return;
    }
    if (!aberto || !achados.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + achados.length) % achados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(achados[ativo] ?? achados[0]);
    }
  }

  return (
    <div
      className="seletor"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar();
      }}
    >
      <input type="hidden" name={nome} value={valor?.id ?? ""} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && achados.length ? `${lista}-${ativo}` : undefined}
        aria-describedby={descritoPor}
        aria-invalid={invalido || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={valor ? undefined : "Digite o nome, a razão social ou o CNPJ"}
        value={aberto ? busca : valor ? rotulo(valor) : ""}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setAberto(true);
          setBusca(e.target.value);
          setAtivo(0);
        }}
        onKeyDown={aoTeclar}
      />
      {aberto && (
        <div className="busca-resultados seletor-lista" id={lista} role="listbox">
          {achados.length ? (
            achados.map((o, i) => (
              <div
                key={o.id}
                id={`${lista}-${i}`}
                role="option"
                className="seletor-opcao"
                aria-selected={i === ativo}
                // mousedown (antes do blur) para a escolha não se perder quando o campo perde o foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(o);
                }}
              >
                <span>
                  {o.nome}
                  {o.nome !== o.nomeCompleto && <small>{o.nomeCompleto}</small>}
                </span>
                <span className="cod">{o.doc}</span>
              </div>
            ))
          ) : (
            <div className="busca-vazio">
              {opcoes.length
                ? `Nenhum cliente${busca.trim() ? ` com “${busca.trim()}”` : ""}. Confira o nome ou o documento; cliente novo se cadastra em Clientes.`
                : "Nenhum cliente cadastrado. Cadastre em Clientes antes de criar o pedido."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
