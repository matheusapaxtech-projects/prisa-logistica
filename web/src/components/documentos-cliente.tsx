"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, Lock, RotateCw, Trash2, Upload } from "lucide-react";
import { TIPOS_ACEITOS, erroDoArquivo, mimeDoArquivo, type DonoArquivo } from "@/lib/arquivos";
import { formato } from "@/lib/formato";
import { abrirEmNovaJanela, enviarObjeto, useReenvio } from "@/lib/envio-navegador";
import { apagarDocumento, conferirDocumento, prepararEnvio } from "@/components/documentos-acoes";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { toast } from "@/components/Toast";

export type TipoDocumento = { id: number; nome: string };

export type LinhaDocumento = {
  id: string;
  tipo: string;
  nome: string;
  tamanho: number | null;
  numero: string | null;
  validade: string | null;
  estado: "normal" | "vencendo" | "vencido" | "neutro";
  textoValidade: string | null;
  conferidoPor: string | null;
  conferidoEm: string | null;
  restrito: boolean;
  caminho: string;
  envioFalhou: boolean;
};

type Props = {
  dono: DonoArquivo;
  linhas: LinhaDocumento[];
  tipos: TipoDocumento[];
  podeEditar: boolean;
  admin: boolean;
  nomeUsuario: string;
  titulo: string;
  vazio: string;
  tipoSugerido?: string;
  /** `id` da seção "Enviar documento" (para o botão "Anexar documento" da ficha rolar até ela). */
  idEnvio?: string;
};

const MSG_FALHA_ENVIO =
  "O arquivo não chegou ao armazenamento. O documento ficou marcado como “envio falhou”: use “Enviar de novo”.";

