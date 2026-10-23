import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Placa } from "@/components/Placa";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import type { VeiculoDoProprietario } from "../consultas";
import { LinhaVeiculo } from "./linha-veiculo";

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "TOCO 10 TON CARROCERIA - 2 EIXOS" → "toco 10 ton carroceria · 2 eixos" (com o ponto do meio da tela). */
function TipoCurto({ tipo }: { tipo: string | null }) {
  const t = (tipo ?? "").toLowerCase();
  const m = t.match(/^(.*) - (\d) eixos$/);
  if (!m) return <>{t}</>;
  return (
    <>
      {m[1]}
      <Ponto />
      {m[2]} eixos
    </>
  );
}

/* Aba Veículos (painelVeiculos de prototipo/proprietario.html): os veículos em nome deste proprietário,
   no CRLV (posse), na ANTT (documento) ou nos dois. Arrendado = posse e documento são de pessoas diferentes. */
export function Veiculos({ veiculos, nome }: { veiculos: VeiculoDoProprietario[]; nome: string }) {
  if (!veiculos.length)
    return <EstadoVazio>Nenhum veículo em nome deste proprietário. Ao cadastrar um veículo, escolha {nome} no CRLV ou na ANTT.</EstadoVazio>;

  const posse = veiculos.filter((v) => v.posse).length;
  const documento = veiculos.filter((v) => v.documento).length;
  const arrendados = veiculos.filter((v) => v.arrendado).length;

  return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>
        {veiculos.length} {plural(veiculos.length, "veículo", "veículos")}
        <Ponto />
        {posse} no CRLV
        <Ponto />
        {documento} na ANTT
        {arrendados > 0 && (
          <>
            <Ponto />
            {arrendados} {plural(arrendados, "arrendado", "arrendados")}
          </>
        )}
      </p>
      <div className="tabela-wrap">
        <table className="tabela tabela-prop">
          <thead>
            <tr>
              <th scope="col" style={{ width: "40%" }}>
                Veículo
              </th>
              <th scope="col" className="some-celular">
                Papel deste proprietário
              </th>
              <th scope="col" className="some-celular">
                Outro proprietário
              </th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => {
              const papel = v.posse && v.documento ? "CRLV e ANTT" : v.posse ? "Só no CRLV" : "Só na ANTT";
              const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
              return (
                <LinhaVeiculo key={v.id} href={`/veiculos/${v.id}`}>
                  <td>
                    <div className="placa-cel">
                      <Placa placa={v.placa} />
                      <span className="txt">
                        <span className="id">{marcaModelo}</span>
                        <span className="linha2">
                          <TipoCurto tipo={v.tipo} />
                        </span>
                        <span className="linha2 p-cel">
                          {papel}
                          {v.outro && (
                            <>
                              <Ponto />
                              {v.outro.naPosse ? "CRLV" : "ANTT"}: {v.outro.nome}
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="some-celular">
                    {papel}
                    <span className="linha2">{v.posse && v.documento ? "dono e transportador" : v.documento ? "arrendatário: roda com o veículo" : "arrendador: é o dono"}</span>
                  </td>
                  <td className="some-celular">
                    {v.outro ? (
                      <>
                        <Link href={`/proprietarios/${v.outro.id}`}>{v.outro.nome}</Link>
                        <span className="linha2">{v.outro.naPosse ? "no CRLV (posse)" : "na ANTT (documento)"}</span>
                      </>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td>
                    {v.arrendado ? <Sinal situacao="arrendado" /> : <Sinal situacao={v.situacao} />}
                    {v.arrendado && v.semContrato ? (
                      <span className="linha2 sem-contrato">sem contrato de arrendamento</span>
                    ) : v.arrendado ? (
                      <span className="linha2">contrato anexado</span>
                    ) : null}
                  </td>
                </LinhaVeiculo>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
