/* Regras e textos da tela de Conjuntos que valem no servidor e no navegador (sem banco, sem React).
   A validação vem de lib/conjunto.ts (espelho de public.validar_conjunto, mensagens idênticas);
   aqui só se decide em qual peça cada mensagem aparece, como no montador de prototipo/conjunto.html. */
import { MENSAGENS_CONJUNTO, validar, type ConjuntoAberto, type Veiculo } from "@/lib/conjunto";

/** Máximo de peças atrás do cavalo (`conjunto_item.posicao between 1 and 5`). */
export const MAX_PECAS = 5;
const MAX_CARRETAS = 3;

/** Veículo como o montador e a ficha usam: colunas de `veiculo` + `tipo_veiculo` + `marca_veiculo.nome`
   + o nome curto do proprietário na ANTT (`proprietario_documento_id` → nome fantasia ou nome). */
export type VeiculoConjunto = Veiculo & {
  eixos: number;
  configuracao_cavalo: "toco" | "trucado" | null;
  /** `tipo_veiculo.nome` (ex.: "CARRETA BAU - 3 EIXOS"). */
  tipo: string;
  marca: string | null;
  modelo: string | null;
  arrendado: boolean;
  /** Proprietário na ANTT, curto (nome fantasia ou nome). */
  dono: string;
  dono_id: string;
  situacao_operacional: string;
  ultimo_motorista_id: string | null;
};

/** Conjunto aberto como o montador precisa: o que `validar` usa + motorista e início (avisos). */
export type AbertoConjunto = ConjuntoAberto & { motorista_id: string | null; inicio: string };

/** Motorista que pode ser escolhido (cadastro normal), com o que os avisos usam. */
export type MotoristaOpcao = {
  pessoa_id: string;
  nome: string;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  situacao_gr: string;
  gr_validade: string | null;
};

/** "CARRETA BAU - 3 EIXOS" → "Carreta baú, 3 eixos" (`tipoTxt` do protótipo). */
export function tipoTxt(nome: string): string {
  const t = nome.toLowerCase().replace(/\bbau\b/, "baú").replace(" - ", ", ");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** "Carreta baú, 3 eixos" → "Carreta baú" (`tipoVeic` de pendencias.html). */
export function tipoSemEixos(nome: string): string {
  const t = nome.toLowerCase().replace(/\bbau\b/, "baú").replace(/ - \d eixos$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** "QHT4C27 + QHX2A61 + QHX2A62" (`nomeConj` do protótipo). */
export const nomeConjunto = (placas: string[]) => placas.join(" + ");

/** Rótulo curto de uma peça livre no botão "Livres:" ("Baú", "Graneleiro trucada", "dolly"). */
export function rotuloLivre(v: Pick<VeiculoConjunto, "categoria" | "tipo">): string {
  if (v.categoria === "dolly") return "dolly";
  return tipoTxt(v.tipo).replace(/^Carreta /, "").replace(/, \d eixos$/, "");
}

export type ErrosPorPeca = {
  /** Mensagens que aparecem junto do cavalo. */
  cavalo: string[];
  /** Mensagens de cada peça, na ordem de engate (índice 0 = posição 1). */
  itens: string[][];
};

/** Cavalo de mentira para validar as peças antes de a pessoa escolher o cavalo. */
const SEM_CAVALO: Veiculo = {
  id: "",
  placa: "",
  categoria: "cavalo",
  cmt_t: null,
  pbt_t: null,
  tara_t: null,
  capacidade_carga_t: null,
};

/**
 * Violações de `validar` distribuídas pelas peças, como o montador do protótipo mostra:
 * - com posição → na peça daquela posição;
 * - "conjunto aceita no máximo 3 carretas" → em cada carreta além da terceira;
 * - as demais sem posição (cavalo inválido, cavalo em outro conjunto aberto) → no cavalo.
 * `abertos` = os outros conjuntos abertos (sem o que está sendo editado).
 */
export function errosPorPeca(cavalo: Veiculo | null, itens: Veiculo[], abertos: ConjuntoAberto[]): ErrosPorPeca {
  const r: ErrosPorPeca = { cavalo: [], itens: itens.map(() => []) };
  for (const v of validar(cavalo ?? SEM_CAVALO, itens, abertos)) {
    if (v.posicao != null) r.itens[v.posicao - 1].push(v.mensagem);
    else if (v.mensagem === MENSAGENS_CONJUNTO.maximoCarretas) {
      let carretas = 0;
      itens.forEach((x, i) => {
        if (x.categoria === "carreta" && ++carretas > MAX_CARRETAS) r.itens[i].push(v.mensagem);
      });
    } else if (cavalo) r.cavalo.push(v.mensagem);
  }
  return r;
}

/** Onde mostrar um erro de montagem que o banco devolveu. */
export type LocalErro = { alvo: "cavalo" } | { alvo: "peca"; posicao: number };

const MENSAGENS = new Set<string>(Object.values(MENSAGENS_CONJUNTO));

/**
 * O banco (`salvar_conjunto` → `validar_conjunto`) para na primeira regra que falha e devolve a
 * mensagem como está. Para mostrá-la junto da peça certa, roda a mesma validação com os dados que
 * o banco viu e devolve o primeiro lugar (cavalo, depois peças em ordem) que tem essa mensagem.
 * `null` = não é uma mensagem de composição (ou os dados não reproduzem a falha): mostrar no geral.
 * Para reproduzir o banco, `abertos` não deve ter o conjunto editado nem o conjunto aberto do mesmo
 * cavalo (o `salvar_conjunto` encerra os dois antes de validar).
 */
export function localizarErro(
  mensagem: string,
  cavalo: Veiculo | null,
  itens: Veiculo[],
  abertos: ConjuntoAberto[],
): LocalErro | null {
  if (!MENSAGENS.has(mensagem)) return null;
  const r = errosPorPeca(cavalo, itens, abertos);
  if (r.cavalo.includes(mensagem)) return { alvo: "cavalo" };
  const i = r.itens.findIndex((e) => e.includes(mensagem));
  return i >= 0 ? { alvo: "peca", posicao: i + 1 } : null;
}

/** Conjunto aberto (de outro conjunto) em que o veículo está, se houver. */
export function abertoCom(veiculoId: string, abertos: AbertoConjunto[]): AbertoConjunto | undefined {
  return abertos.find((c) => c.cavalo_id === veiculoId || c.item_ids.includes(veiculoId));
}
