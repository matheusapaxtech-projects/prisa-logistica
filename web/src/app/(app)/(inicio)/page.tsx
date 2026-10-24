import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Link2, Route, Truck, Weight } from "lucide-react";
import { Anel } from "@/components/Anel";
import { Avatar } from "@/components/Avatar";
import { Capacidade } from "@/components/Capacidade";
import { Engate } from "@/components/Engate";
import { EstadoVazio } from "@/components/EstadoVazio";
import { MarcoKm } from "@/components/MarcoKm";
import { Numero } from "@/components/Numero";
import { Ponto } from "@/components/Ponto";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { tipado } from "@/lib/banco";
import { rotuloDe } from "@/lib/quadro";
import { duracao } from "../viagens/regras";
import {
  carregarInicio,
  carregarPainel,
  destaquesDoQuadro,
  resumoOperacao,
  situacaoDoQuadro,
  type Cadastros,
  type Destaque,
  type Placas,
  type ResumoOperacao,
  type SituacaoQuadro,
  type Vencimento,
} from "./consultas";
import { GraficoToneladas } from "./grafico-toneladas";
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
  /** Para onde a placa leva (pendências filtradas, ou a fila da operação). */
  href: string;
  n: number;
  rotulo: string;
  sub: string;
  /** Texto quando o valor é zero (padrão: "nada pendente"). */
  zero?: string;
  forma: "circulo" | "laranja" | "amarelo";
};

/** Placas da fila da operação (bloco "Operação"), antes das pendências de cadastro. */
function filasDaOperacao(o: ResumoOperacao): Advertencia[] {
  return [
    { tipo: "pedidos_a_planejar", href: "/pedidos?aba=a_planejar", n: o.pedidosAPlanejar, rotulo: "Pedidos a planejar", sub: "com peso ainda sem viagem", zero: "nada a planejar", forma: "laranja" },
    { tipo: "planejadas_aptas", href: "/viagens?aba=planejadas", n: o.planejadasAptas, rotulo: "Planejadas aptas", sub: "prontas para iniciar", zero: "nenhuma pronta", forma: "amarelo" },
    { tipo: "planejadas_com_trava", href: "/viagens?aba=planejadas&trava=1", n: o.planejadasComTrava, rotulo: "Planejadas com trava", sub: "não podem iniciar", zero: "nenhuma travada", forma: "circulo" },
    { tipo: "cartoes_vermelhos", href: "/quadro?problema=1", n: o.cartoesVermelhos, rotulo: "Cartões no vermelho", sub: "passaram do tempo-limite", zero: "nenhum parado demais", forma: "circulo" },
    { tipo: "pausas_nao_programadas", href: "/quadro?problema=1", n: o.pausasNaoProgramadas, rotulo: "Pausas não programadas", sub: "carga parada sem aviso", zero: "nenhuma pausa", forma: "laranja" },
  ];
}

function advertencias(p: Placas): Advertencia[] {
  return [
    { tipo: "arquivo_vencido", href: `/pendencias?tipo=arquivo_vencido`, n: p.vencidos, rotulo: "Documentos vencidos", sub: "CNH, RNTRC, seguro e arquivos", forma: "circulo" },
    { tipo: "veiculo_arrendado_sem_contrato", href: `/pendencias?tipo=veiculo_arrendado_sem_contrato`, n: p.arrendadoSemContrato, rotulo: "Arrendado sem contrato", sub: "posse diferente da ANTT", forma: "laranja" },
    { tipo: "conjunto_acima_cmt", href: `/pendencias?tipo=conjunto_acima_cmt`, n: p.acimaCmt, rotulo: "Conjunto acima do CMT", sub: "carretas passam do que o cavalo puxa", forma: "circulo" },
    { tipo: "motorista_sem_cnh", href: `/pendencias?tipo=motorista_sem_cnh`, n: p.semCnh, rotulo: "Motorista sem CNH anexada", sub: "falta o arquivo da CNH", forma: "laranja" },
    { tipo: "motorista_sem_comprovante", href: `/pendencias?tipo=motorista_sem_comprovante`, n: p.semComprovante, rotulo: "Sem comprovante de residência", sub: "falta o arquivo do comprovante", forma: "laranja" },
  ];
}

/** Cartão sólido na cor da situação (vermelho = círculo, laranja/amarelo = losango); zero fica apagado,
   em vidro, com a forma tracejada. O número grande conta até o valor. */
