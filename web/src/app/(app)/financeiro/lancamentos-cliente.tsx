"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";
import { Sinal } from "@/components/Sinal";
import { toast } from "@/components/Toast";
import { formato } from "@/lib/formato";
import { CATEGORIAS, LISTA_CATEGORIAS, chaveDaDescricao, nomeDoMes, partesDaConta, sinalConfere, type Categoria } from "@/lib/financeiro";
import { classificarLancamento } from "./actions";
import type { Lancamento } from "./consultas";
import { dinheiro, SEM_CATEGORIA, type Classificado } from "./regras";

type Props = {
  mes: string;
  lancamentos: Lancamento[];
  /** `?ver=`: "" (todos), "sem" ou uma categoria. */
  filtro: string;
  busca: string;
  /** Lançamentos sem categoria fora deste mês, e o mês do mais antigo deles. */
  semCategoriaOutrosMeses: number;
  primeiroMesSemCategoria: string | null;
};

const LEMBRAR = "nilt.financeiro.lembrar";
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

function passa(l: Lancamento, categoria: Categoria | null, filtro: string, termo: string): boolean {
  if (filtro === SEM_CATEGORIA && categoria) return false;
  if (filtro && filtro !== SEM_CATEGORIA && categoria !== filtro) return false;
  if (!termo) return true;
  const t = chaveDaDescricao(termo);
  return (t && chaveDaDescricao(l.descricao).includes(t)) || l.descricao.toLowerCase().includes(termo.toLowerCase());
}

/** Aviso do que a gravação fez: a categoria, quantos parecidos foram junto, ou por que não virou regra. */
function avisoDaGravacao(nova: Categoria | null, r: Classificado): string {
  if (!nova) return "Categoria tirada.";
  const rot = CATEGORIAS[nova].rotulo;
  if (r.outros > 0) return `${rot}. Mais ${r.outros} ${plural(r.outros, "lançamento parecido", "lançamentos parecidos")} também.`;
  if (r.pediuRegra && !r.regra) return `${rot}. A descrição é genérica demais para virar regra; os parecidos ficam como estão.`;
  return `${rot}.`;
}

/** Categoria de uma linha: grava ao mudar e mostra a escolha na hora (otimista); quando a gravação
   termina, vale o que o servidor devolveu (em erro, o valor antigo volta sozinho e o aviso explica).
   O campo continua focável enquanto grava (`aria-disabled`, não `disabled`): o foco não se perde. */
function CelulaCategoria({ l, lembrar }: { l: Lancamento; lembrar: boolean }) {
  const [gravando, iniciar] = useTransition();
  const [valor, mostrar] = useOptimistic(l.categoria);
  return (
    <>
      <select
        className="sel-categoria"
        aria-label={`Categoria de “${l.descricao}”`}
        value={valor ?? ""}
        aria-disabled={gravando || undefined}
        data-vazio={valor ? undefined : ""}
        onChange={(e) => {
          if (gravando) return;
          const nova = (e.currentTarget.value || null) as Categoria | null;
          iniciar(async () => {
            mostrar(nova);
            const r = await classificarLancamento(l.id, nova ?? "", lembrar);
            if (!r.ok) toast(r.erro, "circle-alert");
            else toast(avisoDaGravacao(nova, r.dados));
          });
        }}
      >
        <option value="">Sem categoria</option>
        {LISTA_CATEGORIAS.map((c) => (
          <option key={c} value={c}>
            {CATEGORIAS[c].rotulo}
          </option>
        ))}
      </select>
      {valor && !sinalConfere(valor, l.valor) && (
        <span className="confira">
          <Sinal tipo="pendente" texto={l.valor < 0 ? "Confira: é uma saída" : "Confira: é uma entrada"} />
        </span>
      )}
    </>
  );
}

/* Aba Lançamentos: os lançamentos do mês com a categoria escolhida na própria linha. Busca e filtro
   pela URL (?q=, ?ver=); "Lembrar para os parecidos" grava a regra pela descrição (e fica guardado
   neste navegador). Depois de gravar, a página recarrega do servidor (revalidatePath). */
