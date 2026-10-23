import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IdPedido } from "../../proprietarios/[id]/id-pedido";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Cliente não encontrado" };

/* Id que não é de nenhuma pessoa (ou nem é um id): "não encontrado". */
export default function ClienteNaoEncontrado() {
  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/clientes">Clientes</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Cliente não encontrado</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          Não há cliente com o código “<IdPedido />”. O link pode estar incompleto ou o cadastro foi excluído.
        </div>
        <div className="acoes">
          <Link className="btn btn-primario" href="/clientes">
            <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
            Voltar para clientes
          </Link>
          <Link className="btn" href="/clientes/novo">
            Novo cliente
          </Link>
        </div>
      </div>
    </main>
  );
}
