import { describe, expect, it } from "vitest";
import { lerLancamentoManual } from "@/app/(app)/financeiro/regras";
import { resumoEvento } from "@/lib/auditoria";
import {
  chaveDaDescricao,
  limitesDoMes,
  mesDeHoje,
  mesValido,
  nomeDoBanco,
  nomeDoMes,
  partesDaConta,
  percentualMargem,
  resultadoDoAno,
  sinalConfere,
  somarMes,
  somarResultado,
  type LinhaResumo,
} from "@/lib/financeiro";

// Regras puras do financeiro: a chave das regras aprendidas, a conferência do sinal, os meses e o
// resultado montado das linhas de fin_resumo_mensal (em centavos, sem erro de arredondamento).

describe("chaveDaDescricao", () => {
  it("tira acento, número, símbolo e letra solta", () => {
    expect(chaveDaDescricao("PIX ENVIADO - João Silva 12/10")).toBe("PIX ENVIADO JOAO SILVA");
    expect(chaveDaDescricao("ROADCARD PAGAMENTO FRETE 778812")).toBe("ROADCARD PAGAMENTO FRETE");
    expect(chaveDaDescricao("Pagto. a Fornecedor S/A")).toBe("PAGTO FORNECEDOR");
  });

  it("o mesmo favorecido em meses diferentes dá a mesma chave", () => {
    expect(chaveDaDescricao("PARCELA EMPRESTIMO 01/10")).toBe(chaveDaDescricao("PARCELA EMPRESTIMO 02/10"));
  });

  it("só números vira vazio", () => {
    expect(chaveDaDescricao("123 456")).toBe("");
  });
});

describe("sinalConfere", () => {
  it("receita, empréstimo e aporte são entradas; pagamento, despesa e devoluções, saídas", () => {
    expect(sinalConfere("receita_frete", 100)).toBe(true);
    expect(sinalConfere("receita_frete", -100)).toBe(false);
    expect(sinalConfere("pagamento_frete", -100)).toBe(true);
    expect(sinalConfere("despesa", 50)).toBe(false);
    expect(sinalConfere("devolucao_capital", -1)).toBe(true);
    expect(sinalConfere("emprestimo", 1)).toBe(true);
  });

  it("transferência aceita os dois lados", () => {
    expect(sinalConfere("transferencia", 1)).toBe(true);
    expect(sinalConfere("transferencia", -1)).toBe(true);
  });
});

