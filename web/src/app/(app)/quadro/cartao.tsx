"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { MoreHorizontal, Wallet } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import type { Cartao as DadosCartao, Nivel } from "@/lib/quadro";
import { duracao, TIPOS_PAUSA } from "../viagens/regras";

/* Cartão da viagem no Quadro, na anatomia do template: no alto o tempo na coluna (com a forma do sinal
   quando âmbar ou vermelho) e o botão "…" (Mover, a alternativa ao arrastar); a rota grande; cliente e
   motorista; os sinais da parte administrativa; embaixo o número da viagem (abre a ficha), a placa do
   cavalo e o avatar do motorista. A cor sólida do cartão é o tempo-limite. */

type Sinalizado = { tipo: TipoSinal; texto: string };

const RESULTADO: Record<string, string> = { falta: "Falta", sobra: "Sobra", avaria: "Avaria" };
const ANTES_DE_EM_ROTA = ["transito", "aguardando_carregamento", "em_carregamento"];
const DEPOIS_DA_DESCARGA = ["aguardando_contagem", "resolucao_divergencia", "aguardando_saldo", "frete_finalizado"];

/** Sinais do cartão (forma + cor, nunca só cor), só os que importam na coluna em que ele está. */
export function sinaisDoCartao(c: DadosCartao): Sinalizado[] {
  const s: Sinalizado[] = [];
  const st = c.status_campo;
  if (st === "pausa" && c.pausa_tipo) {
    const tipo = TIPOS_PAUSA[c.pausa_tipo] ?? c.pausa_tipo;
    s.push(c.pausa_programada ? { tipo: "info", texto: `${tipo}, programada` } : { tipo: "pendente", texto: `${tipo}, não programada` });
  }
  if (st === "aguardando_nf_pagamento") {
    s.push(c.tem_chaves ? { tipo: "normal", texto: "CT-e e MDF-e" } : { tipo: "pendente", texto: "Falta CT-e e MDF-e" });
    s.push(c.pagamento_saida ? { tipo: "normal", texto: "Pagamento de saída" } : { tipo: "pendente", texto: "Falta pagamento de saída" });
  } else if (st && ANTES_DE_EM_ROTA.includes(st) && c.pagamento_saida) {
    s.push({ tipo: "normal", texto: "Pagamento de saída" });
  }
  if (st === "aguardando_descarga" || st === "descarregando") {
    s.push(c.tem_canhoto ? { tipo: "normal", texto: "Canhoto" } : { tipo: "pendente", texto: "Falta canhoto" });
  } else if (st && DEPOIS_DA_DESCARGA.includes(st) && c.tem_canhoto) {
    s.push({ tipo: "normal", texto: "Canhoto" });
  }
  if (st === "aguardando_saldo") {
    s.push(c.saldo_pago ? { tipo: "normal", texto: "Saldo pago" } : { tipo: "pendente", texto: "Falta pagar o saldo" });
  }
  if (c.divergencia && RESULTADO[c.divergencia]) s.push({ tipo: "bloqueado", texto: `Divergência: ${RESULTADO[c.divergencia]}` });
  const oc = c.ocorrencias_abertas ?? 0;
  if (oc > 0) s.push({ tipo: "bloqueado", texto: oc === 1 ? "1 ocorrência aberta" : `${oc} ocorrências abertas` });
  return s;
}

const cidade = (c: string | null, uf: string | null) => (c ? `${c}${uf ? `/${uf}` : ""}` : "—");
const soCidade = (c: string | null) => c ?? "—";

type Props = {
  cartao: DadosCartao;
  nivel: Nivel;
  agora: number;
  /** Operação e admin (pode_editar): arrasta e vê "Mover" (só se houver para onde ir). */
  podeMover: boolean;
  /** Financeiro, operação e admin: "Aguardando NF e pagamento" sem o pagamento de saída, ou "Aguardando saldo" sem o saldo. */
  podePagar: boolean;
  /** O cartão está indo para outra coluna (gravando). */
  movendo: boolean;
  aoMover: () => void;
  aoPagar: () => void;
  aoArrastar: (arrastando: boolean) => void;
  /** Clique no cartão (fora do número e dos botões): abre a ficha rápida. */
  aoAbrir: () => void;
};

