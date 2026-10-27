"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { agrupar as agruparContas, estadoVencimento, fraseRetencao, ROTULO_ORIGEM, rotuloForma, sinalAprovacao, somarValores } from "@/lib/contas";
import type { Conta } from "../consultas";
import { formato } from "@/lib/formato";
import { MenuLinha, type ItemMenu } from "../contas-comum/menu-linha";
import { aprovar, desaprovar } from "./actions";
import type { CentroCusto, ContaPagar, TipoDespesa } from "./consultas";
import { DialogoConta } from "./dialogo-conta";
import { DialogoDesfazerPagamento, DialogoMotivoPagar, DialogoPagar } from "./dialogo-pagar";
import { acoesDaConta, chaveCentro, chaveTipo, type Agrupamento } from "./regras";

type Props = {
  contas: ContaPagar[];
  agrupar: Agrupamento;
  /** Hoje em Brasília ("aaaa-mm-dd"), vindo do servidor para o servidor e o navegador mostrarem o mesmo prazo. */
  hoje: string;
  usuario: { userId: string; admin: boolean };
  contasBancarias: Conta[];
  tipos: TipoDespesa[];
  centros: CentroCusto[];
  /** Frase do estado vazio (depende da aba e da busca). */
  vazio: string;
};

type Aberto = { tipo: "editar" | "pagar" | "cancelar" | "liberar" | "desfazer"; conta: ContaPagar } | null;

const COLUNAS = 6; // no celular sobram 3 (descrição, valor, ações): ver `some-celular`
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const semCanceladas = (itens: ContaPagar[]) => somarValores(itens.filter((c) => !c.canceladoEm));

function Linha({
  c,
  hoje,
  usuario,
  abrir,
}: {
  c: ContaPagar;
  hoje: string;
  usuario: Props["usuario"];
  abrir: (tipo: NonNullable<Aberto>["tipo"], conta: ContaPagar) => void;
}) {
  const [pendente, iniciar] = useTransition();
  const a = acoesDaConta(c, usuario);
  const cancelada = !!c.canceladoEm;
  const { estado, dias } = estadoVencimento(c.vencimento, hoje, !c.canceladoEm && !c.pagoEm);

  /** Roda uma ação do banco e conta o resultado num aviso (a lista recarrega sozinha em caso de sucesso). */
  function rodar(acao: () => Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>, sucesso: string) {
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) toast(r.erro, "circle-alert");
      else toast(sucesso);
    });
  }

  const itens: ItemMenu[] = [];
  if (a.editar) itens.push({ rotulo: "Editar", desabilitado: pendente, aoEscolher: () => abrir("editar", c) });
  if (a.desaprovar) itens.push({ rotulo: "Desfazer aprovação", desabilitado: pendente, aoEscolher: () => rodar(() => desaprovar(c.id), "Aprovação desfeita.") });
  if (a.liberar) itens.push({ rotulo: "Liberar antecipação", desabilitado: pendente, aoEscolher: () => abrir("liberar", c) });
  if (a.desfazerPagamento) itens.push({ rotulo: "Desfazer pagamento", desabilitado: pendente, aoEscolher: () => abrir("desfazer", c) });
  if (a.cancelar) itens.push({ rotulo: "Cancelar a conta", desabilitado: pendente, perigo: true, aoEscolher: () => abrir("cancelar", c) });

  return (
    <tr className={cancelada ? "sem-link contas-cancelada" : "sem-link"} aria-busy={pendente || undefined}>
      <td className="col-desc">
        <span className="contas-desc">{c.descricao}</span>
        <span className="linha2">
          {c.favorecidoNome}
          {c.origem !== "manual" && (
            <>
              <Ponto />
              {ROTULO_ORIGEM[c.origem]}
            </>
          )}
          {c.viagemId && (
            <>
              <Ponto />
              <Link href={`/viagens/${c.viagemId}`}>Viagem {c.viagemNumero}</Link>
            </>
          )}
          {c.antecipacaoLiberadaEm && !cancelada && (
            <>
              <Ponto />
              <span title={c.antecipacaoMotivo ?? undefined}>Antecipação liberada</span>
            </>
          )}
          {c.parteRetencao > 0 && !cancelada && (
            <>
              <Ponto />
              {fraseRetencao(c.parteRetencao)}
            </>
          )}
          {cancelada && c.cancelamentoMotivo && (
            <>
              <Ponto />
              Motivo: {c.cancelamentoMotivo}
            </>
          )}
        </span>
        <span className="contas-mini so-celular">
          <span className="contas-mini-venc">
            {formato.data(c.vencimento)}
            <Ponto />
            {formato.dias(dias)}
          </span>
          <Sinal {...sinalAprovacao(c, estado === "vencida" ? dias : null)} />
          <span>{rotuloForma(c.forma)}</span>
        </span>
      </td>
      <td className="some-celular">{rotuloForma(c.forma)}</td>
      <td className="contas-venc some-celular">
        <span className="contas-data">{formato.data(c.vencimento)}</span>
        {estado === "vencida" && <Sinal tipo="bloqueado" texto={formato.dias(dias)} />}
        {estado === "vencendo" && <Sinal tipo="vencendo" texto={formato.dias(dias)} />}
        {estado === "normal" && <span className="linha2">{formato.dias(dias)}</span>}
      </td>
      <td className="num contas-valor">{formato.reais(c.valor)}</td>
      <td className="some-celular">
        <Sinal {...sinalAprovacao(c, estado === "vencida" ? dias : null)} />
        <span className="linha2">
          {c.pagoEm ? (
            <>
              Paga em {curta(c.pagoEm)}
              {c.pagoPorNome && ` por ${c.pagoPorNome}`}
            </>
          ) : (
            <>
              Lançada{c.lancadoPorNome && ` por ${c.lancadoPorNome}`}
              {c.aprovadoEm && (
                <>
                  <Ponto />
                  aprovada{c.aprovadoPorNome && ` por ${c.aprovadoPorNome}`}
                </>
              )}
            </>
          )}
        </span>
      </td>
      <td className="col-acao">
        <div className="contas-acoes">
          {a.aprovar && (
            <button className="btn btn-pequeno" type="button" disabled={pendente} onClick={() => rodar(() => aprovar(c.id, c.versao), "Conta aprovada.")}>
              Aprovar
            </button>
          )}
          {a.esperarOutro && <span className="nota">Outra pessoa aprova</span>}
          {a.pagar && (
            <button className="btn btn-pequeno" type="button" onClick={() => abrir("pagar", c)}>
              Pagar
            </button>
          )}
          {itens.length > 0 && <MenuLinha rotulo={`Mais ações da conta ${c.numero}`} itens={itens} />}
        </div>
      </td>
    </tr>
  );
}

