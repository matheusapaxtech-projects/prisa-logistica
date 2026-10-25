"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake } from "lucide-react";
import { toast } from "@/components/Toast";
import { normalizar } from "@/lib/calculadora/rota";
import { formato } from "@/lib/formato";
import { registrarNegociacao, type DadosNegociacao } from "../actions";
import type { FreteDaFila, FretePago, MotoristaDoAcervo } from "./consultas";

/* Pedaços da calculadora quando ela abre na aba "Calculadora e negociações" do Despacho (como no sistema do
   sócio): escolher o frete da fila e o motorista do acervo, ver o que já foi pago nesta rota e salvar a
   negociação no histórico do motorista. */

export type DadosNegociacaoTela = { fretes: FreteDaFila[]; motoristas: MotoristaDoAcervo[]; pagos: FretePago[] };

export function EscolhaFreteMotorista({
  dados,
  freteId,
  conjuntoId,
  aoFrete,
  aoMotorista,
}: {
  dados: DadosNegociacaoTela;
  freteId: string;
  conjuntoId: string;
  aoFrete: (f: FreteDaFila | null) => void;
  aoMotorista: (m: MotoristaDoAcervo | null) => void;
}) {
  return (
    <section className="painel" aria-labelledby="neg-frete">
      <div className="calc-cab">
        <h2 id="neg-frete">Frete e motorista</h2>
      </div>
      <div className="campos">
        <div className="campo f6">
          <label htmlFor="neg-frete-fila">
            Frete da fila <span className="opcional">(opcional)</span>
          </label>
          <select id="neg-frete-fila" value={freteId} onChange={(e) => aoFrete(dados.fretes.find((f) => f.id === e.target.value) ?? null)}>
            <option value="">Sem frete da fila</option>
            {dados.fretes.map((f) => (
              <option key={f.id} value={f.id}>
                #{f.numero} · {f.origem} → {f.destino} · {f.cliente}
              </option>
            ))}
          </select>
          <span className="ajuda">Preenche a rota, a carga e o preço do pedido. Com o frete e o conjunto, “aceitou” vira viagem.</span>
        </div>
        <div className="campo f6">
          <label htmlFor="neg-motorista">Motorista do acervo</label>
          <select id="neg-motorista" value={conjuntoId} onChange={(e) => aoMotorista(dados.motoristas.find((m) => m.conjuntoId === e.target.value) ?? null)}>
            <option value="">Escolha o motorista</option>
            {dados.motoristas.map((m) => (
              <option key={m.conjuntoId} value={m.conjuntoId}>
                {m.nome} · {m.placa}
                {m.eixos ? ` · ${m.eixos} eixos` : ""}
                {m.pendente ? " · pendente" : ""}
              </option>
            ))}
          </select>
          <span className="ajuda">Obrigatório para salvar: o histórico fica no motorista.</span>
        </div>
      </div>
    </section>
  );
}

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** "Pago nesta rota": mesma origem, destino e eixos; mediana em R$/km e os botões de usar o piso ou o histórico. */
export function PagoNestaRota({
  pagos,
  origem,
  destino,
  eixos,
  km,
  piso,
  aoUsar,
}: {
  pagos: FretePago[];
  origem: string;
  destino: string;
  eixos: number;
  km: number;
  piso: number;
  aoUsar: (valor: number) => void;
}) {
  const o = normalizar(origem);
  const d = normalizar(destino);
  const daRota = pagos.filter((p) => normalizar(p.origem) === o && normalizar(p.destino) === d && p.eixos === eixos);
  const porKm = daRota.length ? mediana(daRota.map((p) => p.valor / p.km)) : null;
  return (
    <section className="painel" aria-labelledby="neg-pago">
      <div className="calc-cab">
        <h2 id="neg-pago">Pago nesta rota</h2>
        <p className="nota">
          {daRota.length
            ? `${eixos} eixos · mediana de ${daRota.length} ${daRota.length === 1 ? "frete" : "fretes"}: ${formato.reais(porKm!)}/km`
            : `Nenhum frete pago de ${origem || "—"} para ${destino || "—"} com ${eixos} eixos.`}
        </p>
      </div>
      {daRota.length > 0 && (
        <ul className="neg-pagos">
          {daRota.slice(0, 6).map((p) => (
            <li key={p.id}>
              <span>
                {formato.data(p.dia)} · {p.motorista.split(" ")[0]} · {p.eixos} eixos
              </span>
              <b>{formato.reais(p.valor)}</b>
            </li>
          ))}
        </ul>
      )}
      <div className="neg-usar">
        <button type="button" className="btn" disabled={!(piso > 0)} onClick={() => aoUsar(Math.ceil(piso))}>
          Usar o piso
        </button>
        <button type="button" className="btn" disabled={!porKm || !(km > 0)} onClick={() => aoUsar(Math.round(porKm! * km))}>
          Usar o valor do histórico
        </button>
      </div>
    </section>
  );
}

/** Grava a proposta (situação "aberta"); a resposta do motorista é marcada na lista de negociações. */
export function SalvarNegociacao({ dados, falta }: { dados: DadosNegociacao | null; falta: string | null }) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  return (
    <div className="neg-salvar">
      <button
        type="button"
        className="btn btn-primario"
        disabled={!dados || salvando}
        onClick={() =>
          dados &&
          iniciar(async () => {
            const r = await registrarNegociacao(dados);
            if (!r.ok) return toast(r.erro, "alert-circle");
            toast("Negociação salva. Marque a resposta do motorista na lista abaixo.");
            router.refresh();
          })
        }
      >
        <Handshake size={16} strokeWidth={1.6} aria-hidden="true" />
        {salvando ? "Salvando…" : "Salvar negociação com o motorista"}
      </button>
      {falta && <p className="nota">{falta}</p>}
    </div>
  );
}
