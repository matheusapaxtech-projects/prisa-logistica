import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Receipt, Truck, Users, type LucideIcon } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { tipado } from "@/lib/banco";
import { mesDeHoje, mesValido, nomeDoMes, somarMes } from "@/lib/financeiro";
import { irrfPorContratado, somarRetencoes } from "@/lib/fiscal";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { AbasFinanceiro } from "../abas";
import { AcoesGuias } from "./acoes-guias";
import { guiasDoMes, retencoesDoMes, vencimentoDoMes } from "./consultas";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";
import "@/styles/paginas/fiscal.css";

export const metadata: Metadata = { title: "Retenções e tributos" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const href = (mes: string) => (mes === mesDeHoje() ? "/financeiro/retencoes" : `/financeiro/retencoes?mes=${mes}`);

/** Indicador do topo (sem link): círculo com ícone, rótulo, valor e uma linha de detalhe. */
function Kpi({ Icone, valor, rotulo, linha2 }: { Icone: LucideIcon; valor: string; rotulo: string; linha2: string }) {
  return (
    <div className="kpi">
      <span className="kpi-icone" aria-hidden="true">
        <Icone size={18} strokeWidth={1.7} />
      </span>
      <span>
        <span className="kpi-rot">{rotulo}</span>
        <b className="kpi-valor">{valor}</b>
        <span className="kpi-rot">{linha2}</span>
      </span>
    </div>
  );
}

function SemAcesso() {
  return (
    <main className="prop fin fiscal">
      <div className="titulo">
        <div>
          <h1>Retenções e tributos</h1>
        </div>
      </div>
      <EstadoVazio>As retenções são vistas só pelo administrador e pelo financeiro. Se você precisa delas, peça o acesso ao administrador.</EstadoVazio>
    </main>
  );
}

/* Retenções e tributos: INSS, SEST/SENAT e IRRF retidos do frete pago a autônomo pessoa física (TAC PF) e o
   INSS patronal da PRISA, por mês (`?mes=aaaa-mm`; sem ele, o mês atual). Entra cada viagem finalizada no mês
   cujo contratado (proprietário ANTT do cavalo) é pessoa física. */
export default async function RetencoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (!pode(perfil, "financeiro")) return <SemAcesso />;

  const pedido = um(sp.mes);
  const mes = mesValido(pedido) ? pedido : mesDeHoje();
  const db = tipado(await createClient());
  const [linhas, guias, vencimento] = await Promise.all([retencoesDoMes(db, mes), guiasDoMes(db, mes), vencimentoDoMes(db, mes)]);
  const t = somarRetencoes(linhas);
  const irrf = irrfPorContratado(linhas);
  const nomeMes = nomeDoMes(mes);
  const soMes = nomeMes.split(" ")[0];

  return (
    <main className="prop fin fiscal">
      <div className="titulo titulo-inicio">
        <div>
          <h1>Retenções e tributos</h1>
          <p className="sub">INSS, SEST/SENAT e IRRF retidos de motoristas autônomos (TAC pessoa física) e o INSS patronal da PRISA.</p>
        </div>
      </div>

      <AbasFinanceiro ativa="retencoes" mes={mes} />

      <nav className="mes-nav" aria-label="Mês">
        <Link className="btn btn-icone" href={href(somarMes(mes, -1))} aria-label="Mês anterior" scroll={false}>
          <ChevronLeft size={16} strokeWidth={1.6} aria-hidden="true" />
        </Link>
        <b aria-current="date">{maiuscula(nomeMes)}</b>
        <Link className="btn btn-icone" href={href(somarMes(mes, 1))} aria-label="Próximo mês" scroll={false}>
          <ChevronRight size={16} strokeWidth={1.6} aria-hidden="true" />
        </Link>
        {mes !== mesDeHoje() && (
          <Link className="btn btn-texto" href={href(mesDeHoje())} scroll={false}>
            Mês atual
          </Link>
        )}
      </nav>

      <div className="kpis kpis-fiscal">
        <Kpi
          Icone={Truck}
          rotulo="Fretes pagos a TAC PF"
          valor={formato.reais(t.frete)}
          linha2={`${t.quantidade} ${plural(t.quantidade, "frete", "fretes")} em ${soMes}`}
        />
        <Kpi
          Icone={Receipt}
          rotulo="Guia do INSS (retido + patronal)"
          valor={formato.reais(t.guiaInss)}
          linha2={`${formato.reais(t.inss)} + ${formato.reais(t.patronal)}`}
        />
        <Kpi Icone={Users} rotulo="Guia do SEST/SENAT" valor={formato.reais(t.guiaSestSenat)} linha2="retidos dos motoristas" />
        <Kpi Icone={CalendarClock} rotulo="Vencimento das guias" valor={formato.data(vencimento)} linha2="dia 20 do mês seguinte" />
      </div>

      <section className="bloco" aria-labelledby="h-competencia">
        <div className="bloco-cab">
          <h2 id="h-competencia">Competência {nomeMes}</h2>
        </div>
        <div className="bloco-corpo">
          <p className="explica">
            Cada frete pago a motorista autônomo pessoa física entra aqui sozinho, quando a viagem é finalizada. Mande a planilha ao contador, que
            confere e emite as guias; ou gere as guias aqui para acompanhar o vencimento e o pagamento.
          </p>
          <AcoesGuias mes={mes} temRetencoes={t.quantidade > 0} guias={guias} />
        </div>
      </section>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-retencoes" aria-label={`Retenções de ${nomeMes}`}>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Contratado</th>
              <th scope="col" className="num">
                Frete
              </th>
              <th scope="col" className="num">
                Base 20%
              </th>
              <th scope="col" className="num">
                INSS 11%
              </th>
              <th scope="col" className="num">
                SEST 1,5%
              </th>
              <th scope="col" className="num">
                SENAT 1,0%
              </th>
              <th scope="col" className="num">
                Patronal 20%
              </th>
              <th scope="col" className="num">
                Base IRRF 10%
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={9}>
                  <EstadoVazio>Nenhuma viagem com contratado pessoa física foi finalizada em {nomeMes}.</EstadoVazio>
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.viagemId} className="sem-link">
                  <td className="data">
                    {formato.data(l.data)}
                    <span className="linha2">
                      <Link href={`/viagens/${l.viagemId}`}>Viagem {l.viagemNumero}</Link>
                      {l.cteNumero !== null && (
                        <>
                          <Ponto />
                          CT-e {l.cteNumero}
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    <span className="desc">{l.contratadoNome}</span>
                    <span className="linha2">{formato.cpf(l.contratadoCpf)}</span>
                  </td>
                  <td className="num">{formato.reais(l.frete)}</td>
                  <td className="num">{formato.reais(l.base)}</td>
                  <td className="num">{formato.reais(l.inss)}</td>
                  <td className="num">{formato.reais(l.sest)}</td>
                  <td className="num">{formato.reais(l.senat)}</td>
                  <td className="num">{formato.reais(l.patronal)}</td>
                  <td className="num">{formato.reais(l.baseIrrf)}</td>
                </tr>
              ))
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="total">
                <th scope="row" colSpan={2}>
                  Total do mês
                </th>
                <td className="num">{formato.reais(t.frete)}</td>
                <td className="num">{formato.reais(t.base)}</td>
                <td className="num">{formato.reais(t.inss)}</td>
                <td className="num">{formato.reais(t.sest)}</td>
                <td className="num">{formato.reais(t.senat)}</td>
                <td className="num">{formato.reais(t.patronal)}</td>
                <td className="num">{formato.reais(t.baseIrrf)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {irrf.length > 0 && (
        <section className="bloco" aria-labelledby="h-irrf">
          <div className="bloco-cab">
            <h2 id="h-irrf">IRRF por motorista (para o contador)</h2>
          </div>
          <div className="bloco-corpo">
            <p className="explica">
              O IRRF do autônomo usa a tabela progressiva do mês sobre 10% do frete, somando todos os fretes do contratado no mês. O contador aplica a
              tabela vigente.
            </p>
            <ul className="lista-irrf">
              {irrf.map((c) => (
                <li key={c.contratadoId}>
                  <span>
                    <b>{c.nome}</b>
                    <span className="linha2">
                      {formato.cpf(c.cpf)}
                      <Ponto />
                      {c.quantidade} {plural(c.quantidade, "frete", "fretes")}
                    </span>
                  </span>
                  <span className="num valor-irrf">
                    fretes {formato.reais(c.fretes)}
                    <span className="linha2">base IRRF {formato.reais(c.baseIrrf)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="nota nota-fiscal">
        Confira com o contador: códigos e prazos das guias (INSS pela DCTFWeb, SEST/SENAT), feriados no vencimento, o teto do INSS quando o motorista
        tiver outras fontes de renda no mês e se a PRISA está no regime que recolhe o INSS patronal de 20% sobre o frete de autônomos.
      </p>
    </main>
  );
}
