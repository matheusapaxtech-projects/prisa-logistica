"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Search } from "lucide-react";
import { MarcoKm } from "@/components/MarcoKm";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import { LinhaClicavel } from "../conjuntos/lista-conjuntos";
import { Partes, plural } from "../conjuntos/partes";
import type { Documento, Vencimento } from "./consultas";
import type { TipoPendencia } from "./filtros";

/** Filtro "Tipo" da aba Pendências: grava `?tipo=` no endereço (a tela Início linka para cada tipo). */
export function FiltroTipo({ tipo }: { tipo: TipoPendencia | null }) {
  const router = useRouter();
  return (
    <select
      id="filtro-tipo"
      aria-label="Filtrar pendências por tipo"
      value={tipo ?? ""}
      onChange={(e) => router.replace(e.target.value ? `/pendencias?tipo=${e.target.value}` : "/pendencias", { scroll: false })}
    >
      <option value="">Todos os tipos</option>
      <option value="arquivo_vencido">Documentos vencidos</option>
      <option value="veiculo_arrendado_sem_contrato">Arrendado sem contrato</option>
      <option value="conjunto_acima_cmt">Conjunto acima do CMT</option>
      <option value="motorista_sem_cnh">Motorista sem CNH anexada</option>
      <option value="motorista_sem_comprovante">Sem comprovante de residência</option>
    </select>
  );
}

/* ---------- vencimentos como marcos de km ---------- */

const JANELAS = [
  { id: "30", rotulo: "30 dias" },
  { id: "60", rotulo: "60 dias" },
  { id: "90", rotulo: "90 dias" },
  { id: "todos", rotulo: "Todos" },
];

function LinhaVenc({ v, escala }: { v: Vencimento; escala: number }) {
  const venc = v.dias < 0;
  return (
    <Link className="marco" href={v.href}>
      {v.quem.tipo === "pessoa" ? (
        <span className="quem">
          <b>{v.tipo}</b>
          <span>
            {v.quem.nome}
            <Ponto />
            {formato.data(v.data)}
          </span>
        </span>
      ) : (
        <span className="quem quem-veic">
          <Placa placa={v.quem.placa} />
          <span>
            <b>{v.tipo}</b>
            <span>
              {v.quem.modelo}
              <Ponto />
              {formato.data(v.data)}
            </span>
          </span>
        </span>
      )}
      <MarcoKm dias={v.dias} janela={escala} />
      <span className={`dias${venc ? " vencido" : v.dias <= 30 ? " vencendo" : ""}`}>
        <b>{venc ? "Vencido" : v.dias === 0 ? "Hoje" : plural(v.dias, "dia", "dias")}</b>
        <span>{venc ? formato.dias(v.dias) : v.dias === 0 ? "vence hoje" : "restantes"}</span>
      </span>
    </Link>
  );
}

