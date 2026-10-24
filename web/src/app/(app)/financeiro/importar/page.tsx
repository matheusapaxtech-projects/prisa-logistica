import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { tipado } from "@/lib/banco";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { listarImportacoes } from "../consultas";
import { FormularioImportar, HistoricoImportacoes } from "./importar-cliente";
import "@/styles/paginas/proprietarios.css";
import "@/styles/paginas/financeiro.css";

export const metadata: Metadata = { title: "Importar extrato" };

/* Importar extrato: envia o OFX (a leitura e a gravação são da Server Action) e mostra os extratos já
   importados, com "Desfazer" para o arquivo errado. */
export default async function ImportarPage() {
  const perfil = await getPerfil();
  const migalha = (
    <div className="cab-ficha">
      <div className="ident">
        <nav className="migalha" aria-label="Você está em">
          <Link href="/financeiro">Financeiro</Link>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <h1>Importar extrato</h1>
        </nav>
      </div>
    </div>
  );

  if (!pode(perfil, "financeiro")) {
    return (
      <main className="prop fin">
        {migalha}
        <EstadoVazio>O financeiro é visto só pelo administrador e pelo financeiro. Se você precisa dele, peça o acesso ao administrador.</EstadoVazio>
      </main>
    );
  }

  const importacoes = await listarImportacoes(tipado(await createClient()));

  return (
    <main className="prop fin">
      {migalha}
      <div className="grade">
        <section className="bloco c7" aria-labelledby="t-enviar">
          <div className="bloco-cab">
            <h2 id="t-enviar">Enviar o extrato</h2>
          </div>
          <div className="bloco-corpo">
            <FormularioImportar />
          </div>
        </section>

        <section className="bloco c5" aria-labelledby="t-como">
          <div className="bloco-cab">
            <h2 id="t-como">Como tirar o OFX do banco</h2>
          </div>
          <div className="bloco-corpo como-ofx">
            <p>No internet banking da empresa, abra o extrato da conta, escolha o período e exporte em <b>OFX</b> (às vezes aparece como “Money” ou “Quicken”).</p>
            <p>Um mês por arquivo é o mais prático. Pode importar o mesmo período de novo: o que já está no NILT não se repete.</p>
            <p>A conta é reconhecida pelo próprio arquivo (banco, agência e conta) e aparece sozinha na primeira importação.</p>
          </div>
        </section>

        <section className="bloco c12" aria-labelledby="t-historico">
          <div className="bloco-cab">
            <h2 id="t-historico">Extratos importados</h2>
            <span className="dir">
              {importacoes.length === 50 ? "os 50 mais recentes" : `${importacoes.length} ${importacoes.length === 1 ? "extrato" : "extratos"}`}
            </span>
          </div>
          <div className="bloco-corpo">
            <HistoricoImportacoes importacoes={importacoes} />
          </div>
        </section>
      </div>
    </main>
  );
}
