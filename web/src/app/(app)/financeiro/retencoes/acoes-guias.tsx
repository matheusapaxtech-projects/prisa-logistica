"use client";

import { useState, useTransition } from "react";
import { Download, FileCheck2 } from "lucide-react";
import { formato } from "@/lib/formato";
import { gerarGuias, marcarGuia } from "./actions";
import type { Guia } from "./consultas";

const ROTULO_GUIA: Record<Guia["tipo"], string> = { inss: "INSS (retido + patronal)", sest_senat: "SEST/SENAT" };

/** Hoje em Brasília, "aaaa-mm-dd". */
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Situação da guia: paga (verde), vencida (vermelho) ou a vencer (sem cor). */
function Situacao({ guia }: { guia: Guia }) {
  if (guia.pagaEm) return <span className="selo selo-verde">paga em {formato.data(guia.pagaEm)}</span>;
  if (guia.vencimento < hoje()) return <span className="selo selo-vermelho">vencida</span>;
  const dias = Math.round((Date.parse(guia.vencimento) - Date.parse(hoje())) / 86_400_000);
  return <span className="nota">{formato.dias(dias)}</span>;
}

/** Botões da competência (planilha e guias) e a lista das guias já geradas, com o pagamento. */
export function AcoesGuias({ mes, temRetencoes, guias }: { mes: string; temRetencoes: boolean; guias: Guia[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const algumaPaga = guias.some((g) => g.pagaEm);

  function gerar() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await gerarGuias(mes);
      if (!r.ok) setErro(r.erro);
      else setAviso(r.dados === 0 ? "As guias já estavam em dia com as retenções do mês." : "Guias geradas com os valores do mês.");
    });
  }

  function pagar(g: Guia, data: string | null) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await marcarGuia(g.id, data);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <>
      <div className="acoes-guias">
        {temRetencoes ? (
          <a className="btn btn-primario" href={`/financeiro/retencoes/planilha?mes=${mes}`} download>
            <Download size={16} strokeWidth={1.6} aria-hidden="true" />
            Baixar planilha para o contador
          </a>
        ) : (
          <button className="btn btn-primario" type="button" disabled>
            <Download size={16} strokeWidth={1.6} aria-hidden="true" />
            Baixar planilha para o contador
          </button>
        )}
        <button
          className="btn"
          type="button"
          onClick={gerar}
          disabled={!temRetencoes || enviando || algumaPaga}
          title={algumaPaga ? "Há guia paga neste mês: desfaça o pagamento para gerar de novo." : undefined}
        >
          <FileCheck2 size={16} strokeWidth={1.6} aria-hidden="true" />
          {guias.length ? "Atualizar as guias" : "Gerar as guias"}
        </button>
      </div>

      {erro && (
        <p className="aviso aviso-bloqueado" role="alert">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="aviso aviso-normal" role="status">
          {aviso}
        </p>
      )}

      {guias.length > 0 && (
        <div className="tabela-wrap">
          <table className="tabela tabela-guias" aria-label="Guias do mês">
            <thead>
              <tr>
                <th scope="col">Guia</th>
                <th scope="col" className="num">
                  Valor
                </th>
                <th scope="col">Vencimento</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {guias.map((g) => (
                <tr key={g.id} className="sem-link">
                  <td>{ROTULO_GUIA[g.tipo]}</td>
                  <td className="num">{formato.reais(g.valor)}</td>
                  <td>{formato.data(g.vencimento)}</td>
                  <td>
                    <Situacao guia={g} />
                  </td>
                  <td className="col-acao">
                    {g.pagaEm ? (
                      <button className="btn btn-texto" type="button" disabled={enviando} onClick={() => pagar(g, null)}>
                        Desfazer pagamento
                      </button>
                    ) : (
                      <button className="btn btn-texto" type="button" disabled={enviando} onClick={() => pagar(g, hoje())}>
                        Marcar como paga hoje
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
