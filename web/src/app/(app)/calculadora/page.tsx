import type { Metadata } from "next";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { RE_ID } from "../_pessoa/formulario";
import { TIPOS_CARGA_ANTT } from "../pedidos/regras";
import { CalculadoraCliente } from "./calculadora-cliente";
import { daViagem, parametros, tabelaAntt } from "./consultas";
import "@/styles/paginas/calculadora.css";

export const metadata: Metadata = { title: "Calcular frete" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/* Calcular frete: a decisão de contratar um frete antes de fechar com o cliente e o motorista (Calculadora
   de Frete PRISA). Todos usam; a margem e o resultado do CT-e aparecem só para admin e financeiro, e a
   operação recebe o veredito e os limites em reais (decisão de 2026-10-24). `?viagem=<id>` preenche com a
   viagem (botão da ficha). As contas correm no navegador (lib/calculadora/regras.ts); a viagem real
   continua calculada pelo banco. */
export default async function CalculadoraPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const db = tipado(await createClient());
  const idViagem = um(sp.viagem);
  const [perfil, tabela, param, viagem] = await Promise.all([
    getPerfil(),
    tabelaAntt(db),
    parametros(db),
    RE_ID.test(idViagem) ? daViagem(db, idViagem) : Promise.resolve(null),
  ]);
  return (
    <main className="calc">
      <CalculadoraCliente
        tabela={tabela}
        fiscal={param.fiscal}
        vigenciaFiscal={param.vigencia}
        tiposCarga={TIPOS_CARGA_ANTT}
        verTudo={pode(perfil, "financeiro")}
        viagem={viagem}
      />
    </main>
  );
}
