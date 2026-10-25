import { describe, expect, it } from "vitest";
import type { LinhaViagem, PedidoDaViagem } from "@/app/(app)/viagens/consultas";
import {
  filtrarViagens,
  filtrosLigados,
  hrefDaAba,
  hrefDe,
  hrefSemFiltros,
  intervaloDe,
  lerFiltros,
  numerosDePagina,
  opcoesDaAba,
  paginar,
} from "@/app/(app)/viagens/filtros";

// 25/10/2026 às 15h em Brasília (18h UTC).
const AGORA = new Date("2026-10-25T18:00:00Z");

function viagem(numero: number, extra: Partial<LinhaViagem> = {}): LinhaViagem {
  return {
    id: `v${numero}`,
    numero,
    status_campo: "frete_finalizado",
    statusDesde: null,
    criadaEm: "2026-10-01T12:00:00Z",
    finalizadaEm: "2026-10-20T12:00:00Z",
    cancelada_em: null,
    pedido: { id: `p${numero}`, numero: 100 + numero, situacao: "aberto" as PedidoDaViagem["situacao"], produto: "Soja", cliente: "Agro Sul", origem: "Rio Verde/GO", destino: "Santos/SP" },
    placa: "ABC1D23",
    motorista: "João",
    travas: null,
    avisos: null,
    ...extra,
  };
}

describe("lerFiltros", () => {
  it("sem nada na URL: planejadas, sem filtro, página 1 de 25", () => {
    const f = lerFiltros({});
    expect(f).toMatchObject({ aba: "planejadas", q: "", situacao: "", periodo: "tudo", ordem: "recentes", pagina: 1, porPagina: 25 });
  });
  it("valores inválidos voltam ao padrão", () => {
    const f = lerFiltros({ aba: "xyz", periodo: "sempre", pagina: "-2", por: "33", ordem: "lado", situacao: "inventada" });
    expect(f).toMatchObject({ aba: "planejadas", periodo: "tudo", pagina: 1, porPagina: 25, ordem: "recentes", situacao: "" });
  });
  it("no quadro, a ordem padrão é a mais antiga primeiro", () => {
    expect(lerFiltros({ aba: "no_quadro" }).ordem).toBe("antigas");
  });
  it("o link antigo ?trava=1 vira situação com trava", () => {
    expect(lerFiltros({ aba: "planejadas", trava: "1" }).situacao).toBe("com_trava");
  });
  it("datas só valem com período 'Escolher datas'", () => {
    expect(lerFiltros({ periodo: "30d", de: "2026-01-01" }).de).toBe("");
    expect(lerFiltros({ periodo: "datas", de: "2026-01-01", ate: "lixo" })).toMatchObject({ de: "2026-01-01", ate: "" });
  });
});

describe("hrefDe", () => {
  const f = lerFiltros({ aba: "finalizadas", cliente: "Agro Sul", pagina: "3" });
  it("só põe na URL o que foge do padrão", () => {
    expect(hrefDe(lerFiltros({}))).toBe("?aba=planejadas");
  });
  it("mudar um filtro volta para a página 1", () => {
    expect(hrefDe(f, { motorista: "João" })).toBe("?aba=finalizadas&cliente=Agro+Sul&motorista=Jo%C3%A3o");
  });
  it("mudar a página mantém os filtros", () => {
    expect(hrefDe(f, { pagina: 4 })).toBe("?aba=finalizadas&cliente=Agro+Sul&pagina=4");
  });
  it("trocar de aba deixa a situação e a ordem para trás", () => {
    const g = lerFiltros({ aba: "planejadas", situacao: "com_trava", q: "abc", ordem: "antigas" });
    expect(hrefDaAba(g, "no_quadro")).toBe("?aba=no_quadro&q=abc");
  });
  it("limpar filtros guarda a aba e o por página", () => {
    const g = lerFiltros({ aba: "finalizadas", cliente: "X", q: "y", periodo: "7d", por: "50" });
    expect(hrefSemFiltros(g)).toBe("?aba=finalizadas&por=50");
    expect(filtrosLigados(g)).toBe(2);
  });
});