function PlacaAdvertencia({ a }: { a: Advertencia }) {
  const vazio = a.n === 0;
  return (
    <Link className={`advertencia tom-${vazio ? "vazio" : a.forma}`} href={a.href} aria-label={`${a.n} ${a.rotulo}`}>
      <b className="adv-n">
        <Numero valor={a.n} />
      </b>
      <span className={`adv-forma forma-${a.forma === "circulo" ? "circulo" : "losango"}${vazio ? " vazio" : ""}`} aria-hidden="true" />
      <span className="txt">
        <b>{a.rotulo}</b>
        <span>{vazio ? (a.zero ?? "nada pendente") : a.sub}</span>
      </span>
    </Link>
  );
}

/** Indicador ao lado do título: círculo com ícone, número que conta, selo opcional e legenda. */
function Kpi({ Icone, n, sufixo, rotulo, href, selo }: { Icone: typeof Truck; n: number; sufixo?: string; rotulo: string; href: string; selo?: React.ReactNode }) {
  return (
    <Link className="kpi" href={href}>
      <span className="kpi-icone" aria-hidden="true">
        <Icone size={18} strokeWidth={1.7} />
      </span>
      <span>
        <b className="kpi-valor">
          <Numero valor={n} />
          {sufixo}
          {selo}
        </b>
        <span className="kpi-rot">{rotulo}</span>
      </span>
    </Link>
  );
}

const cidade = (c: string | null, uf: string | null) => (c ? `${c}${uf ? `/${uf}` : ""}` : "—");
const FORMA: Record<Destaque["nivel"], { classe: string; texto: string }> = {
  vermelho: { classe: "forma-circulo tom-vermelho", texto: "passou do tempo-limite" },
  ambar: { classe: "forma-losango tom-mostarda", texto: "perto do tempo-limite" },
  normal: { classe: "forma-ret tom-verde", texto: "no prazo" },
};

/** Cartão escuro dos destaques (os "Hot deals" do template): a viagem parada há mais tempo, com a forma
   da situação no canto, a coluna no alto, a rota em destaque e o tempo grande embaixo. */
function CartaoDestaque({ d, agora }: { d: Destaque; agora: number }) {
  const c = d.cartao;
  const f = FORMA[d.nivel];
  return (
    <Link
      className="destaque"
      href={`/viagens/${c.viagem_id}`}
      aria-label={`Viagem #${c.numero}, ${c.status_campo ? rotuloDe(c.status_campo) : ""}, ${f.texto}, ${c.status_desde ? duracao(c.status_desde, new Date(agora)) : ""}`}
    >
      <span className="dest-topo">
        <span>{c.status_campo ? rotuloDe(c.status_campo) : "—"}</span>
        <span className={`dest-forma ${f.classe}`} aria-hidden="true" />
      </span>
      <b className="dest-titulo">
        {cidade(c.origem_cidade, c.origem_uf).split("/")[0]} → {cidade(c.destino_cidade, c.destino_uf).split("/")[0]}
      </b>
      <span className="dest-sub">{c.cliente_nome ?? "—"}</span>
      <span className="dest-pe">
        <span>
          <b className="dest-valor">{c.status_desde ? duracao(c.status_desde, new Date(agora)).replace(/^há /, "") : "—"}</b>
          <span className="dest-meta">
            #{c.numero} · {c.cavalo_placa ?? "sem placa"}
          </span>
        </span>
        <Avatar nome={c.motorista_nome} />
      </span>
    </Link>
  );
}

