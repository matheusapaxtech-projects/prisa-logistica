import Link from "next/link";
import { SearchX } from "lucide-react";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { tipado } from "@/lib/banco";
import { createClient } from "@/lib/supabase/server";
import "@/styles/paginas/veiculos.css";
import { LinhaClicavel } from "../linha-clicavel";
import { marcaCurta, rotuloTipo, um } from "../rotulos";
import { CodigoNaoAchado } from "./codigo-nao-achado";

type Embutido<T> = T | T[] | null;

/* Veículo não encontrado (`veiculo.html` com id que não existe): a mesma página para id que não é um
   código válido e para id que não aparece (apagado, ou sem permissão). Sugere os veículos que pedem atenção. */
export default async function VeiculoNaoEncontrado() {
  const db = tipado(await createClient());
  const [pendentes, semContrato] = await Promise.all([
    db
      .from("veiculo")
      .select("id, placa, modelo, arrendado, situacao_cadastro, tipo_veiculo(nome, categoria, configuracao_cavalo), marca_veiculo(nome)")
      .or("situacao_cadastro.eq.pendente,arrendado.eq.true")
      .order("placa")
      .limit(20),
    db.from("v_pendencias_documentos").select("veiculo_id").eq("tipo_pendencia", "veiculo_arrendado_sem_contrato"),
  ]);
  const idsSemContrato = new Set((semContrato.data ?? []).map((p) => p.veiculo_id));
  const linhas = (pendentes.data ?? [])
    .map((v) => ({ v, semContrato: idsSemContrato.has(v.id) }))
    .filter((x) => x.semContrato || x.v.situacao_cadastro === "pendente");

  return (
    <main>
      <div className="titulo">
        <div>
          <div className="migalha">
            <Link href="/veiculos">Veículos</Link>
            <span className="sep" aria-hidden="true">/</span>
            <h1>Veículo não encontrado</h1>
          </div>
          <p className="sub">
            <CodigoNaoAchado />
          </p>
        </div>
      </div>
      <div className="vazio-bloco nao-achou">
        <SearchX size={18} strokeWidth={1.6} aria-hidden="true" />
        <span>
          O link pode estar errado ou o veículo foi removido. Procure pela placa na busca do alto (tecla /) ou volte à lista.
        </span>
        <Link className="btn" href="/veiculos">
          Ver todos os veículos
        </Link>
      </div>
      {linhas.length > 0 && (
        <section className="bloco-sec atalhos">
          <h2>Veículos que pedem atenção</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Placa</th>
                  <th scope="col">Veículo</th>
                  <th scope="col">O que falta</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ v, semContrato: sem }) => {
                  const tipo = um(v.tipo_veiculo as Embutido<{ nome: string; categoria: "cavalo" | "caminhao" | "carreta" | "dolly" | "outros"; configuracao_cavalo: "toco" | "trucado" | null }>);
                  return (
                    <LinhaClicavel key={v.id} href={`/veiculos/${v.id}`}>
                      <td>
                        <Placa placa={v.placa} />
                      </td>
                      <td>
                        {tipo ? rotuloTipo(tipo) : "Veículo"}
                        <Ponto />
                        {marcaCurta(um(v.marca_veiculo as Embutido<{ nome: string }>)?.nome)} {v.modelo}
                      </td>
                      <td>
                        {sem ? <Sinal tipo="pendente" texto="Sem contrato de arrendamento" /> : <Sinal situacao="pendente" texto="Cadastro pendente" />}
                      </td>
                    </LinhaClicavel>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
