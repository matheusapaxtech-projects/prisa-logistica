"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buscarPessoas } from "./buscas";
import type { OpcaoPessoa } from "./pessoas-tipos";

type Props = {
  /** `id` do campo de busca (o rótulo `<label htmlFor>` aponta para ele). */
  id: string;
  /** `name` do campo escondido que leva o id escolhido no `FormData`. */
  nome: string;
  tipo: "proprietario" | "motorista";
  valor: OpcaoPessoa | null;
  aoMudar: (o: OpcaoPessoa | null) => void;
  placeholder?: string;
  /** Mostra "Tirar" para voltar a nenhum (campos opcionais). */
  limpavel?: boolean;
  /** `aria-describedby` do campo (ajuda ou erro). */
  descritoPor?: string;
  invalido?: boolean;
};

const rotulo = (o: OpcaoPessoa) => `${o.nome} (${o.doc})`;

/* Escolha de proprietário (ou motorista) por busca: nome, apelido, nome fantasia ou CPF/CNPJ. A lista
   vem do servidor a cada pausa na digitação (a frota pode ter centenas de cadastros, então não vai
   tudo para a tela). Padrão combobox + listbox: setas, Enter e Esc. O valor vai no campo escondido
   `nome`, para o formulário ler com `FormData`. */
export function SeletorPessoa({ id, nome, tipo, valor, aoMudar, placeholder, limpavel, descritoPor, invalido }: Props) {
  const lista = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoPessoa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);

  // Busca depois de uma pausa; resposta de termo antigo é descartada.
  useEffect(() => {
    if (!aberto) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      const r = await buscarPessoas(tipo, busca);
      if (!vigente) return;
      if (r.ok) {
        setOpcoes(r.dados);
        setErro(null);
        setAtivo(0);
      } else setErro(r.erro);
    }, busca ? 200 : 0);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [aberto, busca, tipo]);

  function fechar() {
    setAberto(false);
    setBusca("");
    setOpcoes(null);
    setErro(null);
  }

  function escolher(o: OpcaoPessoa) {
    aoMudar(o);
    fechar();
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (aberto) e.preventDefault();
      fechar();
      return;
    }
    if (!aberto || !opcoes?.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(opcoes[ativo] ?? opcoes[0]);
    }
  }

  return (
    <div
      className="seletor"
      ref={caixa}
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node | null)) fechar();
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
        aria-activedescendant={aberto && opcoes?.length ? `${lista}-${ativo}` : undefined}
        aria-describedby={descritoPor}
        aria-invalid={invalido || undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={valor ? undefined : (placeholder ?? "Digite nome, CPF ou CNPJ")}
        value={aberto ? busca : valor ? rotulo(valor) : ""}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setAberto(true);
          setBusca(e.target.value);
        }}
        onKeyDown={aoTeclar}
      />
      {limpavel && valor && (
        <button className="btn btn-texto seletor-tirar" type="button" onClick={() => aoMudar(null)}>
          Tirar
        </button>
      )}
      {aberto && (
        <div className="busca-resultados seletor-lista" id={lista} role="listbox">
          {erro ? (
            <div className="busca-vazio">{erro}</div>
          ) : opcoes === null ? (
            <div className="busca-vazio">Buscando…</div>
          ) : opcoes.length ? (
            opcoes.map((o, i) => (
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
                <span>{o.nome}</span>
                <span className="cod">{o.doc}</span>
              </div>
            ))
          ) : (
            <div className="busca-vazio">
              Nada encontrado{busca.trim() ? ` para “${busca.trim()}”` : ""}. Confira o nome ou o documento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
