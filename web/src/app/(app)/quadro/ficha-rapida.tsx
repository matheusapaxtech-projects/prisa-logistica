"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { motion } from "motion/react";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { formato } from "@/lib/formato";
import { rotuloDe, type Cartao, type Nivel, type StatusCampo } from "@/lib/quadro";
import { duracao } from "../viagens/regras";
import { sinaisDoCartao } from "./cartao";

/* Ficha rápida da viagem (o cartão que cresce e vira ficha, como no template): mesma `layoutId` do
   cartão do quadro, véu desfocado atrás, barra das etapas da viagem e as duas saídas: abrir a viagem
   ou mover (o menu de destinos de sempre, com as regras do banco). */

/** As seis etapas da barra; cada coluna do quadro cai numa delas. */
const ETAPAS = ["Trânsito", "Carregamento", "NF e pagamento", "Em rota", "Descarga", "Finalizado"] as const;
const ETAPA_DE: Record<StatusCampo, number> = {
  transito: 0,
  aguardando_carregamento: 1,
  em_carregamento: 1,
  aguardando_nf_pagamento: 2,
  em_rota: 3,
  pausa: 3,
  aguardando_descarga: 4,
  aguardando_contagem: 4,
  resolucao_divergencia: 4,
  frete_finalizado: 5,
};

const SITUACAO: Record<Nivel, string> = { normal: "No prazo", ambar: "Perto do tempo-limite", vermelho: "Passou do tempo-limite" };
const cidade = (c: string | null, uf: string | null) => (c ? `${c}${uf ? `/${uf}` : ""}` : "—");

type Props = {
  cartao: Cartao;
  nivel: Nivel;
  agora: number;
  podeMover: boolean;
  aoFechar: () => void;
  aoMover: () => void;
};

export function FichaRapida({ cartao: c, nivel, agora, podeMover, aoFechar, aoMover }: Props) {
  const fechar = useRef<HTMLButtonElement>(null);
  const etapa = c.status_campo ? ETAPA_DE[c.status_campo] : 0;
  const n = c.numero ?? "—";
  const sinais = sinaisDoCartao(c);

  useEffect(() => {
    fechar.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar]);

  return (
    <>
      <motion.div
        className="veu"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={aoFechar}
      />
      <div className="ficha-centro" onClick={aoFechar}>
        <motion.div
          layoutId={c.viagem_id ? `viagem-${c.viagem_id}` : undefined}
          className={`ficha-rapida nivel-${nivel}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ficha-rapida-titulo"
          style={{ borderRadius: 30 }}
          transition={{ layout: { type: "spring", stiffness: 300, damping: 32 } }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.12 } }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
            <div className="fr-topo">
              <span>{c.status_desde ? `Na coluna desde ${formato.dataHora(c.status_desde)}` : "—"}</span>
              <button ref={fechar} className="fr-fechar" type="button" onClick={aoFechar} aria-label="Fechar a ficha">
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <h2 id="ficha-rapida-titulo">
              Viagem #{n}: {cidade(c.origem_cidade, c.origem_uf)} → {cidade(c.destino_cidade, c.destino_uf)}
            </h2>
            <p className="fr-sub">
              {c.cliente_nome ?? "—"}
              <Ponto />
              {c.motorista_nome ?? "sem motorista"}
            </p>
            <p className="fr-tempo num">{c.status_desde ? duracao(c.status_desde, new Date(agora)).replace(/^há /, "") : "—"}</p>
            <p className="fr-situacao">
              {SITUACAO[nivel]} em {c.status_campo ? rotuloDe(c.status_campo) : "—"}
            </p>
            <ol className="fr-etapas" aria-label={`Etapa ${etapa + 1} de ${ETAPAS.length}: ${ETAPAS[etapa]}`}>
              {ETAPAS.map((e, i) => (
                <li key={e} aria-current={i === etapa ? "step" : undefined}>
                  <span className="fr-trilho">
                    <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: i <= etapa ? 1 : 0 }} transition={{ type: "spring", stiffness: 160, damping: 24, delay: 0.15 + i * 0.05 }} />
                  </span>
                  <span className="fr-rot">{e}</span>
                </li>
              ))}
            </ol>
            <div className="fr-dados">
              <div>
                <small>Coluna</small>
                <strong>{c.status_campo ? rotuloDe(c.status_campo) : "—"}</strong>
              </div>
              <div>
                <small>Cavalo</small>
                {c.cavalo_placa ? <Placa placa={c.cavalo_placa} /> : <strong>—</strong>}
              </div>
              <div>
                <small>Cliente</small>
                <strong>{c.cliente_nome ?? "—"}</strong>
              </div>
            </div>
            {sinais.length > 0 && (
              <ul className="quadro-sinais fr-sinais" aria-label="Sinais">
                {sinais.map((s) => (
                  <li key={s.texto}>
                    <Sinal tipo={s.tipo} texto={s.texto} />
                  </li>
                ))}
              </ul>
            )}
            <div className="fr-acoes">
              <Link className="fr-vazado" href={`/viagens/${c.viagem_id}`}>
                Abrir a viagem
              </Link>
              {podeMover && (
                <button className="fr-claro" type="button" onClick={aoMover}>
                  Mover
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
