"use client";

import { useState } from "react";
import Link from "next/link";
import { Route, UserCheck } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { porcento } from "@/lib/frete";
import type { Candidato } from "@/lib/motor/despacho";
import { CabPainel } from "../../_pessoa/partes";
import type { OpcaoConjunto, RotaSalvaDoPedido } from "../consultas";
import type { DadosDespacho } from "../despacho";
import { DialogoViagem, type InicialViagem } from "./nova-viagem";

/* Despacho do pedido (motor de despacho, rotinas 2 e 3): os motoristas livres em volta do embarque, com nota
   e motivos, e a composição de lote mais barata para o saldo. "Planejar viagem" abre a nova viagem com o
   conjunto e o peso sugeridos. A margem do lote só aparece para admin e financeiro. */

type Props = {
  dados: DadosDespacho;
  podeEditar: boolean;
  verResultado: boolean;
  pedidoId: string;
  numero: number;
  saldoKg: number;
  conjuntos: OpcaoConjunto[];
  rotaSalva: RotaSalvaDoPedido | null;
};

const ORIGEM_KM = { salva: "rota salva pela equipe", medida: "rota medida pela Prisa", estimada: "estimado entre as cidades" } as const;

export function DespachoPainel({ dados: d, podeEditar, verResultado, pedidoId, numero, saldoKg, conjuntos, rotaSalva }: Props) {
  const [planejando, setPlanejando] = useState<InicialViagem | null>(null);
  const [vez, setVez] = useState(0);
  const planejar = (c: Candidato, pesoT: number) => {
    setVez((n) => n + 1);
    setPlanejando({ conjuntoId: c.motorista.conjuntoId, pesoKg: Math.round(pesoT * 1000) });
  };

  return (
    <section className="subsecao despacho" aria-label="Despacho">
      <CabPainel titulo="Despacho">
        <Link className="btn" href="/disponiveis">
          <UserCheck size={16} strokeWidth={1.6} aria-hidden="true" />
          Motoristas livres
        </Link>
      </CabPainel>
      {d.indisponivel ? (
        <p className="nota">{d.indisponivel}</p>
      ) : (
        <>
          <p className="nota">
            {formato.kg(saldoKg)} a planejar · {d.kmViagem.toLocaleString("pt-BR")} km ({d.origemKm ? ORIGEM_KM[d.origemKm] : "—"}). A nota soma distância até o
            embarque (40%), há quanto tempo o motorista avisou que está livre (20%), ocupação do caminhão (20%), custo mínimo por tonelada (10%) e
            histórico com a Prisa (10%).
          </p>

          {d.composicao && d.composicao.caminhoes.length > 0 && (
            <div className="despacho-lote">
              <div className="despacho-lote-cab">
                <h3>Lote sugerido: {d.composicao.caminhoes.length} {d.composicao.caminhoes.length === 1 ? "caminhão" : "caminhões"}</h3>
                <span>
                  {formato.reais(d.composicao.custoPorT)}/t de motorista e pedágio
                  {verResultado && d.composicao.freteEmpresa > 0 && ` · margem líquida ${porcento(d.composicao.margemLiquida)}`}
                </span>
              </div>
              {d.composicao.faltaT > 0 && (
                <p className="aviso aviso-pendente">Faltam {d.composicao.faltaT.toLocaleString("pt-BR")} t: os motoristas livres não fecham o lote.</p>
              )}
              <ol className="despacho-lote-lista">
                {d.composicao.caminhoes.map((x) => (
                  <li key={x.candidato.motorista.conjuntoId}>
                    <Placa placa={x.candidato.motorista.placaCavalo} />
                    <span className="quem">
                      {x.candidato.motorista.nome}
                      <span className="linha2">
                        {x.candidato.motorista.eixos} eixos · {x.pesoT.toLocaleString("pt-BR")} t · motorista no piso {formato.reais(x.freteMotorista)}
                      </span>
                    </span>
                    {podeEditar && (
                      <button type="button" className="btn" onClick={() => planejar(x.candidato, x.pesoT)}>
                        <Route size={16} strokeWidth={1.6} aria-hidden="true" />
                        Planejar viagem
                      </button>
                    )}
                  </li>
                ))}
              </ol>
              <p className="nota">{d.composicao.observacoes.filter((o) => !o.includes("não fecham")).join(" ")}</p>
            </div>
          )}

          {d.candidatos.length === 0 ? (
            <p className="calc-vazio despacho-vazio">
              Nenhum motorista livre a até 300 km do embarque. Registre quem avisou que está livre em <Link href="/disponiveis">Motoristas livres</Link>.
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela despacho-ranking">
                <thead>
                  <tr>
                    <th scope="col">Motorista</th>
                    <th scope="col" className="num">
                      Nota
                    </th>
                    <th scope="col">Por quê</th>
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.candidatos.map((c, i) => (
                    <tr key={c.motorista.conjuntoId}>
                      <td>
                        <span className="id">
                          {i + 1}. {c.motorista.nome}
                        </span>
                        <span className="linha2">
                          <Placa placa={c.motorista.placaCavalo} /> {c.motorista.eixos} eixos · {c.motorista.capacidadeT.toLocaleString("pt-BR")} t ·{" "}
                          {c.disponibilidade.posicao.cidade}
                        </span>
                      </td>
                      <td className="num">
                        <b>{c.score.toLocaleString("pt-BR")}</b>
                      </td>
                      <td>
                        {c.motivos.join(" · ")}
                        {c.alertas.map((a) => (
                          <span key={a} className="linha2">
                            <Sinal tipo="vencendo" texto={a} />
                          </span>
                        ))}
                      </td>
                      <td className="num">
                        {podeEditar && (
                          <button type="button" className="btn" onClick={() => planejar(c, c.pesoAtendidoT)}>
                            Planejar viagem
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {d.descartados.length > 0 && (
            <details className="despacho-descartados">
              <summary>
                {d.descartados.length} {d.descartados.length === 1 ? "motorista ficou de fora" : "motoristas ficaram de fora"}
              </summary>
              <ul>
                {d.descartados.map((x) => (
                  <li key={x.motorista.conjuntoId}>
                    <b>{x.motorista.nome}</b> ({x.motorista.placaCavalo}): {x.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {planejando && (
        <DialogoViagem
          key={vez}
          pedidoId={pedidoId}
          numero={numero}
          saldoKg={saldoKg}
          conjuntos={conjuntos}
          rotaSalva={rotaSalva}
          aberto
          aoFechar={() => setPlanejando(null)}
          inicial={planejando}
        />
      )}
    </section>
  );
}
