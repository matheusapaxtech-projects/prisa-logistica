import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Percent, Tag, Upload, Wallet, type LucideIcon } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Numero } from "@/components/Numero";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { ehCategoria, mesDeHoje, mesValido, nomeDoMes, percentualMargem, somarMes, somarResultado } from "@/lib/financeiro";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { AbasFinanceiro } from "./abas";
import { BotaoNovoLancamento } from "./botao-lancamento";
import {
  contarSemCategoria,
  lancamentosDoMes,
  listarContas,
  listarRegras,
  primeiroMesSemCategoria,
  resumoDoAno,
  saldosAte,
  ultimoMesComLancamento,
} from "./consultas";
import { LancamentosCliente } from "./lancamentos-cliente";
import { PainelResultado } from "./painel-resultado";
import { RegrasCliente } from "./regras-cliente";
import { ABAS, SEM_CATEGORIA, type AbaFinanceiro } from "./regras";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";

export const metadata: Metadata = { title: "Financeiro" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Endereço dentro do Financeiro mantendo aba e mês. */
function href(p: { aba?: AbaFinanceiro; mes?: string; ver?: string; q?: string }): string {
  const u = new URLSearchParams();
  if (p.aba && p.aba !== "resultado") u.set("aba", p.aba);
  if (p.mes) u.set("mes", p.mes);
  if (p.ver) u.set("ver", p.ver);
  if (p.q) u.set("q", p.q);
  const s = u.toString();
  return s ? `/financeiro?${s}` : "/financeiro";
}

/** Indicador ao lado do título (o mesmo do Início): círculo com ícone, número que conta e legenda. */
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
    <main className="prop fin">
      <div className="titulo">
        <div>
          <h1>Financeiro</h1>
        </div>
      </div>
      <EstadoVazio>O financeiro é visto só pelo administrador e pelo financeiro. Se você precisa dele, peça o acesso ao administrador.</EstadoVazio>
    </main>
  );
}

/* Financeiro: o resultado do mês (frete, despesas, empréstimos e capital) montado do extrato OFX e dos
   lançamentos feitos à mão, os lançamentos do mês para classificar e as regras que o NILT aprendeu. Mês pela URL (`?mes=aaaa-mm`;
   sem ele, o mês do lançamento mais recente) e aba por `?aba=`. */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (!pode(perfil, "financeiro")) return <SemAcesso />;

  const db = tipado(await createClient());
  const [ultimo, contas] = await Promise.all([ultimoMesComLancamento(db), listarContas(db)]);
  if (!ultimo) {
    return (
      <main className="prop fin">
        <div className="titulo">
          <div>
            <h1>Financeiro</h1>
            <p className="sub">Nenhum lançamento ainda</p>
          </div>
          <div className="acoes">
            <BotaoNovoLancamento mes={mesDeHoje()} contas={contas} />
            <Link className="btn btn-primario" href="/financeiro/importar">
              <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
              Importar extrato
            </Link>
          </div>
        </div>
        <EstadoVazio>
          Importe o extrato do banco em OFX, ou lance à mão o que não está no extrato. O NILT separa receita e pagamento de frete, despesas,
          empréstimos e capital e mostra o resultado de cada mês.
          <Link className="btn btn-texto" href="/financeiro/importar" style={{ marginLeft: "auto" }}>
            Importar o primeiro extrato
          </Link>
        </EstadoVazio>
      </main>
    );
  }

  const pedido = um(sp.mes);
  const mes = mesValido(pedido) ? pedido : ultimo;
  const ano = Number(mes.slice(0, 4));
  const pedida = um(sp.aba) as AbaFinanceiro;
  const aba: AbaFinanceiro = ABAS.includes(pedida) ? pedida : "resultado";

  const [linhasAno, semCategoriaTotal, regras] = await Promise.all([resumoDoAno(db, ano), contarSemCategoria(db), listarRegras(db)]);
  const doMes = somarResultado(linhasAno.filter((l) => l.mes === mes));

  const achado = [
    maiuscula(nomeDoMes(mes)),
    `${doMes.quantidade} ${plural(doMes.quantidade, "lançamento", "lançamentos")}`,
    ...(doMes.semCategoriaQtd ? [`${doMes.semCategoriaQtd} sem categoria`] : []),
  ];

  const margem = percentualMargem(doMes);
  const ver = um(sp.ver);
  const filtro = ver === SEM_CATEGORIA || ehCategoria(ver) ? ver : "";
  const busca = um(sp.q).trim();

  return (
    <main className="prop fin">
      <div className="titulo titulo-inicio">
        <div>
          <h1>Financeiro</h1>
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
          <Kpi Icone={Wallet} rotulo={`Resultado da operação em ${nomeDoMes(mes).split(" ")[0]}`} href={href({ mes })}>
            {doMes.resultado < 0 && "−"}
            <Numero valor={Math.abs(Math.round(doMes.resultado))} formato="moeda" />
          </Kpi>
          <Kpi Icone={Percent} rotulo="Margem do frete" href={href({ mes })}>
            {margem === null ? "—" : `${margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
          </Kpi>
          <Kpi Icone={Tag} rotulo="Sem categoria no mês" href={href({ aba: "lancamentos", mes, ver: SEM_CATEGORIA })}>
            <Numero valor={doMes.semCategoriaQtd} />
            {doMes.semCategoriaQtd > 0 ? <span className="selo selo-laranja">classificar</span> : <span className="selo selo-verde">em dia</span>}
          </Kpi>
        </div>
        <div className="acoes">
          <BotaoNovoLancamento mes={mes} contas={contas} />
          <Link className="btn btn-primario" href="/financeiro/importar">
            <Upload size={16} strokeWidth={1.6} aria-hidden="true" />
            Importar extrato
          </Link>
        </div>
      </div>

      <AbasFinanceiro ativa={aba} mes={mes} contagens={{ lancamentos: doMes.quantidade, regras: regras.length }} />

      {aba !== "regras" && (
        <nav className="mes-nav" aria-label="Mês">
          <Link className="btn btn-icone" href={href({ aba, mes: somarMes(mes, -1), ver: filtro, q: busca })} aria-label="Mês anterior" scroll={false}>
            <ChevronLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <b aria-current="date">{maiuscula(nomeDoMes(mes))}</b>
          <Link className="btn btn-icone" href={href({ aba, mes: somarMes(mes, 1), ver: filtro, q: busca })} aria-label="Próximo mês" scroll={false}>
            <ChevronRight size={16} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          {mes !== mesDeHoje() && (
            <Link className="btn btn-texto" href={href({ aba, mes: mesDeHoje() })} scroll={false}>
              Mês atual
            </Link>
          )}
        </nav>
      )}

      {aba === "resultado" && (
        <PainelResultado
          mes={mes}
          ano={ano}
          linhasAno={linhasAno}
          saldos={await saldosAte(db, mes)}
          semCategoriaTotal={semCategoriaTotal}
          hrefLancamentos={(v) => href({ aba: "lancamentos", mes, ver: v })}
          hrefMes={(m) => href({ mes: m })}
        />
      )}

      {aba === "lancamentos" && (
        <LancamentosCliente
          mes={mes}
          lancamentos={await lancamentosDoMes(db, mes)}
          contas={contas}
          filtro={filtro}
          busca={busca}
          semCategoriaOutrosMeses={Math.max(0, semCategoriaTotal - doMes.semCategoriaQtd)}
          primeiroMesSemCategoria={semCategoriaTotal > doMes.semCategoriaQtd ? await primeiroMesSemCategoria(db) : null}
        />
      )}

      {aba === "regras" && <RegrasCliente regras={regras} />}
    </main>
  );
}
