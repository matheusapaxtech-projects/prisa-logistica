"use client";

import { useId } from "react";
import { simularAntecipacao } from "@/lib/contas";
import { formato } from "@/lib/formato";
import { lerParametrosSimulacao } from "./regras";

export type TituloMarcado = { id: string; titulo: string; clienteNome: string; valor: number; vencimento: string };

const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const prazo = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} ${Math.round(n) === 1 ? "dia" : "dias"}`;

/** Taxa e tarifa como digitadas (a lista guarda, para não perder quando o painel some ao desmarcar o último título). */
export type ParametrosTexto = { taxa: string; tarifa: string };
export const PARAMETROS_PADRAO: ParametrosTexto = { taxa: "2,0", tarifa: "5,00" };

/* Simulador de antecipação: quanto o fomento descontaria dos títulos marcados na lista. Taxa ao mês (padrão 2,0%) e
   tarifa por título (padrão R$ 5,00) são digitadas em formato brasileiro. Só simula: nada é gravado. Os textos dos
   dois campos moram em quem monta o painel. */
export function Simulador({
  titulos,
  hoje,
  parametros,
  aoMudar,
  aoLimpar,
}: {
  titulos: TituloMarcado[];
  hoje: string;
  parametros: ParametrosTexto;
  aoMudar: (p: ParametrosTexto) => void;
  aoLimpar: () => void;
}) {
  const id = useId();
  const taxaTexto = parametros.taxa;
  const tarifaTexto = parametros.tarifa;

  const params = lerParametrosSimulacao(taxaTexto, tarifaTexto);
  const sim = params.ok ? simularAntecipacao(titulos, params.taxa, params.tarifa, hoje) : null;
  const porId = new Map(titulos.map((t) => [t.id, t]));
  const erros = params.ok ? {} : params.erros;

  return (
    <section className="contas-simulador" aria-label="Simulador de antecipação">
      <div className="contas-sim-topo">
        <h2>Simulador de antecipação</h2>
        <span className="contas-sim-qtd" aria-live="polite">
          {titulos.length} {titulos.length === 1 ? "título marcado" : "títulos marcados"}
        </span>
        <button className="btn btn-texto btn-pequeno" type="button" onClick={aoLimpar}>
          Limpar seleção
        </button>
      </div>

      <div className="contas-sim-params">
        <div className="campo" data-invalido={erros.taxa ? "" : undefined}>
          <label htmlFor={`${id}-taxa`}>Taxa ao mês (%)</label>
          <input
            id={`${id}-taxa`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={taxaTexto}
            onChange={(e) => aoMudar({ ...parametros, taxa: e.target.value })}
            aria-invalid={!!erros.taxa || undefined}
            aria-describedby={erros.taxa ? `${id}-taxa-erro` : undefined}
          />
          {erros.taxa && (
            <span className="erro" id={`${id}-taxa-erro`} role="alert">
              {erros.taxa}
            </span>
          )}
        </div>
        <div className="campo" data-invalido={erros.tarifa ? "" : undefined}>
          <label htmlFor={`${id}-tarifa`}>Tarifa por título (R$)</label>
          <input
            id={`${id}-tarifa`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={tarifaTexto}
            onChange={(e) => aoMudar({ ...parametros, tarifa: e.target.value })}
            aria-invalid={!!erros.tarifa || undefined}
            aria-describedby={erros.tarifa ? `${id}-tarifa-erro` : undefined}
          />
          {erros.tarifa && (
            <span className="erro" id={`${id}-tarifa-erro`} role="alert">
              {erros.tarifa}
            </span>
          )}
        </div>
      </div>

      {sim && (
        <>
          <div className="tabela-wrap">
            <table className="tabela tabela-prop contas-sim-tabela" aria-label="Títulos na simulação">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col" className="num">
                    Dias
                  </th>
                  <th scope="col" className="num">
                    Deságio
                  </th>
                  <th scope="col" className="num">
                    Tarifa
                  </th>
                  <th scope="col" className="num">
                    Líquido
                  </th>
                </tr>
              </thead>
              <tbody>
                {sim.linhas.map((l) => {
                  const t = porId.get(l.id);
                  return (
                    <tr key={l.id} className="sem-link">
                      <td>
                        <span className="contas-desc">{t?.titulo}</span>
                        <span className="linha2">{t?.clienteNome}</span>
                      </td>
                      <td className="num">{formato.reais(l.valor)}</td>
                      <td className="num">{l.dias}</td>
                      <td className="num">{formato.reais(l.desagio)}</td>
                      <td className="num">{formato.reais(l.tarifa)}</td>
                      <td className="num contas-valor">{formato.reais(l.liquido)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <dl className="contas-sim-totais">
            <div>
              <dt>Bruto</dt>
              <dd>{formato.reais(sim.bruto)}</dd>
            </div>
            <div>
              <dt>Deságio</dt>
              <dd>{formato.reais(sim.desagio)}</dd>
            </div>
            <div>
              <dt>Tarifas</dt>
              <dd>{formato.reais(sim.tarifas)}</dd>
            </div>
            <div>
              <dt>Líquido</dt>
              <dd className="contas-sim-liquido">{formato.reais(sim.liquido)}</dd>
            </div>
            <div>
              <dt>Prazo médio</dt>
              <dd>{prazo(sim.prazoMedio)}</dd>
            </div>
            <div>
              <dt>Custo efetivo ao mês</dt>
              <dd>{sim.custoEfetivoMesPct === null ? "—" : pct(sim.custoEfetivoMesPct)}</dd>
            </div>
          </dl>
        </>
      )}

      <p className="nota">Só simula: registrar a antecipação no fomento chega na próxima etapa.</p>
    </section>
  );
}
