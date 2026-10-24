/* Regras puras do financeiro (servidor, tela e testes): categorias, chave de descrição para as regras
   aprendidas, conferência do sinal e o resultado por mês montado a partir de `fin_resumo_mensal`. */

/** Categoria de lançamento (enum `fin_categoria`), na ordem da tela. */
export const CATEGORIAS = {
  receita_frete: { rotulo: "Receita de frete", sentido: "entrada" },
  pagamento_frete: { rotulo: "Pagamento de frete", sentido: "saida" },
  despesa: { rotulo: "Despesa", sentido: "saida" },
  emprestimo: { rotulo: "Empréstimo", sentido: "entrada" },
  devolucao_emprestimo: { rotulo: "Devolução de empréstimo", sentido: "saida" },
  aporte_capital: { rotulo: "Aporte de capital", sentido: "entrada" },
  devolucao_capital: { rotulo: "Devolução de capital", sentido: "saida" },
  transferencia: { rotulo: "Transferência entre contas", sentido: "ambos" },
} as const;

export type Categoria = keyof typeof CATEGORIAS;
export const LISTA_CATEGORIAS = Object.keys(CATEGORIAS) as Categoria[];

export function ehCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && v in CATEGORIAS;
}

/**
 * Descrição do banco → chave das regras: maiúsculas, sem acento, sem números nem símbolos, sem letras
 * soltas. "PIX ENVIADO - João Silva 12/10" → "PIX ENVIADO JOAO SILVA". Assim o mesmo favorecido casa
 * em meses diferentes (a data, o documento e o valor mudam; o nome não).
 */
export function chaveDaDescricao(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .split(" ")
    .filter((p) => p.length > 1)
    .join(" ")
    .slice(0, 120)
    .trim();
}

/** O sinal do valor bate com a categoria? Receita com valor de saída (ou o contrário) pede conferência. */
export function sinalConfere(categoria: Categoria, valor: number): boolean {
  const s = CATEGORIAS[categoria].sentido;
  if (s === "ambos" || valor === 0) return true;
  return s === "entrada" ? valor > 0 : valor < 0;
}

/* ---------- meses ---------- */

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTOS_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-10" é um mês? */
export function mesValido(v: unknown): v is string {
  return typeof v === "string" && RE_MES.test(v);
}

/** Mês de hoje em Brasília, "aaaa-mm". */
export function mesDeHoje(agora = new Date()): string {
  // en-CA escreve a data como "aaaa-mm".
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora);
}

/** "2026-10" + n meses (n pode ser negativo). */
export function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" → "outubro de 2026". */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1]} de ${a}`;
}

/** "2026-10" → "out". */
export function mesCurto(mes: string): string {
  return CURTOS_MES[Number(mes.slice(5, 7)) - 1];
}

/** Os 12 meses do ano: "2026-01" … "2026-12". */
export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

/** Primeiro e último dia do mês ("2026-02" → ["2026-02-01", "2026-02-28"]). */
export function limitesDoMes(mes: string): [string, string] {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${mes}-01`, `${mes}-${String(ultimo).padStart(2, "0")}`];
}

/* ---------- resultado ---------- */

/** Uma linha de `fin_resumo_mensal`. */
export type LinhaResumo = { mes: string; categoria: Categoria | null; valor: number; quantidade: number };

/** Resultado de um período (valores com sinal: entrada +, saída −). */
export type Resultado = {
  receitaFrete: number;
  pagamentoFrete: number;
  /** Receita menos pagamento do frete. */
  margemFrete: number;
  despesa: number;
  /** Margem do frete menos despesas: o que a operação deixou no período. */
  resultado: number;
  emprestimo: number;
  devolucaoEmprestimo: number;
  aporteCapital: number;
  devolucaoCapital: number;
  transferencia: number;
  semCategoria: number;
  semCategoriaQtd: number;
  /** Soma de tudo: quanto o caixa mudou no período. */
  variacaoCaixa: number;
  quantidade: number;
};

const centavos = (n: number) => Math.round(n * 100);
const reais = (c: number) => c / 100;

/** Soma as linhas do resumo (de um mês, de um ano ou de qualquer seleção) num resultado. */
export function somarResultado(linhas: LinhaResumo[]): Resultado {
  const c: Record<Categoria | "sem", number> = {
    receita_frete: 0,
    pagamento_frete: 0,
    despesa: 0,
    emprestimo: 0,
    devolucao_emprestimo: 0,
    aporte_capital: 0,
    devolucao_capital: 0,
    transferencia: 0,
    sem: 0,
  };
  let semQtd = 0;
  let quantidade = 0;
  for (const l of linhas) {
    c[l.categoria ?? "sem"] += centavos(Number(l.valor));
    quantidade += l.quantidade;
    if (!l.categoria) semQtd += l.quantidade;
  }
  const margem = c.receita_frete + c.pagamento_frete;
  const resultado = margem + c.despesa;
  const variacao = Object.values(c).reduce((s, v) => s + v, 0);
  return {
    receitaFrete: reais(c.receita_frete),
    pagamentoFrete: reais(c.pagamento_frete),
    margemFrete: reais(margem),
    despesa: reais(c.despesa),
    resultado: reais(resultado),
    emprestimo: reais(c.emprestimo),
    devolucaoEmprestimo: reais(c.devolucao_emprestimo),
    aporteCapital: reais(c.aporte_capital),
    devolucaoCapital: reais(c.devolucao_capital),
    transferencia: reais(c.transferencia),
    semCategoria: reais(c.sem),
    semCategoriaQtd: semQtd,
    variacaoCaixa: reais(variacao),
    quantidade,
  };
}

/** Margem do frete sobre a receita, em %, com uma casa; sem receita → null. */
export function percentualMargem(r: Pick<Resultado, "receitaFrete" | "margemFrete">): number | null {
  if (r.receitaFrete <= 0) return null;
  return Math.round((r.margemFrete / r.receitaFrete) * 1000) / 10;
}

/** O resultado de cada mês do ano e o total do ano. */
export function resultadoDoAno(linhas: LinhaResumo[], ano: number): { meses: { mes: string; r: Resultado }[]; total: Resultado } {
  const meses = mesesDoAno(ano).map((mes) => ({ mes, r: somarResultado(linhas.filter((l) => l.mes === mes)) }));
  return { meses, total: somarResultado(linhas.filter((l) => l.mes.startsWith(`${ano}-`))) };
}

/* ---------- bancos ---------- */

const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "041": "Banrisul",
  "077": "Inter",
  "085": "Ailos",
  "104": "Caixa",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "403": "Cora",
  "422": "Safra",
  "748": "Sicredi",
  "756": "Sicoob",
};

/** "341" → "Itaú"; código desconhecido → "Banco 999". */
export function nomeDoBanco(codigo: string): string {
  return BANCOS[codigo] ?? (/^\d+$/.test(codigo) ? `Banco ${codigo}` : codigo);
}

/** "Itaú · ag. 1234 · c/c 56789-0" sem o ponto (a tela põe os separadores); apelido, se houver, na frente. */
export function partesDaConta(c: { banco: string; agencia: string; numero: string; apelido?: string | null }): string[] {
  return [c.apelido || nomeDoBanco(c.banco), ...(c.agencia ? [`ag. ${c.agencia}`] : []), `conta ${c.numero}`];
}