/* Parte interativa de <Documentos> (marcação da aba Documentos de prototipo/motorista.html). */
export function DocumentosLista({
  dono,
  linhas,
  tipos,
  podeEditar,
  admin,
  nomeUsuario,
  titulo,
  vazio,
  tipoSugerido,
  idEnvio,
}: Props) {
  // Ids únicos por instância: duas listas na mesma página não colidem.
  const base = useId();
  const id = (parte: string) => `${base}-${parte}`;
  const campoArquivo = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [apagar, setApagar] = useState<LinhaDocumento | null>(null);

  const visiveis = linhas.filter((a) => admin || !a.restrito);
  const sugerido = tipos.find((t) => t.nome === tipoSugerido)?.id ?? tipos[0]?.id;

  const { campo: campoReenvio, escolher: escolherReenvio, aoEscolher: reenviar } = useReenvio<LinhaDocumento>({
    iniciar,
    msgFalha: MSG_FALHA_ENVIO,
    aoEnviar: (arquivo) => {
      toast(`Arquivo enviado: ${arquivo.name}`, "upload");
      router.refresh();
    },
  });

  function abrir(a: LinhaDocumento) {
    const aberto = abrirEmNovaJanela(a.id);
    iniciar(async () => {
      const r = await aberto;
      if (!r.ok) {
        toast(r.erro, "alert-circle");
        return;
      }
      toast(`Visualização registrada: ${a.nome}`, "eye");
      router.refresh();
    });
  }

  function conferir(a: LinhaDocumento) {
    iniciar(async () => {
      const r = await conferirDocumento(a.id);
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(`${a.tipo} conferido por ${nomeUsuario}`);
      router.refresh();
    });
  }

  function confirmarApagar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const a = apagar;
    if (!a) return;
    iniciar(async () => {
      const r = await apagarDocumento(a.id);
      setApagar(null);
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(`Documento apagado: ${a.nome}`, "trash-2");
      router.refresh();
    });
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const arquivo = fd.get("arquivo");
    const erro = erroDoArquivo(arquivo instanceof File ? arquivo : undefined);
    setErroGeral(null);
    setErroArquivo(erro);
    if (erro || !(arquivo instanceof File)) {
      campoArquivo.current?.focus();
      return;
    }
    iniciarEnvio(async () => {
      const r = await prepararEnvio({
        ...dono,
        tipoArquivoId: Number(fd.get("tipo")),
        nome: arquivo.name,
        mime: mimeDoArquivo(arquivo.name, arquivo.type) as "application/pdf",
        tamanho: arquivo.size,
        validade: String(fd.get("validade") || "") || null,
        numero: String(fd.get("numero") || "").trim() || null,
        restrito: fd.get("restrito") === "on",
      });
      if (!r.ok) return setErroGeral(r.erro);
      const ok = await enviarObjeto(r.dados.caminho, arquivo);
      router.refresh();
      if (!ok) return setErroGeral(MSG_FALHA_ENVIO);
      form.reset();
      toast(`Arquivo enviado: ${arquivo.name}`, "upload");
    });
  }

  return (
    <>
      <div className="subsecao">
        <div className="painel-cab">
          <h2>{titulo}</h2>
          <span className="dir">
            <span className="muted small">{admin ? "Arquivos restritos só aparecem para administradores." : ""}</span>
          </span>
        </div>
        {visiveis.length ? (
          <div className="tabela-wrap">
            <table className="tabela leve empilha">
              <thead>
                <tr>
                  <th scope="col">Documento</th>
                  <th scope="col">Validade</th>
                  <th scope="col">Conferido por</th>
                  <th scope="col">Acesso</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((a) => (
                  <tr key={a.id}>
                    <td className="cel-1">
                      <span className="id">{a.tipo}</span>
                      <span className="linha2">
                        {a.nome}
                        <Ponto />
                        {formato.kb(a.tamanho || 0)}
                        {a.numero && (
                          <>
                            <Ponto />
                            nº {a.numero}
                          </>
                        )}
                        {a.envioFalhou && (
                          <>
                            <Ponto />
                            <span className="val val-vencido">envio falhou</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      {a.validade ? (
                        <>
                          <span className={`val${a.estado === "normal" ? "" : ` val-${a.estado}`}`}>
                            {formato.data(a.validade)}
                          </span>
                          <span className="linha2">{a.textoValidade}</span>
                        </>
                      ) : (
                        <span className="dash">sem validade</span>
                      )}
                    </td>
                    <td>
                      {a.conferidoEm ? (
                        <>
                          <span className="so-cel">conferido por </span>
                          {a.conferidoPor ?? <span className="dash">—</span>}
                          <span className="linha2">em {a.conferidoEm}</span>
                        </>
                      ) : podeEditar && !a.envioFalhou ? (
                        <button className="btn btn-texto" type="button" disabled={ocupado} onClick={() => conferir(a)}>
                          Conferir
                        </button>
                      ) : (
                        <span className="muted">não conferido</span>
                      )}
                    </td>
                    {a.restrito ? (
                      <td>
                        <span className="marca-texto">
                          <Lock size={16} strokeWidth={1.6} aria-hidden="true" />
                          Restrito
                        </span>
                      </td>
                    ) : (
                      <td className="vazio-cel">
                        <span className="dash">todos</span>
                      </td>
                    )}
                    <td className="acoes-linha">
                      {a.envioFalhou ? (
                        podeEditar && (
                          <button className="btn" type="button" disabled={ocupado} onClick={() => escolherReenvio(a)}>
                            <RotateCw size={16} strokeWidth={1.6} aria-hidden="true" />
                            Enviar de novo
                          </button>
                        )
                      ) : (
                        <button className="btn" type="button" disabled={ocupado} onClick={() => abrir(a)}>
                          <Eye size={16} strokeWidth={1.6} aria-hidden="true" />
                          Abrir
                        </button>
                      )}
                      {admin && (
                        <button
                          className="btn btn-texto btn-icone"
                          type="button"
                          aria-label={`Apagar ${a.nome}`}
                          title="Apagar"
                          disabled={ocupado}
                          onClick={() => setApagar(a)}
                        >
                          <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>{vazio}</EstadoVazio>
        )}
        <input
          ref={campoReenvio}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={TIPOS_ACEITOS}
          onChange={(e) => reenviar(e.currentTarget.files?.[0])}
        />
      </div>

      {podeEditar && (
        <section className="subsecao bloco bloco-corpo" aria-labelledby={id("h-enviar")} id={idEnvio ?? id("enviar")}>
          <h2 id={id("h-enviar")} className="enviar-titulo">
            Enviar documento
          </h2>
          <form onSubmit={enviar} noValidate>
            <div className="campos">
              {erroGeral && (
                <div className="aviso aviso-bloqueado f12" role="alert">
                  <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
                  <span>{erroGeral}</span>
                </div>
              )}
              <div className="campo f4">
                <label htmlFor={id("tipo")}>Tipo de arquivo</label>
                <select id={id("tipo")} name="tipo" defaultValue={sugerido}>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo f4">
                <label htmlFor={id("validade")}>
                  Validade <span className="opcional">(opcional)</span>
                </label>
                <input id={id("validade")} name="validade" type="date" />
              </div>
              <div className="campo f4">
                <label htmlFor={id("numero")}>
                  Número do documento <span className="opcional">(opcional)</span>
                </label>
                <input id={id("numero")} name="numero" autoComplete="off" />
              </div>
              <div className="campo f8" data-invalido={erroArquivo ? "" : undefined}>
                <label htmlFor={id("arquivo")}>Arquivo</label>
                <input
                  ref={campoArquivo}
                  id={id("arquivo")}
                  name="arquivo"
                  type="file"
                  accept={TIPOS_ACEITOS}
                  aria-describedby={erroArquivo ? `${id("arquivo-ajuda")} ${id("arquivo-erro")}` : id("arquivo-ajuda")}
                  aria-invalid={erroArquivo ? true : undefined}
                  onChange={() => setErroArquivo(null)}
                />
                <span className="ajuda" id={id("arquivo-ajuda")}>
                  PDF, JPG, PNG ou HEIC, até 20 MB. Fica no armazenamento privado; cada abertura é registrada.
                </span>
                {erroArquivo && (
                  <span className="erro" id={id("arquivo-erro")}>
                    {erroArquivo}
                  </span>
                )}
              </div>
              {admin && (
                <div className="campo f4">
                  <span className="rotulo" aria-hidden="true">
                    &nbsp;
                  </span>
                  <label className="marcar" htmlFor={id("restrito")}>
                    <input type="checkbox" id={id("restrito")} name="restrito" />
                    Restrito ao administrador
                  </label>
                </div>
              )}
              <div className="f12 enviar-pe">
                <button className="btn" type="submit" disabled={enviando}>
                  <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
                  {enviando ? "Enviando…" : "Enviar arquivo"}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <Dialogo
        aberto={!!apagar}
        aoFechar={() => setApagar(null)}
        titulo="Apagar documento"
        onSubmit={confirmarApagar}
        pe={
          <>
            <button className="btn" type="button" data-fechar>
              Cancelar
            </button>
            <button className="btn btn-perigo" type="submit" disabled={ocupado}>
              Apagar documento
            </button>
          </>
        }
      >
        <p>
          {apagar ? `${apagar.tipo} (${apagar.nome})` : ""} sai da ficha e do armazenamento. Não dá para desfazer; a
          auditoria guarda quem apagou e quando.
        </p>
      </Dialogo>
    </>
  );
}
