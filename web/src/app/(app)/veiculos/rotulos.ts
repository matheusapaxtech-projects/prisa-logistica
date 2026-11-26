/* Listas e rótulos das telas de veículo (as listas de apoio de prototipo/assets/paginas/veiculos.js).
   As tabelas de apoio (tipo, marca, operadora de TAG, unidade) vêm do banco; aqui ficam só os enums
   do banco, na ordem da tela do ATUA, e as funções de leitura. Puro: serve a Server e Client Components. */
import type { Database } from "@/lib/banco";

type Enums = Database["public"]["Enums"];

export type CategoriaVeiculo = Enums["categoria_veiculo"];
export type SituacaoOperacional = Enums["situacao_operacional"];
export type SituacaoCadastro = Enums["situacao_cadastro"];

export const CATEGORIAS: Record<CategoriaVeiculo, string> = {
  cavalo: "Cavalo",
  carreta: "Carreta",
  dolly: "Dolly",
  caminhao: "Caminhão",
  outros: "Outros",
};

export const SITUACAO_OPERACIONAL: [SituacaoOperacional, string][] = [
  ["ag_motorista", "Aguardando motorista"],
  ["apreendido", "Apreendido"],
  ["arrendado", "Arrendado"],
  ["ativo", "Ativo"],
  ["a_venda", "À venda"],
  ["devolvido", "Devolvido"],
  ["parado", "Parado"],
  ["sinistro", "Sinistro"],
  ["vendido", "Vendido"],
];
export const SITUACAO_CADASTRO: [SituacaoCadastro, string][] = [
  ["normal", "Normal"],
  ["pendente", "Pendente"],
  ["cancelado", "Cancelado"],
];
export const RECEBEDOR: [Enums["recebedor_valores"], string][] = [
  ["motorista", "Motorista"],
  ["proprietario", "Proprietário"],
  ["posto", "Posto (CF)"],
];
export const ASSOALHO: [Enums["tipo_assoalho"], string][] = [
  ["madeira", "Madeira"],
  ["ferro", "Ferro"],
  ["misto", "Misto"],
];
/** Carroceria da carreta ou do caminhão: o frete publicado no app do motorista pode exigir uma delas. */
export const CARROCERIA: [Enums["tipo_carroceria"], string][] = [
  ["graneleiro", "Graneleiro"],
  ["basculante", "Basculante"],
  ["cacamba", "Caçamba"],
  ["bau", "Baú"],
  ["sider", "Sider"],
  ["grade_baixa", "Grade baixa"],
  ["prancha", "Prancha"],
  ["tanque", "Tanque"],
  ["frigorifico", "Frigorífico"],
  ["porta_container", "Porta-contêiner"],
  ["boiadeiro", "Boiadeiro"],
  ["cegonha", "Cegonha"],
  ["outro", "Outra"],
];
export const RASTREAMENTO: [Enums["tipo_rastreamento"], string][] = [
  ["telemonitorado", "Telemonitorado"],
  ["rastreador", "Rastreador"],
  ["localizador", "Localizador"],
];
export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
  "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
export const ENQUADRAMENTO: Record<Enums["enquadramento_antt"], string> = {
  tac: "TAC",
  etc: "ETC",
  ctc: "CTC",
  etc_equiparado: "ETC equiparado",
};
/** Tipos de arquivo de veículo oferecidos no envio já vêm de `tipo_arquivo` (aplica_veiculo). */

const ACENTOS: Record<string, string> = {
  BAU: "baú",
  CAMINHAO: "caminhão",
  TRACAO: "tração",
  FURGAO: "furgão",
  CONTEINER: "contêiner",
};

export type TipoVeiculo = {
  id: number;
  nome: string;
  categoria: CategoriaVeiculo;
  eixos: number;
  configuracao_cavalo: "toco" | "trucado" | null;
};

/** "Cavalo trucado", "Dolly", "Carreta graneleiro trucada" (`rotuloTipo` do protótipo). */
export function rotuloTipo(t: Pick<TipoVeiculo, "nome" | "categoria" | "configuracao_cavalo">): string {
  if (t.categoria === "cavalo") return t.configuracao_cavalo === "trucado" ? "Cavalo trucado" : "Cavalo toco";
  if (t.categoria === "dolly") return "Dolly";
  const s = t.nome
    .replace(/\s*-\s*\d EIXOS$/, "")
    .split(" ")
    .map((w) => ACENTOS[w] ?? w.toLowerCase())
    .join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nome do tipo na lista de escolha: o do ATUA, só com os acentos de volta (`nomeTipoLista`). */
export function nomeTipoLista(nome: string): string {
  return nome
    .split(" ")
    .map((w) => (ACENTOS[w] ? ACENTOS[w].toUpperCase() : w))
    .join(" ");
}

/** "SCANIA" → "Scania", "MERCEDES-BENZ" → "Mercedes-Benz"; até 3 letras (GM, DAF, MAN) ficam como estão. */
export function marcaCurta(m: string | null | undefined): string {
  if (!m) return "";
  if (m.length <= 3) return m;
  return m.charAt(0) + m.slice(1).toLowerCase().replace(/-(\w)/, (_, c: string) => "-" + c.toUpperCase());
}

export function rotuloSituacaoOperacional(s: string | null | undefined): string {
  return SITUACAO_OPERACIONAL.find((x) => x[0] === s)?.[1] ?? s ?? "—";
}
export function rotuloSituacaoCadastro(s: string | null | undefined): string {
  return SITUACAO_CADASTRO.find((x) => x[0] === s)?.[1] ?? s ?? "—";
}

export { nomeCurto, um } from "./pessoas-tipos";

/** Capacidade efetiva da coluna `capacidade_carga(veiculo)`: a informada, ou PBT − tara. */
export function capacidadeEfetiva(v: {
  capacidade_carga_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
}): number | null {
  if (v.capacidade_carga_t != null) return v.capacidade_carga_t;
  if (v.pbt_t != null && v.tara_t != null) return Math.round((v.pbt_t - v.tara_t) * 100) / 100;
  return null;
}

/* ---------- números em pt-BR (campos de texto) ---------- */

/** 9.4 → "9,4" (sem separador de milhar, como `num` do protótipo); nulo → "". */
export function num(n: number | string | null | undefined, casas = 1): string {
  if (n == null || n === "") return "";
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: false,
  });
}

/** "9,4" ou "9.4" → 9.4; "1.234,56" → 1234.56; vazio ou lixo → null. Com vírgula, o ponto é milhar;
   sem vírgula, o ponto é decimal. */
export function lerNum(s: unknown): number | null {
  const t = String(s ?? "").trim();
  if (t === "") return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** 685000 → "685.000,00". */
export function dinheiro(n: number | null | undefined): string {
  return n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 182340 → "182.340". */
export function milhar(n: number | null | undefined): string {
  return n == null ? "" : n.toLocaleString("pt-BR");
}