export function LancamentosCliente({ mes, lancamentos, filtro, busca, semCategoriaOutrosMeses, primeiroMesSemCategoria }: Props) {
  const [lembrar, setLembrar] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  const tabela = useRef<HTMLTableSectionElement>(null);
  // Linha do último campo usado: se ela sair da lista (filtro "Sem categoria"), o foco vai para a
  // linha que tomou o lugar dela, em vez de cair no começo da página.
  const ultimaLinha = useRef<number | null>(null);

  useEffect(() => {
    const i = ultimaLinha.current;
    const ativo = document.activeElement;
    if (i === null || (ativo && ativo !== document.body)) return;
    const campos = tabela.current?.querySelectorAll<HTMLSelectElement>("select.sel-categoria");
    if (campos?.length) campos[Math.min(i, campos.length - 1)].focus();
  }, [lancamentos]);

  useEffect(() => {
    try {
      // Preferência deste navegador: só existe depois que a página abriu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(LEMBRAR) === "nao") setLembrar(false);
    } catch {
      // sem armazenamento (janela anônima): fica ligado
    }
  }, []);

  // O filtro olha a categoria do servidor: a linha recém-classificada sai quando a página recarrega.
  const vis = lancamentos.filter((l) => passa(l, l.categoria, filtro, busca));
  const entradas = vis.reduce((s, l) => s + (l.valor > 0 ? Math.round(l.valor * 100) : 0), 0) / 100;
  const saidas = vis.reduce((s, l) => s + (l.valor < 0 ? Math.round(l.valor * 100) : 0), 0) / 100;
  const nome = nomeDoMes(mes);

  return (
    <>
      <form className="ferramentas" role="search" method="get" ref={form}>
        <input type="hidden" name="aba" value="lancamentos" />
        <input type="hidden" name="mes" value={mes} />
        <label className="busca-lista">
          <span className="sr-only">Buscar pelo histórico do lançamento</span>
          <Search size={16} strokeWidth={1.6} aria-hidden="true" />
          <input id="busca" name="q" type="search" autoComplete="off" placeholder="Histórico do lançamento" defaultValue={busca} />
        </label>
        <label className="sr-only" htmlFor="ver">
          Mostrar
        </label>
        <select id="ver" name="ver" defaultValue={filtro} onChange={() => form.current?.requestSubmit()}>
          <option value="">Todas as categorias</option>
          <option value={SEM_CATEGORIA}>Sem categoria</option>
          {LISTA_CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIAS[c].rotulo}
            </option>
          ))}
        </select>
        <label className="marcar lembrar" title="Grava a categoria para a mesma descrição (sem números) e classifica os parecidos que ainda estão sem categoria">
          <input
            type="checkbox"
            checked={lembrar}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              setLembrar(v);
              try {
                localStorage.setItem(LEMBRAR, v ? "sim" : "nao");
              } catch {
                // sem armazenamento: vale só nesta visita
              }
            }}
          />
          Lembrar para os parecidos
        </label>
        <span className="total" id="total" aria-live="polite">
          {vis.length} {plural(vis.length, "lançamento", "lançamentos")}
          {vis.length > 0 && (
            <span className="some-celular">
              <Ponto />
              entradas {dinheiro(entradas)}
              <Ponto />
              saídas {dinheiro(saidas)}
            </span>
          )}
        </span>
      </form>

      <div className="tabela-wrap">
        <table className="tabela tabela-prop tabela-lanc" aria-describedby="total">
          <thead>
            <tr>
              <th scope="col" className="col-data some-celular">
                Data
              </th>
              <th scope="col">Lançamento</th>
              <th scope="col" className="col-categoria">
                Categoria
              </th>
              <th scope="col" className="num col-valor">
                Valor
              </th>
            </tr>
          </thead>
          <tbody id="linhas" ref={tabela}>
            {vis.length === 0 ? (
              <tr className="vazio-linha">
                <td colSpan={4}>
                  <EstadoVazio>
                    {busca
                      ? `Nenhum lançamento com “${busca}” em ${nome}.`
                      : filtro === SEM_CATEGORIA
                        ? `Todos os lançamentos de ${nome} têm categoria.`
                        : filtro
                          ? `Nenhum lançamento de ${CATEGORIAS[filtro as Categoria].rotulo.toLowerCase()} em ${nome}.`
                          : `Nenhum lançamento em ${nome}. Importe o extrato desse mês.`}
                    {filtro === SEM_CATEGORIA && !busca && semCategoriaOutrosMeses > 0 && primeiroMesSemCategoria && (
                      <Link className="btn btn-texto" href={`/financeiro?aba=lancamentos&mes=${primeiroMesSemCategoria}&ver=${SEM_CATEGORIA}`} style={{ marginLeft: "auto" }}>
                        Ainda há {semCategoriaOutrosMeses} em outros meses: ir para {nomeDoMes(primeiroMesSemCategoria)}
                      </Link>
                    )}
                  </EstadoVazio>
                </td>
              </tr>
            ) : (
              vis.map((l, indice) => {
                return (
                  <tr key={l.id} className="sem-link" onFocus={() => (ultimaLinha.current = indice)}>
                    <td className="data some-celular">{formato.data(l.data)}</td>
                    <td className="col-desc">
                      <span className="desc">{l.descricao}</span>
                      <span className="linha2">
                        <span className="data-cel">
                          {formato.data(l.data)}
                          <Ponto />
                        </span>
                        {l.conta &&
                          partesDaConta(l.conta).map((p, i) => (
                            <Fragment key={i}>
                              {i > 0 && <Ponto />}
                              {p}
                            </Fragment>
                          ))}
                      </span>
                    </td>
                    <td>
                      <CelulaCategoria l={l} lembrar={lembrar} />
                    </td>
                    <td className="num valor">{dinheiro(l.valor)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
