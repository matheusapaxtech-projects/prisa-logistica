import { describe, expect, it } from "vitest";
import { estadoPlaca, regraCampo } from "@/app/(app)/veiculos/novo/regras";
import { FichaVeiculo, NovoVeiculo, ehId, errosPorCampo } from "@/app/(app)/veiculos/schema";
import { capacidadeEfetiva, lerNum, marcaCurta, num, rotuloTipo } from "@/app/(app)/veiculos/rotulos";
import { casaBusca, type LinhaVeiculo } from "@/app/(app)/veiculos/consultas";

const P1 = "00000000-0000-4000-8000-000000000201";
const base = {
  placa: "abc1d23",
  tipo_veiculo_id: "10",
  renavam: "01344572018",
  chassi: "9afx530t0pr118450",
  cor: "",
  marca_id: "32",
  modelo: " R 450 ",
  ano_fabricacao: "2022",
  ano_modelo: "2023",
  uf_emplacamento: "PR",
  cidade_emplacamento: "",
  proprietario_posse_id: P1,
  proprietario_documento_id: "",
};

describe("placa ao vivo (novo)", () => {
  it("normaliza e conta o que falta", () => {
    const p = estadoPlaca("ab-c1");
    expect(p.placa).toBe("ABC1");
    expect(p.completa).toBe(false);
    expect(p.mensagem).toBe("Próximo: letra ou número.");
  });
  it("aponta a posição errada com a mensagem do protótipo", () => {
    expect(estadoPlaca("AB1").mensagem).toBe("A 3ª posição precisa ser letra. Use ABC1234 ou ABC1D23.");
    expect(estadoPlaca("AB1").invalida).toBe(true);
  });
  it("antiga x Mercosul", () => {
    expect(estadoPlaca("ABC1234")).toMatchObject({ completa: true, mercosul: false });
    expect(estadoPlaca("ABC1D23")).toMatchObject({ completa: true, mercosul: true });
    expect(estadoPlaca("ABC1")).toMatchObject({ completa: false, mercosul: true });
  });
});

describe("regras de campo (novo)", () => {
  const ctx = { anoAtual: 2026, anoFabricacao: "2022", renavamEmUso: null };
  it("renavam", () => {
    expect(regraCampo("renavam", "123", ctx)).toBe("Renavam tem 11 dígitos; faltam 8.");
    expect(regraCampo("renavam", "01344572018", { ...ctx, renavamEmUso: "RTU1F45" })).toBe(
      "Renavam já cadastrado na placa RTU1F45. Confira o documento.",
    );
    expect(regraCampo("renavam", "01344572018", ctx)).toBe("");
  });
  it("chassi", () => {
    expect(regraCampo("chassi", "9BWZZZ377VT00IOQ1", ctx)).toBe("Chassi não tem as letras I, O ou Q. Confira se é 1 ou 0.");
    expect(regraCampo("chassi", "9BWZZZ377VT", ctx)).toBe("Chassi tem 17 caracteres; faltam 6.");
  });
  it("anos", () => {
    expect(regraCampo("ano_fabricacao", "1950", ctx)).toBe("Use um ano entre 1970 e 2027.");
    expect(regraCampo("ano_modelo", "2025", ctx)).toBe("O ano do modelo é 2022 ou 2023.");
    expect(regraCampo("ano_modelo", "2023", ctx)).toBe("");
  });
});

describe("schema do novo veículo", () => {
  it("normaliza e aceita", () => {
    const r = NovoVeiculo.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.placa).toBe("ABC1D23");
      expect(r.data.chassi).toBe("9AFX530T0PR118450");
      expect(r.data.modelo).toBe("R 450");
      expect(r.data.proprietario_documento_id).toBeNull();
      expect(r.data.cor).toBeNull();
    }
  });
  it("recusa placa inválida, chassi com I/O/Q e ano do modelo fora da regra", () => {
    const r = NovoVeiculo.safeParse({ ...base, placa: "AB1", chassi: "9AFX530T0PR1184IO", ano_modelo: "2030" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = errosPorCampo(r.error);
      expect(e.placa).toBe("Placa inválida: use ABC1234 ou ABC1D23.");
      expect(e.chassi).toBe("Chassi não tem as letras I, O ou Q. Confira se é 1 ou 0.");
      expect(e.ano_modelo).toBe("O ano do modelo é 2022 ou 2023.");
    }
  });
  it("exige o dono da posse", () => {
    const r = NovoVeiculo.safeParse({ ...base, proprietario_posse_id: "" });
    expect(r.success).toBe(false);
  });
});

