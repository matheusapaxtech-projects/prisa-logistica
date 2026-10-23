"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

type Props = {
  /** Abre (`showModal`) quando verdadeiro e fecha quando falso. */
  aberto: boolean;
  /** Chamado quando o diálogo fecha por Esc, pelo botão `data-fechar` ou por `<form method="dialog">`. */
  aoFechar: () => void;
  titulo: ReactNode;
  /** Conteúdo de `.dialogo-corpo` (campos dentro de `<div className="campos">`, textos, avisos). */
  children: ReactNode;
  /** Botões de `.dialogo-pe`. Um botão com `data-fechar` fecha o diálogo; o `type="submit"` dispara `onSubmit`. */
  pe: ReactNode;
  /** Envio do formulário do diálogo. Chame `e.preventDefault()` para validar/gravar antes de fechar
     (feche mudando `aberto`). Sem `onSubmit`, o envio só fecha (`method="dialog"`). */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Classe extra no `<dialog>`. */
  className?: string;
};

/* Diálogo modal do protótipo: `<dialog class="dialogo">` + `<form method="dialog" novalidate>` com
   cabeçalho, corpo e pé. Use para confirmar ações e para inclusões curtas.
   Não coloque o <Dialogo> dentro de outro <form> (form dentro de form é HTML inválido e quebra a hidratação):
   renderize-o ao lado do formulário da página. */
export function Dialogo({ aberto, aoFechar, titulo, children, pe, onSubmit, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (aberto && !dlg.open) {
      dlg.showModal();
      dlg.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=radio]),select,textarea")?.focus();
    }
    if (!aberto && dlg.open) dlg.close();
  }, [aberto]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const aoClose = () => fechar.current();
    dlg.addEventListener("close", aoClose);
    return () => dlg.removeEventListener("close", aoClose);
  }, []);

  return (
    <dialog ref={ref} className={`dialogo${className ? ` ${className}` : ""}`} aria-labelledby={idTitulo}>
      <form
        method="dialog"
        noValidate
        onSubmit={onSubmit}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-fechar]")) ref.current?.close();
        }}
      >
        <div className="dialogo-cab">
          <h2 id={idTitulo}>{titulo}</h2>
        </div>
        <div className="dialogo-corpo">{children}</div>
        <div className="dialogo-pe">{pe}</div>
      </form>
    </dialog>
  );
}
