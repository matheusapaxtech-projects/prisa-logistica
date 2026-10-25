"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { Numero } from "@/components/Numero";
import type { MesToneladas } from "./consultas";

/* Toneladas transportadas por mês (viagens finalizadas), no estilo do painel "Revenue" do template:
   número grande que conta, legenda, linha curva que se desenha ao aparecer e se transforma ao trocar
   6/12 meses, dica que segue o cursor e linha tracejada da média do período. */

const T = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const ALTURA = 230;
const ESQ = 52;
const DIR = 12;
const CIMA = 14;
const BAIXO = 28;

/** Curva suave monotônica (Fritsch–Carlson): nunca passa acima nem abaixo dos pontos vizinhos, então
   um mês zerado não vira tonelada negativa. Sempre os 12 pontos, para a forma se transformar sem saltos. */
function curva(pts: [number, number][]): string {
  const n = pts.length;
  const sec: number[] = [];
  for (let i = 0; i < n - 1; i++) sec.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0] || 1));
  const tan: number[] = pts.map((_, i) => {
    if (i === 0) return sec[0];
    if (i === n - 1) return sec[n - 2];
    return sec[i - 1] * sec[i] <= 0 ? 0 : (sec[i - 1] + sec[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (sec[i] === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = tan[i] / sec[i];
    const b = tan[i + 1] / sec[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tan[i] = t * a * sec[i];
      tan[i + 1] = t * b * sec[i];
    }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = (x1 - x0) / 3;
    d += ` C${(x0 + dx).toFixed(1)},${(y0 + tan[i] * dx).toFixed(1)} ${(x1 - dx).toFixed(1)},${(y1 - tan[i + 1] * dx).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/** Topo da escala: múltiplo "redondo" acima do maior valor. */
function topo(max: number): number {
  if (max <= 0) return 10;
  const passo = 10 ** Math.floor(Math.log10(max));
  return Math.ceil((max * 1.15) / passo) * passo;
}

export function GraficoToneladas({ meses }: { meses: MesToneladas[] }) {
  const [periodo, setPeriodo] = useState<6 | 12>(12);
  const [foco, setFoco] = useState<number | null>(null);
  const [largura, setLargura] = useState(640);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ini = 12 - periodo;
  const visiveis = meses.slice(ini);
  const total = visiveis.reduce((a, m) => a + m.toneladas, 0);
  const media = total / periodo;
  const maximo = topo(Math.max(...meses.map((m) => m.toneladas), media));
  const x = (i: number) => ESQ + ((i - ini) / (periodo - 1)) * (largura - ESQ - DIR);
  const y = (v: number) => CIMA + (1 - v / maximo) * (ALTURA - CIMA - BAIXO);
  const pts = meses.map((m, i): [number, number] => [x(i), y(m.toneladas)]);
  const linha = curva(pts);
  const area = `${linha} L${pts[11][0].toFixed(1)},${ALTURA - BAIXO} L${pts[0][0].toFixed(1)},${ALTURA - BAIXO} Z`;
  const mola = { type: "spring" as const, stiffness: 120, damping: 22 };
  const vazio = meses.every((m) => m.toneladas === 0);

  function mover(e: React.PointerEvent) {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    const px = e.clientX - r.left;
    let melhor = ini;
    for (let i = ini; i < 12; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    setFoco(melhor);
  }

  return (
    <section className="painel painel-grafico" aria-labelledby={`${id}-t`}>
      <div className="painel-cab">
        <h2 id={`${id}-t`}>Toneladas transportadas</h2>
        <LayoutGroup id={`${id}-periodo`}>
          <div className="segmentado" role="group" aria-label="Período">
            {([6, 12] as const).map((p) => (
              <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
                {periodo === p && <motion.span layoutId="seg-fundo" className="segmentado-fundo" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="segmentado-rot">{p} meses</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
        <Link className="redondo" href="/viagens?aba=finalizadas" aria-label="Ver as viagens finalizadas">
          <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
      <div className="linha-valor">
        <span className="valor-grande">
          <Numero valor={Math.round(total)} /> t
        </span>
        <span className="nota">
          em {periodo} meses · média de <b>{T.format(media)} t</b> por mês
        </span>
      </div>
      <div className="graf-legenda">
        <span>
          <i className="leg-ponto" /> Finalizadas no mês
        </span>
        <span>
          <i className="leg-traco" /> Média do período
        </span>
      </div>
      <div className="graf-caixa" ref={caixa} onPointerMove={mover} onPointerLeave={() => setFoco(null)}>
        <svg role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-tab`} width="100%" height={ALTURA}>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--verde)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--verde)" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-c`}>
              <rect x={ESQ - 4} y="0" width={largura - ESQ - DIR + 8} height={ALTURA} />
            </clipPath>
          </defs>
          {[0, maximo / 2, maximo].map((v) => (
            <g key={v}>
              <line x1={ESQ} x2={largura - DIR} y1={y(v)} y2={y(v)} className="graf-grade" />
              <text x={ESQ - 10} y={y(v) + 4} textAnchor="end">
                {T.format(v)} t
              </text>
            </g>
          ))}
          <motion.line
            x1={ESQ}
            x2={largura - DIR}
            className="graf-media"
            initial={false}
            animate={{ y1: y(media), y2: y(media) }}
            transition={mola}
          />
          <g clipPath={`url(#${id}-c)`}>
            <motion.path
              fill={`url(#${id}-g)`}
              initial={{ opacity: 0, d: area }}
              animate={{ opacity: 1, d: area }}
              transition={{ d: mola, opacity: { duration: 0.8, delay: 0.5 } }}
            />
            <motion.path
              className="graf-linha"
              fill="none"
              initial={{ pathLength: 0, d: linha }}
              animate={{ pathLength: 1, d: linha }}
              transition={{ pathLength: { duration: 1.1, ease: [0.23, 1, 0.32, 1], delay: 0.2 }, d: mola }}
            />
          </g>
          {meses.map((m, i) => (
            <motion.text key={m.mes} y={ALTURA - 8} textAnchor="middle" initial={false} animate={{ x: x(i), opacity: i >= ini ? 1 : 0 }} transition={mola}>
              {m.rotulo}
            </motion.text>
          ))}
          {foco !== null && (
            <g>
              <line x1={x(foco)} x2={x(foco)} y1={CIMA} y2={ALTURA - BAIXO} className="graf-guia" />
              <circle cx={x(foco)} cy={y(meses[foco].toneladas)} r="5" className="graf-ponto" />
            </g>
          )}
        </svg>
        {foco !== null && (
          <div
            className="graf-dica"
            style={{ left: Math.min(Math.max(x(foco) - 72, 0), largura - 150), top: Math.max(y(meses[foco].toneladas) - 74, 0) }}
            aria-hidden="true"
          >
            <b>{meses[foco].rotulo}</b>
            <div>
              <span>Transportado</span>
              <strong className="num">{T.format(meses[foco].toneladas)} t</strong>
            </div>
            <div>
              <span>Média</span>
              <span className="num">{T.format(media)} t</span>
            </div>
          </div>
        )}
        {vazio && <p className="graf-vazio">Nenhuma viagem finalizada nos últimos 12 meses.</p>}
      </div>
      <table className="sr-only" id={`${id}-tab`}>
        <caption>Toneladas por mês, últimos {periodo} meses</caption>
        <tbody>
          {visiveis.map((m) => (
            <tr key={m.mes}>
              <th scope="row">{m.rotulo}</th>
              <td>{T.format(m.toneladas)} t</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
