/* Consultas das telas do Financeiro, sempre com o cliente do usuário (RLS: só admin e financeiro). */
import type { Banco } from "@/lib/banco";
import { limitesDoMes, type Categoria, type LinhaResumo } from "@/lib/financeiro";

/** A API devolve no máximo 1.000 linhas por vez: busca em páginas até acabar. */
async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const TAM = 1000;
  const saida: T[] = [];
  for (let de = 0; ; de += TAM) {
    const { data, error } = await pagina(de, de + TAM - 1);
    if (error) throw error;
    saida.push(...(data ?? []));
    if (!data || data.length < TAM) return saida;
  }
}

/* ---------- resumo ---------- */

/** Linhas de `fin_resumo_mensal` de um ano. */
export async function resumoDoAno(db: Banco, ano: number): Promise<LinhaResumo[]> {
  const linhas = await todas((de, ate) =>
    db.from("fin_resumo_mensal").select("mes, categoria, valor, quantidade").gte("mes", `${ano}-01`).lte("mes", `${ano}-12`).range(de, ate),
  );
  return linhas
    .filter((l) => l.mes)
    .map((l) => ({ mes: l.mes!, categoria: (l.categoria as Categoria | null) ?? null, valor: Number(l.valor ?? 0), quantidade: l.quantidade ?? 0 }));
}

/** Mês ("aaaa-mm") do lançamento mais recente; sem nenhum, null. */
export async function ultimoMesComLancamento(db: Banco): Promise<string | null> {
  const r = await db.from("fin_lancamento").select("data").order("data", { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw r.error;
  return r.data ? r.data.data.slice(0, 7) : null;
}

/** Quantos lançamentos estão sem categoria (todos os meses). */
export async function contarSemCategoria(db: Banco): Promise<number> {
  const r = await db.from("fin_lancamento").select("id", { count: "exact", head: true }).is("categoria", null);
  if (r.error) throw r.error;
  return r.count ?? 0;
}

/** Mês ("aaaa-mm") do lançamento sem categoria mais antigo; nenhum, null. */
export async function primeiroMesSemCategoria(db: Banco): Promise<string | null> {
  const r = await db.from("fin_lancamento").select("data").is("categoria", null).order("data").limit(1).maybeSingle();
  if (r.error) throw r.error;
  return r.data ? r.data.data.slice(0, 7) : null;
}

/* ---------- contas e saldo ---------- */

export type Conta = { id: string; banco: string; agencia: string; numero: string; apelido: string | null };

/** Contas que o lançamento à mão pode usar (as que vieram por OFX). */
export async function listarContas(db: Banco): Promise<Conta[]> {
  const r = await db.from("fin_conta").select("id, banco, agencia, numero, apelido").order("banco").order("numero");
  if (r.error) throw r.error;
  return r.data ?? [];
}

/** Saldo de cada conta no extrato mais recente até o fim do mês (o LEDGERBAL do OFX). */
export type SaldoConta = { conta: Conta; saldo: number; em: string };

export async function saldosAte(db: Banco, mes: string): Promise<SaldoConta[]> {
  const [, fim] = limitesDoMes(mes);
  // Uma linha por conta, escolhida no banco (fin_saldos_ate): sem o limite de linhas da API.
  const r = await db.rpc("fin_saldos_ate", { p_fim: fim });
  if (r.error) throw r.error;
  return (r.data ?? []).map((s) => ({
    conta: { id: s.conta_id, banco: s.banco, agencia: s.agencia, numero: s.numero, apelido: s.apelido },
    saldo: Number(s.saldo),
    em: s.saldo_em,
  }));
}

/* ---------- lançamentos ---------- */

export type Lancamento = {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  categoria: Categoria | null;
  conta: Conta | null;
  /** null = lançamento feito à mão (sem extrato). */
  importacaoId: string | null;
  observacao: string | null;
};

/** Lançamentos do mês, do mais antigo ao mais novo (como no extrato). */
export async function lancamentosDoMes(db: Banco, mes: string): Promise<Lancamento[]> {
  const [ini, fim] = limitesDoMes(mes);
  const linhas = await todas((de, ate) =>
    db
      .from("fin_lancamento")
      .select("id, data, valor, descricao, categoria, importacao_id, observacao, fin_conta(id, banco, agencia, numero, apelido)")
      .gte("data", ini)
      .lte("data", fim)
      .order("data")
      .order("created_at")
      .order("id")
      .range(de, ate),
  );
  return linhas.map((l) => ({
    id: l.id,
    data: l.data,
    valor: Number(l.valor),
    descricao: l.descricao,
    categoria: l.categoria,
    conta: l.fin_conta,
    importacaoId: l.importacao_id,
    observacao: l.observacao,
  }));
}

/* ---------- regras ---------- */

export type Regra = { id: string; chave: string; categoria: Categoria; criadaEm: string };

export async function listarRegras(db: Banco): Promise<Regra[]> {
  const linhas = await todas((de, ate) => db.from("fin_regra").select("id, chave, categoria, created_at").order("chave").range(de, ate));
  return linhas.map((r) => ({ id: r.id, chave: r.chave, categoria: r.categoria, criadaEm: r.created_at }));
}

/* ---------- importações ---------- */

export type Importacao = {
  id: string;
  nomeArquivo: string;
  conta: Conta | null;
  inicio: string | null;
  fim: string | null;
  total: number;
  novos: number;
  criadaEm: string;
  /** Nome de quem importou (perfil_usuario); null quando não se sabe. */
  quem: string | null;
  /** É a importação mais recente da conta? Só ela pode ser desfeita (ver `desfazerImportacao`). */
  ultimaDaConta: boolean;
};

export async function listarImportacoes(db: Banco, limite = 50): Promise<Importacao[]> {
  const r = await db
    .from("fin_importacao")
    .select("id, conta_id, nome_arquivo, inicio, fim, total, novos, created_at, created_by, fin_conta(id, banco, agencia, numero, apelido)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  if (r.error) throw r.error;
  const linhas = r.data ?? [];
  const ids = [...new Set(linhas.map((i) => i.created_by).filter((v): v is string => !!v))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const n = await db.rpc("nomes_usuarios", { p_ids: ids });
    // Sem os nomes a lista ainda serve: a coluna fica com "—".
    for (const u of n.data ?? []) nomes.set(u.user_id, u.nome);
  }
  return linhas.map((i) => ({
    id: i.id,
    nomeArquivo: i.nome_arquivo,
    conta: i.fin_conta,
    inicio: i.inicio,
    fim: i.fim,
    total: i.total,
    novos: i.novos,
    criadaEm: i.created_at,
    quem: i.created_by ? (nomes.get(i.created_by) ?? null) : null,
    // A lista vem da mais nova para a mais antiga: a primeira de cada conta é a mais recente.
    ultimaDaConta: linhas.findIndex((x) => x.conta_id === i.conta_id) === linhas.indexOf(i),
  }));
}
