import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErroFicha } from "./erro-ficha";
import { IdPedido, TentarDeNovo } from "./id-pedido";

export const metadata: Metadata = { title: "Motorista não encontrado" };

/* Id que não é de nenhum motorista nem de nenhuma pessoa (ou nem é um id): "não encontrado". */
export default function MotoristaNaoEncontrado() {
  return (
    <ErroFicha titulo="Motorista não encontrado">
      <h2>Não encontramos este motorista</h2>
      <p>
        O endereço pede o motorista <IdPedido />, que não existe ou foi removido. Confira o link ou procure pelo nome, apelido ou CPF na lista.
      </p>
      <div className="acoes">
        <Link className="btn btn-primario" href="/motoristas">
          <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          Ir para a lista de motoristas
        </Link>
        <TentarDeNovo />
      </div>
    </ErroFicha>
  );
}
