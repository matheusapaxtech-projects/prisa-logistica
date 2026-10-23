/* Regras do conjunto (cavalo + carretas/dollies na ordem de engate), espelhando o banco:
   - `validar` espelha `public.validar_conjunto` (supabase/migrations/20261023000700_conjunto.sql);
   - `capacidade` espelha `public.v_conjunto_capacidade` e `public.capacidade_carga`
     (…000700_conjunto.sql e …000600_veiculo.sql).
   O banco é a autoridade: as mensagens abaixo são idênticas às dos `raise exception` e um teste
   (tests/unit/conjunto.test.ts) lê a migration para pegar qualquer divergência. */

export type CategoriaVeiculo = "cavalo" | "caminhao" | "carreta" | "dolly" | "outros";

/** Veículo mínimo para as regras do conjunto. Quem chama monta a partir da linha do banco:
   - `id`, `placa`, `cmt_t`, `pbt_t`, `tara_t`, `capacidade_carga_t`: colunas de `veiculo`
     (`capacidade_carga_t` é o valor informado; nulo = usar `pbt_t - tara_t`);
   - `categoria`: `tipo_veiculo.categoria` do `tipo_veiculo_id` do veículo (join). */
export type Veiculo = {
  id: string;
  placa: string;
  categoria: CategoriaVeiculo;
  cmt_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
  capacidade_carga_t: number | null;
};

/** Outro conjunto aberto (`conjunto.fim is null`), só com o que a regra 7 precisa:
   - `id`: `conjunto.id`; `cavalo_id`: `conjunto.cavalo_id`;
   - `item_ids`: `conjunto_item.veiculo_id` das peças desse conjunto.
   Ao editar um conjunto existente, não passe o próprio conjunto na lista. */
export type ConjuntoAberto = {
  id: string;
  cavalo_id: string;
  item_ids: string[];
};

export type Violacao = {
  /** Posição (1 = primeira peça atrás do cavalo) a que a mensagem se refere; nulo = conjunto todo. */
  posicao: number | null;
  mensagem: string;
};

export type Capacidade = {
  cmt_t: number | null;
  tara_total_t: number;
  capacidade_total_t: number;
  limite_t: number | null;
  excede_cmt: boolean;
};

/** As 7 mensagens de `validar_conjunto`, na ordem das regras do banco. */
export const MENSAGENS_CONJUNTO = {
  cavaloInvalido: "o cavalo do conjunto precisa ser da categoria cavalo",
  itemInvalido: "itens do conjunto precisam ser carreta ou dolly",
  posicoes: "posições do conjunto precisam começar em 1 e não ter buracos",
  dollyNaPonta: "dolly não pode ser a primeira nem a última peça",
  dolliesSeguidos: "dois dollies não podem ficar seguidos",
  maximoCarretas: "conjunto aceita no máximo 3 carretas",
  emOutroConjunto: "veículo já está em outro conjunto aberto",
} as const;

const MAX_CARRETAS = 3;

/** As colunas são numeric(6,2): arredondar em 2 casas tira o ruído do ponto flutuante (91 - 28,6). */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** `public.capacidade_carga`: a informada, ou PBT - tara; nula se não der para calcular. */
function capacidadeCarga(v: Veiculo): number | null {
  if (v.capacidade_carga_t != null) return v.capacidade_carga_t;
  if (v.pbt_t != null && v.tara_t != null) return v.pbt_t - v.tara_t;
  return null;
}

/** Violações de composição do conjunto, todas de uma vez (o banco para na primeira).
   `itens` está na ordem de engate: o índice + 1 é a posição.
   A regra "posições começam em 1 e sem buracos" não aparece aqui: um array nunca tem buracos
   (a mensagem existe em MENSAGENS_CONJUNTO só para espelhar o banco).
   Posição de cada violação: item inválido, dolly na ponta e veículo repetido em outro conjunto →
   a do item; dollies seguidos → a do segundo dolly; cavalo inválido, cavalo em outro conjunto e
   excesso de carretas → nulo. Sempre valida como conjunto aberto (é o único caso da tela). */
export function validar(cavalo: Veiculo, itens: Veiculo[], abertos: ConjuntoAberto[]): Violacao[] {
  const violacoes: Violacao[] = [];
  const M = MENSAGENS_CONJUNTO;

  // 1. a base é um cavalo
  if (cavalo.categoria !== "cavalo") violacoes.push({ posicao: null, mensagem: M.cavaloInvalido });

  // 2. itens só carreta ou dolly
  itens.forEach((v, i) => {
    if (v.categoria !== "carreta" && v.categoria !== "dolly")
      violacoes.push({ posicao: i + 1, mensagem: M.itemInvalido });
  });

  // 4. dolly nunca na primeira nem na última posição
  itens.forEach((v, i) => {
    if (v.categoria === "dolly" && (i === 0 || i === itens.length - 1))
      violacoes.push({ posicao: i + 1, mensagem: M.dollyNaPonta });
  });

  // 5. dois dollies em posições consecutivas
  for (let i = 1; i < itens.length; i++) {
    if (itens[i - 1].categoria === "dolly" && itens[i].categoria === "dolly")
      violacoes.push({ posicao: i + 1, mensagem: M.dolliesSeguidos });
  }

  // 6. no máximo 3 carretas
  if (itens.filter((v) => v.categoria === "carreta").length > MAX_CARRETAS)
    violacoes.push({ posicao: null, mensagem: M.maximoCarretas });

  // 7. nenhum veículo (cavalo ou item) em outro conjunto aberto
  const ocupados = new Set<string>();
  for (const o of abertos) {
    ocupados.add(o.cavalo_id);
    o.item_ids.forEach((id) => ocupados.add(id));
  }
  if (ocupados.has(cavalo.id)) violacoes.push({ posicao: null, mensagem: M.emOutroConjunto });
  itens.forEach((v, i) => {
    if (ocupados.has(v.id)) violacoes.push({ posicao: i + 1, mensagem: M.emOutroConjunto });
  });

  return violacoes;
}

/** Mesma conta de `v_conjunto_capacidade`:
   - capacidade_total_t: soma da capacidade só das carretas (dolly não carrega; carreta sem
     capacidade calculável conta 0);
   - tara_total_t: tara do cavalo + de todos os itens (tara nula conta 0);
   - limite_t: cmt_t - tara_total_t (nulo se o cavalo não tem CMT);
   - excede_cmt: capacidade_total_t > limite_t (falso se não há CMT). */
export function capacidade(cavalo: Veiculo, itens: Veiculo[]): Capacidade {
  const tara = r2((cavalo.tara_t ?? 0) + itens.reduce((s, v) => s + (v.tara_t ?? 0), 0));
  const cap = r2(
    itens.filter((v) => v.categoria === "carreta").reduce((s, v) => s + (capacidadeCarga(v) ?? 0), 0),
  );
  const limite = cavalo.cmt_t != null ? r2(cavalo.cmt_t - tara) : null;
  return {
    cmt_t: cavalo.cmt_t,
    tara_total_t: tara,
    capacidade_total_t: cap,
    limite_t: limite,
    excede_cmt: limite != null && cap > limite,
  };
}

export const conjunto = { validar, capacidade };
