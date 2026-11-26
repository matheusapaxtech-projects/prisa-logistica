"use client";

import { useState } from "react";
import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { estadoVencimento, rotuloForma, sinalReceber, somarValores } from "@/lib/contas";
import { formato } from "@/lib/formato";
import type { Conta } from "../consultas";
import { MenuLinha, type ItemMenu } from "../contas-comum/menu-linha";
import type { CentroCusto } from "../pagar/consultas";
import type { OpcaoCliente, TipoReceita, TituloReceber } from "./consultas";
import { DialogoTitulo } from "./dialogo-conta";
import { DialogoCancelarTitulo, DialogoDesfazerRecebimento, DialogoReceber } from "./dialogo-receber";
import { acoesDoTitulo } from "./regras";
import { PARAMETROS_PADRAO, Simulador, type ParametrosTexto } from "./simulador";

type Props = {
  titulos: TituloReceber[];
  /** Hoje em Brasília ("aaaa-mm-dd"), vindo do servidor para o servidor e o navegador mostrarem o mesmo prazo. */
  hoje: string;
  contasBancarias: Conta[];
  clientes: OpcaoCliente[];
  tipos: TipoReceita[];
  centros: CentroCusto[];
  /** Frase do estado vazio (depende da aba e da busca). */
  vazio: string;
};

type Aberto = { tipo: "editar" | "receber" | "cancelar" | "desfazer"; titulo: TituloReceber } | null;

const COLUNAS = 7; // no celular sobram 4 (antecipar, cliente, valor, ações): ver `some-celular`
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const semCancelados = (itens: TituloReceber[]) => somarValores(itens.filter((t) => !t.canceladoEm));

function Linha({
  t,
  hoje,
  marcado,
  alternar,
  abrir,
}: {
  t: TituloReceber;
  hoje: string;
  marcado: boolean;
  alternar: (id: string) => void;
  abrir: (tipo: NonNullable<Aberto>["tipo"], titulo: TituloReceber) => void;
}) {
  const a = acoesDoTitulo(t, hoje);
  const cancelado = !!t.canceladoEm;
  const { estado, dias } = estadoVencimento(t.vencimento, hoje, a.receber);

  const itens: ItemMenu[] = [];
  if (a.editar) itens.push({ rotulo: "Editar", aoEscolher: () => abrir("editar", t) });
  if (a.desfazerRecebimento) itens.push({ rotulo: "Desfazer recebimento", aoEscolher: () => abrir("desfazer", t) });
  if (a.cancelar) itens.push({ rotulo: "Cancelar a conta", perigo: true, aoEscolher: () => abrir("cancelar", t) });

  const porque = a.antecipar ? undefined : a.receber ? "Já venceu: não entra na antecipação." : "Só títulos em aberto e ainda não vencidos entram na antecipação.";

  return (
    <tr className={cancelado ? "sem-link contas-cancelada" : "sem-link"}>
      <td className="contas-marcar">
        <input
          type="checkbox"
          checked={marcado}
          disabled={!a.antecipar}
          onChange={() => alternar(t.id)}
          aria-label={`Antecipar ${t.titulo}`}
          title={porque}
        />
      </td>
      <td className="col-desc">
        <span className="contas-desc">{t.clienteNome}</span>
        <span className="linha2">
          {t.titulo}
          <Ponto />
          {t.planoNome}
          {t.viagemId && (
            <>
              <Ponto />
              <Link href={`/viagens/${t.viagemId}`}>Viagem {t.viagemNumero}</Link>
            </>
          )}
          {cancelado && t.cancelamentoMotivo && (
            <>
              <Ponto />
              Motivo: {t.cancelamentoMotivo}
            </>
          )}
        </span>
        <span className="contas-mini so-celular">
          <span className="contas-mini-venc">
            {formato.data(t.vencimento)}
            <Ponto />
            {formato.dias(dias)}
          </span>
          <Sinal {...sinalReceber(t.situacao)} />
          <span>{rotuloForma(t.forma)}</span>
        </span>
      </td>
      <td className="some-celular">{rotuloForma(t.forma)}</td>
      <td className="contas-venc some-celular">
        <span className="contas-data">{formato.data(t.vencimento)}</span>
        {estado === "vencida" && <Sinal tipo="bloqueado" texto={formato.dias(dias)} />}
        {estado === "vencendo" && <Sinal tipo="vencendo" texto={formato.dias(dias)} />}
        {estado === "normal" && <span className="linha2">{formato.dias(dias)}</span>}
      </td>
      <td className="num contas-valor">{formato.reais(t.valor)}</td>
      <td className="some-celular">
        <Sinal {...sinalReceber(t.situacao)} />
        {t.recebidoEm && (
          <span className="linha2">
            Recebido em {curta(t.recebidoEm)}
            {t.recebidoPorNome && ` por ${t.recebidoPorNome}`}
          </span>
        )}
      </td>
      <td className="col-acao">
        <div className="contas-acoes">
          {a.receber && (
            <button className="btn btn-pequeno" type="button" onClick={() => abrir("receber", t)}>
              Receber
            </button>
          )}
          {itens.length > 0 && <MenuLinha rotulo={`Mais ações da conta ${t.numero}`} itens={itens} />}
        </div>
      </td>
    </tr>
  );
}

