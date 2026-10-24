import { Fragment } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Ponto } from "@/components/Ponto";
import { formato } from "@/lib/formato";
import {
  mesCurto,
  nomeDoMes,
  partesDaConta,
  percentualMargem,
  resultadoDoAno,
  somarResultado,
  type Categoria,
  type LinhaResumo,
  type Resultado,
} from "@/lib/financeiro";
import type { SaldoConta } from "./consultas";
import { dinheiro, SEM_CATEGORIA } from "./regras";
import { RolarAteMes } from "./rolar-ate-mes";

type Props = {
  mes: string;
  ano: number;
  linhasAno: LinhaResumo[];
  saldos: SaldoConta[];
  /** Lançamentos sem categoria em todos os meses (o aviso fala dos outros meses também). */
  semCategoriaTotal: number;
  hrefLancamentos: (ver: string) => string;
  hrefMes: (mes: string) => string;
};

type Linha = {
  rotulo: string;
  valor: (r: Resultado) => number;
  /** Categoria que a linha soma (o rótulo leva aos lançamentos dela). */
  ver?: Categoria | typeof SEM_CATEGORIA;
  /** Linha de soma: filete acima e peso 600. */
  total?: boolean;
};

/* Demonstrativo do mês: o que o frete deixou e o que as despesas levaram. */
const RESULTADO: Linha[] = [
  { rotulo: "Receita de frete", valor: (r) => r.receitaFrete, ver: "receita_frete" },
  { rotulo: "Pagamento de frete", valor: (r) => r.pagamentoFrete, ver: "pagamento_frete" },
  { rotulo: "Margem do frete", valor: (r) => r.margemFrete, total: true },
  { rotulo: "Despesas", valor: (r) => r.despesa, ver: "despesa" },
  { rotulo: "Resultado da operação", valor: (r) => r.resultado, total: true },
];

/* O que mexeu no caixa sem ser operação, e a variação total. */
const CAIXA: Linha[] = [
  { rotulo: "Resultado da operação", valor: (r) => r.resultado },
  { rotulo: "Empréstimos recebidos", valor: (r) => r.emprestimo, ver: "emprestimo" },
  { rotulo: "Devolução de empréstimos", valor: (r) => r.devolucaoEmprestimo, ver: "devolucao_emprestimo" },
  { rotulo: "Aportes de capital", valor: (r) => r.aporteCapital, ver: "aporte_capital" },
  { rotulo: "Devolução de capital", valor: (r) => r.devolucaoCapital, ver: "devolucao_capital" },
  { rotulo: "Transferências entre contas", valor: (r) => r.transferencia, ver: "transferencia" },
  { rotulo: "Sem categoria", valor: (r) => r.semCategoria, ver: SEM_CATEGORIA },
  { rotulo: "Variação do caixa", valor: (r) => r.variacaoCaixa, total: true },
];

/* Mês a mês: as mesmas linhas, resumidas (empréstimo e capital pelo líquido). */
const ANO: Linha[] = [
  { rotulo: "Receita de frete", valor: (r) => r.receitaFrete },
  { rotulo: "Pagamento de frete", valor: (r) => r.pagamentoFrete },
  { rotulo: "Margem do frete", valor: (r) => r.margemFrete, total: true },
  { rotulo: "Despesas", valor: (r) => r.despesa },
  { rotulo: "Resultado da operação", valor: (r) => r.resultado, total: true },
  { rotulo: "Empréstimos (líquido)", valor: (r) => r.emprestimo + r.devolucaoEmprestimo },
  { rotulo: "Capital (líquido)", valor: (r) => r.aporteCapital + r.devolucaoCapital },
  { rotulo: "Transferências", valor: (r) => r.transferencia },
  { rotulo: "Sem categoria", valor: (r) => r.semCategoria },
  { rotulo: "Variação do caixa", valor: (r) => r.variacaoCaixa, total: true },
];