export function CartaoQuadro({ cartao: c, nivel, agora, podeMover, podePagar, movendo, aoMover, aoPagar, aoArrastar, aoAbrir }: Props) {
  const tempo = c.status_desde ? duracao(c.status_desde, new Date(agora)) : "—";
  const desde = c.status_desde ? `Na coluna desde ${formato.dataHora(c.status_desde)}` : undefined;
  const sinais = sinaisDoCartao(c);
  const n = c.numero ?? "—";
  /** Sendo arrastado: o lugar de origem fica apagado enquanto a imagem do arraste segue o ponteiro. */
  const [levantado, setLevantado] = useState(false);

  return (
    // O invólucro do Motion só anima a posição: ao trocar de coluna o cartão voa até a nova (mesmo
    // layoutId) e os vizinhos se reacomodam. O arraste nativo fica no <article> de dentro, porque o Motion
    // toma para si os onDragStart/onDragEnd do elemento animado.
    <motion.div
      className="quadro-cartao-mov"
      layoutId={c.viagem_id ? `viagem-${c.viagem_id}` : undefined}
      layout
      transition={{ layout: { type: "spring", stiffness: 380, damping: 34 } }}
      style={{ borderRadius: 18 }}
    >
    <article
      className={`quadro-cartao nivel-${nivel}${movendo ? " movendo" : ""}${levantado ? " levantado" : ""}`}
      data-nivel={nivel}
      aria-label={`Viagem #${n}, ${c.cavalo_placa ?? "sem placa"}, ${c.motorista_nome ?? "sem motorista"}`}
      aria-busy={movendo || undefined}
      draggable={podeMover && !movendo}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.viagem_id ?? "");
        e.dataTransfer.effectAllowed = "move";
        setLevantado(true);
        aoArrastar(true);
      }}
      onDragEnd={() => {
        setLevantado(false);
        aoArrastar(false);
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a, button")) aoAbrir();
      }}
    >
      <div className="qc-topo">
        <span className="qc-tempo" title={desde}>
          {nivel !== "normal" && <span className={`qc-forma ${nivel === "vermelho" ? "forma-circulo" : "forma-losango"}`} aria-hidden="true" />}
          {tempo}
        </span>
        {podeMover && (
          <button className="qc-mais" type="button" onClick={aoMover} disabled={movendo} aria-label={`Mover a viagem #${n}`} title="Mover">
            <MoreHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="qc-titulo" title={`${cidade(c.origem_cidade, c.origem_uf)} → ${cidade(c.destino_cidade, c.destino_uf)}`}>
        {soCidade(c.origem_cidade)}
        <span className="seta" aria-label="para">
          {" → "}
        </span>
        {soCidade(c.destino_cidade)}
      </p>
      <p className="qc-sub">
        {c.cliente_nome ?? "—"}
        <Ponto />
        {c.motorista_nome ?? "sem motorista"}
      </p>
      {sinais.length > 0 && (
        <ul className="quadro-sinais" aria-label="Sinais">
          {sinais.map((s) => (
            <li key={s.texto}>
              <Sinal tipo={s.tipo} texto={s.texto} />
            </li>
          ))}
        </ul>
      )}
      {podePagar && (
        <div className="quadro-cartao-acoes">
          <button
            className="btn btn-texto"
            type="button"
            onClick={aoPagar}
            aria-label={`Confirmar ${c.status_campo === "aguardando_saldo" ? "pagamento do saldo" : "pagamento de saída"} da viagem #${n}`}
          >
            <Wallet size={16} strokeWidth={1.6} aria-hidden="true" />
            {c.status_campo === "aguardando_saldo" ? "Confirmar pagamento do saldo" : "Confirmar pagamento de saída"}
          </button>
        </div>
      )}
      <div className="qc-pe">
        <Link className="quadro-cartao-link" href={`/viagens/${c.viagem_id}`} draggable={false} aria-label={`Abrir a viagem #${n}`}>
          #{n}
        </Link>
        <span className="qc-quem">
          {c.cavalo_placa ? <Placa placa={c.cavalo_placa} /> : <span className="sem-placa">sem placa</span>}
          <Avatar nome={c.motorista_nome} />
        </span>
      </div>
    </article>
    </motion.div>
  );
}
