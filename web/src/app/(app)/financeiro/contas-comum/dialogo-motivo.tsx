"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Dialogo } from "@/components/Dialogo";
import { toast } from "@/components/Toast";
import type { ResultadoAcao } from "@/lib/acao";
import { CampoDialogo } from "./campo-dialogo";
import { lerMotivo, MAX_MOTIVO } from "./leitura";

export type TextosMotivo = {
  titulo: string;
  explica: string;
  rotulo: string;
  voltar: string;
  enviar: string;
  sucesso: string;
  para: "cancelamento" | "liberação";
  /** Botão de envio vermelho (cancelar) em vez de escuro. */
  perigo: boolean;
};

/* Diálogo que pede um motivo antes de uma ação (cancelar a conta, liberar a antecipação): confere o motivo, chama a
   ação com ele e mostra a frase do banco se recusar. Quem usa passa o resumo da conta, os textos e a ação do servidor.
   Monte o diálogo só quando for abrir. */
export function DialogoMotivo({
  textos,
  resumo,
  acao,
  aoFechar,
}: {
  textos: TextosMotivo;
  resumo: ReactNode;
  acao: (motivo: string) => Promise<ResultadoAcao<unknown>>;
  aoFechar: () => void;
}) {
  const id = useId();
  const t = textos;
  const [erro, setErro] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
    setErroAcao(null);
    const lido = lerMotivo(motivo, t.para);
    if (!lido.ok) {
      setErro(lido.erro);
      e.currentTarget.querySelector<HTMLElement>('[name="motivo"]')?.focus();
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await acao(lido.motivo);
      if (!r.ok) {
        setErroAcao(r.erro);
        return;
      }
      toast(t.sucesso);
      aoFechar();
    });
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={t.titulo}
      onSubmit={aoEnviar}
      pe={
        <>
          <button className="btn" type="button" data-fechar>
            {t.voltar}
          </button>
          <button className={`btn ${t.perigo ? "btn-perigo" : "btn-primario"}`} type="submit" disabled={gravando} aria-busy={gravando}>
            {t.enviar}
          </button>
        </>
      }
    >
      {resumo}
      <p className="nota">{t.explica}</p>
      <div className="campos" onInput={() => erro && setErro(null)}>
        <CampoDialogo classe="f12" id={`${id}-motivo`} rotulo={t.rotulo} erro={erro ?? undefined}>
          <textarea
            id={`${id}-motivo`}
            name="motivo"
            rows={3}
            maxLength={MAX_MOTIVO}
            aria-invalid={!!erro || undefined}
            aria-describedby={erro ? `${id}-motivo-erro` : undefined}
          />
        </CampoDialogo>
      </div>
      {erroAcao && (
        <div className="aviso aviso-bloqueado" role="alert">
          <p>{erroAcao}</p>
        </div>
      )}
    </Dialogo>
  );
}
