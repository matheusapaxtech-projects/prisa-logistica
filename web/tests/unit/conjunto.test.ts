import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  conjunto,
  MENSAGENS_CONJUNTO,
  type ConjuntoAberto,
  type Veiculo,
} from "@/lib/conjunto";

let seq = 0;
function veiculo(categoria: Veiculo["categoria"], extra: Partial<Veiculo> = {}): Veiculo {
  seq += 1;
  return {
    id: `v${seq}`,
    placa: `TST${String(seq).padStart(4, "0")}`,
    categoria,
    cmt_t: null,
    pbt_t: null,
    tara_t: null,
    capacidade_carga_t: null,
    ...extra,
  };
}
const cavalo = (extra: Partial<Veiculo> = {}) => veiculo("cavalo", { cmt_t: 91, tara_t: 9.9, ...extra });
const carreta = (extra: Partial<Veiculo> = {}) => veiculo("carreta", { pbt_t: 45, tara_t: 7.8, ...extra });
const dolly = (extra: Partial<Veiculo> = {}) => veiculo("dolly", { pbt_t: 12, tara_t: 3.1, ...extra });

describe("conjunto.capacidade", () => {
  it("rodotrem do protótipo: excede o CMT", () => {
    const c = conjunto.capacidade(cavalo(), [carreta(), dolly(), carreta()]);
    expect(c.cmt_t).toBe(91);
    expect(c.tara_total_t).toBe(28.6);
    expect(c.capacidade_total_t).toBe(74.4);
    expect(c.limite_t).toBe(62.4);
    expect(c.excede_cmt).toBe(true);
  });
  it("conjunto simples dentro do limite", () => {
    const c = conjunto.capacidade(cavalo({ cmt_t: 74, tara_t: 9 }), [carreta({ capacidade_carga_t: 37.2 })]);
    expect(c.tara_total_t).toBe(16.8);
    expect(c.capacidade_total_t).toBe(37.2);
    expect(c.limite_t).toBe(57.2);
    expect(c.excede_cmt).toBe(false);
  });
  it("capacidade informada vale mais que PBT - tara", () => {
    const c = conjunto.capacidade(cavalo(), [carreta({ capacidade_carga_t: 30 })]);
    expect(c.capacidade_total_t).toBe(30);
  });
  it("dolly não carrega; carreta sem PBT nem capacidade conta 0; tara nula conta 0", () => {
    const semDados = carreta({ pbt_t: null, tara_t: null });
    const c = conjunto.capacidade(cavalo(), [dolly(), semDados]);
    expect(c.capacidade_total_t).toBe(0);
    expect(c.tara_total_t).toBe(13);
  });
  it("sem CMT do cavalo: limite nulo e nunca excede", () => {
    const c = conjunto.capacidade(cavalo({ cmt_t: null }), [carreta()]);
    expect(c.cmt_t).toBeNull();
    expect(c.limite_t).toBeNull();
    expect(c.excede_cmt).toBe(false);
  });
  it("sem itens: só a tara do cavalo", () => {
    const c = conjunto.capacidade(cavalo(), []);
    expect(c.tara_total_t).toBe(9.9);
    expect(c.capacidade_total_t).toBe(0);
    expect(c.limite_t).toBe(81.1);
    expect(c.excede_cmt).toBe(false);
  });
  it("exatamente no limite não excede", () => {
    const c = conjunto.capacidade(cavalo({ cmt_t: 50, tara_t: 10 }), [carreta({ tara_t: 10, capacidade_carga_t: 30 })]);
    expect(c.limite_t).toBe(30);
    expect(c.excede_cmt).toBe(false);
  });
});

