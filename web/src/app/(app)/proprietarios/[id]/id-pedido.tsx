"use client";

import { usePathname } from "next/navigation";

/** O código pedido no endereço (o not-found não recebe `params`). */
export function IdPedido() {
  const caminho = usePathname();
  const id = decodeURIComponent(caminho.split("/").filter(Boolean).pop() ?? "");
  return <>{id}</>;
}
