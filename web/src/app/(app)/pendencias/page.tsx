import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Link2, Paperclip } from "lucide-react";
import { Abas } from "@/components/Abas";
import { Avatar } from "@/components/Avatar";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { createClient } from "@/lib/supabase/server";
import { Partes, plural } from "../conjuntos/partes";
import { carregarPendencias, type LinhaPendencia, type Objeto } from "./consultas";
import { abaPendencias, TIPOS_PENDENCIA, type TipoPendencia } from "./filtros";
import { FiltroTipo, PainelDocumentos, PainelVencimentos } from "./paineis";
import "@/styles/paginas/conjuntos.css";

export const metadata: Metadata = { title: "Pendências" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const GRUPOS: Record<TipoPendencia, { forma: "circulo" | "laranja"; titulo: string; desc: string; vazio: string }> = {
  arquivo_vencido: {
    forma: "circulo",
    titulo: "Documentos vencidos",
    desc: "A validade passou. Anexe o documento renovado na ficha.",
    vazio: "Nenhum documento vencido.",
  },
  veiculo_arrendado_sem_contrato: {
    forma: "laranja",
    titulo: "Arrendado sem contrato",
    desc: "Posse no CRLV diferente do proprietário na ANTT, sem contrato de arrendamento anexado.",
    vazio: "Todo veículo arrendado tem contrato anexado.",
  },
  conjunto_acima_cmt: {
    forma: "circulo",
    titulo: "Conjunto acima do CMT",
    desc: "A capacidade das carretas passa do que o cavalo pode puxar. Troque peças ou carregue abaixo do limite.",
    vazio: "Nenhum conjunto passa do CMT do cavalo.",
  },
  motorista_sem_cnh: {
    forma: "laranja",
    titulo: "Motorista sem CNH anexada",
    desc: "A CNH está no cadastro, mas falta o arquivo.",
    vazio: "Todo motorista tem a CNH anexada.",
  },
  motorista_sem_comprovante: {
    forma: "laranja",
    titulo: "Sem comprovante de residência",
    desc: "Falta o arquivo do comprovante de residência.",
    vazio: "Todo motorista tem comprovante de residência.",
  },
};

function SinalGrupo({ forma, n }: { forma: "circulo" | "laranja"; n: number }) {
  return forma === "circulo" ? (
    <span className={`circulo-proibido${n ? "" : " vazio"}`} aria-hidden="true">
      <b>{n}</b>
    </span>
  ) : (
    <span className={`losango ${n ? forma : "vazio"}`} aria-hidden="true">
      <b>{n}</b>
    </span>
  );
}

function ObjetoLinha({ o }: { o: Objeto }) {
  if (o.tipo === "pessoa")
    return (
      <div className="objeto">
        <Avatar nome={o.nome} />
        <div className="nome">
          <Link href={o.href}>{o.nome}</Link>
          <span>
            <span className="cod">{o.doc}</span>
            {o.papel && (
              <>
                <Ponto />
                {o.papel}
              </>
            )}
          </span>
        </div>
      </div>
    );
  return (
    <div className="objeto">
      <Placa placa={o.placa} />
      <div className="nome">
        <Link href={o.href}>{o.titulo}</Link>
        <span>{o.sub}</span>
      </div>
    </div>
  );
}

function LinhaPend({ x }: { x: LinhaPendencia }) {
  const Icone = x.acao.icone === "link-2" ? Link2 : Paperclip;
  return (
    <div className="pend-linha">
      <ObjetoLinha o={x.objeto} />
      <div className="pend-txt">
        <b className={x.vencido ? "vencido" : undefined}>{x.titulo}</b>
        <span>
          <Partes
            itens={x.sub.map((p, i) =>
              typeof p === "string" ? (
                p
              ) : (
                <Fragment key={i}>{p.map((q, j) => (typeof q === "string" ? q : <span className="cod" key={j}>{q.cod}</span>))}</Fragment>
              ),
            )}
          />
        </span>
      </div>
      <div className="acao">
        <Link className="btn" href={x.acao.href}>
          <Icone size={16} strokeWidth={1.6} aria-hidden="true" />
          {x.acao.rotulo}
        </Link>
      </div>
    </div>
  );
}

/* Pendências (prototipo/pendencias.html): abas Pendências, Vencimentos e Documentos.
   `?tipo=` (da tela Início) filtra a aba Pendências; `?aba=` escolhe a aba. */
export default async function Pendencias({ searchParams }: Props) {
  const { aba, tipo } = abaPendencias(await searchParams);
  const d = await carregarPendencias(await createClient());
  const { resumo } = d;

  const titulo = [
    plural(resumo.total, "pendência", "pendências"),
    resumo.vencidos > 0 && plural(resumo.vencidos, "documento vencido", "documentos vencidos"),
    resumo.acimaCmt > 0 && plural(resumo.acimaCmt, "conjunto acima do CMT", "conjuntos acima do CMT"),
    d.arrendados > 0 && plural(d.arrendados, "arrendado sem contrato", "arrendados sem contrato"),
    `${d.aConferir} arquivos a conferir`,
  ];

  const visiveis = TIPOS_PENDENCIA.filter((t) => !tipo || t === tipo);
  const nVisiveis = visiveis.reduce((s, t) => s + d.grupos[t].length, 0);
  const tiposDoc = [...new Set(d.documentos.map((x) => x.tipo))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Pendências</h1>
          <p className="sub" id="achado">
            <Partes itens={titulo} />
          </p>
        </div>
      </div>

      <Abas
        rotulo="Pendências, vencimentos e documentos"
        ativa={aba}
        abas={[
          { id: "pendencias", rotulo: "Pendências", n: resumo.total },
          { id: "vencimentos", rotulo: "Vencimentos", n: d.vencimentos.length },
          { id: "documentos", rotulo: "Documentos", n: d.documentos.length },
        ]}
      />

      {aba === "pendencias" && (
        <section data-painel="pendencias" aria-label="Pendências de documentos">
          <div className="ferramentas">
            <label className="ctrl">
              <span className="rotulo-ctrl">Tipo</span>
              <FiltroTipo tipo={tipo} />
            </label>
            <span className="total" id="total-pend">
              {plural(nVisiveis, "pendência", "pendências")}
            </span>
          </div>
          <div className="grupos" id="grupos">
            {!tipo && !resumo.total && <EstadoVazio>Nenhuma pendência de documentos. Tudo anexado e dentro da validade.</EstadoVazio>}
            {visiveis.map((t) => {
              const g = GRUPOS[t];
              const itens = d.grupos[t];
              return (
                <section className="grupo-pend" aria-labelledby={`g-${t}`} key={t} data-tipo={t}>
                  <div className="grupo-cab">
                    <SinalGrupo forma={g.forma} n={itens.length} />
                    <div>
                      <h2 id={`g-${t}`}>{g.titulo}</h2>
                      <p>{g.desc}</p>
                    </div>
                    <span className="total-grupo">{plural(itens.length, "item", "itens")}</span>
                  </div>
                  <div className="grupo-corpo">
                    {itens.length ? itens.map((x) => <LinhaPend key={x.chave} x={x} />) : <EstadoVazio>{g.vazio}</EstadoVazio>}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {aba === "vencimentos" && <PainelVencimentos vencimentos={d.vencimentos} />}
      {aba === "documentos" && <PainelDocumentos documentos={d.documentos} tipos={tiposDoc} />}
    </main>
  );
}
