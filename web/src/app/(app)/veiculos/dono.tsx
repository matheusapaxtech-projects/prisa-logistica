import Link from "next/link";
import { Equal, EqualNot, FileCheck2, FileWarning, Info } from "lucide-react";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { diasAte } from "@/lib/datas";
import { formato } from "@/lib/formato";
import type { OpcaoPessoa } from "./pessoas-tipos";
import { ENQUADRAMENTO, type SituacaoOperacional } from "./rotulos";

/** `ENQUADRAMENTO` aceita só as chaves do enum; o que vem do banco é texto. */
const enquadramento = (e: string | null) => (e && e in ENQUADRAMENTO ? ENQUADRAMENTO[e as keyof typeof ENQUADRAMENTO] : "—");

/** Linha de ajuda sob o seletor de proprietário (`infoProp` do veiculo-novo.html): RNTRC e validade.
   `antt` = este é quem consta na ANTT, que exige o RNTRC. */
export function InfoRntrc({ o, antt }: { o: OpcaoPessoa; antt: boolean }) {
  if (!o.rntrc)
    return antt ? (
      <span className="erro-suave">Sem RNTRC cadastrado: complete na ficha do proprietário, a ANTT exige.</span>
    ) : (
      <>Sem RNTRC; para a posse no CRLV ele não é exigido.</>
    );
  const dias = o.rntrc_validade ? diasAte(o.rntrc_validade) : null;
  return (
    <>
      RNTRC <span className="cod">{o.rntrc}</span>
      <Ponto />
      {enquadramento(o.enquadramento)}
      {dias != null && (
        <>
          <Ponto />
          {formato.dias(dias)}
        </>
      )}
    </>
  );
}

function CartaoDono({ o, titulo }: { o: OpcaoPessoa | null; titulo: string }) {
  if (!o)
    return (
      <div className="dono">
        <h3>{titulo}</h3>
        <p className="muted">Não informado.</p>
      </div>
    );
  const dias = o.rntrc_validade ? diasAte(o.rntrc_validade) : null;
  return (
    <div className="dono">
      <h3>{titulo}</h3>
      <Link className="dono-nome" href={`/proprietarios/${o.id}`}>
        {o.nomeCompleto}
      </Link>
      <dl className="kv">
        <dt>{o.tipo === "pj" ? "CNPJ" : "CPF"}</dt>
        <dd className="cod">{o.doc}</dd>
        <dt>RNTRC</dt>
        <dd>
          {o.rntrc ? (
            <>
              <span className="cod">{o.rntrc}</span>
              <Ponto />
              {o.enquadramento ? enquadramento(o.enquadramento) : ""}
            </>
          ) : (
            <span className="dash">—</span>
          )}
        </dd>
        <dt>Validade</dt>
        <dd className="com-sinal">
          {o.rntrc_validade ? formato.data(o.rntrc_validade) : <span className="dash">—</span>}
          {dias != null && dias < 0 && <Sinal tipo="bloqueado" texto="vencido" />}
          {dias != null && dias >= 0 && dias <= 30 && <Sinal tipo="vencendo" texto={formato.dias(dias)} />}
        </dd>
        <dt>Cadastro</dt>
        <dd>
          <Sinal situacao={o.situacao_cadastro} />
        </dd>
      </dl>
    </div>
  );
}

type Contrato = { nome: string; validade: string | null } | null;

/** Posse e ANTT lado a lado, e o aviso de arrendamento quando são diferentes (`blocoDonos` do veiculo.html).
   `contrato`: o arquivo CONTRATO já anexado (nulo = falta). `anexarHref`: onde anexar (só com permissão). */
export function BlocoDonos({
  posse,
  antt,
  contrato,
  situacaoOperacional,
  verDocumentosHref,
  anexarHref,
}: {
  posse: OpcaoPessoa | null;
  antt: OpcaoPessoa | null;
  contrato: Contrato;
  situacaoOperacional: SituacaoOperacional;
  verDocumentosHref: string;
  anexarHref: string | null;
}) {
  const arrendado = !!posse && !!antt && posse.id !== antt.id;
  return (
    <div className="bloco-donos" id="bloco-donos">
      <div className={`donos${arrendado ? " diferentes" : ""}`}>
        <CartaoDono o={posse} titulo="Posse (CRLV)" />
        <div className="donos-meio" aria-hidden="true">
          {arrendado ? <EqualNot size={20} strokeWidth={1.6} /> : <Equal size={20} strokeWidth={1.6} />}
          <span>{arrendado ? "diferentes" : "mesmo dono"}</span>
        </div>
        <CartaoDono o={antt} titulo="Documento (ANTT)" />
      </div>
      {arrendado && (
        <div className="arrendamento">
          <div className="aviso aviso-info">
            <Info size={18} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <b>Arrendado.</b> A posse no CRLV é de {posse.nome} e a ANTT está em nome de {antt.nome}. O NILT marca isso
              sozinho e exige o contrato de arrendamento. Situação operacional: <Sinal situacao={situacaoOperacional} />
            </div>
          </div>
          {contrato ? (
            <div className="upload com-arquivo">
              <FileCheck2 size={20} strokeWidth={1.6} aria-hidden="true" />
              <span className="upload-txt">
                <b>{contrato.nome}</b>
                <span>
                  CONTRATO
                  <Ponto />
                  {contrato.validade ? `vale até ${formato.data(contrato.validade)}` : "sem validade"}
                  <Ponto />
                  restrito: só o administrador abre
                </span>
              </span>
              <Link className="btn btn-texto" href={verDocumentosHref} scroll={false}>
                Ver em Documentos
              </Link>
            </div>
          ) : (
            <div className="aviso aviso-pendente">
              <FileWarning size={18} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <b>Falta o contrato de arrendamento.</b> Enquanto ele não for anexado, o veículo aparece em Pendências como
                arrendado sem contrato.
              </div>
              {anexarHref && (
                <Link className="btn" href={anexarHref}>
                  Anexar contrato
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
