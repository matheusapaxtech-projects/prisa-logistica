"use client";

import { useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { Dialogo } from "@/components/Dialogo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { CATEGORIAS, chaveDaDescricao } from "@/lib/financeiro";
import { apagarRegra } from "./actions";
import type { Regra } from "./consultas";

const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

/* Aba Regras: o que o NILT aprendeu ("descrição parecida → categoria"). Nascem na aba Lançamentos com
   "Lembrar para os parecidos" e valem na importação seguinte; apagar não muda o que já foi classificado. */
export function RegrasCliente({ regras }: { regras: Regra[] }) {
  const [termo, setTermo] = useState("");
  const [apagando, setApagando] = useState<Regra | null>(null);
  const [gravando, iniciar] = useTransition();
  const t = chaveDaDescricao(termo);
  const vis = t ? regras.filter((r) => r.chave.includes(t)) : regras;

  return (
    <>
      <p className="explica-aba">
        Quando você escolhe a categoria de um lançamento com “Lembrar para os parecidos” ligado, o NILT guarda a descrição sem números e
        passa a classificar sozinho, na importação, todo lançamento que contém essa descrição. Se duas regras servem, vale a mais longa.
      </p>

      <div className="ferramentas" role="search">
        <label className="busca-lista">
          <span className="sr-only">Buscar regra pela descrição</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input type="search" autoComplete="off" placeholder="Descrição" value={termo} onChange={(e) => setTermo(e.currentTarget.value)} />
        </label>
        <span className="total" id="total-regras" aria-live="polite">
          {vis.length} {plural(vis.length, "regra", "regras")}
        </span>
      </div>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-regras" aria-describedby="total-regras">
          <thead>
            <tr>
              <th scope="col">Descrição que contém</th>
              <th scope="col">Categoria</th>
              <th scope="col" className="num some-celular">
                Criada em
              </th>
              <th scope="col" className="col-acao">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={4}>
                  <EstadoVazio>
                    {termo ? `Nenhuma regra com “${termo}”.` : "Nenhuma regra ainda. Elas nascem quando você classifica um lançamento na aba Lançamentos."}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((r) => (
                <tr key={r.id} className="sem-link">
                  <td className="col-desc">
                    <span className="desc">{r.chave}</span>
                  </td>
                  <td>{CATEGORIAS[r.categoria].rotulo}</td>
                  <td className="num data some-celular">{formato.dataHora(r.criadaEm)}</td>
                  <td className="col-acao">
                    <button className="btn btn-texto btn-icone" type="button" aria-label={`Apagar a regra “${r.chave}”`} title="Apagar a regra" onClick={() => setApagando(r)}>
                      <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialogo
        aberto={!!apagando}
        aoFechar={() => setApagando(null)}
        titulo="Apagar a regra?"
        onSubmit={(e) => {
          e.preventDefault();
          const r = apagando;
          if (!r) return;
          iniciar(async () => {
            const res = await apagarRegra(r.id);
            if (!res.ok) {
              toast(res.erro, "circle-alert");
              return;
            }
            setApagando(null);
            toast("Regra apagada.", "trash-2");
          });
        }}
        pe={
          <>
            <button className="btn" type="button" data-fechar>
              Cancelar
            </button>
            <button className="btn btn-perigo" type="submit" disabled={gravando}>
              {gravando ? "Apagando…" : "Apagar regra"}
            </button>
          </>
        }
      >
        {apagando && (
          <p>
            Os próximos lançamentos com “<b>{apagando.chave}</b>” chegam sem categoria. Os que já estão como {CATEGORIAS[apagando.categoria].rotulo.toLowerCase()}{" "}
            continuam como estão.
          </p>
        )}
      </Dialogo>
    </>
  );
}
