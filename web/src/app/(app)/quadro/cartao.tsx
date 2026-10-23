"use client";

import Link from "next/link";
import { ArrowRightLeft, Wallet } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal, type TipoSinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import type { Cartao as DadosCartao, Nivel } from "@/lib/quadro";
import { duracao, TIPOS_PAUSA } from "../viagens/regras";

/* Cartão da viagem no Quadro: o mínimo para decidir sem abrir. Placa do cavalo, motorista, cliente,
   origem → destino, há quanto tempo está na coluna (âmbar e vermelho pelo tempo-limite) e os sinais
   da parte administrativa. Clicar abre a ficha da viagem; "Mover" é a alternativa ao arrastar. */

type Sinalizado = { tipo: TipoSinal; texto: string };

const RESULTADO: Record<string, string> = { falta: "Falta", sobra: "Sobra", avaria: "Avaria" };
const ANTES_DE_EM_ROTA = ["transito", "aguardando_carregamento", "em_carregamento"];
const DEPOIS_DA_DESCARGA = ["aguardando_contagem", "resolucao_divergencia", "frete_finalizado"];

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
  if (st === "aguardando_descarga") {
    s.push(c.tem_canhoto ? { tipo: "normal", texto: "Canhoto" } : { tipo: "pendente", texto: "Falta canhoto" });
  } else if (st && DEPOIS_DA_DESCARGA.includes(st) && c.tem_canhoto) {
    s.push({ tipo: "normal", texto: "Canhoto" });
  }
  if (c.divergencia && RESULTADO[c.divergencia]) s.push({ tipo: "bloqueado", texto: `Divergência: ${RESULTADO[c.divergencia]}` });
  const oc = c.ocorrencias_abertas ?? 0;
  if (oc > 0) s.push({ tipo: "bloqueado", texto: oc === 1 ? "1 ocorrência aberta" : `${oc} ocorrências abertas` });
  return s;
}

const cidade = (c: string | null, uf: string | null) => (c ? `${c}${uf ? `/${uf}` : ""}` : "—");

type Props = {
  cartao: DadosCartao;
  nivel: Nivel;
  agora: number;
  /** Operação e admin (pode_editar): arrasta e vê "Mover" (só se houver para onde ir). */
  podeMover: boolean;
  /** Financeiro, operação e admin, em "Aguardando NF e pagamento" sem o pagamento confirmado. */
  podePagar: boolean;
  /** O cartão está indo para outra coluna (gravando). */
  movendo: boolean;
  aoMover: () => void;
  aoPagar: () => void;
  aoArrastar: (arrastando: boolean) => void;
};

export function CartaoQuadro({ cartao: c, nivel, agora, podeMover, podePagar, movendo, aoMover, aoPagar, aoArrastar }: Props) {
  const tempo = c.status_desde ? duracao(c.status_desde, new Date(agora)) : "—";
  const desde = c.status_desde ? `Na coluna desde ${formato.dataHora(c.status_desde)}` : undefined;
  const sinais = sinaisDoCartao(c);
  const n = c.numero ?? "—";

  return (
    <article
      className={`quadro-cartao nivel-${nivel}${movendo ? " movendo" : ""}`}
      data-nivel={nivel}
      aria-label={`Viagem #${n}, ${c.cavalo_placa ?? "sem placa"}, ${c.motorista_nome ?? "sem motorista"}`}
      aria-busy={movendo || undefined}
      draggable={podeMover && !movendo}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.viagem_id ?? "");
        e.dataTransfer.effectAllowed = "move";
        aoArrastar(true);
      }}
      onDragEnd={() => aoArrastar(false)}
    >
      <div className="quadro-cartao-cab">
        {c.cavalo_placa ? <Placa placa={c.cavalo_placa} /> : <span className="sem-placa">—</span>}
        <Link className="quadro-cartao-link" href={`/viagens/${c.viagem_id}`} draggable={false} aria-label={`Abrir a viagem #${n}`}>
          #{n}
        </Link>
      </div>
      <p className="quem">
        <b>{c.motorista_nome ?? "—"}</b>
        <Ponto />
        {c.cliente_nome ?? "—"}
      </p>
      <p className="rota">
        {cidade(c.origem_cidade, c.origem_uf)}
        <span className="seta" aria-label="para">
          {" → "}
        </span>
        {cidade(c.destino_cidade, c.destino_uf)}
      </p>
      <p className="tempo" title={desde}>
        {nivel === "vermelho" ? (
          <Sinal tipo="bloqueado" texto={tempo} />
        ) : nivel === "ambar" ? (
          <Sinal tipo="vencendo" texto={tempo} />
        ) : (
          <span className="tempo-normal">{tempo}</span>
        )}
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
      {(podeMover || podePagar) && (
        <div className="quadro-cartao-acoes">
          {podePagar && (
            <button className="btn btn-texto" type="button" onClick={aoPagar} aria-label={`Confirmar pagamento de saída da viagem #${n}`}>
              <Wallet size={16} strokeWidth={1.6} aria-hidden="true" />
              Confirmar pagamento de saída
            </button>
          )}
          {podeMover && (
            <button className="btn" type="button" onClick={aoMover} disabled={movendo} aria-label={`Mover a viagem #${n}`}>
              <ArrowRightLeft size={16} strokeWidth={1.6} aria-hidden="true" />
              Mover
            </button>
          )}
        </div>
      )}
    </article>
  );
}
