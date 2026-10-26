import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Search, Wallet, type LucideIcon } from "lucide-react";
import { Abas } from "@/components/Abas";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Numero } from "@/components/Numero";
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
import { contagemDasAbas, indicadoresPagar, listarCentrosAtivos, listarContasPagar, listarTiposDespesa, taxaDoMes } from "./consultas";
import { BotaoLancarConta } from "./dialogo-conta";
import {
  AGRUPAMENTOS,
  FILTROS,
  lerAgrupar,
  lerFiltro,
  ROTULO_AGRUPAMENTO,
  ROTULO_FILTRO,
  type Agrupamento,
  type FiltroPagar,
} from "./regras";
import { TabelaPagar } from "./tabela-pagar";
import { TaxaCartaoBloco } from "./taxa-cartao";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";
import "@/styles/paginas/contas.css";

export const metadata: Metadata = { title: "Contas a pagar" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Escolha = { filtro: FiltroPagar; agrupar: Agrupamento; mes?: string; q?: string };

/** Endereço da tela mantendo aba, agrupamento, mês (só quando não é o atual) e busca. */
function href(p: Escolha): string {
  const u = new URLSearchParams();
  if (p.filtro !== "aberto") u.set("filtro", p.filtro);
  if (p.agrupar !== "centro") u.set("agrupar", p.agrupar);
  if (p.mes && p.mes !== mesDeHoje()) u.set("mes", p.mes);
  if (p.q) u.set("q", p.q);
  const s = u.toString();
  return s ? `/financeiro/pagar?${s}` : "/financeiro/pagar";
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
          <h1>Contas a pagar</h1>
        </div>
      </div>
      <EstadoVazio>As contas a pagar são vistas só pelo administrador e pelo financeiro. Se você precisa delas, peça o acesso ao administrador.</EstadoVazio>
    </main>
  );
}

function frasePara(filtro: FiltroPagar, busca: string, nome: string): string {
  if (busca) return `Nenhuma conta com “${busca}” nesta lista.`;
  switch (filtro) {
    case "aberto":
      return "Nenhuma conta em aberto. Use “Lançar conta a pagar” para incluir uma.";
    case "aprovar":
      return "Nenhuma conta esperando aprovação.";
    case "vencidas":
      return "Nenhuma conta vencida. Tudo em dia.";
    case "pagas":
      return `Nenhuma conta foi paga em ${nome}.`;
    case "todas":
      return `Nenhuma conta com vencimento em ${nome}.`;
  }
}

/* Contas a pagar: o que a PRISA deve, em aberto, vencido, esperando aprovação ou já pago. Quem lança não aprova e sem
   aprovação não paga (o banco confere). Aba por `?filtro=`, agrupamento por `?agrupar=`, mês por `?mes=aaaa-mm` (abas Pagas e
   Todas e bloco da taxa do cartão-frete; sem ele, o mês atual) e busca por `?q=`. */
export default async function PagarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (!perfil || !pode(perfil, "financeiro")) return <SemAcesso />;

  const filtro = lerFiltro(um(sp.filtro));
  const agrupar = lerAgrupar(um(sp.agrupar));
  const pedido = um(sp.mes);
  const mes = mesValido(pedido) ? pedido : mesDeHoje();
  const busca = um(sp.q).trim().slice(0, 80);
  const comMes = filtro === "pagas" || filtro === "todas";
  const nomeMes = nomeDoMes(mes);
  const hoje = hojeISO();

  const db = tipado(await createClient());
  const ind = await indicadoresPagar(db, mesDeHoje());
  const [contas, contagens, taxa, tipos, centros, contasBancarias] = await Promise.all([
    listarContasPagar(db, { filtro, mes, busca }),
    contagemDasAbas(db, mes, ind),
    taxaDoMes(db, comMes ? mes : mesDeHoje()),
    listarTiposDespesa(db),
    listarCentrosAtivos(db),
    listarContas(db),
  ]);

  const total = somarValores(contas.filter((c) => !c.canceladoEm));
  const achado = [
    `${contas.length} ${plural(contas.length, "conta", "contas")}`,
    formato.reais(total),
    comMes ? `${ROTULO_FILTRO[filtro]} em ${nomeMes}` : ROTULO_FILTRO[filtro],
  ];
  const escolha = { filtro, agrupar, mes: comMes ? mes : undefined, q: busca };

  return (
    <main className="prop fin contas">
      <div className="titulo titulo-inicio">
        <div>
          <h1>Contas a pagar</h1>
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
          <Kpi Icone={Wallet} rotulo={`Em aberto · ${ind.abertoQtd} ${plural(ind.abertoQtd, "conta", "contas")}`} href={href({ filtro: "aberto", agrupar })}>
            {formato.reais(ind.abertoValor)}
          </Kpi>
          <Kpi Icone={CalendarClock} rotulo={`Vencidas · ${ind.vencidasQtd} ${plural(ind.vencidasQtd, "conta", "contas")}`} href={href({ filtro: "vencidas", agrupar })}>
            {formato.reais(ind.vencidasValor)}
            {ind.vencidasQtd > 0 ? <span className="selo selo-vermelho">atrasadas</span> : <span className="selo selo-verde">em dia</span>}
          </Kpi>
          <Kpi Icone={ClipboardCheck} rotulo="Falta aprovar" href={href({ filtro: "aprovar", agrupar })}>
            <Numero valor={ind.aprovarQtd} />
            {ind.aprovarQtd > 0 ? <span className="selo selo-laranja">aprovar</span> : <span className="selo selo-verde">em dia</span>}
          </Kpi>
          <Kpi Icone={Banknote} rotulo={`Pago no mês · ${ind.pagoMesQtd} ${plural(ind.pagoMesQtd, "conta", "contas")}`} href={href({ filtro: "pagas", agrupar })}>
            {formato.reais(ind.pagoMesValor)}
          </Kpi>
        </div>
        <div className="acoes">
          <Link className="btn btn-texto" href="/centros-de-custo">
            Centros de custo
          </Link>
          <BotaoLancarConta tipos={tipos} centros={centros} />
        </div>
      </div>

      <AbasFinanceiro ativa="pagar" />

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

      <TaxaCartaoBloco taxa={taxa} />

      <form className="ferramentas" role="search" method="get" action="/financeiro/pagar">
        {filtro !== "aberto" && <input type="hidden" name="filtro" value={filtro} />}
        {agrupar !== "centro" && <input type="hidden" name="agrupar" value={agrupar} />}
        {comMes && mes !== mesDeHoje() && <input type="hidden" name="mes" value={mes} />}
        <label className="busca-lista">
          <span className="sr-only">Buscar pela descrição ou pelo favorecido</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Descrição ou favorecido" defaultValue={busca} />
        </label>
        <nav className="contas-seg" aria-label="Agrupar a lista por">
          <span className="contas-seg-rot">Agrupar por</span>
          {AGRUPAMENTOS.map((a) => (
            <Link key={a} href={href({ ...escolha, agrupar: a })} aria-current={a === agrupar ? "true" : undefined} scroll={false} replace>
              {ROTULO_AGRUPAMENTO[a]}
            </Link>
          ))}
        </nav>
      </form>

      <TabelaPagar
        contas={contas}
        agrupar={agrupar}
        hoje={hoje}
        usuario={{ userId: perfil.userId, admin: pode(perfil, "admin") }}
        contasBancarias={contasBancarias}
        tipos={tipos}
        centros={centros}
        vazio={frasePara(filtro, busca, nomeMes)}
      />
    </main>
  );
}
