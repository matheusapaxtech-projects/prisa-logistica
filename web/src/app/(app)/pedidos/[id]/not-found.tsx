import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IdPedido } from "../../proprietarios/[id]/id-pedido";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Pedido não encontrado" };

/* Id que não é de nenhum pedido (ou nem é um id): "não encontrado". */
export default function PedidoNaoEncontrado() {
  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/pedidos">Pedidos</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Pedido não encontrado</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          Não há pedido com o código “<IdPedido />”. O link pode estar incompleto ou o pedido foi excluído.
        </div>
        <div className="acoes">
          <Link className="btn btn-primario" href="/pedidos">
            <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
            Voltar para pedidos
          </Link>
        </div>
      </div>
    </main>
  );
}
