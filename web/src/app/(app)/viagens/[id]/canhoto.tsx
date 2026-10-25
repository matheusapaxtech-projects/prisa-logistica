"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, RotateCw, Upload } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { toast } from "@/components/Toast";
import { erroDoArquivo, TIPOS_ACEITOS } from "@/lib/arquivos";
import { abrirEmNovaJanela, useReenvio } from "@/lib/envio-navegador";
import { formato } from "@/lib/formato";
import { CabPainel } from "../../_pessoa/partes";
import type { CanhotoDaViagem } from "../consultas";
import { enviarCanhotoDoNavegador, MSG_FALHA_ENVIO_CANHOTO } from "../envio";

type Props = {
  viagemId: string;
  canhotos: CanhotoDaViagem[];
  /** Operação e admin (pode_editar), viagem iniciada e não cancelada. */
  podeEnviar: boolean;
};

/* Bloco "Canhoto" da ficha: o(s) canhoto(s) enviados (abrir registra a visualização), envio novo
   (linha em `arquivo` → objeto no Storage) e "Enviar de novo" quando o objeto não chegou. */
export function Canhoto({ viagemId, canhotos, podeEnviar }: Props) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [ocupado, iniciar] = useTransition();
  const { campo: campoReenvio, escolher: escolherReenvio, aoEscolher: reenviar } = useReenvio<CanhotoDaViagem>({
    iniciar,
    msgFalha: MSG_FALHA_ENVIO_CANHOTO,
    aoEnviar: (arquivo) => {
      toast(`Canhoto enviado: ${arquivo.name}`, "upload");
      router.refresh();
    },
  });

  function abrir(c: CanhotoDaViagem) {
    const aberto = abrirEmNovaJanela(c.id);
    iniciar(async () => {
      const r = await aberto;
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(`Visualização registrada: ${c.nome}`, "eye");
    });
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const arquivo = new FormData(form).get("arquivo");
    const f = arquivo instanceof File && arquivo.size ? arquivo : null;
    const problema = erroDoArquivo(f);
    setErro(problema);
    if (problema || !f) return campo.current?.focus();
    iniciarEnvio(async () => {
      const r = await enviarCanhotoDoNavegador(viagemId, f);
      router.refresh();
      if (!r.ok) return setErro(r.erro);
      form.reset();
      toast(`Canhoto enviado: ${f.name}`, "upload");
    });
  }

  return (
    <section className="subsecao canhoto" id="canhoto">
      <CabPainel titulo="Canhoto" />
      {canhotos.length ? (
        <ul className="lista-arquivos">
          {canhotos.map((c) => (
            <li key={c.id}>
              <span className="nome">
                <b>{c.nome}</b>
                <span className="linha2">
                  enviado em {formato.dataHora(c.enviadoEm)}
                  <Ponto />
                  {formato.kb(c.tamanho || 0)}
                  {c.envioFalhou && (
                    <>
                      <Ponto />
                      <span className="val val-vencido">envio falhou</span>
                    </>
                  )}
                </span>
              </span>
              {c.envioFalhou ? (
                podeEnviar && (
                  <button
                    className="btn btn-texto"
                    type="button"
                    disabled={ocupado}
                    onClick={() => escolherReenvio(c)}
                  >
                    <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
                    Enviar de novo
                  </button>
                )
              ) : (
                <button className="btn btn-texto" type="button" disabled={ocupado} onClick={() => abrir(c)}>
                  <Eye size={16} strokeWidth={1.6} aria-hidden="true" />
                  Abrir
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhum canhoto ainda. Ele é pedido para passar de “Descarregando” para a contagem.</EstadoVazio>
      )}

      {podeEnviar && (
        <form className="envio-canhoto" onSubmit={enviar} noValidate>
          {erro && (
            <div className="aviso aviso-bloqueado" role="alert">
              <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}
          <div className="campo">
            <label htmlFor="arquivo-canhoto">{canhotos.length ? "Enviar outro canhoto" : "Arquivo do canhoto"}</label>
            <input
              ref={campo}
              id="arquivo-canhoto"
              name="arquivo"
              type="file"
              accept={TIPOS_ACEITOS}
              aria-invalid={erro ? true : undefined}
              onChange={() => setErro(null)}
            />
            <span className="ajuda">Foto ou PDF do canhoto assinado: PDF, JPG, PNG ou HEIC de até 20 MB.</span>
          </div>
          <div>
            <button className="btn" type="submit" id="btn-enviar-canhoto" disabled={enviando}>
              <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
              {enviando ? "Enviando…" : "Enviar canhoto"}
            </button>
          </div>
        </form>
      )}
      <input ref={campoReenvio} type="file" accept={TIPOS_ACEITOS} hidden onChange={(e) => reenviar(e.currentTarget.files?.[0])} />
    </section>
  );
}
