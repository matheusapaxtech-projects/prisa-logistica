"use client";

import { Fragment, useState, useTransition } from "react";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { definirAtivo } from "./actions";
import { DialogoDesativar, DialogoRenomear } from "./dialogo-centro";
import type { CentroLinha, Departamento } from "./regras";

type Props = {
  arvore: Departamento[];
  /** Contas a pagar em aberto por centro, como pares `[id do centro, quantidade]` (vem do servidor). */
  uso: [number, number][];
  /** Só o administrador vê "Renomear" e "Desativar". */
  admin: boolean;
  vazio: string;
};

type Aberto = { tipo: "renomear" | "desativar"; centro: CentroLinha } | null;

/* Lista em árvore: cada departamento seguido dos seus subdepartamentos, com a situação, o uso (contas a pagar em
   aberto) e, para o administrador, as ações da linha. Depois de gravar, a Server Action revalida a página. */
export function ListaCentros({ arvore, uso, admin, vazio }: Props) {
  const usos = new Map(uso);
  const [aberto, setAberto] = useState<Aberto>(null);
  const [gravando, iniciar] = useTransition();

  function reativar(c: CentroLinha) {
    iniciar(async () => {
      const r = await definirAtivo(c.id, true);
      if (r.ok) toast("Centro de custo reativado.");
      else toast(r.erro, "alert-circle");
    });
  }

  function linha(c: CentroLinha, sub: boolean) {
    const n = usos.get(c.id) ?? 0;
    return (
      <tr key={c.id} className={`${sub ? "centros-sub" : "centros-depto"}${c.ativo ? "" : " centros-desligado"}`}>
        <td>
          <span className="cod centros-codigo">{c.codigo}</span>
        </td>
        <td className="centros-nome">{c.nome}</td>
        <td>{c.ativo ? <Sinal tipo="normal" texto="Ativo" /> : <Sinal tipo="neutro" texto="Desativado" />}</td>
        <td className="centros-uso">{n > 0 ? `${n} ${n === 1 ? "conta a pagar em aberto" : "contas a pagar em aberto"}` : "—"}</td>
        {admin && (
          <td className="col-acao">
            <div className="centros-acoes">
              <button className="btn btn-texto btn-pequeno" type="button" onClick={() => setAberto({ tipo: "renomear", centro: c })}>
                Renomear
              </button>
              {c.ativo ? (
                <button className="btn btn-texto btn-pequeno" type="button" onClick={() => setAberto({ tipo: "desativar", centro: c })}>
                  Desativar
                </button>
              ) : (
                <button className="btn btn-texto btn-pequeno" type="button" disabled={gravando} onClick={() => reativar(c)}>
                  Reativar
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  return (
    <>
      <div className="tabela-wrap">
        <table className="tabela tabela-centros">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nome</th>
              <th scope="col">Situação</th>
              <th scope="col">Uso</th>
              {admin && (
                <th scope="col" className="col-acao">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {arvore.length === 0 ? (
              <tr>
                <td colSpan={admin ? 5 : 4}>
                  <div className="vazio-bloco">{vazio}</div>
                </td>
              </tr>
            ) : (
              arvore.map((d) => (
                <Fragment key={d.id}>
                  {linha(d, false)}
                  {d.subs.map((s) => linha(s, true))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {aberto?.tipo === "renomear" && <DialogoRenomear key={aberto.centro.id} centro={aberto.centro} aoFechar={() => setAberto(null)} />}
      {aberto?.tipo === "desativar" && <DialogoDesativar key={aberto.centro.id} centro={aberto.centro} aoFechar={() => setAberto(null)} />}
    </>
  );
}
