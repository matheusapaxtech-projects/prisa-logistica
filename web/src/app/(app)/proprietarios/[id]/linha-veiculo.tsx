"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/* Linha da tabela de veículos que abre a ficha do veículo (`linhaClicavel` do protótipo): clique fora
   de links e botões, ou Enter com a linha em foco. */
export function LinhaVeiculo({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      data-href={href}
      tabIndex={0}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,input")) router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