describe("conjunto.validar", () => {
  it("conjunto válido não tem violações", () => {
    expect(conjunto.validar(cavalo(), [carreta(), dolly(), carreta()], [])).toEqual([]);
    expect(conjunto.validar(cavalo(), [], [])).toEqual([]);
  });

  it("dolly na posição 1 é recusado", () => {
    const r = conjunto.validar(cavalo(), [dolly(), carreta()], []);
    expect(r).toContainEqual({ posicao: 1, mensagem: "dolly não pode ser a primeira nem a última peça" });
  });
  it("dolly na última posição é recusado, e as duas pontas geram duas violações", () => {
    const r = conjunto.validar(cavalo(), [dolly(), carreta(), dolly()], []);
    expect(r.filter((v) => v.mensagem === MENSAGENS_CONJUNTO.dollyNaPonta)).toEqual([
      { posicao: 1, mensagem: MENSAGENS_CONJUNTO.dollyNaPonta },
      { posicao: 3, mensagem: MENSAGENS_CONJUNTO.dollyNaPonta },
    ]);
  });
  it("dollies seguidos apontam a segunda peça", () => {
    const r = conjunto.validar(cavalo(), [carreta(), dolly(), dolly(), carreta()], []);
    expect(r).toEqual([{ posicao: 3, mensagem: "dois dollies não podem ficar seguidos" }]);
  });
  it("mais de 3 carretas vale para o conjunto todo", () => {
    const r = conjunto.validar(cavalo(), [carreta(), carreta(), carreta(), carreta()], []);
    expect(r).toEqual([{ posicao: null, mensagem: "conjunto aceita no máximo 3 carretas" }]);
  });
  it("3 carretas com dollies no meio é aceito", () => {
    expect(conjunto.validar(cavalo(), [carreta(), dolly(), carreta(), dolly(), carreta()], [])).toEqual([]);
  });
  it("a base precisa ser cavalo", () => {
    const r = conjunto.validar(veiculo("caminhao"), [carreta()], []);
    expect(r).toEqual([{ posicao: null, mensagem: "o cavalo do conjunto precisa ser da categoria cavalo" }]);
  });
  it("itens só carreta ou dolly, apontando cada item inválido", () => {
    const r = conjunto.validar(cavalo(), [carreta(), veiculo("caminhao"), veiculo("cavalo")], []);
    expect(r).toEqual([
      { posicao: 2, mensagem: "itens do conjunto precisam ser carreta ou dolly" },
      { posicao: 3, mensagem: "itens do conjunto precisam ser carreta ou dolly" },
    ]);
  });
  describe("veículo em outro conjunto aberto", () => {
    it("cavalo em outro conjunto: violação do conjunto todo", () => {
      const c = cavalo();
      const abertos: ConjuntoAberto[] = [{ id: "x", cavalo_id: c.id, item_ids: [] }];
      expect(conjunto.validar(c, [carreta()], abertos)).toEqual([
        { posicao: null, mensagem: "veículo já está em outro conjunto aberto" },
      ]);
    });
    it("item em outro conjunto: aponta a posição do item", () => {
      const c1 = carreta();
      const c2 = carreta();
      const abertos: ConjuntoAberto[] = [{ id: "x", cavalo_id: "outro", item_ids: [c2.id] }];
      expect(conjunto.validar(cavalo(), [c1, dolly(), c2], abertos)).toEqual([
        { posicao: 3, mensagem: "veículo já está em outro conjunto aberto" },
      ]);
    });
    it("item que é o cavalo de outro conjunto também conta", () => {
      const c1 = carreta();
      const abertos: ConjuntoAberto[] = [{ id: "x", cavalo_id: c1.id, item_ids: [] }];
      expect(conjunto.validar(cavalo(), [c1], abertos)).toEqual([
        { posicao: 1, mensagem: "veículo já está em outro conjunto aberto" },
      ]);
    });
    it("conjunto aberto sem relação não atrapalha", () => {
      const abertos: ConjuntoAberto[] = [{ id: "x", cavalo_id: "a", item_ids: ["b", "c"] }];
      expect(conjunto.validar(cavalo(), [carreta()], abertos)).toEqual([]);
    });
  });
  it("devolve todas as violações juntas", () => {
    const r = conjunto.validar(cavalo(), [dolly(), dolly(), carreta(), carreta(), carreta(), carreta()], []);
    const msgs = r.map((v) => v.mensagem);
    expect(msgs).toContain(MENSAGENS_CONJUNTO.dollyNaPonta);
    expect(msgs).toContain(MENSAGENS_CONJUNTO.dolliesSeguidos);
    expect(msgs).toContain(MENSAGENS_CONJUNTO.maximoCarretas);
  });
});

describe("mensagens do conjunto x banco", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/20261023000700_conjunto.sql"),
    "utf8",
  );
  it("são 7 mensagens", () => {
    expect(Object.keys(MENSAGENS_CONJUNTO)).toHaveLength(7);
  });
  it.each(Object.entries(MENSAGENS_CONJUNTO))("%s aparece em validar_conjunto", (_nome, texto) => {
    expect(sql).toContain(`raise exception '${texto}'`);
  });
  it("a migration não tem mensagens além das 7", () => {
    const noBanco = [...sql.matchAll(/raise exception '([^']+)'/g)].map((m) => m[1]);
    expect(noBanco.sort()).toEqual(Object.values(MENSAGENS_CONJUNTO).sort());
  });
});
