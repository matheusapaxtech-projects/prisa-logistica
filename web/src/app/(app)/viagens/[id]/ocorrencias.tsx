"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus, TriangleAlert } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { erroDoArquivo, mimeDoArquivo, TIPOS_ACEITOS } from "@/lib/arquivos";
import { enviarObjeto } from "@/lib/envio-navegador";
import { formato } from "@/lib/formato";
import { CabPainel, Opcoes } from "../../_pessoa/partes";
import { registrarOcorrencia, resolverOcorrencia } from "../actions";
import type { OcorrenciaDaViagem } from "../consultas";
import { MSG_FALHA_ENVIO_FOTO } from "../envio";
import { AVISO_FINANCEIRO, avisaFinanceiro, TIPOS_OCORRENCIA } from "../regras";

type Props = {
  viagemId: string;
  ocorrencias: OcorrenciaDaViagem[];
  /** Operação e admin (pode_editar). */
  podeEditar: boolean;
  /** Registrar só em viagem não cancelada. */
  podeRegistrar: boolean;
};

function AvisoFinanceiro() {
  return (
    <div className="aviso aviso-pendente">
      <TriangleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{AVISO_FINANCEIRO}</span>
    </div>
  );
}

/** Diálogo "Registrar ocorrência": tipo, descrição e foto opcional (arquivo OUTROS da viagem). */
function RegistrarOcorrencia({ viagemId }: { viagemId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [vez, setVez] = useState(0);
  const [tipo, setTipo] = useState("");
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  // Erros do envio só valem na abertura em que o envio foi feito (o estado da ação continua entre aberturas).
  const [vezDoEnvio, setVezDoEnvio] = useState(-1);
  const foto = useRef<File | null>(null);
  const [estado, enviar, enviando] = useActionState(registrarOcorrencia, null);
  const tratado = useRef<typeof estado>(null);

  // Depois de gravar: envia a foto (se houver) ao caminho devolvido, fecha e recarrega a ficha.
  useEffect(() => {
    if (!estado?.ok || tratado.current === estado) return;
    tratado.current = estado;
    const arquivo = foto.current;
    foto.current = null;
    void (async () => {
      setAberto(false);
      if (estado.dados.erroFoto) toast(`Ocorrência registrada, mas a foto não: ${estado.dados.erroFoto}`, "alert-circle");
      else if (estado.dados.caminhoFoto && arquivo) {
        const ok = await enviarObjeto(estado.dados.caminhoFoto, arquivo);
        toast(ok ? "Ocorrência registrada com a foto." : MSG_FALHA_ENVIO_FOTO, ok ? "check" : "alert-circle");
      } else toast("Ocorrência registrada.", "check");
      router.refresh();
    })();
  }, [estado, router]);

  const atual = vezDoEnvio === vez ? estado : null;
  const campos = (atual && !atual.ok && "campos" in atual ? atual.campos : {}) as Record<string, string>;
  const erroGeral = atual && !atual.ok && !("campos" in atual) ? atual.erro : null;

  return (
    <>
      <button
        className="btn"
        type="button"
        id="btn-registrar-ocorrencia"
        onClick={() => {
          setVez((n) => n + 1);
          setTipo("");
          setErroFoto(null);
          setAberto(true);
        }}
      >
        <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
        Registrar ocorrência
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Registrar ocorrência"
        className="dlg-cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          if (enviando) return;
          const fd = new FormData(e.currentTarget);
          const f = fd.get("foto");
          fd.delete("foto");
          foto.current = null;
          if (f instanceof File && f.size) {
            const problema = erroDoArquivo(f);
            setErroFoto(problema);
            if (problema) return;
            foto.current = f;
            fd.set("foto_nome", f.name);
            fd.set("foto_mime", mimeDoArquivo(f.name, f.type));
            fd.set("foto_tamanho", String(f.size));
          } else setErroFoto(null);
          setVezDoEnvio(vez);
          startTransition(() => enviar(fd));
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar disabled={enviando}>
              Voltar
            </button>
            <button className="btn btn-primario" type="submit" disabled={enviando}>
              {enviando ? "Registrando…" : "Registrar"}
            </button>
          </>
        }
      >
        <div key={vez} className="campos-ocorrencia">
          {erroGeral && (
            <div className="aviso aviso-bloqueado" role="alert">
              <CircleAlert size={16} strokeWidth={1.6} aria-hidden="true" />
              <span>{erroGeral}</span>
            </div>
          )}
          <input type="hidden" name="viagem_id" value={viagemId} />
          <div className="campo">
            <label htmlFor="tipo-ocorrencia">Tipo</label>
            <select
              id="tipo-ocorrencia"
              name="tipo"
              defaultValue=""
              aria-invalid={campos.tipo ? true : undefined}
              onChange={(e) => setTipo(e.currentTarget.value)}
            >
              <Opcoes mapa={TIPOS_OCORRENCIA} vazio="Escolha" />
            </select>
            {campos.tipo && <span className="erro">{campos.tipo}</span>}
          </div>
          {avisaFinanceiro(tipo) && <AvisoFinanceiro />}
          <div className="campo">
            <label htmlFor="descricao-ocorrencia">Descrição</label>
            <textarea
              id="descricao-ocorrencia"
              name="descricao"
              maxLength={2000}
              required
              aria-invalid={campos.descricao ? true : undefined}
              placeholder="O que aconteceu, onde e o que já foi feito"
            />
            {campos.descricao && <span className="erro">{campos.descricao}</span>}
          </div>
          <div className="campo">
            <label htmlFor="foto-ocorrencia">
              Foto <span className="opcional">(opcional)</span>
            </label>
            <input id="foto-ocorrencia" name="foto" type="file" accept={TIPOS_ACEITOS} aria-invalid={erroFoto ? true : undefined} />
            {erroFoto ? <span className="erro">{erroFoto}</span> : <span className="ajuda">Fica em Arquivos da viagem, como “OUTROS”.</span>}
          </div>
        </div>
      </Dialogo>
    </>
  );
}

