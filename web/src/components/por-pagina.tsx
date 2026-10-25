"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/* "Por página" do rodapé de `Paginacao`: troca na hora, levando ao endereço já montado pela lista. */
export function PorPagina({ atual, hrefs }: { atual: number; hrefs: Record<number, string> }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  return (
    <label className="paginacao-por">
      <span>Por página</span>
      <select value={atual} onChange={(e) => iniciar(() => router.replace(hrefs[Number(e.currentTarget.value)], { scroll: false }))}>
        {Object.keys(hrefs).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