/* A lista de contas a pagar: com o agrupamento escolhido na URL (centro de custo, tipo de despesa ou sem agrupar),
   o total no pé e as ações de cada linha (aprovar, pagar, editar, desfazer, cancelar). Os diálogos ficam aqui, fora
   da tabela. Depois de cada ação a página recarrega do servidor (revalidatePath). Cancelada aparece na lista, sem
   entrar nos totais. */
export function TabelaPagar({ contas, agrupar, hoje, usuario, contasBancarias, tipos, centros, vazio }: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const abrir = (tipo: NonNullable<Aberto>["tipo"], conta: ContaPagar) => setAberto({ tipo, conta });
  const fechar = () => setAberto(null);

  const grupos = agrupar === "nenhum" ? null : agruparContas(contas, agrupar === "centro" ? chaveCentro : chaveTipo);
  const temCancelada = contas.some((c) => c.canceladoEm);
  const rotuloTotal = `Total da lista${temCancelada ? " (sem as canceladas)" : ""}`;
  const linha = (c: ContaPagar) => <Linha key={c.id} c={c} hoje={hoje} usuario={usuario} abrir={abrir} />;

  return (
    <>
      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-contas" aria-label="Contas a pagar">
          <thead>
            <tr>
              <th scope="col">Descrição</th>
              <th scope="col" className="some-celular">
                Forma
              </th>
              <th scope="col" className="some-celular">
                Vencimento
              </th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col" className="some-celular">
                Aprovação
              </th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contas.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={COLUNAS}>
                  <EstadoVazio>{vazio}</EstadoVazio>
                </td>
              </tr>
            ) : grupos ? (
              grupos.map((g) => {
                const rotuloGrupo = (
                  <>
                    {g.rotulo}
                    <span className="contas-grupo-qtd">
                      {g.itens.length} {g.itens.length === 1 ? "conta" : "contas"}
                    </span>
                  </>
                );
                return (
                  <Fragment key={g.id}>
                    <tr className="contas-grupo sem-link">
                      <th scope="rowgroup" colSpan={3} className="some-celular">
                        {rotuloGrupo}
                      </th>
                      <th scope="rowgroup" className="so-celular">
                        {rotuloGrupo}
                      </th>
                      <td className="num">{formato.reais(semCanceladas(g.itens))}</td>
                      <td className="some-celular" />
                      <td />
                    </tr>
                    {g.itens.map(linha)}
                  </Fragment>
                );
              })
            ) : (
              contas.map(linha)
            )}
          </tbody>
          {contas.length > 0 && (
            <tfoot>
              <tr className="total">
                <th scope="row" colSpan={3} className="some-celular">
                  {rotuloTotal}
                </th>
                <th scope="row" className="so-celular">
                  {rotuloTotal}
                </th>
                <td className="num">{formato.reais(semCanceladas(contas))}</td>
                <td className="some-celular" />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {aberto?.tipo === "editar" && <DialogoConta key={aberto.conta.id} conta={aberto.conta} tipos={tipos} centros={centros} aoFechar={fechar} />}
      {aberto?.tipo === "pagar" && <DialogoPagar key={aberto.conta.id} conta={aberto.conta} contas={contasBancarias} aoFechar={fechar} />}
      {aberto?.tipo === "desfazer" && <DialogoDesfazerPagamento key={aberto.conta.id} conta={aberto.conta} aoFechar={fechar} />}
      {(aberto?.tipo === "cancelar" || aberto?.tipo === "liberar") && (
        <DialogoMotivoPagar key={`${aberto.tipo}-${aberto.conta.id}`} tipo={aberto.tipo} conta={aberto.conta} aoFechar={fechar} />
      )}
    </>
  );
}
