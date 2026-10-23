"use client";

import { useParams } from "next/navigation";

/* O código da URL que não abriu nenhum veículo (o not-found não recebe `params`). */
export function CodigoNaoAchado() {
  const { id } = useParams<{ id?: string }>();
  let codigo = id ?? "";
  try {
    codigo = decodeURIComponent(codigo);
  } catch {
    // código com % solto: mostra como veio
  }
  return <>{codigo ? `Não há veículo com o código “${codigo.slice(0, 80)}”.` : "O endereço não diz qual veículo abrir."}</>;
}
