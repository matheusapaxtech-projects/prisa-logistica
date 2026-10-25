import type { Metadata } from "next";
import Link from "next/link";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { opcoesDeClientes } from "../consultas";
import { FormularioPedido } from "../formulario-pedido";
import "@/styles/paginas/pessoa.css";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/pedidos.css";

export const metadata: Metadata = { title: "Novo pedido" };

/* Novo pedido: o formulário recebe todos os clientes (para a busca de tomador, remetente e
   destinatário); os locais de cada um chegam quando ele é escolhido. */
export default async function NovoPedidoPage() {
  const perfil = await getPerfil();
  const podeEditar = pode(perfil, "editar");
  const clientes = podeEditar ? await opcoesDeClientes(tipado(await createClient())) : [];

  return (
    <main className="prop ped">
      <div className="titulo">
        <div>
          <nav className="migalha" aria-label="Caminho">
            <Link href="/pedidos">Pedidos</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <h1>Novo pedido</h1>
          </nav>
          <p className="sub">O que o cliente contratou: partes, locais, carga e frete. As viagens saem dele depois.</p>
        </div>
      </div>
      {podeEditar ? (
        <FormularioPedido clientes={clientes} />
      ) : (
        <div className="vazio-bloco" role="alert">
          Seu papel não permite criar pedidos. Peça a um administrador ou à operação.
          <Link className="btn btn-texto" href="/pedidos">
            Voltar para a lista
          </Link>
        </div>
      )}
    </main>
  );
}
