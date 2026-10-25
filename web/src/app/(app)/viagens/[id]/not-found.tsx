import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IdPedido } from "../../proprietarios/[id]/id-pedido";
import "@/styles/paginas/proprietarios.css";

export const metadata: Metadata = { title: "Viagem não encontrada" };

/* Id que não é de nenhuma viagem (ou nem é um id): "não encontrado". */
export default function ViagemNaoEncontrada() {
  return (
    <main className="prop">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/viagens">Viagens</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Viagem não encontrada</h1>
          </nav>
        </div>
      </div>
      <div className="prop-nao-achou" role="alert">
        <div className="vazio-bloco">
          Não há viagem com o código “<IdPedido />”. O link pode estar incompleto ou a viagem foi excluída.
        </div>
        <div className="acoes">
          <Link className="btn btn-primario" href="/viagens">
            <ArrowLeft size={16} strokeWidth={1.6} aria-hidden="true" />
            Voltar para viagens
          </Link>
        </div>
      </div>
    </main>
  );
}
