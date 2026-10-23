"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Capacidade } from "@/components/Capacidade";
import { Engate } from "@/components/Engate";
import { Ponto } from "@/components/Ponto";
import { formato } from "@/lib/formato";
import { validacao } from "@/lib/validacao";
import type { ConjuntoLista } from "./consultas";
import { diaSP, diasEntre, haDias, Partes, plural } from "./partes";

/** Linha que abre o conjunto (`linhaClicavel` do protótipo): clique fora de links/botões ou Enter. */
export function LinhaClicavel({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      data-href={href}
      tabIndex={0}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,input")) router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) router.push(href);
      }}
    >
      {children}
    </tr>
  );
}

/** Placa (2+ caracteres) ou nome do motorista (`casa` do protótipo). */
function casa(c: ConjuntoLista, termo: string): boolean {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  const pl = validacao.normalizarPlaca(t);
  return (pl.length >= 2 && c.placas.some((p) => p.includes(pl))) || (c.motorista ?? "").toLowerCase().includes(t);
}

const data = (iso: string) => formato.data(diaSP(iso));

const FILTROS: Record<string, (c: ConjuntoLista) => boolean> = {
  excede: (c) => c.capacidade.excede_cmt,
  rodotrem: (c) => c.carretas > 1,
  sem_motorista: (c) => !c.motorista,
};

function BuscaLista({ id, valor, mudar, rotulo }: { id: string; valor: string; mudar: (v: string) => void; rotulo: string }) {
  return (
    <div className="busca-lista">
      <Search size={16} strokeWidth={1.6} aria-hidden="true" />
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder="Placa ou motorista"
        aria-label={rotulo}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
      />
    </div>
  );
}

const SemMotorista = () => <span className="dash">sem motorista</span>;

export function PainelAbertos({ abertos }: { abertos: ConjuntoLista[] }) {
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState("");
  const f = FILTROS[filtro] ?? (() => true);
  const linhas = abertos.filter((c) => f(c) && casa(c, termo));

  return (
    <section data-painel="abertos" aria-label="Conjuntos abertos">
      <div className="ferramentas">
        <BuscaLista id="busca-abertos" valor={termo} mudar={setTermo} rotulo="Buscar conjunto por placa ou motorista" />
        <label className="ctrl">
          <span className="rotulo-ctrl">Mostrar</span>
          <select id="filtro-abertos" aria-label="Filtrar conjuntos abertos" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            <option value="excede">Acima do CMT</option>
            <option value="rodotrem">Com mais de uma carreta</option>
            <option value="sem_motorista">Sem motorista</option>
          </select>
        </label>
        <span className="total" id="total-abertos">
          {plural(linhas.length, "conjunto", "conjuntos")}
        </span>
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-fixa">
          <thead>
            <tr>
              <th className="col-engate">Conjunto em ordem de engate</th>
              <th className="some-celular">Motorista</th>
              <th className="num some-celular">Eixos</th>
              <th className="col-cap">Capacidade de carga</th>
            </tr>
          </thead>
          <tbody id="lista-abertos">
            {linhas.length ? (
              linhas.map((c) => {
                const href = `/conjuntos/${c.id}`;
                const mot = c.motorista ?? <SemMotorista />;
                return (
                  <LinhaClicavel key={c.id} href={href}>
                    <td className="col-engate">
                      <Engate cavalo={c.cavalo} itens={c.itens} />
                      <span className="linha2 so-celular">
                        <Partes itens={[mot, `desde ${data(c.inicio)}`, `${c.eixos} eixos`]} />
                      </span>
                      <div className="cap-inline">
                        <Capacidade c={c.capacidade} />
                      </div>
                    </td>
                    <td className="some-celular">
                      <Link className="id" href={href}>
                        {mot}
                      </Link>
                      <span className="linha2">
                        desde {data(c.inicio)}
                        <span className="some-tablet">
                          <Ponto />
                          {haDias(c.inicio)}
                        </span>
                      </span>
                    </td>
                    <td className="num some-celular">{c.eixos}</td>
                    <td className="col-cap">
                      <Capacidade c={c.capacidade} />
                    </td>
                  </LinhaClicavel>
                );
              })
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="vazio-bloco">
                    {abertos.length
                      ? "Nenhum conjunto aberto com essa placa, motorista ou filtro."
                      : "Nenhum conjunto aberto. Use “Montar conjunto” para engatar o primeiro."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PainelHistorico({ historico }: { historico: ConjuntoLista[] }) {
  const [termo, setTermo] = useState("");
  const linhas = historico.filter((c) => casa(c, termo));

  return (
    <section data-painel="historico" aria-label="Conjuntos encerrados">
      <div className="ferramentas">
        <BuscaLista id="busca-historico" valor={termo} mudar={setTermo} rotulo="Buscar conjunto encerrado por placa ou motorista" />
        <span className="total" id="total-historico">
          {plural(linhas.length, "encerrado", "encerrados")}
        </span>
      </div>
      <div className="tabela-wrap">
        <table className="tabela tabela-fixa">
          <thead>
            <tr>
              <th className="col-engate">Conjunto em ordem de engate</th>
              <th className="some-celular">Motorista</th>
              <th className="num some-celular">Início</th>
              <th className="num some-celular">Fim</th>
              <th className="num some-celular">Dias rodando</th>
            </tr>
          </thead>
          <tbody id="lista-historico">
            {linhas.length ? (
              linhas.map((c) => {
                const href = `/conjuntos/${c.id}`;
                const dur = diasEntre(c.inicio, c.fim!);
                return (
                  <LinhaClicavel key={c.id} href={href}>
                    <td className="col-engate">
                      <Engate cavalo={c.cavalo} itens={c.itens} />
                      <span className="linha2 so-celular">
                        <Partes itens={[c.motorista ?? "sem motorista", `${data(c.inicio)} a ${data(c.fim!)}`, `${dur} dias`]} />
                      </span>
                    </td>
                    <td className="some-celular">
                      <Link className="id" href={href}>
                        {c.motorista ?? <SemMotorista />}
                      </Link>
                      <span className="linha2">{c.eixos} eixos</span>
                    </td>
                    <td className="num some-celular">{data(c.inicio)}</td>
                    <td className="num some-celular">{data(c.fim!)}</td>
                    <td className="num some-celular">{dur}</td>
                  </LinhaClicavel>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="vazio-bloco">
                    {historico.length ? "Nenhum conjunto encerrado com essa placa ou motorista." : "Nenhum conjunto encerrado ainda."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
