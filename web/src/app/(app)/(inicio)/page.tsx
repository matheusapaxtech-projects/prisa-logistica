import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { Capacidade } from "@/components/Capacidade";
import { Engate } from "@/components/Engate";
import { EstadoVazio } from "@/components/EstadoVazio";
import { MarcoKm } from "@/components/MarcoKm";
import { Ponto } from "@/components/Ponto";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { carregarInicio, type Cadastros, type Placas, type Vencimento } from "./consultas";
import { MenuNovo } from "./menu-novo";

export const metadata: Metadata = { title: "Início" };

const FUSO = "America/Sao_Paulo";

/** "um" quando 1, senão o plural já escrito. */
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Itens separados pelo ponto do meio (`<Ponto />` dá o ar que a Overpass não dá). */
function Partes({ itens }: { itens: string[] }) {
  return (
    <>
      {itens.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <Ponto />}
          {t}
        </Fragment>
      ))}
    </>
  );
}

/** Dia da semana e data de hoje em Brasília: "Sexta-feira, 23 de outubro". */
function hojePorExtenso(): string {
  const t = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO });
  return t[0].toUpperCase() + t.slice(1);
}

/** Dia (dd/mm/aaaa) de um instante `timestamptz`, no horário de Brasília. */
function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** "a, b e c": o fato que mais pede atenção hoje (`#achado` do protótipo). */
function achadoDoDia(p: Placas): string[] {
  const partes: string[] = [];
  if (p.vencidos) partes.push(plural(p.vencidos, "documento vencido", "documentos vencidos"));
  if (p.acimaCmt) partes.push(plural(p.acimaCmt, "conjunto acima do CMT", "conjuntos acima do CMT"));
  if (p.arrendadoSemContrato)
    partes.push(plural(p.arrendadoSemContrato, "veículo arrendado", "veículos arrendados") + " sem contrato");
  const resumo = partes.length
    ? partes.slice(0, -1).join(", ") + (partes.length > 1 ? " e " : "") + partes[partes.length - 1]
    : "nenhuma pendência hoje";
  return [hojePorExtenso(), resumo];
}

type Advertencia = {
  tipo: string;
  n: number;
  rotulo: string;
  sub: string;
  forma: "circulo" | "laranja";
};

function advertencias(p: Placas): Advertencia[] {
  return [
    { tipo: "arquivo_vencido", n: p.vencidos, rotulo: "Documentos vencidos", sub: "CNH, RNTRC, seguro e arquivos", forma: "circulo" },
    { tipo: "veiculo_arrendado_sem_contrato", n: p.arrendadoSemContrato, rotulo: "Arrendado sem contrato", sub: "posse diferente da ANTT", forma: "laranja" },
    { tipo: "conjunto_acima_cmt", n: p.acimaCmt, rotulo: "Conjunto acima do CMT", sub: "carretas passam do que o cavalo puxa", forma: "circulo" },
    { tipo: "motorista_sem_cnh", n: p.semCnh, rotulo: "Motorista sem CNH anexada", sub: "falta o arquivo da CNH", forma: "laranja" },
    { tipo: "motorista_sem_comprovante", n: p.semComprovante, rotulo: "Sem comprovante de residência", sub: "falta o arquivo do comprovante", forma: "laranja" },
  ];
}

function PlacaAdvertencia({ a }: { a: Advertencia }) {
  const vazio = a.n === 0;
  return (
    <Link className="advertencia" href={`/pendencias?tipo=${a.tipo}`} aria-label={`${a.n} ${a.rotulo}`}>
      {a.forma === "circulo" ? (
        <span className={`circulo-proibido${vazio ? " vazio" : ""}`} aria-hidden="true">
          <b>{a.n}</b>
        </span>
      ) : (
        <span className={`losango ${vazio ? "vazio" : a.forma}`} aria-hidden="true">
          <b>{a.n}</b>
        </span>
      )}
      <span className="txt">
        <b>{a.rotulo}</b>
        <span>{vazio ? "nada pendente" : a.sub}</span>
      </span>
    </Link>
  );
}

function LinhaVencimento({ v }: { v: Vencimento }) {
  const vencido = v.dias < 0;
  return (
    <Link className="marco" href={v.dono.href}>
      <span className="quem">
        <b>{v.tipo}</b>
        <span>
          {v.dono.tipo === "pessoa" ? (
            v.dono.nome
          ) : (
            <>
              {v.dono.placa}
              <Ponto />
              {v.dono.modelo ?? "—"}
            </>
          )}
          <Ponto />
          {formato.data(v.data)}
        </span>
      </span>
      <MarcoKm dias={v.dias} />
      <span className={`dias${vencido ? " vencido" : ""}`}>
        <b>{vencido ? "Vencido" : v.dias + (v.dias === 1 ? " dia" : " dias")}</b>
        <span>{vencido ? formato.dias(v.dias) : "restantes"}</span>
      </span>
    </Link>
  );
}

function LinhaCadastro({ rotulo, total, detalhe, href }: { rotulo: string; total: number; detalhe: string[]; href: string }) {
  return (
    <Link className="marco" href={href} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
      <span className="quem">
        <b>{rotulo}</b>
        <span>
          <Partes itens={detalhe} />
        </span>
      </span>
      <span className="dias">
        <b>{total}</b>
      </span>
    </Link>
  );
}

