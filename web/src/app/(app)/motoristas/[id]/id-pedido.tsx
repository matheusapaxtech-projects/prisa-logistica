"use client";

import { usePathname, useRouter } from "next/navigation";

/** O código pedido no endereço (o not-found não recebe `params`). */
export function IdPedido() {
  const caminho = usePathname();
  const id = decodeURIComponent(caminho.split("/").filter(Boolean).pop() ?? "");
  return <span className="cod">{id}</span>;
}

/** "Tentar de novo": busca a página outra vez. */
export function TentarDeNovo() {
  const router = useRouter();
  return (
    <button className="btn btn-texto" type="button" onClick={() => router.refresh()}>
      Tentar de novo
    </button>
  );
}
