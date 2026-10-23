import { describe, expect, it } from "vitest";
import { MENSAGENS_CONJUNTO, type ConjuntoAberto, type Veiculo } from "@/lib/conjunto";
import {
  errosPorPeca,
  localizarErro,
  nomeConjunto,
  rotuloLivre,
  tipoSemEixos,
  tipoTxt,
} from "@/app/(app)/conjuntos/regras";
import { abaPendencias } from "@/app/(app)/pendencias/filtros";

// Tela de Conjuntos (Task 10): em qual peça cada mensagem do banco aparece, e os filtros de Pendências.

let seq = 0;
function v(categoria: Veiculo["categoria"]): Veiculo {
  seq += 1;
  return { id: `v${seq}`, placa: `ABC${1000 + seq}`, categoria, cmt_t: 74, pbt_t: 45, tara_t: 8, capacidade_carga_t: null };
}
const M = MENSAGENS_CONJUNTO;

describe("errosPorPeca (validação ao vivo do montador)", () => {
  it("dolly na primeira posição: a mensagem fica na peça 1", () => {
    const r = errosPorPeca(v("cavalo"), [v("dolly"), v("carreta")], []);
    expect(r.cavalo).toEqual([]);
    expect(r.itens).toEqual([[M.dollyNaPonta], []]);
  });
  it("rodotrem válido (carreta, dolly, carreta): sem erros", () => {
    const r = errosPorPeca(v("cavalo"), [v("carreta"), v("dolly"), v("carreta")], []);
    expect(r).toEqual({ cavalo: [], itens: [[], [], []] });
  });
  it("quarta carreta: 'no máximo 3 carretas' só na carreta que passa do limite", () => {
    const itens = [v("carreta"), v("carreta"), v("carreta"), v("carreta")];
    expect(errosPorPeca(v("cavalo"), itens, []).itens).toEqual([[], [], [], [M.maximoCarretas]]);
  });
  it("cavalo e peça em outro conjunto aberto: mensagem no cavalo e na peça", () => {
    const cav = v("cavalo");
    const car = v("carreta");
    const aberto: ConjuntoAberto = { id: "c1", cavalo_id: cav.id, item_ids: [car.id] };
    const r = errosPorPeca(cav, [car], [aberto]);
    expect(r.cavalo).toEqual([M.emOutroConjunto]);
    expect(r.itens).toEqual([[M.emOutroConjunto]]);
  });
  it("sem cavalo escolhido: valida as peças e não acusa nada no cavalo", () => {
    const r = errosPorPeca(null, [v("dolly")], []);
    expect(r.cavalo).toEqual([]);
    expect(r.itens).toEqual([[M.dollyNaPonta]]);
  });
});

describe("localizarErro (mensagem que o banco devolveu → peça)", () => {
  it("'dolly não pode ser a primeira nem a última peça' com dolly no fim → posição 3", () => {
    const itens = [v("carreta"), v("carreta"), v("dolly")];
    expect(localizarErro("dolly não pode ser a primeira nem a última peça", v("cavalo"), itens, [])).toEqual({
      alvo: "peca",
      posicao: 3,
    });
  });
  it("dois dollies seguidos → o segundo dolly", () => {
    const itens = [v("carreta"), v("dolly"), v("dolly"), v("carreta")];
    expect(localizarErro(M.dolliesSeguidos, v("cavalo"), itens, [])).toEqual({ alvo: "peca", posicao: 3 });
  });
  it("item que não é carreta nem dolly → a peça", () => {
    expect(localizarErro(M.itemInvalido, v("cavalo"), [v("carreta"), v("caminhao")], [])).toEqual({
      alvo: "peca",
      posicao: 2,
    });
  });
  it("cavalo que não é cavalo → o cavalo", () => {
    expect(localizarErro(M.cavaloInvalido, v("carreta"), [v("carreta")], [])).toEqual({ alvo: "cavalo" });
  });
  it("peça que outra pessoa engatou enquanto a tela estava aberta → a peça (dados atuais do banco)", () => {
    const livre = v("carreta");
    const tomada = v("carreta");
    const outro: ConjuntoAberto = { id: "c9", cavalo_id: "outro-cavalo", item_ids: [tomada.id] };
    expect(localizarErro(M.emOutroConjunto, v("cavalo"), [livre, tomada], [outro])).toEqual({
      alvo: "peca",
      posicao: 2,
    });
  });
  it("mensagem que os dados não reproduzem → null (vai para o aviso geral)", () => {
    expect(localizarErro(M.emOutroConjunto, v("cavalo"), [v("carreta")], [])).toBeNull();
  });
  it("mensagem que não é de composição → null", () => {
    expect(localizarErro("informe o cavalo do conjunto", v("cavalo"), [v("carreta")], [])).toBeNull();
    expect(localizarErro("Seu papel não permite essa alteração.", v("cavalo"), [v("carreta")], [])).toBeNull();
  });
});

describe("textos", () => {
  it("tipo do veículo como no protótipo", () => {
    expect(tipoTxt("CARRETA BAU - 3 EIXOS")).toBe("Carreta baú, 3 eixos");
    expect(tipoTxt("CAVALO TRUCADO - 3 EIXOS")).toBe("Cavalo trucado, 3 eixos");
    expect(tipoSemEixos("CARRETA BAU - 3 EIXOS")).toBe("Carreta baú");
    expect(rotuloLivre({ categoria: "carreta", tipo: "CARRETA GRANELEIRO TRUCADA - 3 EIXOS" })).toBe("graneleiro trucada");
    expect(rotuloLivre({ categoria: "dolly", tipo: "DOLLY - 2 EIXOS" })).toBe("dolly");
    expect(nomeConjunto(["QHT4C27", "QHX2A61"])).toBe("QHT4C27 + QHX2A61");
  });
});

describe("abaPendencias (?aba= e ?tipo= de /pendencias)", () => {
  it("cada tipo da tela Início abre a aba Pendências com o filtro", () => {
    for (const tipo of [
      "arquivo_vencido",
      "veiculo_arrendado_sem_contrato",
      "conjunto_acima_cmt",
      "motorista_sem_cnh",
      "motorista_sem_comprovante",
    ]) {
      expect(abaPendencias({ tipo })).toEqual({ aba: "pendencias", tipo });
    }
  });
  it("abas válidas; valor fora da lista cai no padrão", () => {
    expect(abaPendencias({ aba: "vencimentos" })).toEqual({ aba: "vencimentos", tipo: null });
    expect(abaPendencias({ aba: "documentos" })).toEqual({ aba: "documentos", tipo: null });
    expect(abaPendencias({})).toEqual({ aba: "pendencias", tipo: null });
    expect(abaPendencias({ aba: "x", tipo: "drop table" })).toEqual({ aba: "pendencias", tipo: null });
    expect(abaPendencias({ aba: ["documentos", "x"] })).toEqual({ aba: "documentos", tipo: null });
  });
});