function ResumoCadastros({ c }: { c: Cadastros }) {
  const { motoristas: m, proprietarios: p, veiculos: v, conjuntos: j, documentos: d } = c;
  return (
    <div className="marcos">
      <LinhaCadastro
        rotulo="Motoristas"
        total={m.total}
        detalhe={[plural(m.normal, "normal", "normais"), plural(m.pendente, "pendente", "pendentes"), plural(m.cancelado, "cancelado", "cancelados")]}
        href="/motoristas"
      />
      <LinhaCadastro
        rotulo="Proprietários"
        total={p.total}
        detalhe={[plural(p.pf, "pessoa física", "pessoas físicas"), plural(p.pj, "empresa", "empresas")]}
        href="/proprietarios"
      />
      <LinhaCadastro
        rotulo="Veículos"
        total={v.total}
        detalhe={[plural(v.cavalo, "cavalo", "cavalos"), plural(v.carreta, "carreta", "carretas"), `${v.dolly} dolly`, `${v.caminhao} truck`]}
        href="/veiculos"
      />
      <LinhaCadastro
        rotulo="Conjuntos abertos"
        total={j.total}
        detalhe={[`${j.comMaisDeUmaCarreta} com mais de uma carreta`, `${j.acimaCmt} acima do CMT`]}
        href="/conjuntos"
      />
      <LinhaCadastro
        rotulo="Documentos anexados"
        total={d.total}
        detalhe={[plural(d.conferidos, "conferido", "conferidos"), plural(d.restritos, "restrito", "restritos")]}
        href="/pendencias?aba=documentos"
      />
      <LinhaCadastro rotulo="Arrendados" total={v.arrendados} detalhe={["posse no CRLV diferente da ANTT"]} href="/veiculos?filtro=arrendados" />
    </div>
  );
}

export default async function Inicio() {
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const { placas, vencimentos, cadastros, conjuntos } = await carregarInicio(await createClient());

  return (
    <main>
      <div className="titulo">
        <div>
          <h1>Início</h1>
          <p className="sub" id="achado">
            <Partes itens={achadoDoDia(placas)} />
          </p>
        </div>
        {podeEditar && (
          <div className="acoes">
            <Link className="btn" href="/conjuntos/novo">
              <Link2 size={16} strokeWidth={1.6} aria-hidden="true" />
              Montar conjunto
            </Link>
            <MenuNovo />
          </div>
        )}
      </div>

      <div className="grade">
        <section className="bloco c12" aria-labelledby="h-pend">
          <div className="bloco-cab">
            <h2 id="h-pend">Pendências</h2>
            <span className="dir">
              <Link href="/pendencias">Ver todas</Link>
            </span>
          </div>
          <div className="advertencias" id="advertencias">
            {advertencias(placas).map((a) => (
              <PlacaAdvertencia key={a.tipo} a={a} />
            ))}
          </div>
        </section>

        <section className="bloco c7" aria-labelledby="h-venc">
          <div className="bloco-cab">
            <h2 id="h-venc">Vencimentos</h2>
            <span className="dir">próximos 90 dias e já vencidos</span>
          </div>
          <div className="bloco-corpo" style={{ paddingTop: 8 }}>
            <div className="marcos" id="marcos">
              {vencimentos.length ? (
                vencimentos.map((v) => (
                  <LinhaVencimento key={`${v.tipo}-${v.dono.href}-${v.data}`} v={v} />
                ))
              ) : (
                <EstadoVazio>Nada vence nos próximos 90 dias.</EstadoVazio>
              )}
            </div>
            <div style={{ paddingTop: 12 }}>
              <Link className="btn" href="/pendencias?aba=vencimentos" style={{ height: 30 }}>
                Ver todos os vencimentos
              </Link>
            </div>
          </div>
        </section>

        <section className="bloco c5" aria-labelledby="h-cad">
          <div className="bloco-cab">
            <h2 id="h-cad">Cadastros</h2>
            <span className="dir">situação atual</span>
          </div>
          <div className="bloco-corpo" id="cadastros">
            <ResumoCadastros c={cadastros} />
          </div>
        </section>

        <section className="bloco c12" aria-labelledby="h-conj">
          <div className="bloco-cab">
            <h2 id="h-conj">Conjuntos rodando</h2>
            <span className="dir" id="conj-total">
              {conjuntos.length} {conjuntos.length === 1 ? "aberto" : "abertos"}
            </span>
          </div>
          <div className="bloco-corpo" style={{ paddingTop: 8 }}>
            <div id="conjuntos">
              {conjuntos.length ? (
                conjuntos.map((c) => (
                  <Link key={c.id} className="marco marco-conjunto" href={`/conjuntos/${c.id}`}>
                    <Engate cavalo={c.cavalo} itens={c.itens} />
                    <span className="quem">
                      <b>{c.motorista}</b>
                      <span>
                        desde {diaDe(c.inicio)}
                        <Ponto />
                        {c.eixos} eixos
                      </span>
                    </span>
                    <Capacidade c={c.capacidade} />
                  </Link>
                ))
              ) : (
                <EstadoVazio>Nenhum conjunto rodando agora.</EstadoVazio>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
