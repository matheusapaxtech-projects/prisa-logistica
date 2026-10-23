"use client";

import { usePathname } from "next/navigation";

/** O código pedido no endereço (o not-found não recebe `params`). */
export function IdPedido() {
  const bruto = usePathname().split("/").filter(Boolean).pop() ?? "";
  let id = bruto;
  try {
    id = decodeURIComponent(bruto);
  } catch {
    // "%" solto no endereço: mostra como veio
  }
  return <>{id}</>;
}
