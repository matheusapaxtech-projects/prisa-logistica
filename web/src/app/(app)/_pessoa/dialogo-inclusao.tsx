"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import type { ResultadoForm } from "./formulario";
import "@/styles/paginas/pessoa.css";

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  /** Texto do botão de confirmar (ex.: "Adicionar endereço"). */
  botao: string;
  /** Server Action que grava (recebe o FormData do diálogo). */
  acao: (form: FormData) => Promise<ResultadoForm>;
  /** Toast depois de gravar (ex.: "Endereço adicionado."). */
  sucesso: string;
  /** Campos do diálogo; `campos[nome]` é o erro da validação para o `erro` do <Campo>. */
  children: (campos: Record<string, string>) => ReactNode;
};

/* Diálogo de inclusão das listas da ficha (endereço, telefone, conta, Pix, referência): grava na hora
   pela Server Action, marca os campos recusados sem limpar o que foi digitado e, no sucesso, fecha,
   avisa e recarrega os dados da página. */
export function DialogoInclusao({ aberto, aoFechar, titulo, botao, acao, sucesso, children }: Props) {
  const router = useRouter();
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();
  // Cada abertura começa com os campos limpos (a chave remonta os campos não controlados).
  const [vez, setVez] = useState(0);
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setVez((n) => n + 1);
      setCampos({});
      setErro(null);
    }
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setCampos({});
    setErro(null);
    iniciar(async () => {
      const r = await acao(dados);
      if (!r.ok) {
        if ("campos" in r) {
          setCampos(r.campos);
          const primeiro = Object.keys(r.campos)[0];
          form.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
        } else setErro(r.erro);
        return;
      }
      toast(sucesso, "plus");
      aoFechar();
      router.refresh();
    });
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      onSubmit={enviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar disabled={gravando}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" disabled={gravando}>
            {gravando ? "Gravando…" : botao}
          </button>
        </>
      }
    >
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      <div
        className="campos"
        key={vez}
        onInput={(e) => {
          // Como o protótipo: editar um campo marcado tira a marca (selects e áreas de texto também).
          const nome = (e.target as HTMLInputElement).name;
          if (!nome || !campos[nome]) return;
          setCampos((c) => {
            const n = { ...c };
            delete n[nome];
            return n;
          });
        }}
      >
        {children(campos)}
      </div>
    </Dialogo>
  );
}