function Demonstrativo({ linhas, r, hrefLancamentos }: { linhas: Linha[]; r: Resultado; hrefLancamentos: Props["hrefLancamentos"] }) {
  return (
    <table className="demonstrativo">
      <tbody>
        {linhas.map((l) => (
          <tr key={l.rotulo} className={l.total ? "total" : undefined}>
            <th scope="row">
              {l.ver ? (
                <Link href={hrefLancamentos(l.ver)} title={`Ver os lançamentos de ${l.rotulo.toLowerCase()}`}>
                  {l.rotulo}
                </Link>
              ) : (
                l.rotulo
              )}
            </th>
            <td className="num">{dinheiro(l.valor(r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PainelResultado({ mes, ano, linhasAno, saldos, semCategoriaTotal, hrefLancamentos, hrefMes }: Props) {
  const r = somarResultado(linhasAno.filter((l) => l.mes === mes));
  const doAno = resultadoDoAno(linhasAno, ano);
  const margem = percentualMargem(r);
  const nome = nomeDoMes(mes);
  const outros = semCategoriaTotal - r.semCategoriaQtd;

  return (
    <div className="painel-fin">
      {r.semCategoriaQtd > 0 && (
        <div className="aviso aviso-pendente aviso-fin" role="status">
          <CircleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <span className="txt">
            <b>
              {r.semCategoriaQtd} {r.semCategoriaQtd === 1 ? "lançamento" : "lançamentos"} de {nome.split(" ")[0]} sem categoria
            </b>{" "}
            ({dinheiro(r.semCategoria)}) {r.semCategoriaQtd === 1 ? "fica" : "ficam"} fora do resultado da operação.
            {outros > 0 && ` Há mais ${outros} em outros meses.`}
          </span>
          <Link className="btn btn-pequeno" href={hrefLancamentos(SEM_CATEGORIA)}>
            Classificar
          </Link>
        </div>
      )}

      {r.quantidade === 0 && (
        <div className="vazio-bloco aviso-fin">
          Nenhum lançamento em {nome}. Importe o extrato desse mês ou escolha outro mês.
          <Link className="btn btn-texto" href="/financeiro/importar" style={{ marginLeft: "auto" }}>
            Importar extrato
          </Link>
        </div>
      )}

      <div className="grade">
        <section className="bloco c7" aria-labelledby="t-resultado">
          <div className="bloco-cab">
            <h2 id="t-resultado">Resultado de {nome}</h2>
          </div>
          <div className="bloco-corpo">
            <div className="linha-valor">
              <span className="valor-grande">{dinheiro(r.resultado)}</span>
              <span className="nota">
                {margem !== null
                  ? `margem do frete de ${margem.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                  : "sem receita de frete no mês"}
              </span>
            </div>
            <Demonstrativo linhas={RESULTADO} r={r} hrefLancamentos={hrefLancamentos} />
          </div>
        </section>

        <section className="bloco c5" aria-labelledby="t-caixa">
          <div className="bloco-cab">
            <h2 id="t-caixa">Caixa</h2>
          </div>
          <div className="bloco-corpo">
            <Demonstrativo linhas={CAIXA} r={r} hrefLancamentos={hrefLancamentos} />
            {saldos.length > 0 && (
              <dl className="saldos">
                {saldos.map((s) => (
                  <Fragment key={s.conta.id}>
                    <dt>
                      Saldo no extrato
                      <span className="linha2">
                        {partesDaConta(s.conta).map((p, i) => (
                          <Fragment key={i}>
                            {i > 0 && <Ponto />}
                            {p}
                          </Fragment>
                        ))}
                        <Ponto />
                        em {formato.data(s.em)}
                      </span>
                    </dt>
                    <dd className="num">{dinheiro(s.saldo)}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </div>
        </section>

        <section className="bloco c12" aria-labelledby="t-ano">
          <div className="bloco-cab">
            <h2 id="t-ano">Mês a mês em {ano}</h2>
            <span className="dir">valores em R$</span>
          </div>
          <div className="bloco-corpo">
            <RolarAteMes>
              <table className="tabela tabela-ano">
                <thead>
                  <tr>
                    <th scope="col" className="col-rotulo">
                      <span className="sr-only">Linha</span>
                    </th>
                    {doAno.meses.map((m) => (
                      <th key={m.mes} scope="col" className={`num${m.mes === mes ? " atual" : ""}`}>
                        <Link href={hrefMes(m.mes)} aria-current={m.mes === mes ? "date" : undefined} aria-label={nomeDoMes(m.mes)}>
                          {mesCurto(m.mes)}
                        </Link>
                      </th>
                    ))}
                    <th scope="col" className="num col-total">
                      {ano}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ANO.map((l) => (
                    <tr key={l.rotulo} className={l.total ? "total" : undefined}>
                      <th scope="row">{l.rotulo}</th>
                      {doAno.meses.map((m) => (
                        <td key={m.mes} className={`num${m.mes === mes ? " atual" : ""}`}>
                          {m.r.quantidade === 0 ? <span className="dash">—</span> : dinheiro(l.valor(m.r), true)}
                        </td>
                      ))}
                      <td className="num col-total">{doAno.total.quantidade === 0 ? <span className="dash">—</span> : dinheiro(l.valor(doAno.total), true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </RolarAteMes>
          </div>
        </section>
      </div>
    </div>
  );
}
