"use client";

import { useCallback, useState, type FormEvent, type MouseEvent } from "react";
import { toast } from "@/components/Toast";

type Props = {
  /** Há alteração não salva? A barra só aparece quando verdadeiro. */
  pendente: boolean;
  /** "Descartar": a página volta os campos (ex.: `form.reset()`) e zera `pendente`. */
  onDescartar: () => void;
  /** "Salvar alterações". Sem `onSalvar`, o botão é `type="submit"` e dispara o `onSubmit` do formulário
     em volta (a barra precisa estar dentro do `<form>`). Antes de salvar, se algum `.campo` do formulário
     estiver marcado como inválido, mostra o aviso do protótipo e foca o campo, sem salvar. */
  onSalvar?: () => void;
  /** Enquanto grava: desabilita os botões e troca o texto para "Salvando…". */
  salvando?: boolean;
  /** Texto da barra. Padrão: "Alterações não salvas nesta ficha". */
  texto?: string;
};

/* Barra de salvar da ficha (`.barra-salvar` + `montarSalvar` do protótipo). Um modelo de salvar por tela. */
export function BarraSalvar({ pendente, onDescartar, onSalvar, salvando = false, texto }: Props) {
  function confirmar(e: MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form ?? e.currentTarget.closest("form");
    const invalido = form?.querySelector("[data-invalido]");
    if (invalido) {
      e.preventDefault();
      toast("Corrija os campos marcados em vermelho antes de salvar.", "alert-circle");
      invalido.querySelector<HTMLElement>("input, select")?.focus();
      return;
    }
    onSalvar?.();
  }

  return (
    <div className="barra-salvar" hidden={!pendente}>
      <span>{texto ?? "Alterações não salvas nesta ficha"}</span>
      <span className="espaco" />
      <button className="btn btn-texto" type="button" data-descartar onClick={onDescartar} disabled={salvando}>
        Descartar
      </button>
      <button
        className="btn btn-primario"
        type={onSalvar ? "button" : "submit"}
        data-confirmar
        onClick={confirmar}
        disabled={salvando}
      >
        {salvando ? "Salvando…" : "Salvar alterações"}
      </button>
    </div>
  );
}

/** Liga a barra a um formulário: `<form onInput={aoAlterar} ...>`; arquivo escolhido não conta como
   alteração (igual ao protótipo). `limpar()` depois de salvar ou descartar. */
export function useAlteracoes() {
  const [pendente, setPendente] = useState(false);
  const aoAlterar = useCallback((e: FormEvent<HTMLFormElement>) => {
    if ((e.target as HTMLInputElement).type !== "file") setPendente(true);
  }, []);
  const limpar = useCallback(() => setPendente(false), []);
  return { pendente, aoAlterar, limpar };
}
