"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import type { LinhaMotorista } from "./consultas";
import { MarcaValidade } from "./validade";

const ABAS = [
  { id: "todos", rot: "Todos", ok: () => true },
  { id: "normal", rot: "Normais", ok: (l: LinhaMotorista) => l.situacao === "normal" },
  { id: "pendente", rot: "Pendentes", ok: (l: LinhaMotorista) => l.situacao === "pendente" },
  { id: "documentos", rot: "Documentos vencendo ou vencidos", ok: (l: LinhaMotorista) => l.situacao !== "cancelado" && l.atencao > 0 },
  { id: "cancelado", rot: "Cancelados", ok: (l: LinhaMotorista) => l.situacao === "cancelado" },
] as const;

export type AbaLista = (typeof ABAS)[number]["id"];

type Props = { linhas: LinhaMotorista[]; aba: AbaLista; busca: string; gr: string };

function CelCnh({ l }: { l: LinhaMotorista }) {
  const cat = l.cnhCategoria ?? "—";
  if (!l.cnhValidade)
    return (
      <>
        <span className="dash">sem validade</span>
        <span className="linha2">Categoria {cat}</span>
      </>
    );
  return (
    <>
      <MarcaValidade iso={l.cnhValidade} />
      <span className="linha2">
        Categoria {cat}
        <Ponto />
        {l.cnh.cls === "normal" ? "válida" : formato.dias(l.cnh.dias ?? 0)}
      </span>
    </>
  );
}

function CelGr({ l }: { l: LinhaMotorista }) {
  const g = l.gr;
  if (g.chave === "sem_consulta")
    return (
      <>
        <span className="dash">Sem consulta</span>
        <span className="linha2">nunca consultado</span>
      </>
    );
  if (g.chave === "vencendo")
    return (
      <>
        <span>Habilitado</span>
        <span className="linha2">
          <span className="val val-vencendo">{g.sub}</span>
        </span>
      </>
    );
  if (g.chave === "vencido")
    return (
      <>
        <span className="val val-vencido">Vencida</span>
        <span className="linha2">{l.grValidade ? g.sub : "refazer a consulta"}</span>
      </>
    );
  return (
    <>
      <span>Habilitado</span>
      <span className="linha2">{g.sub}</span>
    </>
  );
}

/** Resumo da gerenciadora numa frase curta, para a segunda linha no celular. */
function GrCurto({ l }: { l: LinhaMotorista }) {
  if (l.gr.chave === "sem_consulta") return <>risco sem consulta</>;
  if (l.gr.chave === "vencido") return <span className="val val-vencido">risco vencido</span>;
  return <MarcaValidade iso={l.grValidade} prefixo="risco até " />;
}

/* Lista de motoristas (motoristas.html): abas por situação, busca e filtro da gerenciadora no
   próprio navegador, com o estado guardado na URL (?situacao=, ?q=, ?gr=). */
