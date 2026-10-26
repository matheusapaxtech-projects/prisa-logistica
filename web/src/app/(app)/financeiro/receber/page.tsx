import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarClock, CalendarRange, ChevronLeft, ChevronRight, Search, Wallet, type LucideIcon } from "lucide-react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { somarValores } from "@/lib/contas";
import { hojeISO } from "@/lib/datas";
import { mesDeHoje, mesValido, nomeDoMes, somarMes } from "@/lib/financeiro";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { AbasFinanceiro } from "../abas";
import { listarContas } from "../consultas";
import { listarCentrosAtivos } from "../pagar/consultas";
import { contagemDasAbas, indicadoresReceber, listarClientesParaEscolher, listarTiposReceita, listarTitulos } from "./consultas";
import { BotaoLancarTitulo } from "./dialogo-conta";
import { FILTROS, lerFiltro, ROTULO_FILTRO, type FiltroReceber } from "./regras";
import { TabelaReceber } from "./tabela-receber";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";
import "@/styles/paginas/contas.css";

export const metadata: Metadata = { title: "Contas a receber" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Escolha = { filtro: FiltroReceber; mes?: string; q?: string };

/** Endereço da tela mantendo aba, mês (só quando não é o atual) e busca. */
function href(p: Escolha): string {
  const u = new URLSearchParams();
  if (p.filtro !== "aberto") u.set("filtro", p.filtro);
  if (p.mes && p.mes !== mesDeHoje()) u.set("mes", p.mes);
  if (p.q) u.set("q", p.q);
  const s = u.toString();
  return s ? `/financeiro/receber?${s}` : "/financeiro/receber";
}

/** Indicador ao lado do título (o mesmo do Financeiro): círculo com ícone, número e legenda; leva à aba correspondente. */
function Kpi({ Icone, children, rotulo, href }: { Icone: LucideIcon; children: React.ReactNode; rotulo: string; href: string }) {
  return (
    <Link className="kpi" href={href} scroll={false}>
      <span className="kpi-icone" aria-hidden="true">
        <Icone size={18} strokeWidth={1.7} />
      </span>
      <span>
        <b className="kpi-valor">{children}</b>
        <span className="kpi-rot">{rotulo}</span>
      </span>
    </Link>
  );
}

function SemAcesso() {
  return (
    <main className="prop fin contas">
      <div className="titulo">
        <div>
          <h1>Contas a receber</h1>
        </div>
      </div>
      <EstadoVazio>As contas a receber são vistas só pelo administrador e pelo financeiro. Se você precisa delas, peça o acesso ao administrador.</EstadoVazio>
    </main>
  );
}

function frasePara(filtro: FiltroReceber, busca: string, nome: string): string {
  if (busca) return `Nenhuma conta com “${busca}” nesta lista.`;
  switch (filtro) {
    case "aberto":
      return "Nenhuma conta em aberto. Use “Lançar conta a receber” para incluir uma.";
    case "vencidas":
      return "Nenhuma conta vencida. Tudo em dia.";
    case "recebidas":
      return `Nenhuma conta foi recebida em ${nome}.`;
    case "todas":
      return `Nenhuma conta com vencimento em ${nome}.`;
  }
}

/* Contas a receber: o que os clientes devem à PRISA, em aberto, vencido ou já recebido, e a simulação de antecipar
   títulos no fomento. Aba por `?filtro=`, mês por `?mes=aaaa-mm` (abas Recebidas e Todas; sem ele, o mês atual) e
   busca por `?q=`. */
export default async function ReceberPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (!perfil || !pode(perfil, "financeiro")) return <SemAcesso />;

  const filtro = lerFiltro(um(sp.filtro));
  const pedido = um(sp.mes);
  const mes = mesValido(pedido) ? pedido : mesDeHoje();
  const busca = um(sp.q).trim().slice(0, 80);
  const comMes = filtro === "recebidas" || filtro === "todas";
  const nomeMes = nomeDoMes(mes);
  const hoje = hojeISO();

  const db = tipado(await createClient());
  const ind = await indicadoresReceber(db, mesDeHoje());
  const [titulos, contagens, clientes, tipos, centros, contasBancarias] = await Promise.all([
    listarTitulos(db, { filtro, mes, busca }),
    contagemDasAbas(db, mes, ind),
    listarClientesParaEscolher(db),
    listarTiposReceita(db),
    listarCentrosAtivos(db),
    listarContas(db),
  ]);

  const total = somarValores(titulos.filter((t) => !t.canceladoEm));
  const achado = [
    `${titulos.length} ${plural(titulos.length, "conta", "contas")}`,
    formato.reais(total),
    comMes ? `${ROTULO_FILTRO[filtro]} em ${nomeMes}` : ROTULO_FILTRO[filtro],
  ];
  const escolha = { filtro, mes: comMes ? mes : undefined, q: busca };

  return (
    <main className="prop fin contas">
      <div className="titulo titulo-inicio">
        <div>
          <h1>Contas a receber</h1>
          <p className="sub" id="achado">
            {achado.map((t, i) => (
              <Fragment key={i}>
                {i > 0 && <Ponto />}
                {t}
              </Fragment>
            ))}
          </p>
        </div>
        <div className="kpis">
          <Kpi Icone={Wallet} rotulo={`Em aberto · ${ind.abertoQtd} ${plural(ind.abertoQtd, "conta", "contas")}`} href={href({ filtro: "aberto" })}>
            {formato.reais(ind.abertoValor)}
          </Kpi>
          <Kpi Icone={CalendarClock} rotulo={`Vencidas · ${ind.vencidasQtd} ${plural(ind.vencidasQtd, "conta", "contas")}`} href={href({ filtro: "vencidas" })}>
            {formato.reais(ind.vencidasValor)}
            {ind.vencidasQtd > 0 ? <span className="selo selo-vermelho">atrasadas</span> : <span className="selo selo-verde">em dia</span>}
          </Kpi>
          <Kpi Icone={CalendarRange} rotulo={`A receber em 30 dias · ${ind.em30Qtd} ${plural(ind.em30Qtd, "conta", "contas")}`} href={href({ filtro: "aberto" })}>
            {formato.reais(ind.em30Valor)}
          </Kpi>
          <Kpi Icone={Banknote} rotulo={`Recebido no mês · ${ind.recebidoMesQtd} ${plural(ind.recebidoMesQtd, "conta", "contas")}`} href={href({ filtro: "recebidas" })}>
            {formato.reais(ind.recebidoMesValor)}
          </Kpi>
        </div>
        <div className="acoes">
          <BotaoLancarTitulo clientes={clientes} tipos={tipos} centros={centros} />
        </div>
      </div>

      <AbasFinanceiro ativa="receber" />

      <Abas
        rotulo="Situação das contas"
        ativa={filtro}
        abas={FILTROS.map((f) => ({ id: f, rotulo: ROTULO_FILTRO[f], n: contagens[f], href: href({ ...escolha, filtro: f, mes }) }))}
      />

      {comMes && (
        <nav className="mes-nav" aria-label="Mês">
          <Link className="btn btn-icone" href={href({ ...escolha, mes: somarMes(mes, -1) })} aria-label="Mês anterior" scroll={false}>
            <ChevronLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <b aria-current="date">{maiuscula(nomeMes)}</b>
          <Link className="btn btn-icone" href={href({ ...escolha, mes: somarMes(mes, 1) })} aria-label="Próximo mês" scroll={false}>
            <ChevronRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          {mes !== mesDeHoje() && (
            <Link className="btn btn-texto" href={href({ ...escolha, mes: mesDeHoje() })} scroll={false}>
              Mês atual
            </Link>
          )}
        </nav>
      )}

      <form className="ferramentas" role="search" method="get" action="/financeiro/receber">
        {filtro !== "aberto" && <input type="hidden" name="filtro" value={filtro} />}
        {comMes && mes !== mesDeHoje() && <input type="hidden" name="mes" value={mes} />}
        <label className="busca-lista">
          <span className="sr-only">Buscar pelo título ou pelo cliente</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Título ou cliente" defaultValue={busca} />
        </label>
      </form>

      <TabelaReceber
        titulos={titulos}
        hoje={hoje}
        contasBancarias={contasBancarias}
        clientes={clientes}
        tipos={tipos}
        centros={centros}
        vazio={frasePara(filtro, busca, nomeMes)}
      />
    </main>
  );
}
