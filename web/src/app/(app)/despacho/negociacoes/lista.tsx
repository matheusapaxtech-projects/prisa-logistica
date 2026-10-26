"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, X } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { porcento } from "@/lib/frete";
import { num } from "../../calculadora/partes";
import { informarCte, responderNegociacao } from "../actions";
import type { LinhaNegociacao, SituacaoNegociacao } from "./consultas";

/* Negociações com motoristas (aba "Calculadora e negociações"): a proposta salva fica "Aguardando resposta".
   Aceitou: com frete da fila e conjunto vira viagem planejada (Quadro). Recusou: guarda o valor que ele pediu
   e o motivo. Saiu o CT-e: o número congela o registro. Margem só para admin e financeiro. */

const SITUACAO: Record<SituacaoNegociacao, [TipoSinal, string]> = {
  aberta: ["pendente", "Aguardando resposta"],
  aceita: ["normal", "Aceita"],
  recusada: ["bloqueado", "Recusada"],
  cte_emitido: ["info", "CT-e emitido"],
};

type Aberto = { tipo: "recusa" | "cte"; linha: LinhaNegociacao } | null;

export function NegociacoesLista({ linhas, verMargem, podeEditar }: { linhas: LinhaNegociacao[]; verMargem: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [dlg, setDlg] = useState<Aberto>(null);
  const [gravando, iniciar] = useTransition();

  function aceitar(l: LinhaNegociacao) {
    iniciar(async () => {
      const r = await responderNegociacao(l.id, true, null, "");
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(r.dados ? "Aceita: a viagem foi criada no Quadro, como Planejada." : "Aceita. Sem frete da fila, crie a viagem no pedido quando ele fechar com o cliente.");
      router.refresh();
    });
  }

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!dlg) return;
    const f = new FormData(ev.currentTarget);
    iniciar(async () => {
      const r =
        dlg.tipo === "recusa"
          ? await responderNegociacao(dlg.linha.id, false, num(String(f.get("valor") ?? "")) || null, String(f.get("motivo") ?? ""))
          : await informarCte(dlg.linha.id, String(f.get("cte") ?? ""));
      if (!r.ok) return toast(r.erro, "alert-circle");
      toast(dlg.tipo === "recusa" ? "Recusa registrada no histórico do motorista." : "CT-e informado. O registro ficou congelado.");
      setDlg(null);
      router.refresh();
    });
  }

  return (
    <section className="neg-lista" aria-labelledby="neg-lista-titulo">
      <h2 id="neg-lista-titulo">Negociações com motoristas</h2>
      {linhas.length === 0 ? (
        <EstadoVazio>Nenhuma negociação ainda. Calcule acima, escolha o motorista e salve a negociação.</EstadoVazio>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Motorista</th>
                <th scope="col">Rota</th>
                <th scope="col" className="num">
                  Frete motorista
                </th>
                {verMargem && (
                  <th scope="col" className="num">
                    Margem
                  </th>
                )}
                <th scope="col">Situação</th>
                <th scope="col">Próximo passo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const [tipo, texto] = SITUACAO[l.situacao];
                return (
                  <tr key={l.id}>
                    <td>{formato.data(l.dia)}</td>
                    <td>
                      {l.motorista}
                      <span className="linha2">
                        {l.placa && <Placa placa={l.placa} />} {l.eixos} eixos
                      </span>
                    </td>
                    <td>
                      {l.origem} → {l.destino}
                      <span className="linha2">
                        {l.km.toLocaleString("pt-BR")} km{l.pedidoNumero ? ` · pedido #${l.pedidoNumero}` : ""}
                      </span>
                    </td>
                    <td className="num">
                      {formato.reais(l.freteMotorista)}
                      {l.valorPedido && <span className="linha2">pediu {formato.reais(l.valorPedido)}</span>}
                    </td>
                    {verMargem && <td className="num">{l.margem !== null && l.situacao !== "recusada" ? porcento(l.margem) : "—"}</td>}
                    <td>
                      <Sinal tipo={tipo} texto={texto} />
                    </td>
                    <td>
                      {l.situacao === "aberta" && podeEditar && (
                        <span className="neg-botoes">
                          <button type="button" className="btn" disabled={gravando} onClick={() => aceitar(l)}>
                            <Check size={16} strokeWidth={1.6} aria-hidden="true" /> Aceitou
                          </button>
                          <button type="button" className="btn" disabled={gravando} onClick={() => setDlg({ tipo: "recusa", linha: l })}>
                            <X size={16} strokeWidth={1.6} aria-hidden="true" /> Recusou
                          </button>
                        </span>
                      )}
                      {l.situacao === "aceita" && (
                        <>
                          {podeEditar && (
                            <button type="button" className="btn" disabled={gravando} onClick={() => setDlg({ tipo: "cte", linha: l })}>
                              Informar CT-e
                            </button>
                          )}
                          {l.viagem && (
                            <span className="linha2">
                              <Link href={`/viagens/${l.viagem.id}`}>Viagem #{l.viagem.numero}</Link>
                            </span>
                          )}
                        </>
                      )}
                      {l.situacao === "cte_emitido" && (
                        <span className="neg-congelado">
                          <Lock size={14} strokeWidth={1.6} aria-hidden="true" /> CT-e {l.cteNumero} · registro congelado
                        </span>
                      )}
                      {l.situacao === "recusada" && <span className="linha2">{l.motivo ?? "No histórico do motorista"}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dlg && (
        <Dialogo
          aberto
          aoFechar={() => setDlg(null)}
          titulo={dlg.tipo === "recusa" ? `Recusa de ${dlg.linha.motorista}` : `CT-e da negociação com ${dlg.linha.motorista}`}
          onSubmit={enviar}
          pe={
            <>
              <button className="btn" type="button" data-fechar disabled={gravando}>
                Cancelar
              </button>
              <button className="btn btn-primario" type="submit" disabled={gravando}>
                {gravando ? "Gravando…" : dlg.tipo === "recusa" ? "Registrar recusa" : "Informar CT-e"}
              </button>
            </>
          }
        >
          {dlg.tipo === "recusa" ? (
            <div className="campos">
              <div className="campo f6">
                <label htmlFor="neg-valor">
                  Quanto ele pediu <span className="opcional">(opcional)</span>
                </label>
                <input id="neg-valor" name="valor" className="num" inputMode="decimal" placeholder="0,00" autoComplete="off" />
              </div>
              <div className="campo f12">
                <label htmlFor="neg-motivo">
                  Motivo <span className="opcional">(opcional)</span>
                </label>
                <input id="neg-motivo" name="motivo" maxLength={500} placeholder="Ex.: quer retorno garantido" autoComplete="off" />
              </div>
            </div>
          ) : (
            <div className="campos">
              <p className="f12 muted">Depois do número do CT-e a negociação não muda mais.</p>
              <div className="campo f6">
                <label htmlFor="neg-cte">Número do CT-e</label>
                <input id="neg-cte" name="cte" required maxLength={30} autoComplete="off" />
              </div>
            </div>
          )}
        </Dialogo>
      )}
    </section>
  );
}
