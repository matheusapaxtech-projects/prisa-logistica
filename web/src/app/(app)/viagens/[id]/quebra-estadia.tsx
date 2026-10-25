import { Sinal } from "@/components/Sinal";
import type { Json } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { CabPainel, Dash } from "../../_pessoa/partes";

/* Quebra de peso e estadia da viagem (motor de despacho, rotina 8): o jsonb de `quebra_e_estadia`
   (migration 20261029000400). A quebra compara o peso de saída com o de chegada pela tolerância do
   contrato do cliente; a estadia conta as horas de carga e de descarga acima das horas grátis
   (Lei 11.442/2007) pela linha do tempo do Quadro. As contas são do banco. */

export type QuebraEstadia = {
  pesoOrigemT: number | null;
  pesoDestinoT: number | null;
  quebraT: number | null;
  quebraPct: number | null;
  toleranciaPct: number;
  divergente: boolean | null;
  excedenteT: number | null;
  horasCarga: number;
  horasDescarga: number;
  esperaGratisH: number | null;
  estadiaPorTh: number | null;
  pesoEstadiaT: number;
  estadiaCarga: number;
  estadiaDescarga: number;
  cobrar: number;
  repassePct: number | null;
  repassar: number;
};

type Obj = Record<string, Json | undefined>;
const n = (v: Json | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const z = (v: Json | undefined) => n(v) ?? 0;

export function lerQuebraEstadia(j: Json | null | undefined): QuebraEstadia | null {
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Obj;
  return {
    pesoOrigemT: n(o.peso_origem_t),
    pesoDestinoT: n(o.peso_destino_t),
    quebraT: n(o.quebra_t),
    quebraPct: n(o.quebra_pct),
    toleranciaPct: n(o.tolerancia_pct) ?? 0.3,
    divergente: typeof o.divergente === "boolean" ? o.divergente : null,
    excedenteT: n(o.excedente_t),
    horasCarga: z(o.horas_carga),
    horasDescarga: z(o.horas_descarga),
    esperaGratisH: n(o.espera_gratis_h),
    estadiaPorTh: n(o.estadia_por_th),
    pesoEstadiaT: z(o.peso_estadia_t),
    estadiaCarga: z(o.estadia_carga),
    estadiaDescarga: z(o.estadia_descarga),
    cobrar: z(o.cobrar_do_cliente),
    repassePct: n(o.repasse_pct),
    repassar: z(o.repassar_ao_motorista),
  };
}

const num = (v: number, c = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const horas = (h: number) => {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)} h${String(t % 60).padStart(2, "0")}`;
};

function LinhaEstadia({ h, valor, gratis }: { h: number; valor: number; gratis: number }) {
  return (
    <>
      {horas(h)}
      <span className="linha2">{valor > 0 ? `${formato.reais(valor)} de estadia (${horas(h - gratis)} acima das ${num(gratis, 0)} h grátis)` : `dentro das ${num(gratis, 0)} h grátis`}</span>
    </>
  );
}

export function BlocoQuebraEstadia({ q }: { q: QuebraEstadia }) {
  const gratis = q.esperaGratisH ?? 5;
  return (
    <section className="subsecao quebra-estadia">
      <CabPainel titulo="Quebra de peso e estadia" />
      <dl className="kv">
        <dt>Quebra de peso</dt>
        <dd>
          {q.quebraT === null || q.quebraPct === null ? (
            <Dash>{q.pesoOrigemT === null ? "falta o peso de saída" : "falta o peso de chegada"}</Dash>
          ) : (
            <>
              <Sinal
                tipo={q.divergente ? "bloqueado" : "normal"}
                texto={`${q.quebraT >= 0 ? "Quebra" : "Sobra"} de ${num(Math.abs(q.quebraT), 3)} t (${num(Math.abs(q.quebraPct))}%)`}
              />
              <span className="linha2">
                {num(q.pesoOrigemT ?? 0, 3)} t na saída, {num(q.pesoDestinoT ?? 0, 3)} t na chegada; tolerância do cliente {num(q.toleranciaPct)}%
                {q.divergente && q.excedenteT ? `, passa ${num(q.excedenteT, 3)} t` : ""}
              </span>
            </>
          )}
        </dd>
        <dt>Na carga</dt>
        <dd>
          <LinhaEstadia h={q.horasCarga} valor={q.estadiaCarga} gratis={gratis} />
        </dd>
        <dt>Na descarga</dt>
        <dd>
          <LinhaEstadia h={q.horasDescarga} valor={q.estadiaDescarga} gratis={gratis} />
        </dd>
        <dt>Estadia</dt>
        <dd>
          {q.cobrar > 0 ? (
            <>
              {formato.reais(q.cobrar)} a cobrar do cliente
              <span className="linha2">
                {formato.reais(q.repassar)} de repasse ao motorista ({num(q.repassePct ?? 0, 0)}%); R$ {num(q.estadiaPorTh ?? 0)} por t/h sobre {num(q.pesoEstadiaT, 3)} t
              </span>
            </>
          ) : (
            <Dash>sem estadia</Dash>
          )}
        </dd>
      </dl>
    </section>
  );
}
