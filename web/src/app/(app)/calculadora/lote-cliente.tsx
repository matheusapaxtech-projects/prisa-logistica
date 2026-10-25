"use client";

import { Sinal, type TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import {
  avaliarLote,
  custoPorTonelada,
  distribuirPeso,
  EIXOS_LOTE,
  novoCaminhao,
  type AvaliacaoLote,
  type Caminhao,
  type Rota,
  type SituacaoCaminhao,
} from "@/lib/calculadora/lote";
import { faixaMargem, MARGEM_MINIMA, type Coeficiente, type ParamFiscais, type TipoCarga } from "@/lib/calculadora/regras";
import { porcento, sinalDaFaixa } from "@/lib/frete";
import { dinheiro } from "../financeiro/regras";
import { CabSecao, campo, CampoNumero, FORMA, num } from "./partes";

/* Modo "Lote de carga" da calculadora: o total em toneladas a um preço por tonelada, levado por vários
   caminhões. A rota e o tipo de carga vêm da tela (os mesmos da carga única). Regras em lib/calculadora/lote.ts. */

/** Caminhão como digitado (texto pt-BR); vira `Caminhao` para as contas. */
export type CaminhaoTela = { id: number; eixos: number; capacidade: string; peso: string; freteMotorista: string; pf: boolean };

export type LoteTela = { pesoTotal: string; preco: string; valorMercadoria: string; caminhoes: CaminhaoTela[] };

export const LOTE_VAZIO: LoteTela = { pesoTotal: "", preco: "", valorMercadoria: "", caminhoes: [] };

let proximoId = 1;
export function caminhaoTela(c: Caminhao): CaminhaoTela {
  return {
    id: proximoId++,
    eixos: c.eixos,
    capacidade: campo(c.capacidade),
    peso: c.peso ? campo(c.peso) : "",
    freteMotorista: c.freteMotorista !== null ? campo(c.freteMotorista) : "",
    pf: c.pf,
  };
}

export function paraCaminhao(c: CaminhaoTela): Caminhao {
  return { eixos: c.eixos, capacidade: num(c.capacidade), peso: num(c.peso), freteMotorista: c.freteMotorista.trim() ? num(c.freteMotorista) : null, pf: c.pf };
}

export function avaliar(lote: LoteTela, rota: Rota, tabela: readonly Coeficiente[], param: ParamFiscais): AvaliacaoLote {
  return avaliarLote({
    rota,
    tabela,
    pesoTotal: num(lote.pesoTotal),
    precoPorTonelada: num(lote.preco),
    valorMercadoriaPorTonelada: num(lote.valorMercadoria),
    caminhoes: lote.caminhoes.map(paraCaminhao),
    param,
  });
}

const SITUACAO: Record<SituacaoCaminhao, [TipoSinal, string]> = {
  faltam: ["pendente", "Faltam valores"],
  abaixo_piso: ["bloqueado", "Abaixo do piso"],
  prejuizo: ["bloqueado", "Prejuízo"],
  negociar: ["vencendo", "Negociar"],
  contratar: ["normal", "Pode contratar"],
};

type PropsPaineis = {
  lote: LoteTela;
  muda: (f: (l: LoteTela) => LoteTela) => void;
  av: AvaliacaoLote;
  tipo: TipoCarga;
  aoTipo: (t: TipoCarga) => void;
  tiposCarga: Record<TipoCarga, string>;
  verTudo: boolean;
  /** "Abrir na carga única": leva o caminhão para o outro modo. */
  abrir: (c: Caminhao) => void;
};

export function LotePaineis({ lote, muda, av, tipo, aoTipo, tiposCarga, verTudo, abrir }: PropsPaineis) {
  const pesoTotal = num(lote.pesoTotal);
  const preco = num(lote.preco);
  const mudaCaminhao = (id: number, f: Partial<CaminhaoTela>) =>
    muda((l) => ({ ...l, caminhoes: l.caminhoes.map((c) => (c.id === id ? { ...c, ...f } : c)) }));
  return (
    <>
      <section className="painel" aria-labelledby="calc-lote">
        <CabSecao id="calc-lote" titulo="Lote">
          O total que o cliente vai carregar e o preço por tonelada negociado com ele.
        </CabSecao>
        <div className="campos">
          <div className="campo f6">
            <label htmlFor="lote-tipo">Tipo de carga (ANTT)</label>
            <select id="lote-tipo" value={tipo} onChange={(ev) => aoTipo(ev.target.value as TipoCarga)}>
              {(Object.keys(tiposCarga) as TipoCarga[]).map((t) => (
                <option key={t} value={t}>
                  {tiposCarga[t]}
                </option>
              ))}
            </select>
          </div>
          <CampoNumero
            classe="f6"
            id="lote-mercadoria"
            rotulo="Valor da mercadoria por tonelada"
            opcional
            unidade="R$/t"
            valor={lote.valorMercadoria}
            aoMudar={(v) => muda((l) => ({ ...l, valorMercadoria: v }))}
            ajuda="base do seguro da carga"
          />
          <CampoNumero classe="f6" id="lote-peso" rotulo="Peso total do lote" unidade="t" valor={lote.pesoTotal} aoMudar={(v) => muda((l) => ({ ...l, pesoTotal: v }))} />
          <CampoNumero
            classe="f6"
            id="lote-preco"
            rotulo="Frete contratado por tonelada"
            unidade="R$/t"
            valor={lote.preco}
            aoMudar={(v) => muda((l) => ({ ...l, preco: v }))}
            ajuda={pesoTotal && preco ? `${formato.reais(pesoTotal * preco)} no lote todo` : "valor negociado com o cliente"}
          />
        </div>
      </section>

      <section className="painel" aria-labelledby="calc-caminhoes">
        <CabSecao id="calc-caminhoes" titulo="Caminhões">
          O frete do motorista começa no piso da ANTT de cada caminhão. Digite por cima o que foi negociado.
        </CabSecao>
        {lote.caminhoes.length === 0 ? (
          <p className="calc-vazio">Nenhum caminhão. Use os botões abaixo para montar a composição.</p>
        ) : (
          <ol className="calc-caminhoes">
            {lote.caminhoes.map((c, i) => {
              const a = av.caminhoes[i];
              const [tipoSinal, texto] = SITUACAO[a.situacao];
              const cap = num(c.capacidade);
              const pesoC = num(c.peso);
              const avisos = [
                a.situacao === "abaixo_piso" ? `Frete do motorista ${formato.reais(a.piso - a.freteMotorista)} abaixo do piso.` : "",
                a.acimaDaCapacidade ? `${campo(pesoC - cap)} t acima da capacidade.` : "",
              ].filter(Boolean);
              const n = i + 1;
              return (
                <li key={c.id} className="calc-caminhao">
                  <div className="calc-caminhao-cab">
                    <strong>Caminhão {n}</strong>
                    <select
                      aria-label={`Eixos do caminhão ${n}`}
                      value={c.eixos}
                      onChange={(ev) => {
                        const eixos = Number(ev.target.value);
                        mudaCaminhao(c.id, { eixos, capacidade: campo(novoCaminhao(eixos).capacidade), freteMotorista: "" });
                      }}
                    >
                      {EIXOS_LOTE.map((e) => (
                        <option key={e} value={e}>
                          {e} eixos
                        </option>
                      ))}
                    </select>
                    <Sinal tipo={tipoSinal} texto={texto} />
                    <span className="calc-caminhao-acoes">
                      <button type="button" className="calc-link" onClick={() => abrir(paraCaminhao(c))}>
                        Abrir na carga única
                      </button>
                      <button
                        type="button"
                        className="calc-link calc-link-perigo"
                        onClick={() => muda((l) => ({ ...l, caminhoes: l.caminhoes.filter((x) => x.id !== c.id) }))}
                        aria-label={`Remover o caminhão ${n}`}
                      >
                        Remover
                      </button>
                    </span>
                  </div>
                  <div className="campos">
                    <CampoNumero classe="f3" id={`cam-${c.id}-cap`} rotulo="Capacidade" unidade="t" valor={c.capacidade} aoMudar={(v) => mudaCaminhao(c.id, { capacidade: v })} />
                    <CampoNumero classe="f3" id={`cam-${c.id}-peso`} rotulo="Peso carregado" unidade="t" valor={c.peso} aoMudar={(v) => mudaCaminhao(c.id, { peso: v })} />
                    <CampoNumero
                      classe="f3"
                      id={`cam-${c.id}-fm`}
                      rotulo="Frete do motorista"
                      unidade="R$"
                      valor={c.freteMotorista}
                      placeholder={a.piso ? campo(Math.ceil(a.piso)) : undefined}
                      aoMudar={(v) => mudaCaminhao(c.id, { freteMotorista: v })}
                      ajuda={c.freteMotorista.trim() ? "digitado" : "no piso da ANTT"}
                    />
                    <div className="campo f3 calc-chave-campo">
                      <label className="chave">
                        <input type="checkbox" checked={c.pf} onChange={(ev) => mudaCaminhao(c.id, { pf: ev.target.checked })} />
                        Pessoa física
                      </label>
                    </div>
                  </div>
                  <dl className="calc-caminhao-num">
                    <div>
                      <dt>Frete contratado</dt>
                      <dd>{formato.reais(a.freteEmpresa)}</dd>
                    </div>
                    <div>
                      <dt>Piso ANTT</dt>
                      <dd>{a.piso ? formato.reais(a.piso) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Pedágio</dt>
                      <dd>{formato.reais(a.pedagio)}</dd>
                    </div>
                    <div>
                      <dt>Teto do motorista</dt>
                      <dd>{a.tetoMotorista !== null && a.tetoMotorista >= a.piso ? formato.reais(a.tetoMotorista) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Ocupação</dt>
                      <dd>{cap ? `${Math.round((pesoC / cap) * 100)}%` : "—"}</dd>
                    </div>
                    {verTudo && a.freteEmpresa > 0 && (
                      <>
                        <div>
                          <dt>Resultado líquido</dt>
                          <dd>{dinheiro(a.resultado.resultadoLiquido)}</dd>
                        </div>
                        <div>
                          <dt>Margem líquida</dt>
                          <dd>{porcento(a.resultado.margemLiquida)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  {avisos.length > 0 && <p className="calc-caminhao-aviso">{avisos.join(" ")}</p>}
                </li>
              );
            })}
          </ol>
        )}
        <div className="calc-caminhoes-add">
          {EIXOS_LOTE.map((e) => (
            <button key={e} type="button" className="btn" onClick={() => muda((l) => ({ ...l, caminhoes: [...l.caminhoes, caminhaoTela(novoCaminhao(e))] }))}>
              + {e} eixos
            </button>
          ))}
          <button
            type="button"
            className="btn"
            disabled={!lote.caminhoes.length || !(pesoTotal > 0)}
            onClick={() =>
              muda((l) => {
                const d = distribuirPeso(l.caminhoes.map(paraCaminhao), num(l.pesoTotal));
                return { ...l, caminhoes: l.caminhoes.map((c, i) => ({ ...c, peso: campo(d[i].peso) })) };
              })
            }
          >
            Distribuir o peso
          </button>
        </div>
      </section>
    </>
  );
}

type PropsLateral = { av: AvaliacaoLote; pesoTotal: number; rota: Rota; tabela: readonly Coeficiente[]; verTudo: boolean };

export function LoteLateral({ av, pesoTotal, rota, tabela, verTudo }: PropsLateral) {
  const t = av.totais;
  const custos = custoPorTonelada(rota, tabela);
  const melhor = custos.length ? Math.min(...custos.map((c) => c.valor)) : 0;
  const principal = av.veredito !== "contratar";
  const linhas: [string, string, boolean?][] = [
    ...(av.precoMinimo !== null ? [["Preço mínimo por tonelada", `${formato.reais(av.precoMinimo)}/t`, principal] as [string, string, boolean]] : []),
    ["Peso alocado", `${campo(t.peso)} de ${campo(pesoTotal)} t`],
    ["Fretes dos motoristas", formato.reais(t.freteMotorista)],
    ["Pedágio total", formato.reais(t.pedagio)],
    ...(verTudo && t.freteEmpresa > 0 ? [["Margem líquida do lote", `${porcento(t.margemLiquida)} · ${faixaMargem(t.margemLiquida)}`] as [string, string]] : []),
  ];
  const demo: [string, number, boolean?][] = [
    ["Frete contratado", t.freteEmpresa],
    ["ICMS", -t.icms],
    ["PIS e COFINS", -t.impostoFederal],
    ["Fretes dos motoristas", -t.freteMotorista],
    ["Pedágio", -t.pedagio],
    ...(t.inssPatronal ? [["INSS patronal", -t.inssPatronal] as [string, number]] : []),
    ["Taxa Pan Card", -t.taxaPanCard],
    ...(t.seguroCarga ? [["Seguro da carga", -t.seguroCarga] as [string, number]] : []),
    ["Resultado", t.resultado, true],
    ["IRPJ e CSLL", -t.irpjCsll],
    ["Resultado líquido", t.resultadoLiquido, true],
  ];
  return (
    <>
      <a className={`calc-barra calc-${av.veredito}`} href="#calc-decisao" aria-hidden="true" tabIndex={-1}>
        <svg viewBox="0 0 30 30" width="18" height="18">
          {FORMA[av.veredito]}
        </svg>
        <b>{av.titulo}</b>
        {av.precoMinimo !== null && <span>mínimo {formato.reais(av.precoMinimo)}/t</span>}
      </a>
      <section id="calc-decisao" className={`calc-decisao calc-${av.veredito}`} aria-live="polite" aria-labelledby="calc-veredito">
        <div className="calc-decisao-topo">
          <span>Decisão do lote</span>
          <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
            {FORMA[av.veredito]}
          </svg>
        </div>
        <h2 id="calc-veredito">{av.titulo}</h2>
        <p>{av.texto}</p>
        <dl className="calc-limites">
          {linhas.map(([r, v, p]) => (
            <div key={r} className={p ? "principal" : undefined}>
              <dt>{r}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="painel" aria-labelledby="calc-custo">
        <CabSecao id="calc-custo" titulo="Custo mínimo por tonelada">
          Piso da ANTT + pedágio, dividido pela capacidade de cada tipo de caminhão nesta rota.
        </CabSecao>
        {custos.length ? (
          <table className="calc-demonstrativo">
            <tbody>
              {custos.map((c) => (
                <tr key={c.eixos} className={c.valor === melhor ? "total" : undefined}>
                  <th scope="row">
                    {c.eixos} eixos
                    <span className="linha2">
                      {c.capacidade} t{c.valor === melhor ? " · o mais barato" : ""}
                    </span>
                  </th>
                  <td>{formato.reais(c.valor)}/t</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="nota">Informe a rota.</p>
        )}
      </section>

      {verTudo ? (
        <section className="painel" aria-labelledby="calc-lote-res">
          <div className="calc-cab calc-cab-linha">
            <h2 id="calc-lote-res">Resultado do lote</h2>
            {t.freteEmpresa > 0 && <Sinal tipo={sinalDaFaixa(faixaMargem(t.margemLiquida))} texto={faixaMargem(t.margemLiquida)} />}
          </div>
          {t.freteEmpresa > 0 ? (
            <>
              <table className="calc-demonstrativo">
                <tbody>
                  {demo.map(([r, v, total]) => (
                    <tr key={r} className={total ? "total" : undefined}>
                      <th scope="row">{r}</th>
                      <td>{dinheiro(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="nota">Margem mínima para contratar: {porcento(MARGEM_MINIMA)} de margem líquida no lote.</p>
            </>
          ) : (
            <p className="nota">Informe o preço por tonelada e os caminhões para ver o resultado.</p>
          )}
        </section>
      ) : (
        <p className="aviso aviso-info">Impostos, margem e resultado aparecem só para admin e financeiro. A decisão já considera a margem mínima.</p>
      )}
    </>
  );
}

/** Texto do "Copiar resumo" no modo lote. */
export function resumoLote(av: AvaliacaoLote, lote: LoteTela, cabecalho: string[], verTudo: boolean): string {
  const pesoTotal = num(lote.pesoTotal);
  const preco = num(lote.preco);
  return [
    `PRISA · lote de carga (${new Date().toLocaleDateString("pt-BR")})`,
    ...cabecalho,
    `Lote: ${campo(pesoTotal)} t a ${formato.reais(preco)}/t = ${formato.reais(pesoTotal * preco)}`,
    ...lote.caminhoes.map((c, i) => {
      const a = av.caminhoes[i];
      return `Caminhão ${i + 1}: ${c.eixos} eixos · ${campo(num(c.peso))} de ${campo(num(c.capacidade))} t · motorista ${formato.reais(a.freteMotorista)}${c.pf ? " (PF)" : ""} · ${SITUACAO[a.situacao][1]}`;
    }),
    `Decisão: ${av.titulo}`,
    ...(av.precoMinimo !== null ? [`Preço mínimo por tonelada: ${formato.reais(av.precoMinimo)}`] : []),
    ...(verTudo && av.totais.freteEmpresa ? [`Margem líquida do lote: ${porcento(av.totais.margemLiquida)} (${faixaMargem(av.totais.margemLiquida)})`] : []),
  ].join("\n");
}
