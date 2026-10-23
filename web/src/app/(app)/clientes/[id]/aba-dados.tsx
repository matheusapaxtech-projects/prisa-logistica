"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { BarraSalvar, useAlteracoes } from "@/components/BarraSalvar";
import { toast } from "@/components/Toast";
import { BlocoPessoa } from "../../_pessoa/bloco-pessoa";
import { MSG_FALTAM_DADOS } from "../../_pessoa/formulario";
import { salvarDadosCliente } from "../actions";
import type { PessoaRow } from "../consultas";

type Props = { pessoa: PessoaRow; podeEditar: boolean };

/* Aba "Dados" da ficha do cliente: a identificação da pessoa (o mesmo bloco da ficha de proprietário)
   com a barra de salvar. Remonta a cada gravação (a página passa `key = updated_at`). */
export function AbaDados({ pessoa: p, podeEditar }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { pendente, aoAlterar, limpar } = useAlteracoes();
  const [estado, enviar, salvando] = useActionState(salvarDadosCliente, null);
  const [dispensado, setDispensado] = useState<typeof estado>(null);

  const resposta = estado !== dispensado ? estado : null;
  const campos: Record<string, string> = resposta && !resposta.ok && "campos" in resposta ? (resposta.campos as Record<string, string>) : {};
  const erro = resposta && !resposta.ok && !("campos" in resposta) ? resposta.erro : null;

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast("Alterações salvas.");
      router.refresh();
    } else if ("campos" in estado) {
      toast(MSG_FALTAM_DADOS, "alert-circle");
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(estado.campos)[0]}"]`)?.focus();
    }
  }, [estado, router]);

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    const dados = new FormData(e.currentTarget);
    setDispensado(estado);
    startTransition(() => enviar(dados));
  }

  function descartar() {
    form.current?.reset();
    setDispensado(estado);
    limpar();
  }

  const corpo = (
    <>
      <input type="hidden" name="pessoa_id" value={p.id} />
      <BlocoPessoa pessoa={p} campos={campos} podeEditar={podeEditar} />
    </>
  );

  return (
    <form id="form" ref={form} noValidate onInput={podeEditar ? aoAlterar : undefined} onSubmit={salvar}>
      {podeEditar ? (
        corpo
      ) : (
        <fieldset disabled className="ficha-leitura">
          {corpo}
        </fieldset>
      )}
      {erro && (
        <div className="aviso aviso-bloqueado" role="alert">
          <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}
      {podeEditar && <BarraSalvar pendente={pendente} salvando={salvando} onDescartar={descartar} />}
    </form>
  );
}
