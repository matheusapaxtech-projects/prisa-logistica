"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, RotateCw, Upload } from "lucide-react";
import { abrirDocumento } from "@/components/documentos-acoes";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { toast } from "@/components/Toast";
import { erroDoArquivo, TIPOS_ACEITOS } from "@/lib/arquivos";
import { enviarObjeto } from "@/lib/envio-navegador";
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
  const reenvio = useRef<HTMLInputElement>(null);
  const [reenviando, setReenviando] = useState<CanhotoDaViagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [ocupado, iniciar] = useTransition();

  function abrir(c: CanhotoDaViagem) {
    // A janela abre no clique (senão o navegador bloqueia) e recebe o link quando ele chega.
    const janela = window.open("", "_blank");
    iniciar(async () => {
      const r = await abrirDocumento(c.id);
      if (!r.ok) {
        janela?.close();
        toast(r.erro, "alert-circle");
        return;
      }
      if (janela) {
        janela.opener = null;
        janela.location.href = r.dados;
      } else window.open(r.dados, "_blank", "noopener");
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

  function reenviar(arquivo: File | undefined) {
    const c = reenviando;
    if (reenvio.current) reenvio.current.value = "";
    if (!c || !arquivo) return;
    const problema = erroDoArquivo(arquivo);
    if (problema) return toast(problema, "alert-circle");
    iniciar(async () => {
      const ok = await enviarObjeto(c.caminho, arquivo);
      setReenviando(null);
      if (!ok) return toast(MSG_FALHA_ENVIO_CANHOTO, "alert-circle");
      toast(`Canhoto enviado: ${arquivo.name}`, "upload");
      router.refresh();
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
                    onClick={() => {
                      setReenviando(c);
                      reenvio.current?.click();
                    }}
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
        <EstadoVazio>Nenhum canhoto ainda. Ele é pedido para passar de “Aguardando descarga” para a contagem.</EstadoVazio>
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
      <input ref={reenvio} type="file" accept={TIPOS_ACEITOS} hidden onChange={(e) => reenviar(e.currentTarget.files?.[0])} />
    </section>
  );
}