/* A lista de contas a receber: o total no pé, as ações de cada linha (receber, editar, desfazer, cancelar) e a caixa
   "Antecipar" dos títulos em aberto que ainda não venceram: o que for marcado vai para o simulador, embaixo da lista.
   A seleção mora aqui (não na URL) e só vale para títulos que continuam elegíveis depois de cada recarga. Os diálogos
   ficam fora da tabela. Cancelado aparece na lista, sem entrar nos totais. */
export function TabelaReceber({ titulos, hoje, contasBancarias, clientes, tipos, centros, vazio }: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const [marcadosIds, setMarcadosIds] = useState<ReadonlySet<string>>(new Set());
  // Taxa e tarifa ficam aqui: sobrevivem ao painel sumir quando o último título é desmarcado.
  const [parametros, setParametros] = useState<ParametrosTexto>(PARAMETROS_PADRAO);
  const abrir = (tipo: NonNullable<Aberto>["tipo"], titulo: TituloReceber) => setAberto({ tipo, titulo });
  const fechar = () => setAberto(null);

  // Só conta quem ainda existe na lista e ainda pode ser antecipado (a lista recarrega depois de cada ação).
  const marcados = titulos.filter((t) => marcadosIds.has(t.id) && acoesDoTitulo(t, hoje).antecipar);
  const alternar = (id: string) =>
    setMarcadosIds((antes) => {
      const depois = new Set(antes);
      if (depois.has(id)) depois.delete(id);
      else depois.add(id);
      return depois;
    });
  const temCancelado = titulos.some((t) => t.canceladoEm);
  const rotuloTotal = `Total da lista${temCancelado ? " (sem os cancelados)" : ""}`;

  return (
    <>
      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-contas" aria-label="Contas a receber">
          <thead>
            <tr>
              <th scope="col" className="contas-marcar">
                <span className="contas-marcar-rot">Antecipar</span>
              </th>
              <th scope="col">Cliente</th>
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
                Situação
              </th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {titulos.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={COLUNAS}>
                  <EstadoVazio>{vazio}</EstadoVazio>
                </td>
              </tr>
            ) : (
              titulos.map((t) => <Linha key={t.id} t={t} hoje={hoje} marcado={marcadosIds.has(t.id)} alternar={alternar} abrir={abrir} />)
            )}
          </tbody>
          {titulos.length > 0 && (
            <tfoot>
              <tr className="total">
                <th scope="row" colSpan={4} className="some-celular">
                  {rotuloTotal}
                </th>
                <th scope="row" colSpan={2} className="so-celular">
                  {rotuloTotal}
                </th>
                <td className="num">{formato.reais(semCancelados(titulos))}</td>
                <td className="some-celular" />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {marcados.length > 0 && <Simulador titulos={marcados} hoje={hoje} parametros={parametros} aoMudar={setParametros} aoLimpar={() => setMarcadosIds(new Set())} />}

      {aberto?.tipo === "editar" && <DialogoTitulo key={aberto.titulo.id} titulo={aberto.titulo} clientes={clientes} tipos={tipos} centros={centros} aoFechar={fechar} />}
      {aberto?.tipo === "receber" && <DialogoReceber key={aberto.titulo.id} titulo={aberto.titulo} contas={contasBancarias} aoFechar={fechar} />}
      {aberto?.tipo === "cancelar" && <DialogoCancelarTitulo key={aberto.titulo.id} titulo={aberto.titulo} aoFechar={fechar} />}
      {aberto?.tipo === "desfazer" && <DialogoDesfazerRecebimento key={aberto.titulo.id} titulo={aberto.titulo} aoFechar={fechar} />}
    </>
  );
}