export function ListaMotoristas({ linhas, aba: abaInicial, busca: buscaInicial, gr: grInicial }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<AbaLista>(abaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const [gr, setGr] = useState(grInicial);
  const faixa = useRef<HTMLDivElement>(null);

  function guardarUrl(a: AbaLista, q: string, g: string) {
    const u = new URL(window.location.href);
    if (a === "todos") u.searchParams.delete("situacao");
    else u.searchParams.set("situacao", a);
    if (q.trim()) u.searchParams.set("q", q.trim());
    else u.searchParams.delete("q");
    if (g) u.searchParams.set("gr", g);
    else u.searchParams.delete("gr");
    window.history.replaceState(null, "", u);
  }

  const termo = busca.trim().toLowerCase();
  const dig = validacao.soDigitos(termo);
  const passaBusca = (l: LinhaMotorista) =>
    !termo ||
    l.nome.toLowerCase().includes(termo) ||
    (l.apelido ?? "").toLowerCase().includes(termo) ||
    (dig.length >= 3 && l.cpf.includes(dig));
  const base = linhas.filter((l) => passaBusca(l) && (!gr || l.gr.chave === gr));
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];
  const vis = base.filter(atual.ok);

  function escolher(id: AbaLista) {
    setAba(id);
    guardarUrl(id, busca, gr);
    requestAnimationFrame(() => faixa.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus());
  }

  function teclarAbas(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = ABAS.findIndex((a) => a.id === aba);
    escolher(ABAS[(i + (e.key === "ArrowRight" ? 1 : -1) + ABAS.length) % ABAS.length].id);
  }

  const abrir = (id: string) => router.push(`/motoristas/${id}`);

  return (
    <>
      <div className="abas" role="tablist" aria-label="Situação do motorista" ref={faixa} onKeyDown={teclarAbas}>
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" data-id={a.id} aria-selected={a.id === aba} onClick={() => escolher(a.id)}>
            {a.rot}
            <span className="n">{base.filter(a.ok).length}</span>
          </button>
        ))}
      </div>

      <div className="ferramentas">
        <div className="busca-lista">
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input
            id="busca"
            type="search"
            autoComplete="off"
            placeholder="Nome, apelido ou CPF"
            aria-label="Buscar por nome, apelido ou CPF"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              guardarUrl(aba, e.target.value, gr);
            }}
          />
        </div>
        <label className="filtro-gr" htmlFor="filtro-gr">
          Gerenciadora de risco
          <select
            id="filtro-gr"
            value={gr}
            onChange={(e) => {
              setGr(e.target.value);
              guardarUrl(aba, busca, e.target.value);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="habilitado">Habilitado</option>
            <option value="vencendo">Vence em até 30 dias</option>
            <option value="vencido">Vencido</option>
            <option value="sem_consulta">Sem consulta</option>
          </select>
        </label>
        <span className="total" aria-live="polite">
          {vis.length} {vis.length === 1 ? "motorista" : "motoristas"}
        </span>
      </div>

      <div className="tabela-wrap">
        <table className="tabela" id="tabela">
          <thead>
            <tr>
              <th scope="col">Motorista</th>
              <th scope="col" className="col-tab some-celular">
                CPF
              </th>
              <th scope="col" className="some-celular">
                CNH
              </th>
              <th scope="col" className="some-celular">
                Consulta de risco
              </th>
              <th scope="col" className="col-tab some-celular">
                Telefone
              </th>
              <th scope="col" className="col-tab some-celular">
                Cidade
              </th>
              <th scope="col">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {vis.length === 0 ? (
              <tr className="lista-vazia">
                <td colSpan={7}>
                  <EstadoVazio>
                    {busca.trim()
                      ? `Nenhum motorista com “${busca.trim()}” nesta aba. Confira a grafia ou o CPF.`
                      : linhas.length
                        ? "Nenhum motorista nesta situação."
                        : "Nenhum motorista cadastrado. Comece pelo botão “Novo motorista”."}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((l) => {
                const tel = l.telefone ? formato.telefone(l.telefone.numero) : null;
                return (
                  <tr
                    key={l.id}
                    data-href={`/motoristas/${l.id}`}
                    tabIndex={0}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a,button,input")) abrir(l.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") abrir(l.id);
                    }}
                  >
                    <td>
                      <div className="cel-pessoa">
                        <Avatar nome={l.nome} />
                        <span>
                          <span className="id">{l.nome}</span>
                          <span className="linha2">
                            {l.apelido || "sem apelido"}
                            <span className="x-tab">
                              <Ponto />
                              <span className="cod">{formato.cpf(l.cpf)}</span>
                            </span>
                          </span>
                          <span className="linha2 x-cel-b">
                            {l.cnhValidade ? <MarcaValidade iso={l.cnhValidade} prefixo={`CNH ${l.cnhCategoria ?? ""} até `} /> : "CNH sem validade"}
                            <Ponto />
                            <GrCurto l={l} />
                          </span>
                          <span className="linha2 x-tab-b">
                            {l.cidade || "sem cidade"}
                            {tel && (
                              <>
                                <Ponto />
                                <span className="num">{tel}</span>
                              </>
                            )}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="col-tab some-celular">
                      <span className="cod">{formato.cpf(l.cpf)}</span>
                    </td>
                    <td className="some-celular">
                      <CelCnh l={l} />
                    </td>
                    <td className="some-celular">
                      <CelGr l={l} />
                    </td>
                    <td className="col-tab some-celular">
                      {tel ? (
                        <>
                          <span className="num">{tel}</span>
                          <span className="linha2">{l.telefone!.tipo}</span>
                        </>
                      ) : (
                        <span className="dash">—</span>
                      )}
                    </td>
                    <td className="col-tab some-celular">{l.cidade ?? <span className="dash">—</span>}</td>
                    <td>
                      <Sinal situacao={l.situacao} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
