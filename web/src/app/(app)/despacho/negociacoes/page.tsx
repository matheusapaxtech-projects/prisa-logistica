import type { Metadata } from "next";
import { Abas } from "@/components/Abas";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { CalculadoraCliente } from "../../calculadora/calculadora-cliente";
import { parametros, rotasSalvas, tabelaAntt } from "../../calculadora/consultas";
import { TIPOS_CARGA_ANTT } from "../../pedidos/regras";
import { ABAS_DESPACHO } from "../abas";
import { fretesDaFila, fretesPagos, listarNegociacoes, motoristasDoAcervo } from "./consultas";
import { NegociacoesLista } from "./lista";
import "@/styles/paginas/calculadora.css";
import "@/styles/paginas/despacho.css";

export const metadata: Metadata = { title: "Negociações · Despacho" };

/* Despacho › Calculadora e negociações: a calculadora de frete com o frete da fila e o motorista do acervo, o
   que já foi pago nesta rota e o histórico das negociações com os motoristas (como no sistema do sócio). */
export default async function NegociacoesPage() {
  const db = tipado(await createClient());
  const perfil = await getPerfil();
  const verMargem = pode(perfil, "financeiro");
  const [tabela, param, rotas, fretes, motoristas, pagos, linhas] = await Promise.all([
    tabelaAntt(db),
    parametros(db),
    rotasSalvas(db),
    fretesDaFila(db),
    motoristasDoAcervo(db),
    fretesPagos(db),
    listarNegociacoes(db, verMargem),
  ]);
  return (
    <main className="calc desp-pag">
      <CalculadoraCliente
        tabela={tabela}
        fiscal={param.fiscal}
        vigenciaFiscal={param.vigencia}
        tiposCarga={TIPOS_CARGA_ANTT}
        verTudo={verMargem}
        viagem={null}
        rotas={rotas}
        podeSalvar={pode(perfil, "editar")}
        podeApagar={pode(perfil, "admin")}
        negociacao={{ fretes, motoristas, pagos }}
        cabecalho={
          <div>
            <h1>Despacho</h1>
            <p className="sub">
              Calcule o frete do motorista, salve a negociação e marque a resposta. Aceitou: vira viagem no Quadro. Recusou: fica no histórico com o
              valor que ele pediu. Saiu o CT-e: informe o número e o registro fica congelado.
            </p>
          </div>
        }
        antes={<Abas abas={ABAS_DESPACHO} ativa="negociacoes" rotulo="Partes do despacho" />}
      />
      <NegociacoesLista linhas={linhas} verMargem={verMargem} podeEditar={pode(perfil, "editar")} />
    </main>
  );
}
