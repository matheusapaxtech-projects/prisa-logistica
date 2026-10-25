"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { dataBr, type RotaSalva } from "@/lib/calculadora/rota";
import { apagarRota } from "./actions";
import { CabSecao } from "./partes";

/* Painel "Rotas salvas" da calculadora: as rotas que a equipe conferiu no Qualp. "Usar" carrega a rota na
   tela; o administrador pode apagar (com confirmação na própria linha). */

type Props = {
  rotas: RotaSalva[];
  podeApagar: boolean;
  usar: (r: RotaSalva) => void;
};

export function RotasSalvas({ rotas, podeApagar, usar }: Props) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [apagando, iniciar] = useTransition();

  function apagar(id: string) {
    iniciar(async () => {
      const r = await apagarRota(id);
      setConfirmar(null);
      toast(r.ok ? "Rota apagada." : r.erro, r.ok ? "trash-2" : "alert-circle");
    });
  }

  return (
    <section className="painel" aria-labelledby="calc-salvas">
      <CabSecao id="calc-salvas" titulo={`Rotas salvas${rotas.length ? ` (${rotas.length})` : ""}`}>
        Rotas com km e pedágio conferidos pela equipe. Na cotação, a rota salva vale no lugar da estimativa.
      </CabSecao>
      {rotas.length === 0 ? (
        <p className="calc-vazio">
          Nenhuma rota salva ainda. Quando o km e o pedágio de uma rota forem conferidos no Qualp, use “Salvar rota para a equipe” no bloco Rota.
        </p>
      ) : (
        <div className="tabela-wrap">
          <table className="calc-demonstrativo calc-salvas">
            <thead>
              <tr>
                <th scope="col">Rota</th>
                <th scope="col">Km</th>
                <th scope="col">Pedágio conferido</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rotas.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {r.origem} → {r.destino}
                    <span className="linha2">
                      {r.vias.length ? `por ${r.vias.join(", ")} · ` : ""}conferida em {dataBr(r.atualizada)}
                    </span>
                  </th>
                  <td>{r.km.toLocaleString("pt-BR")} km</td>
                  <td>{r.pedagio ? `${formato.reais(r.pedagio)} / ${r.eixos} eixos` : "—"}</td>
                  <td className="calc-salvas-acoes">
                    {confirmar === r.id ? (
                      <>
                        <button type="button" className="calc-link calc-link-perigo" disabled={apagando} onClick={() => apagar(r.id)}>
                          {apagando ? "Apagando…" : "Confirmar"}
                        </button>
                        <button type="button" className="calc-link" disabled={apagando} onClick={() => setConfirmar(null)}>
                          Manter
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="calc-link" onClick={() => usar(r)}>
                          Usar
                        </button>
                        {podeApagar && (
                          <button type="button" className="calc-link calc-link-perigo" onClick={() => setConfirmar(r.id)} aria-label={`Apagar a rota ${r.origem} → ${r.destino}`}>
                            Apagar
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