export function PainelVencimentos({ vencimentos }: { vencimentos: Vencimento[] }) {
  const [tipo, setTipo] = useState("");
  const [janela, setJanela] = useState("90");
  const tipos = [...new Set(vencimentos.map((v) => v.tipo))];
  const lim = janela === "todos" ? Infinity : Number(janela);
  const linhas = vencimentos.filter((v) => (!tipo || v.tipo === tipo) && v.dias <= lim);
  const ja = linhas.filter((v) => v.dias < 0);
  const vai = linhas.filter((v) => v.dias >= 0);
  const escala = janela === "todos" ? Math.max(30, ...vai.map((v) => v.dias)) : lim;
  const em = tipo ? ` em ${tipo}` : "";

  return (
    <section data-painel="vencimentos" aria-label="Vencimentos">
      <div className="ferramentas">
        <label className="ctrl">
          <span className="rotulo-ctrl">Tipo</span>
          <select id="venc-tipo" aria-label="Filtrar vencimentos por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="segmento" role="group" aria-label="Janela de vencimento" id="venc-janela">
          {JANELAS.map((j) => (
            <button key={j.id} type="button" data-janela={j.id} aria-pressed={janela === j.id} onClick={() => setJanela(j.id)}>
              {j.rotulo}
            </button>
          ))}
        </div>
        <span className="total" id="total-venc">
          <Partes itens={[plural(linhas.length, "vencimento", "vencimentos"), plural(ja.length, "vencido", "vencidos")]} />
        </span>
      </div>
      <div id="vencimentos">
        <section className="venc-grupo" aria-labelledby="vg-1">
          <h2 id="vg-1">
            Vencidos<span className="n">{ja.length}</span>
          </h2>
          <div className="marcos">
            {ja.length ? (
              ja.map((v) => <LinhaVenc key={v.chave} v={v} escala={escala} />)
            ) : (
              <div className="vazio-bloco">Nada vencido{em}.</div>
            )}
          </div>
        </section>
        <section className="venc-grupo" aria-labelledby="vg-2">
          <h2 id="vg-2">
            {janela === "todos" ? "A vencer" : `A vencer em até ${janela} dias`}
            <span className="n">{vai.length}</span>
          </h2>
          <div className="marcos">
            {vai.length ? (
              vai.map((v) => <LinhaVenc key={v.chave} v={v} escala={escala} />)
            ) : (
              <div className="vazio-bloco">
                Nada vence {janela === "todos" ? "daqui para a frente" : `nos próximos ${janela} dias`}
                {em}.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

/* ---------- documentos (arquivo) ---------- */

const donoTxt = (d: Documento) => (d.dono.tipo === "pessoa" ? d.dono.nome : d.dono.placa);

export function PainelDocumentos({ documentos, tipos }: { documentos: Documento[]; tipos: string[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [conf, setConf] = useState("");
  const t = busca.trim().toLowerCase();
  const pla = validacao.normalizarPlaca(t);
  const linhas = documentos.filter(
    (a) =>
      (!tipo || a.tipo === tipo) &&
      (!conf || (conf === "sim") === !!a.conferido) &&
      (!t ||
        a.nome.toLowerCase().includes(t) ||
        donoTxt(a).toLowerCase().includes(t) ||
        (pla.length >= 2 && a.dono.tipo === "veiculo" && a.dono.placa.includes(pla))),
  );

  return (
    <section data-painel="documentos" aria-label="Documentos anexados">
      <div className="ferramentas">
        <div className="busca-lista">
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input
            id="docs-busca"
            type="search"
            autoComplete="off"
            placeholder="Arquivo, nome ou placa"
            aria-label="Buscar documento por arquivo, nome ou placa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="ctrl">
          <span className="rotulo-ctrl">Tipo</span>
          <select id="docs-tipo" aria-label="Filtrar documentos por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tipos.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="ctrl">
          <span className="rotulo-ctrl">Conferência</span>
          <select id="docs-conf" aria-label="Filtrar documentos por conferência" value={conf} onChange={(e) => setConf(e.target.value)}>
            <option value="">Todos</option>
            <option value="sim">Conferidos</option>
            <option value="nao">A conferir</option>
          </select>
        </label>
        <span className="total" id="total-docs">
          {plural(linhas.length, "documento", "documentos")}
        </span>
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-fixa">
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Documento</th>
              <th className="some-celular">Dono</th>
              <th className="num some-celular" style={{ width: 150 }}>
                Validade
              </th>
              <th className="some-celular" style={{ width: 170 }}>
                Conferência
              </th>
              <th className="some-celular" style={{ width: 130 }}>
                Acesso
              </th>
            </tr>
          </thead>
          <tbody id="docs">
            {linhas.length ? (
              linhas.map((a) => {
                const cls = a.dias == null ? "" : a.dias < 0 ? " vencido" : a.dias <= 30 ? " vencendo" : "";
                return (
                  <LinhaClicavel key={a.id} href={a.href}>
                    <td>
                      <b className="id">{a.tipo}</b>
                      <span className="linha2">
                        <Partes itens={[a.nome, a.tamanho, a.restrito && "restrito"]} />
                      </span>
                      <span className="linha2 so-celular">
                        <Partes
                          itens={[donoTxt(a), a.validade ? `até ${formato.data(a.validade)}` : "sem validade", a.conferido ? "conferido" : "a conferir"]}
                        />
                      </span>
                    </td>
                    <td className="some-celular">
                      {a.dono.tipo === "pessoa" ? <Link href={a.href.replace(/\?.*$/, "")}>{a.dono.nome}</Link> : <Placa placa={a.dono.placa} />}
                    </td>
                    <td className="num some-celular">
                      {a.validade ? (
                        <>
                          <span className={`doc-validade${cls}`}>{formato.data(a.validade)}</span>
                          <span className="linha2">{formato.dias(a.dias!)}</span>
                        </>
                      ) : (
                        <span className="dash">sem validade</span>
                      )}
                    </td>
                    <td className="some-celular">
                      {a.conferido ? (
                        <>
                          <Sinal situacao="normal" texto="Conferido" />
                          <span className="linha2">
                            <Partes itens={[a.conferido.por, a.conferido.quando]} />
                          </span>
                        </>
                      ) : (
                        <Sinal situacao="pendente" texto="A conferir" />
                      )}
                    </td>
                    <td className="some-celular">
                      {a.restrito ? (
                        <>
                          <span className="acesso">
                            <Lock size={14} strokeWidth={1.6} aria-hidden="true" />
                            Restrito
                          </span>
                          <span className="linha2">só admin</span>
                        </>
                      ) : (
                        <span className="muted">Equipe</span>
                      )}
                    </td>
                  </LinhaClicavel>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="vazio-bloco">{documentos.length ? "Nenhum documento com essa busca ou filtro." : "Nenhum documento anexado ainda."}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
