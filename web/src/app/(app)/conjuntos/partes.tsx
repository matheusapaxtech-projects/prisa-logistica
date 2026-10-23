/* Pedaços pequenos da tela de Conjuntos, sem hooks (servidor e cliente). */
import { Fragment, type ReactNode } from "react";
import { Ponto } from "@/components/Ponto";
import { diasAte, hojeISO } from "@/lib/datas";

/** Dia (yyyy-mm-dd) em Brasília de um instante `timestamptz` (início e fim do conjunto). */
export const diaSP = (iso: string) => hojeISO(new Date(iso));

/** "hoje", "há 1 dia", "há N dias" desde um instante (`haDias`/`desdeTxt` do protótipo). */
export function haDias(iso: string): string {
  const n = -diasAte(diaSP(iso));
  return n <= 0 ? "hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;
}

/** Dias corridos entre dois instantes (dias de calendário em Brasília). */
export const diasEntre = (inicio: string, fim: string) => diasAte(diaSP(fim)) - diasAte(diaSP(inicio));

/** `n um|varios`. */
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Itens separados pelo ponto do meio (`separarPontos` do protótipo). Itens vazios saem. */
export function Partes({ itens }: { itens: ReactNode[] }) {
  const v = itens.filter((x) => x !== null && x !== false && x !== undefined && x !== "");
  return (
    <>
      {v.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <Ponto />}
          {t}
        </Fragment>
      ))}
    </>
  );
}
