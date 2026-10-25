"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Route, Truck, UserCheck } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { porcento, sinalDaFaixa } from "@/lib/frete";
import { faixaMargem, type Coeficiente, type ParamFiscais, type TipoCarga } from "@/lib/calculadora/regras";
import { comporLote, rankearMotoristas, type Candidato, type CargaDespacho } from "@/lib/motor/despacho";
import { campo, num } from "../calculadora/partes";
import type { OpcaoConjunto, RotaSalvaDoPedido } from "../pedidos/consultas";
import type { DadosDespacho, MotoristaNoDespacho } from "../pedidos/despacho";
import { DialogoViagem, type InicialViagem } from "../pedidos/[id]/nova-viagem";
import { contratarLote } from "./actions";

/* Despacho de um pedido (motor de despacho, como no sistema do sócio): simulação (peso, frete da empresa, tipo
   de carga e frete do motorista acima do piso), o lote sugerido pelo menor custo só com motoristas aptos,
   "Contratar o lote" (cria as viagens planejadas, que vão para o Quadro) e o ranking com apto × pendente.
   Resultado do CT-e e faixa da margem só para admin e financeiro. */

type Props = {
  dados: DadosDespacho;
  tabela: Coeficiente[];
  fiscal: ParamFiscais;
  tiposCarga: Record<TipoCarga, string>;
  podeEditar: boolean;
  verResultado: boolean;
  pedidoId: string;
  numero: number;
  saldoKg: number;
  conjuntos: OpcaoConjunto[];
  rotaSalva: RotaSalvaDoPedido | null;
};

const ORIGEM_KM = { salva: "rota salva pela equipe", medida: "rota medida pela Prisa", estimada: "estimado entre as cidades" } as const;
const PCT_PADRAO = 5;

const pendente = (m: MotoristaNoDespacho) => m.pendencias.some((p) => p.nivel !== "aviso");

