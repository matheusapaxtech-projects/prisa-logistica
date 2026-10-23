"use client";

import { useImperativeHandle, useRef, useState, type ChangeEvent, type KeyboardEvent, type Ref } from "react";
import { Search } from "lucide-react";
import { mascaras } from "@/lib/formato";
import { mensagensValidacao, validacao } from "@/lib/validacao";
import { buscarPessoa, type PessoaAchada } from "./actions";

/** O que a consulta achou: ainda nada (documento incompleto ou inválido), procurando, a pessoa
   (`null` = não cadastrada) ou erro da consulta. */
export type Consulta =
  | { estado: "nada" }
  | { estado: "buscando"; documento: string }
  | { estado: "achado"; documento: string; pessoa: PessoaAchada | null }
  | { estado: "erro"; erro: string };

export type ConsultaDocumentoRef = {
  /** Confere de novo como o botão "Verificar" (mostra o que falta quando incompleto). */
  verificar: () => void;
  focar: () => void;
};

type Props = {
  tipo: "cpf" | "cnpj";
  id: string;
  name: string;
  label: string;
  /** Classe de largura na grade (`f5`…). */
  classe?: string;
  /** Documento já preenchido (ex.: `?cpf=` vindo da ficha); confere ao montar. */
  inicial?: string;
  ajuda?: string;
  aoMudar: (c: Consulta) => void;
  ref?: Ref<ConsultaDocumentoRef>;
};

const TAMANHO = { cpf: 11, cnpj: 14 } as const;
const NOME = { cpf: "CPF", cnpj: "CNPJ" } as const;

/* Campo de CPF/CNPJ com "Verificar" (motorista-novo.html): ao completar os dígitos confere o
   documento e procura a pessoa no NILT, antes de criar outra. A tela decide o que mostrar. */
export function ConsultaDocumento({ tipo, id, name, label, classe = "f5", inicial, ajuda, aoMudar, ref }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);
  const [erro, setErro] = useState<string | null>(null);
  const [valido, setValido] = useState(false);
  const iniciado = useRef(false);

  async function verificar(explicito: boolean) {
    const el = input.current;
    if (!el) return;
    const d = validacao.soDigitos(el.value);
    const n = TAMANHO[tipo];
    const meu = ++pedido.current;
    setValido(false);
    if (d.length < n) {
      aoMudar({ estado: "nada" });
      if (explicito) {
        const falta = n - d.length;
        setErro(d.length ? `Faltam ${falta} ${falta === 1 ? "dígito" : "dígitos"} no ${NOME[tipo]}.` : `Digite o ${NOME[tipo]} para conferir.`);
      }
      return;
    }
    if (!validacao[tipo](d)) {
      setErro(mensagensValidacao[tipo]);
      aoMudar({ estado: "nada" });
      return;
    }
    setErro(null);
    setValido(true);
    aoMudar({ estado: "buscando", documento: d });
    const r = await buscarPessoa(d);
    if (meu !== pedido.current) return; // chegou depois de outra digitação
    aoMudar(r.ok ? { estado: "achado", documento: d, pessoa: r.dados } : { estado: "erro", erro: r.erro });
  }

  useImperativeHandle(ref, () => ({ verificar: () => void verificar(true), focar: () => input.current?.focus() }));

  // ?cpf= vindo da ficha: confere uma vez, ao montar.
  const montar = (el: HTMLInputElement | null) => {
    input.current = el;
    if (el && inicial && !iniciado.current) {
      iniciado.current = true;
      queueMicrotask(() => void verificar(true));
    }
  };

  function aoDigitar(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    el.value = mascaras[tipo](el.value);
    setErro(null);
    if (validacao.soDigitos(el.value).length === TAMANHO[tipo]) void verificar(false);
    else {
      pedido.current++;
      setValido(false);
      aoMudar({ estado: "nada" });
    }
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void verificar(true);
    }
  }

  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  return (
    <div className={`campo ${classe}`} data-invalido={erro ? "" : undefined} data-valido={valido ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      <div className="com-acao">
        <input
          ref={montar}
          id={id}
          name={name}
          className="cod"
          inputMode="numeric"
          autoComplete="off"
          placeholder={tipo === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
          defaultValue={inicial ? mascaras[tipo](inicial) : undefined}
          aria-describedby={`${ajuda ? idAjuda : ""}${erro ? ` ${idErro}` : ""}`.trim() || undefined}
          aria-invalid={erro ? true : undefined}
          onChange={aoDigitar}
          onKeyDown={aoTeclar}
        />
        <button className="btn" type="button" onClick={() => void verificar(true)}>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          Verificar
        </button>
      </div>
      {ajuda && (
        <span className="ajuda" id={idAjuda}>
          {ajuda}
        </span>
      )}
      {erro && (
        <span className="erro" id={idErro}>
          {erro}
        </span>
      )}
    </div>
  );
}
