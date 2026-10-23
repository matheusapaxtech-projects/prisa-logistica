import { Fragment } from "react";
import Link from "next/link";
import { Capacidade } from "@/components/Capacidade";
import { Engate } from "@/components/Engate";
import { EstadoVazio } from "@/components/EstadoVazio";
import { formato } from "@/lib/formato";
import type { Capacidade as DadosCapacidade, ConjuntoDetalhe } from "./consultas";

const dia = (iso: string) => formato.dataHora(iso).slice(0, 10);

/* Aba Conjunto (`painelConjunto` de veiculo.html): o conjunto aberto, desenhado com este veículo em
   destaque, e os conjuntos anteriores. Só para quem engata (cavalo, carreta, dolly). */
export function PainelConjunto({
  placa,
  categoria,
  atual,
  capacidade,
  anteriores,
  podeEditar,
  veiculoId,
}: {
  placa: string;
  categoria: "cavalo" | "carreta" | "dolly" | "caminhao" | "outros";
  atual: ConjuntoDetalhe | null;
  capacidade: DadosCapacidade | null;
  anteriores: ConjuntoDetalhe[];
  podeEditar: boolean;
  veiculoId: string;
}) {
  const ehCavalo = categoria === "cavalo";
  const posicao = atual && !ehCavalo ? atual.itens.findIndex((i) => i.placa === placa) + 1 : 0;
  return (
    <>
      <section className="bloco-sec">
        <h2>Conjunto atual</h2>
        {atual ? (
          <div className="conjunto-atual">
            <div className="conj-desenho" id="conj-desenho">
              <Engate cavalo={atual.cavalo} itens={atual.itens} destacar={placa} />
            </div>
            <div className="conj-dados">
              <p className="conj-onde">
                <b>
                  {ehCavalo
                    ? `Puxando ${atual.itens.length} ${atual.itens.length === 1 ? "peça" : "peças"}`
                    : `Engatado no cavalo ${atual.cavalo.placa}, posição ${posicao} de ${atual.itens.length}`}
                </b>
              </p>
              <dl className="kv">
                <dt>Motorista</dt>
                <dd>
                  {atual.motorista ? <Link href={`/motoristas/${atual.motorista.id}`}>{atual.motorista.nome}</Link> : <span className="dash">—</span>}
                </dd>
                <dt>Desde</dt>
                <dd>{dia(atual.inicio)}</dd>
                <dt>Eixos</dt>
                <dd>{atual.eixos}</dd>
                <dt>Tara total</dt>
                <dd>{capacidade ? formato.t(capacidade.tara_total_t) : "—"}</dd>
              </dl>
              {capacidade && <Capacidade c={capacidade} />}
              <Link className="btn" href={`/conjuntos/${atual.id}`}>
                Abrir o conjunto
              </Link>
            </div>
          </div>
        ) : (
          <EstadoVazio>
            <span>
              {ehCavalo
                ? "Cavalo livre: nenhum conjunto aberto com ele."
                : `${categoria === "dolly" ? "Dolly livre" : "Carreta livre"}: não está engatado em nenhum cavalo.`}
            </span>
            {ehCavalo && podeEditar && (
              <Link className="btn btn-texto" href={`/conjuntos/novo?cavalo=${veiculoId}`}>
                Montar conjunto
              </Link>
            )}
          </EstadoVazio>
        )}
      </section>

      <section className="bloco-sec">
        <h2>Conjuntos anteriores</h2>
        {anteriores.length ? (
          <div className="tabela-wrap">
            <table className="tabela tabela-hist">
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">Peças, na ordem de engate</th>
                  <th scope="col" className="some-celular">Motorista</th>
                </tr>
              </thead>
              <tbody>
                {anteriores.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {dia(c.inicio)} a {c.fim ? dia(c.fim) : "—"}
                    </td>
                    <td>
                      {[c.cavalo, ...c.itens].map((p, i) => (
                        <Fragment key={`${p.placa}-${i}`}>
                          {i > 0 && " + "}
                          <span className="cod">{p.placa}</span>
                        </Fragment>
                      ))}
                    </td>
                    <td className="some-celular">{c.motorista?.nome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>Nenhum conjunto anterior registrado.</EstadoVazio>
        )}
      </section>
    </>
  );
}
