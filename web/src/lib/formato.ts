/* Formatos de exibição e máscaras de campo. Porta 1:1 de `N.fmt` e `mascaras`
   (prototipo/assets/nilt.js). As máscaras ficam aqui (e não em validacao.ts) porque
   são formatação; `soDigitos` vem de validacao.ts. */
import { validacao } from "@/lib/validacao";

const { soDigitos: so, normalizarPlaca } = validacao;

type Nulo = string | null | undefined;

/** Pessoa mínima para `formato.doc`: tipo 'pf' (CPF) ou 'pj' (CNPJ). */
export type PessoaDoc = { tipo: string; cpf?: Nulo; cnpj?: Nulo };

function cpf(v: Nulo): string {
  const d = so(v);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : v || "";
}

function cnpj(v: Nulo): string {
  const d = so(v);
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : v || "";
}

function telefone(v: Nulo): string {
  const d = so(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v || "";
}

function cep(v: Nulo): string {
  const d = so(v);
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : v || "";
}

/** Coluna `date` (string ISO "yyyy-mm-dd") → dd/mm/aaaa; vazio → travessão.
   Só corta os 10 primeiros caracteres, sem converter fuso: para `timestamptz` use `dataHora`. */
function data(iso: Nulo): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Fuso fixo de exibição: o servidor (UTC) e o navegador têm de mostrar o mesmo horário. */
const FUSO = "America/Sao_Paulo";

/** Instante (`timestamptz` em ISO) → "dd/mm/aaaa hh:mm" no horário de Brasília,
   independente do fuso do runtime. */
function dataHora(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { timeZone: FUSO }) +
    " " +
    d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  );
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 5 dias". Conta o tempo decorrido (não o dia do
   calendário), por isso não depende de fuso. */
function relativo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Toneladas: "37,2 t". */
function t(n: number | null | undefined): string {
  return n == null
    ? "—"
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " t";
}

/** Metros: "14,60 m". */
function m(n: number | null | undefined): string {
  return n == null
    ? "—"
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m";
}

/** Tamanho de arquivo: "412 kB" ou "1,8 MB". */
function kb(b: number): string {
  return b >= 1e6
    ? (b / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " MB"
    : Math.round(b / 1e3) + " kB";
}

/** Prazo em dias (negativo = vencido). */
function dias(n: number): string {
  if (n === 0) return "vence hoje";
  if (n > 0) return n === 1 ? "vence amanhã" : `vence em ${n} dias`;
  return n === -1 ? "venceu ontem" : `venceu há ${-n} dias`;
}

export const formato = {
  cpf,
  cnpj,
  doc: (p: PessoaDoc): string => (p.tipo === "pj" ? cnpj(p.cnpj) : cpf(p.cpf)),
  telefone,
  cep,
  data,
  dataHora,
  relativo,
  t,
  m,
  kb,
  dias,
};

/* ---------- máscaras de campo ----------
   Recebem o texto digitado (só os dígitos são considerados, exceto em `placa`) e devolvem o
   texto mascarado, para uso no onChange dos campos. */
export const mascaras = {
  cpf: (v: string): string =>
    so(v)
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4"),
  cnpj: (v: string): string =>
    so(v)
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2"),
  telefone: (v: string): string => {
    const d = so(v).slice(0, 11);
    return d.length > 10
      ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
      : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/[-\s(]+$/, "");
  },
  cep: (v: string): string => so(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"),
  /** Placa: maiúsculas, sem símbolos, até 7 caracteres. */
  placa: (v: string): string => normalizarPlaca(v).slice(0, 7),
  digitos: (v: string): string => so(v),
};