describe("meses", () => {
  it("valida, soma e nomeia", () => {
    expect(mesValido("2026-10")).toBe(true);
    expect(mesValido("2026-13")).toBe(false);
    expect(mesValido("26-10")).toBe(false);
    expect(somarMes("2026-01", -1)).toBe("2025-12");
    expect(somarMes("2026-12", 1)).toBe("2027-01");
    expect(somarMes("2026-05", 14)).toBe("2027-07");
    expect(nomeDoMes("2026-03")).toBe("março de 2026");
    expect(limitesDoMes("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
  });

  it("mês de hoje é o de Brasília", () => {
    // 1º/11 às 01h UTC ainda é 31/10 em Brasília.
    expect(mesDeHoje(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
  });
});

const L = (mes: string, categoria: LinhaResumo["categoria"], valor: number, quantidade = 1): LinhaResumo => ({ mes, categoria, valor, quantidade });

describe("somarResultado", () => {
  const linhas = [
    L("2026-09", "receita_frete", 40550.5, 2),
    L("2026-09", "pagamento_frete", -28100, 2),
    L("2026-09", "despesa", -2629.8, 3),
    L("2026-09", "emprestimo", 30000),
    L("2026-09", "devolucao_emprestimo", -3120.45),
    L("2026-09", "aporte_capital", 50000),
    L("2026-09", null, -0.1, 2),
    L("2026-09", null, -0.2, 1),
  ];
  const r = somarResultado(linhas);

  it("margem do frete e resultado da operação", () => {
    expect(r.margemFrete).toBe(12450.5);
    expect(r.resultado).toBe(9820.7);
  });

  it("separa empréstimo, capital e sem categoria", () => {
    expect(r.emprestimo).toBe(30000);
    expect(r.devolucaoEmprestimo).toBe(-3120.45);
    expect(r.aporteCapital).toBe(50000);
    expect(r.semCategoria).toBe(-0.3);
    expect(r.semCategoriaQtd).toBe(3);
    expect(r.quantidade).toBe(13);
  });

  it("variação do caixa soma tudo, sem erro de ponto flutuante", () => {
    expect(r.variacaoCaixa).toBe(86699.95);
  });

  it("período vazio dá zeros", () => {
    expect(somarResultado([])).toMatchObject({ resultado: 0, variacaoCaixa: 0, quantidade: 0, semCategoriaQtd: 0 });
  });

  it("percentual da margem", () => {
    expect(percentualMargem(r)).toBe(30.7);
    expect(percentualMargem({ receitaFrete: 0, margemFrete: -10 })).toBeNull();
  });
});

describe("resultadoDoAno", () => {
  it("12 meses e o total só do ano pedido", () => {
    const { meses, total } = resultadoDoAno(
      [L("2026-01", "receita_frete", 100), L("2026-12", "despesa", -30), L("2025-12", "receita_frete", 999)],
      2026,
    );
    expect(meses).toHaveLength(12);
    expect(meses[0].r.receitaFrete).toBe(100);
    expect(meses[11].r.despesa).toBe(-30);
    expect(total.resultado).toBe(70);
  });
});

describe("contas", () => {
  it("nome do banco pelo código", () => {
    expect(nomeDoBanco("341")).toBe("Itaú");
    expect(nomeDoBanco("999")).toBe("Banco 999");
    expect(nomeDoBanco("Cartao Exemplo")).toBe("Cartao Exemplo");
  });

  it("partes da conta, com apelido na frente", () => {
    expect(partesDaConta({ banco: "001", agencia: "1234", numero: "5-6" })).toEqual(["Banco do Brasil", "ag. 1234", "conta 5-6"]);
    expect(partesDaConta({ banco: "001", agencia: "", numero: "5-6", apelido: "Conta frete" })).toEqual(["Conta frete", "conta 5-6"]);
  });
});

describe("auditoria do financeiro", () => {
  const ctx = { tipos: new Map<number, string>() };

  it("mudar a categoria aparece como 'Alterou categoria' (sem os carimbos de quem classificou)", () => {
    const antes = { categoria: null, classificado_em: null, classificado_por: null, descricao: "TARIFA" };
    const depois = { categoria: "despesa", classificado_em: "2026-10-24T05:00:00Z", classificado_por: "u", descricao: "TARIFA" };
    expect(resumoEvento({ tabela: "fin_lancamento", acao: "update", dados_antes: antes, dados_depois: depois }, ctx)).toBe("Alterou categoria");
  });

  it("nomes das tabelas do financeiro", () => {
    expect(resumoEvento({ tabela: "fin_importacao", acao: "delete", dados_antes: {}, dados_depois: null }, ctx)).toBe("Apagou o extrato importado");
    expect(resumoEvento({ tabela: "fin_regra", acao: "insert", dados_antes: null, dados_depois: {} }, ctx)).toBe("Criou a regra de categoria");
  });
});

describe("lerLancamentoManual", () => {
  const HOJE = "2026-10-25";
  const f = (c: Record<string, string>) => {
    const d = new FormData();
    const base = { data: "2026-10-05", sentido: "entrada", valor: "500", descricao: "Aporte do sócio", categoria: "aporte_capital", conta: "" };
    for (const [k, v] of Object.entries({ ...base, ...c })) d.set(k, v);
    return d;
  };

  it("entrada fica positiva, saída negativa, com centavos exatos", () => {
    expect(lerLancamentoManual(f({}), HOJE)).toMatchObject({ ok: true, dados: { valor: 500, contaId: null } });
    const s = lerLancamentoManual(f({ sentido: "saida", categoria: "despesa", valor: "0,10" }), HOJE);
    expect(s).toMatchObject({ ok: true, dados: { valor: -0.1, categoria: "despesa" } });
  });

  it("categoria contra o sentido é recusada; transferência aceita os dois", () => {
    expect(lerLancamentoManual(f({ sentido: "saida" }), HOJE)).toEqual({ ok: false, erros: { categoria: "Aporte de capital é uma entrada." } });
    expect(lerLancamentoManual(f({ sentido: "saida", categoria: "transferencia" }), HOJE).ok).toBe(true);
  });

  it("valor vazio, zero, formato errado e alto demais", () => {
    const erro = (valor: string) => {
      const r = lerLancamentoManual(f({ valor }), HOJE);
      return r.ok ? null : r.erros.valor;
    };
    expect(erro("")).toBe("Informe o valor.");
    expect(erro("0,00")).toBe("O valor não pode ser zero.");
    expect(erro("1.5")).toMatch(/Valor inválido/);
    expect(erro("200.000.000")).toMatch(/alto demais/);
  });

  it("data inexistente, muito antiga ou mais de um ano à frente", () => {
    const erro = (data: string) => {
      const r = lerLancamentoManual(f({ data }), HOJE);
      return r.ok ? null : r.erros.data;
    };
    expect(erro("2026-02-30")).toBe("Data inválida.");
    expect(erro("1999-12-31")).toBe("Confira o ano da data.");
    expect(erro("2027-10-26")).toBe("Confira o ano da data.");
    expect(erro("2027-10-25")).toBeNull();
  });

  it("sem descrição, sem sentido e conta que não é id", () => {
    const r = lerLancamentoManual(f({ descricao: "   ", sentido: "", conta: "abc" }), HOJE);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.erros).sort()).toEqual(["conta", "descricao", "sentido"]);
  });
});