/** Barra da situação das viagens do quadro (a "Stage mix" do template), cor = situação. */
function PainelSituacao({ s }: { s: SituacaoQuadro }) {
  const total = s.normal + s.ambar + s.vermelho + s.finalizadas;
  const partes = [
    { k: "normal", n: s.normal, rot: "No prazo", forma: "forma-ret tom-verde" },
    { k: "ambar", n: s.ambar, rot: "Perto do tempo-limite", forma: "forma-losango tom-mostarda" },
    { k: "vermelho", n: s.vermelho, rot: "Passaram do tempo-limite", forma: "forma-circulo tom-vermelho" },
    { k: "finalizadas", n: s.finalizadas, rot: "Frete finalizado", forma: "forma-ponto tom-noite" },
  ];
  return (
    <section className="painel painel-situacao" aria-labelledby="h-sit">
      <div className="painel-cab">
        <h2 id="h-sit">Situação das viagens</h2>
        <Link className="redondo" href="/quadro" aria-label="Abrir o Quadro">
          <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
      <div className="linha-valor">
        <span className="valor-medio">
          <Numero valor={total} />
        </span>
        <span className="nota">viagens no quadro agora</span>
      </div>
      <div className="barra-sit" aria-hidden="true">
        {partes.map((p, i) => (p.n > 0 ? <i key={p.k} className={`sit-${p.k}`} style={{ flexGrow: p.n, animationDelay: `${250 + i * 70}ms` }} /> : null))}
        {total === 0 && <i className="sit-vazio" />}
      </div>
      <ul className="sit-lista">
        {partes.map((p) => (
          <li key={p.k}>
            <span className={`adv-forma ${p.forma}`} aria-hidden="true" />
            <span>{p.rot}</span>
            <b className="num">{p.n}</b>
            <span className="num pct">{total ? Math.round((p.n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </section>
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
  const supabase = await createClient();
  const db = tipado(supabase);
  const agora = new Date().getTime();
  const [{ placas, vencimentos, cadastros, conjuntos }, painel] = await Promise.all([carregarInicio(supabase), carregarPainel(db, agora)]);
  const operacao = await resumoOperacao(db, agora, painel.quadro);
  const destaques = destaquesDoQuadro(painel.quadro, agora);
  const situacao = situacaoDoQuadro(painel.quadro, agora);
  const noQuadro = situacao.normal + situacao.ambar + situacao.vermelho;
  const tonMes = painel.meses[painel.meses.length - 1]?.toneladas ?? 0;
  const docs = cadastros.documentos;

  return (
    <main>
      <div className="titulo titulo-inicio">
        <div>
          <h1>Início</h1>
          <p className="sub" id="achado">
            <Partes itens={achadoDoDia(placas)} />
          </p>
        </div>
        <div className="kpis">
          <Kpi
            Icone={Route}
            n={noQuadro}
            rotulo="Viagens no quadro"
            href="/quadro"
            selo={situacao.vermelho > 0 ? <span className="selo selo-vermelho">{situacao.vermelho} no vermelho</span> : <span className="selo selo-verde">tudo no prazo</span>}
          />
          <Kpi Icone={Weight} n={Math.round(tonMes)} sufixo=" t" rotulo="Transportadas neste mês" href="/viagens?aba=finalizadas" />
          <Kpi Icone={Truck} n={conjuntos.length} rotulo="Conjuntos rodando" href="/conjuntos" />
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

      <div className="painel-operacao">
        <GraficoToneladas meses={painel.meses} />

        <section className="painel painel-destaques" aria-labelledby="h-dest">
          <div className="painel-cab">
            <h2 id="h-dest">Paradas há mais tempo</h2>
            <span className="nota">pelo tempo na coluna</span>
            <Link className="redondo" href="/quadro?problema=1" aria-label="Ver no Quadro as que têm problema">
              <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
          {destaques.length ? (
            <div className="destaques">
              {destaques.map((d) => (
                <CartaoDestaque key={d.cartao.viagem_id} d={d} agora={agora} />
              ))}
            </div>
          ) : (
            <EstadoVazio>Nenhuma viagem no quadro agora.</EstadoVazio>
          )}
        </section>

        <Link className="painel painel-verde" href="/pendencias?aba=documentos" aria-labelledby="h-docs">
          <span className="painel-cab">
            <span className="h2" id="h-docs">
              Documentos conferidos
            </span>
          </span>
          <Anel
            fracao={docs.total ? docs.conferidos / docs.total : 0}
            rotulo={`${docs.conferidos} de ${docs.total} documentos conferidos`}
            tamanho={150}
            legenda={`${docs.conferidos} de ${docs.total}`}
          />
        </Link>

        <PainelSituacao s={situacao} />
      </div>

      <div className="grade">
        <section className="bloco c12" aria-labelledby="h-oper">
          <div className="bloco-cab">
            <h2 id="h-oper">Operação</h2>
            <span className="dir">
              <Link href="/quadro">Abrir o Quadro</Link>
            </span>
          </div>
          <div className="advertencias" id="operacao">
            {filasDaOperacao(operacao).map((a) => (
              <PlacaAdvertencia key={a.tipo} a={a} />
            ))}
          </div>
        </section>

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
              <Link className="btn" href="/pendencias?aba=vencimentos">
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
