import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErroFicha } from "./erro-ficha";
import { IdPedido } from "./id-pedido";

export const metadata: Metadata = { title: "Proprietário não encontrado" };

/* Id que não é de nenhuma pessoa (ou nem é um id): "não encontrado". */
export default function ProprietarioNaoEncontrado() {
  return (
    <ErroFicha titulo="Proprietário não encontrado">
      <div className="vazio-bloco">
        Não há proprietário com o código “<IdPedido />”. O link pode estar incompleto ou o cadastro foi excluído.
      </div>
      <div className="acoes">
        <Link className="btn btn-primario" href="/proprietarios">
          <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
          Voltar para proprietários
        </Link>
        <Link className="btn" href="/proprietarios/novo">
          Novo proprietário
        </Link>
      </div>
    </ErroFicha>
  );
}