/** Diálogo "Resolver": o texto da resolução (quem e quando ficam gravados). */
function ResolverOcorrencia({ o }: { o: OcorrenciaDaViagem }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [vez, setVez] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  return (
    <>
      <button
        className="btn btn-texto"
        type="button"
        onClick={() => {
          setErro(null);
          setVez((n) => n + 1);
          setAberto(true);
        }}
      >
        Resolver
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Resolver: ${TIPOS_OCORRENCIA[o.tipo]}`}
        className="dlg-cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          if (gravando) return;
          const texto = String(new FormData(e.currentTarget).get("resolucao") ?? "");
          setErro(null);
          iniciar(async () => {
            const r = await resolverOcorrencia(o.id, texto);
            if (!r.ok) {
              setErro(r.erro);
              return;
            }
            setAberto(false);
            toast("Ocorrência resolvida.", "check");
            router.refresh();
          });
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar disabled={gravando}>
              Voltar
            </button>
            <button className="btn btn-primario" type="submit" disabled={gravando}>
              {gravando ? "Gravando…" : "Resolver"}
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
        <p className="observacao">{o.descricao}</p>
        {avisaFinanceiro(o.tipo) && <AvisoFinanceiro />}
        <div className="campo" key={vez}>
          <label htmlFor={`resolucao-${o.id}`}>Como foi resolvida</label>
          <textarea id={`resolucao-${o.id}`} name="resolucao" maxLength={2000} required placeholder="Ex.: carga trocada no destino; desconto combinado com o cliente" />
        </div>
      </Dialogo>
    </>
  );
}

/* Ocorrências da viagem (spec 6.4): abertas primeiro, com quem registrou e quando; resolver com texto.
   Avaria e sinistro mostram o aviso ao financeiro. */
export function Ocorrencias({ viagemId, ocorrencias, podeEditar, podeRegistrar }: Props) {
  const ordenadas = [...ocorrencias].sort((a, b) => Number(Boolean(a.resolvidaEm)) - Number(Boolean(b.resolvidaEm)));
  return (
    <section className="subsecao" id="ocorrencias">
      <CabPainel titulo={`Ocorrências (${ocorrencias.length})`}>{podeEditar && podeRegistrar && <RegistrarOcorrencia viagemId={viagemId} />}</CabPainel>
      {ordenadas.length ? (
        <ul className="lista-ocorrencias">
          {ordenadas.map((o) => (
            <li key={o.id} className={o.resolvidaEm ? "resolvida" : undefined}>
              <div className="cab-ocorrencia">
                <span className="tipo">
                  <b>{TIPOS_OCORRENCIA[o.tipo]}</b>
                  {o.resolvidaEm ? <Sinal tipo="normal" texto="Resolvida" /> : <Sinal tipo="pendente" texto="Aberta" />}
                </span>
                {!o.resolvidaEm && podeEditar && <ResolverOcorrencia o={o} />}
              </div>
              <p className="observacao">{o.descricao}</p>
              <span className="linha2">
                registrada em {formato.dataHora(o.abertaEm)}
                {o.abertaPor && (
                  <>
                    <Ponto />
                    por {o.abertaPor}
                  </>
                )}
              </span>
              {!o.resolvidaEm && avisaFinanceiro(o.tipo) && <AvisoFinanceiro />}
              {o.resolvidaEm && (
                <div className="resolucao">
                  <span className="observacao">{o.resolucao}</span>
                  <span className="linha2">
                    resolvida em {formato.dataHora(o.resolvidaEm)}
                    {o.resolvidaPor && (
                      <>
                        <Ponto />
                        por {o.resolvidaPor}
                      </>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhuma ocorrência. Registre atraso, avaria, recusa, sinistro ou parada não prevista.</EstadoVazio>
      )}
    </section>
  );
}