function haQuanto(h: number): string {
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `há ${Math.round(h)} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function PainelDespacho({ dados: d, tabela, fiscal, tiposCarga, podeEditar, verResultado, pedidoId, numero, saldoKg, conjuntos, rotaSalva }: Props) {
  const router = useRouter();
  const base = d.carga;
  const [peso, setPeso] = useState(() => (base ? campo(base.pesoT, 3) : ""));
  const [frete, setFrete] = useState(() => (base?.fretePorT ? campo(base.fretePorT) : ""));
  const [tipo, setTipo] = useState<TipoCarga>(() => base?.tipo ?? "granel_solido");
  const [pct, setPct] = useState(String(PCT_PADRAO));
  const [soAptos, setSoAptos] = useState(false);
  const [planejando, setPlanejando] = useState<InicialViagem | null>(null);
  const [vez, setVez] = useState(0);
  const [contratando, iniciar] = useTransition();

  const porId = useMemo(() => new Map(d.motoristas.map((m) => [m.conjuntoId, m])), [d.motoristas]);
  const acima = Math.max(0, num(pct)) / 100;

  const sim = useMemo(() => {
    if (!base) return null;
    const pesoT = num(peso);
    const carga: CargaDespacho = { ...base, pesoT: pesoT > 0 ? pesoT : base.pesoT, tipo, fretePorT: num(frete) || undefined };
    const r = rankearMotoristas(carga, d.motoristas, d.disponibilidades, tabela, new Date(d.agora));
    const aptos = r.candidatos.filter((c) => !pendente(porId.get(c.motorista.conjuntoId)!));
    const composicao = aptos.length ? comporLote(carga, aptos, { param: fiscal, acimaDoPiso: acima }) : null;
    return { carga, ...r, aptos, composicao };
  }, [base, peso, frete, tipo, acima, d.motoristas, d.disponibilidades, d.agora, tabela, fiscal, porId]);

  if (d.indisponivel || !base || !sim) return <p className="nota">{d.indisponivel ?? "Sem dados para o despacho."}</p>;

  const lote = sim.composicao && sim.composicao.caminhoes.length ? sim.composicao : null;
  const noLote = new Set(lote?.caminhoes.map((x) => x.candidato.motorista.conjuntoId) ?? []);
  const lista = soAptos ? sim.aptos : sim.candidatos;
  const freteDe = (c: Candidato) => Math.ceil(c.piso * (1 + acima));

  function planejar(c: Candidato, pesoT: number) {
    setVez((n) => n + 1);
    setPlanejando({ conjuntoId: c.motorista.conjuntoId, pesoKg: Math.round(pesoT * 1000), freteMotorista: freteDe(c), km: d.kmViagem, pedagio: c.pedagio });
  }

  function contratar() {
    if (!lote) return;
    iniciar(async () => {
      const r = await contratarLote(
        pedidoId,
        lote.caminhoes.map((x) => ({
          conjuntoId: x.candidato.motorista.conjuntoId,
          pesoKg: Math.round(x.pesoT * 1000),
          freteMotorista: x.freteMotorista,
          km: d.kmViagem,
          pedagio: Math.round(x.candidato.pedagio * 100) / 100,
        })),
      );
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(`${r.dados} ${r.dados === 1 ? "viagem criada" : "viagens criadas"} no Quadro, como Planejada.`);
      router.refresh();
    });
  }

  return (
    <div className="desp">
      <p className="nota">
        {formato.kg(saldoKg)} a planejar · {d.kmViagem.toLocaleString("pt-BR")} km ({d.origemKm ? ORIGEM_KM[d.origemKm] : "—"}). A nota soma distância até o
        embarque (40%), há quanto tempo o motorista avisou que está livre (20%), ocupação do caminhão (20%), custo mínimo por tonelada (10%) e histórico
        com a Prisa (10%).
      </p>

      <div className="desp-sim campos" role="group" aria-label="Simulação do lote">
        <label className="campo f3">
          <span className="rotulo">Peso do lote (t)</span>
          <input className="num" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </label>
        <label className="campo f3">
          <span className="rotulo">Frete da empresa (R$/t)</span>
          <input className="num" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="0,00" />
        </label>
        <label className="campo f3">
          <span className="rotulo">Tipo de carga (ANTT)</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCarga)}>
            {Object.entries(tiposCarga).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo f3">
          <span className="rotulo">Frete do motorista acima do piso</span>
          <span className="sufixo">
            <input className="num" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            <span aria-hidden="true">%</span>
          </span>
        </label>
      </div>

      <section className="desp-lote" aria-labelledby="desp-lote-titulo">
        <div className="desp-lote-cab">
          <h3 id="desp-lote-titulo">
            Lote sugerido <span>· menor custo, só aptos</span>
          </h3>
          {verResultado && lote?.freteEmpresa ? <FaixaLote margem={lote.margemLiquida} /> : null}
        </div>
        {!lote ? (
          <p className="calc-vazio">
            {sim.candidatos.length
              ? "Nenhum motorista apto para montar o lote. Resolva as pendências abaixo ou registre mais motoristas livres."
              : "Nenhum motorista livre a até 300 km do embarque."}
          </p>
        ) : (
          <>
            <dl className="desp-numeros">
              <div>
                <dt>Caminhões</dt>
                <dd>{lote.caminhoes.length}</dd>
              </div>
              <div>
                <dt>Custo motorista + pedágio</dt>
                <dd>{formato.reais(lote.custoPorT)}/t</dd>
              </div>
              {verResultado && lote.freteEmpresa > 0 && (
                <>
                  <div>
                    <dt>Resultado líquido</dt>
                    <dd>{formato.reais(lote.resultadoLiquido)}</dd>
                  </div>
                  <div>
                    <dt>Margem líquida</dt>
                    <dd>{porcento(lote.margemLiquida)}</dd>
                  </div>
                </>
              )}
            </dl>
            {lote.faltaT > 0 && (
              <p className="aviso aviso-pendente">Faltam {lote.faltaT.toLocaleString("pt-BR")} t: os motoristas aptos não fecham o lote.</p>
            )}
            <div className="tabela-wrap">
              <table className="tabela desp-lote-tabela">
                <thead>
                  <tr>
                    <th scope="col">Motorista</th>
                    <th scope="col">Conjunto</th>
                    <th scope="col" className="num">
                      Peso
                    </th>
                    <th scope="col" className="num">
                      Frete motorista
                    </th>
                    <th scope="col" className="num">
                      Piso ANTT
                    </th>
                    {verResultado && (
                      <th scope="col" className="num">
                        Resultado CT-e
                      </th>
                    )}
                    {verResultado && <th scope="col">Faixa</th>}
                  </tr>
                </thead>
                <tbody>
                  {lote.caminhoes.map((x) => (
                    <tr key={x.candidato.motorista.conjuntoId}>
                      <td>{x.candidato.motorista.nome}</td>
                      <td>
                        {x.candidato.motorista.eixos} eixos · <Placa placa={x.candidato.motorista.placaCavalo} />
                      </td>
                      <td className="num">{formato.t(x.pesoT)}</td>
                      <td className="num">{formato.reais(x.freteMotorista)}</td>
                      <td className="num">{formato.reais(x.candidato.piso)}</td>
                      {verResultado && (
                        <td className="num">{x.cte ? `${formato.reais(x.cte.resultadoLiquido)} · ${porcento(x.cte.margemLiquida)}` : "—"}</td>
                      )}
                      {verResultado && <td>{x.cte ? <Sinal tipo={sinalDaFaixa(x.cte.faixa)} texto={x.cte.faixa} /> : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota">{lote.observacoes.filter((o) => !o.includes("não fecham")).join(" ")}</p>
            {podeEditar && (
              <div className="desp-acoes">
                <button type="button" className="btn btn-primario" onClick={contratar} disabled={contratando}>
                  <Truck size={16} strokeWidth={1.6} aria-hidden="true" />
                  {contratando
                    ? "Contratando…"
                    : `Contratar ${lote.caminhoes.length === 1 ? "o caminhão" : `os ${lote.caminhoes.length}`} do lote e mandar para o Quadro`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="desp-ranking" aria-labelledby="desp-ranking-titulo">
        <div className="desp-ranking-cab">
          <h3 id="desp-ranking-titulo">
            Ranking <span>· {sim.candidatos.length} {sim.candidatos.length === 1 ? "disponível" : "disponíveis"}, {sim.aptos.length} {sim.aptos.length === 1 ? "apto" : "aptos"} para contratar</span>
          </h3>
          <div className="dir">
            <label className="desp-filtro">
              <input type="checkbox" checked={soAptos} onChange={(e) => setSoAptos(e.target.checked)} /> Mostrar só os aptos
            </label>
            <Link className="btn" href="/disponiveis">
              <UserCheck size={16} strokeWidth={1.6} aria-hidden="true" />
              Motoristas livres
            </Link>
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="calc-vazio">
            {sim.candidatos.length
              ? "Nenhum motorista apto. Desmarque “Mostrar só os aptos” para ver o que falta resolver."
              : <>Nenhum motorista livre a até 300 km do embarque. Registre quem avisou que está livre em <Link href="/disponiveis">Motoristas livres</Link>.</>}
          </p>
        ) : (
          <ol className="desp-cartoes">
            {lista.map((c) => {
              const m = porId.get(c.motorista.conjuntoId)!;
              const trava = m.pendencias.filter((p) => p.nivel !== "aviso");
              const avisos = m.pendencias.filter((p) => p.nivel === "aviso");
              const pos = sim.candidatos.indexOf(c) + 1;
              return (
                <li key={c.motorista.conjuntoId} className={trava.length ? "pendente" : undefined}>
                  <div className="desp-cartao-topo">
                    <span className="pos" aria-label={`Posição ${pos}`}>
                      {pos}
                    </span>
                    <div className="quem">
                      <b>{c.motorista.nome}</b>
                      {noLote.has(c.motorista.conjuntoId) && <Sinal tipo="info" texto="No lote sugerido" />}
                      <span className="linha2">
                        {c.disponibilidade.posicao.cidade ?? "—"} · {c.motorista.eixos} eixos · {formato.t(c.motorista.capacidadeT)} ·{" "}
                        <Placa placa={c.motorista.placaCavalo} />
                        {m.transportador && <> · por {m.transportador}</>}
                      </span>
                    </div>
                    <dl className="desp-medidas">
                      <div>
                        <dt>até o embarque</dt>
                        <dd>{c.kmAteEmbarque.toLocaleString("pt-BR")} km</dd>
                      </div>
                      <div>
                        <dt>avisou que está livre</dt>
                        <dd>{haQuanto(c.horasDesdeRegistro)}</dd>
                      </div>
                      <div>
                        <dt>nota</dt>
                        <dd>{c.score.toLocaleString("pt-BR")}</dd>
                      </div>
                    </dl>
                    <Sinal tipo={trava.length ? "pendente" : "normal"} texto={trava.length ? "Pendente" : "Apto"} />
                    <div className="desp-botoes">
                      {m.whatsapp && (
                        <a className="btn" href={`https://wa.me/${m.whatsapp}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={16} strokeWidth={1.6} aria-hidden="true" />
                          WhatsApp
                        </a>
                      )}
                      {podeEditar && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => planejar(c, c.pesoAtendidoT)}
                          disabled={trava.length > 0}
                          title={trava.length ? "Resolva as pendências para contratar" : undefined}
                        >
                          <Route size={16} strokeWidth={1.6} aria-hidden="true" />
                          Contratar
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="desp-motivos">{c.motivos.join(" · ")}</p>
                  {/* "Leva só X t das Y t" sai: quem compõe o lote é a seção de cima. */}
                  {[...c.alertas.filter((a) => !a.startsWith("Leva só")), ...avisos.map((a) => a.mensagem)].map((a) => (
                    <span key={a} className="linha2">
                      <Sinal tipo="vencendo" texto={a} />
                    </span>
                  ))}
                  {trava.length > 0 && (
                    <div className="desp-pendencias">
                      <b>Não pode ser contratado até resolver:</b>
                      <ul>
                        {trava.map((p) => (
                          <li key={p.mensagem}>{p.mensagem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {sim.descartados.length > 0 && (
          <details className="desp-descartados">
            <summary>Fora da lista ({sim.descartados.length})</summary>
            <ul>
              {sim.descartados.map((x) => (
                <li key={x.motorista.conjuntoId}>
                  <b>{x.motorista.nome}</b> ({x.motorista.placaCavalo}): {x.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="nota">Distâncias estimadas por linha reta e fator da região (erro típico de 10% para mais ou para menos). Raio de busca: 300 km.</p>
      </section>

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
    </div>
  );
}

function FaixaLote({ margem }: { margem: number }) {
  const faixa = faixaMargem(margem);
  return <Sinal tipo={sinalDaFaixa(faixa)} texto={`Frete com resultado ${faixa.toLowerCase()}`} />;
}