describe("intervaloDe (Brasília)", () => {
  it("presets contam a partir de hoje", () => {
    expect(intervaloDe({ periodo: "hoje", de: "", ate: "" }, AGORA)).toEqual({ de: "2026-10-25", ate: "2026-10-25" });
    expect(intervaloDe({ periodo: "7d", de: "", ate: "" }, AGORA)).toEqual({ de: "2026-10-19", ate: "2026-10-25" });
    expect(intervaloDe({ periodo: "ano", de: "", ate: "" }, AGORA)).toEqual({ de: "2026-01-01", ate: "2026-10-25" });
  });
  it("datas trocadas viram o intervalo entre elas", () => {
    expect(intervaloDe({ periodo: "datas", de: "2026-10-10", ate: "2026-10-01" }, AGORA)).toEqual({ de: "2026-10-01", ate: "2026-10-10" });
  });
  it("a virada do dia é a de Brasília, não a UTC", () => {
    // 26/10 01h UTC ainda é 25/10 em Brasília.
    expect(intervaloDe({ periodo: "hoje", de: "", ate: "" }, new Date("2026-10-26T01:00:00Z")).de).toBe("2026-10-25");
  });
});

describe("filtrarViagens", () => {
  const linhas = [
    viagem(1, { finalizadaEm: "2026-10-24T12:00:00Z", motorista: "Ana" }),
    viagem(2, { finalizadaEm: "2026-09-01T12:00:00Z" }),
    viagem(3, { finalizadaEm: "2026-10-25T02:00:00Z", pedido: { ...viagem(3).pedido!, cliente: "Grãos Norte", destino: "Paranaguá/PR" } }),
    viagem(4, { status_campo: null, travas: 1, avisos: 0 }),
    viagem(5, { status_campo: null, travas: 0, avisos: 2 }),
    viagem(6, { status_campo: "em_rota", statusDesde: "2026-10-24T10:00:00Z" }),
    viagem(7, { status_campo: "pausa", statusDesde: "2026-10-23T10:00:00Z" }),
  ];
  const nums = (f: Record<string, string>) => filtrarViagens(linhas, lerFiltros(f), AGORA).map((v) => v.numero);

  it("só a aba pedida, a mais recente primeiro pela data da aba", () => {
    expect(nums({ aba: "finalizadas" })).toEqual([3, 1, 2]);
    expect(nums({ aba: "finalizadas", ordem: "antigas" })).toEqual([2, 1, 3]);
  });
  it("no quadro, quem está há mais tempo na coluna primeiro", () => {
    expect(nums({ aba: "no_quadro" })).toEqual([7, 6]);
    expect(nums({ aba: "no_quadro", situacao: "pausa" })).toEqual([7]);
  });
  it("cliente, motorista, destino e busca se somam", () => {
    expect(nums({ aba: "finalizadas", cliente: "Grãos Norte" })).toEqual([3]);
    expect(nums({ aba: "finalizadas", motorista: "Ana" })).toEqual([1]);
    expect(nums({ aba: "finalizadas", destino: "Santos/SP", q: "ana" })).toEqual([1]);
  });
  it("período pelo dia de Brasília (25/10 02h UTC é 24/10)", () => {
    expect(nums({ aba: "finalizadas", periodo: "hoje" })).toEqual([]);
    expect(nums({ aba: "finalizadas", periodo: "datas", de: "2026-10-24", ate: "2026-10-24" })).toEqual([3, 1]);
  });
  it("aptidão das planejadas", () => {
    expect(nums({ aba: "planejadas", situacao: "com_trava" })).toEqual([4]);
    expect(nums({ aba: "planejadas", situacao: "com_aviso" })).toEqual([5]);
    expect(nums({ aba: "planejadas", situacao: "aptas" })).toEqual([]);
  });
  it("opções da aba em ordem alfabética, com o valor filtrado mesmo se sumiu", () => {
    const o = opcoesDaAba(linhas, lerFiltros({ aba: "finalizadas", cliente: "Zeta" }));
    expect(o.clientes).toEqual(["Agro Sul", "Grãos Norte", "Zeta"]);
    expect(o.destinos).toEqual(["Paranaguá/PR", "Santos/SP"]);
    expect(o.situacoes).toEqual([]);
  });
});

describe("paginar e numerosDePagina", () => {
  const lista = Array.from({ length: 132 }, (_, i) => i + 1);
  it("recorta a página e conta de 1", () => {
    expect(paginar(lista, 2, 25)).toMatchObject({ pagina: 2, paginas: 6, inicio: 26, fim: 50, total: 132 });
    expect(paginar(lista, 2, 25).itens[0]).toBe(26);
  });
  it("página além da última vira a última; lista vazia é 1 de 1", () => {
    expect(paginar(lista, 99, 25)).toMatchObject({ pagina: 6, inicio: 126, fim: 132 });
    expect(paginar([], 3, 25)).toMatchObject({ pagina: 1, paginas: 1, inicio: 0, fim: 0 });
  });
  it("números com reticências", () => {
    expect(numerosDePagina(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(numerosDePagina(1, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(numerosDePagina(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(numerosDePagina(12, 12)).toEqual([1, "…", 9, 10, 11, 12]);
  });
});
