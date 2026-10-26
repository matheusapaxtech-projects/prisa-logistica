"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { ENQ, type LinhaProprietario } from "./consultas";

const ABAS = [
  { id: "todos", rot: "Todos", ok: () => true },
  { id: "pf", rot: "Pessoa física", ok: (l: LinhaProprietario) => l.tipo === "pf" },
  { id: "pj", rot: "Empresa", ok: (l: LinhaProprietario) => l.tipo === "pj" },
  { id: "agregados", rot: "Agregados", ok: (l: LinhaProprietario) => l.agregado },
  { id: "pendentes", rot: "Pendentes", ok: (l: LinhaProprietario) => l.situacao === "pendente" },
  { id: "rntrc", rot: "RNTRC vencendo ou vencido", ok: (l: LinhaProprietario) => l.r.estado === "vencido" || l.r.estado === "vencendo" },
] as const;

export type AbaLista = (typeof ABAS)[number]["id"];

type Props = { linhas: LinhaProprietario[]; aba: AbaLista; busca: string };

const docDe = (l: LinhaProprietario) => (l.tipo === "pj" ? formato.cnpj(l.documento) : formato.cpf(l.documento));
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

function CelRntrc({ l }: { l: LinhaProprietario }) {
  const { r } = l;
  const enq = l.enquadramento ? ENQ[l.enquadramento] : null;
  if (r.estado === "sem")
    return (
      <>
        <span className="dash">—</span>
        <span className="validade-ok">
          sem RNTRC
          {enq && (
            <>
              <Ponto />
              {enq}
            </>
          )}
        </span>
      </>
    );
  const topo = (
    <span className="rntrc-linha">
      <span className="cod">{l.rntrc}</span>
      <span className="enq">{enq ?? ""}</span>
    </span>
  );
  if (r.estado === "vencido")
    return (
      <>
        {topo}
        <span className="validade-sinal">
          <Sinal situacao="vencido" texto={formato.dias(r.dias!).replace("venceu", "Venceu")} />
        </span>
      </>
    );
  if (r.estado === "vencendo")
    return (
      <>
        {topo}
        <span className="validade-sinal">
          <Sinal situacao="vencendo" texto={formato.dias(r.dias!).replace("vence", "Vence")} />
        </span>
      </>
    );
  if (r.estado === "sem_validade")
    return (
      <>
        {topo}
        <span className="validade-ok">validade não informada</span>
      </>
    );
  return (
    <>
      {topo}
      <span className="validade-ok">válido até {formato.data(l.rntrcValidade)}</span>
    </>
  );
}

function CelVeiculos({ l }: { l: LinhaProprietario }) {
  const v = l.veic;
  if (!v.todos)
    return (
      <>
        <b>0</b>
        <span className="linha2">nenhum veículo</span>
      </>
    );
  return (
    <>
      <b>
        {v.posse} CRLV
        <Ponto />
        {v.documento} ANTT
      </b>
      <span className="linha2">
        {v.todos} {plural(v.todos, "veículo", "veículos")}
        {v.arrendados > 0 && (
          <>
            <Ponto />
            {v.arrendados} {plural(v.arrendados, "arrendado", "arrendados")}
          </>
        )}
      </span>
    </>
  );
}

function CelResponsavel({ l }: { l: LinhaProprietario }) {
  if (!l.responsavel) return <span className="dash">—</span>;
  if (!l.responsavel.nome)
    return (
      <>
        <span className="dash">—</span>
        <span className="linha2">sem responsável</span>
      </>
    );
  return (
    <>
      {l.responsavel.nome}
      <span className="linha2">
        <span className="tel">{formato.telefone(l.responsavel.telefone)}</span>
        {l.responsavel.whatsapp && (
          <>
            <Ponto />
            WhatsApp
          </>
        )}
      </span>
    </>
  );
}

/** RNTRC e veículos numa frase curta, para a linha de baixo no celular. */
function ResumoCelular({ l }: { l: LinhaProprietario }) {
  const { r, veic } = l;
  const rn =
    r.estado === "sem"
      ? "sem RNTRC"
      : r.estado === "vencido"
        ? "RNTRC vencido"
        : r.estado === "vencendo"
          ? `RNTRC ${formato.dias(r.dias!)}`
          : `RNTRC ${l.enquadramento ? ENQ[l.enquadramento] : ""}`.trim();
  return (
    <>
      {rn}
      <Ponto />
      {veic.todos} {plural(veic.todos, "veículo", "veículos")}
      {veic.arrendados > 0 && ` (${veic.arrendados} ${plural(veic.arrendados, "arrendado", "arrendados")})`}
    </>
  );
}

/* Lista de proprietários (proprietarios.html): abas e busca no próprio navegador, com o estado
   guardado na URL (?aba=, ?q=). */