describe("schema da ficha", () => {
  it("só toca nas chaves que vieram", () => {
    const r = FichaVeiculo.parse({ modelo: "XF", pbt_t: "45,0", tara_t: "8,4", cap_auto: "on" });
    expect(Object.keys(r).sort()).toEqual(["cap_auto", "modelo", "pbt_t", "tara_t"]);
    expect(r.pbt_t).toBe(45);
    expect(r.tara_t).toBe(8.4);
  });
  it("capacidade informada à mão exige número", () => {
    const r = FichaVeiculo.safeParse({ capacidade_carga_t: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).capacidade_carga_t).toBe("Informe a capacidade ou volte a calcular.");
    expect(FichaVeiculo.safeParse({ capacidade_carga_t: "", cap_auto: "on" }).success).toBe(true);
  });
  it("números e limites das colunas", () => {
    expect(errosPorCampo(FichaVeiculo.safeParse({ pbt_t: "abc" }).error!).pbt_t).toBe("Use só números, com vírgula nos decimais.");
    expect(errosPorCampo(FichaVeiculo.safeParse({ pbt_t: "10000" }).error!).pbt_t).toBe("Use um valor menor que 10.000.");
    expect(errosPorCampo(FichaVeiculo.safeParse({ pbt_t: "-1" }).error!).pbt_t).toBe("Não pode ser negativo.");
    const f = FichaVeiculo.parse({ vl_compra: "685.000,00", km_inicial: "182.340", pgr_sm_automatica: "false", hp: "" });
    expect(f).toMatchObject({ vl_compra: 685000, km_inicial: 182340, pgr_sm_automatica: false, hp: null });
  });
  it("campos vazios viram nulo e enum inválido é recusado", () => {
    const f = FichaVeiculo.parse({ tag_numero: "  ", seguro_validade: "", rastreamento_tipo: "" });
    expect(f).toMatchObject({ tag_numero: null, seguro_validade: null, rastreamento_tipo: null });
    expect(FichaVeiculo.safeParse({ situacao_operacional: "voando" }).success).toBe(false);
    expect(FichaVeiculo.safeParse({ seguro_validade: "31/12/2026" }).success).toBe(false);
  });
});

describe("rótulos e números", () => {
  it("rotuloTipo", () => {
    expect(rotuloTipo({ nome: "CAVALO TRUCADO - 3 EIXOS", categoria: "cavalo", configuracao_cavalo: "trucado" })).toBe("Cavalo trucado");
    expect(rotuloTipo({ nome: "CARRETA BAU - 3 EIXOS", categoria: "carreta", configuracao_cavalo: null })).toBe("Carreta baú");
    expect(rotuloTipo({ nome: "DOLLY - 2 EIXOS", categoria: "dolly", configuracao_cavalo: null })).toBe("Dolly");
  });
  it("marcaCurta", () => {
    expect(marcaCurta("SCANIA")).toBe("Scania");
    expect(marcaCurta("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(marcaCurta("DAF")).toBe("DAF");
  });
  it("num e lerNum", () => {
    expect(num(9.4)).toBe("9,4");
    expect(num(null)).toBe("");
    expect(lerNum("9,4")).toBe(9.4);
    expect(lerNum("9.4")).toBe(9.4);
    expect(lerNum("1.234,56")).toBe(1234.56);
    expect(lerNum("")).toBeNull();
    expect(lerNum("x")).toBeNull();
  });
  it("capacidade efetiva: a informada, ou PBT − tara", () => {
    expect(capacidadeEfetiva({ capacidade_carga_t: 30, pbt_t: 45, tara_t: 8 })).toBe(30);
    expect(capacidadeEfetiva({ capacidade_carga_t: null, pbt_t: 45, tara_t: 8.4 })).toBe(36.6);
    expect(capacidadeEfetiva({ capacidade_carga_t: null, pbt_t: null, tara_t: 8 })).toBeNull();
  });
  it("ehId aceita ids da seed (fora da RFC) e recusa o resto", () => {
    expect(ehId(P1)).toBe(true);
    expect(ehId("zzz")).toBe(false);
    expect(ehId(undefined)).toBe(false);
  });
});

describe("busca da lista", () => {
  const v = {
    placa: "BRA2E19",
    renavam: "01344572018",
    chassi: "9AFX530T0PR118450",
    marca: "Scania",
    modelo: "R 450 A6x4",
    posse: "Edson Ramos Figueira",
    documento: "Rodo Norte",
  } as LinhaVeiculo;
  it("placa, renavam, chassi, modelo e donos", () => {
    expect(casaBusca(v, "")).toBe(true);
    expect(casaBusca(v, "bra-2e")).toBe(true);
    expect(casaBusca(v, "13445")).toBe(true);
    expect(casaBusca(v, "9afx530")).toBe(true);
    expect(casaBusca(v, "scania r 450")).toBe(true);
    expect(casaBusca(v, "edson")).toBe(true);
    expect(casaBusca(v, "rodo norte")).toBe(true);
    expect(casaBusca(v, "zzzz")).toBe(false);
  });
});