export function ListaProprietarios({ linhas, aba: abaInicial, busca: buscaInicial }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<AbaLista>(abaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const faixa = useRef<HTMLDivElement>(null);

  function guardarUrl(a: AbaLista, q: string) {
    const u = new URL(window.location.href);
    if (a === "todos") u.searchParams.delete("aba");
    else u.searchParams.set("aba", a);
    if (q.trim()) u.searchParams.set("q", q.trim());
    else u.searchParams.delete("q");
    window.history.replaceState(null, "", u);
  }

  const termo = busca.trim().toLowerCase();
  const dig = validacao.soDigitos(termo);
  const passa = (l: LinhaProprietario) =>
    !termo ||
    l.nome.toLowerCase().includes(termo) ||
    (l.nomeFantasia ?? "").toLowerCase().includes(termo) ||
    (l.apelido ?? "").toLowerCase().includes(termo) ||
    (dig.length >= 3 && l.documento.includes(dig));
  const base = linhas.filter(passa);
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];
  const vis = base.filter(atual.ok);

  function escolher(id: AbaLista) {
    setAba(id);
    guardarUrl(id, busca);
    requestAnimationFrame(() => faixa.current?.querySelector<HTMLElement>(`[data-filtro="${id}"]`)?.focus());
  }

  function teclarAbas(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = ABAS.findIndex((a) => a.id === aba);
    escolher(ABAS[(i + (e.key === "ArrowRight" ? 1 : -1) + ABAS.length) % ABAS.length].id);
  }

  const abrir = (id: string) => router.push(`/proprietarios/${id}`);

  return (
    <>
      <div className="abas abas-quebra" role="tablist" aria-label="Filtrar proprietários" ref={faixa} onKeyDown={teclarAbas}>
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" data-filtro={a.id} aria-selected={a.id === aba} onClick={() => escolher(a.id)}>
            {a.rot}
            <span className="n">{base.filter(a.ok).length}</span>
          </button>
        ))}
      </div>

      <div className="ferramentas">
        <label className="busca-lista">
          <span className="sr-only">Buscar por nome, nome fantasia, CPF ou CNPJ</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input
            id="busca"
            type="search"
            autoComplete="off"
            placeholder="Nome, nome fantasia, CPF ou CNPJ"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              guardarUrl(aba, e.target.value);
            }}
          />
        </label>
        <span className="total" id="total" aria-live="polite">
          {vis.length} {plural(vis.length, "proprietário", "proprietários")}
        </span>
      </div>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop" id="tabela" aria-describedby="total">
          <thead>
            <tr>
              <th className="col-prop" scope="col">
                Proprietário
              </th>
              <th className="col-doc some-tablet" scope="col">
                Documento
              </th>
              <th className="some-celular" scope="col">
                RNTRC
              </th>
              <th className="num some-celular" scope="col">
                Veículos
              </th>
              <th className="some-celular" scope="col">
                Responsável
              </th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody id="linhas">
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={6}>
                  <EstadoVazio>
                    {busca.trim()
                      ? `Nenhum proprietário com “${busca.trim()}” nesta aba. Confira o nome ou os dígitos do documento.`
                      : linhas.length
                        ? "Nenhum proprietário nesta aba."
                        : "Nenhum proprietário cadastrado. Comece pelo botão “Novo proprietário”."}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((l) => (
                <tr
                  key={l.id}
                  data-href={`/proprietarios/${l.id}`}
                  tabIndex={0}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a,button,input")) abrir(l.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget) abrir(l.id);
                  }}
                >
                  <td>
                    <span className="id">{l.nome}</span>
                    <span className="linha2">
                      {l.tipo === "pj" ? (l.nomeFantasia ?? "empresa") : "pessoa física"}
                      {l.agregado && (
                        <>
                          <Ponto />
                          agregado
                        </>
                      )}
                      {l.tipo === "pf" && l.tambemMotorista && (
                        <>
                          <Ponto />
                          também motorista
                        </>
                      )}
                      <span className="p-estreito">
                        <Ponto />
                        <span className="cod" style={{ fontSize: 12 }}>
                          {docDe(l)}
                        </span>
                      </span>
                    </span>
                    <span className="linha2 p-cel">
                      <ResumoCelular l={l} />
                    </span>
                  </td>
                  <td className="some-tablet">
                    <span className="cod">{docDe(l)}</span>
                  </td>
                  <td className="some-celular">
                    <CelRntrc l={l} />
                  </td>
                  <td className="num veic some-celular">
                    <CelVeiculos l={l} />
                  </td>
                  <td className="some-celular">
                    <CelResponsavel l={l} />
                  </td>
                  <td>
                    <Sinal situacao={l.situacao} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
