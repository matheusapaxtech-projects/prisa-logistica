import { describe, expect, it } from "vitest";
import { sanitizarTermo, termoBusca } from "@/lib/busca";
import { caminhoArquivo, erroDoArquivo, mimeDoArquivo, nomeSeguro } from "@/lib/arquivos";
import { resumoEvento } from "@/lib/auditoria";

describe("busca global: sanitização do termo (vai para um filtro .or() do PostgREST)", () => {
  it("tira tudo o que não é letra, dígito ou espaço (vírgula, parênteses, *, %, _, ponto, aspas, barra)", () => {
    expect(sanitizarTermo("a,b(c)*d%e_f.g\"h'i\\j/k:l")).toBe("a b c d e f g h i j k l");
    expect(sanitizarTermo("nome.ilike.*,id.neq.0")).toBe("nome ilike id neq 0");
    expect(sanitizarTermo("  João   Bertoli  ")).toBe("João Bertoli");
    expect(sanitizarTermo("%%%")).toBe("");
  });

  it("termoBusca: texto sanitizado, dígitos e placa normalizada; curto demais é nulo", () => {
    expect(termoBusca("a")).toBeNull();
    expect(termoBusca(" ,* ")).toBeNull();
    expect(termoBusca("529.982.247-25")).toEqual({ texto: "529 982 247 25", digitos: "52998224725", placa: "52998224725" });
    expect(termoBusca("abc-1d23")).toEqual({ texto: "abc 1d23", digitos: "123", placa: "ABC1D23" });
  });
});

describe("arquivos: caminho no Storage", () => {
  it("nomeSeguro tira acentos, espaços e símbolos e mantém a extensão", () => {
    expect(nomeSeguro("CNH Édson (frente).PDF")).toBe("cnh-edson-frente.pdf");
    expect(nomeSeguro("../../etc/passwd")).toBe("etc-passwd");
    expect(nomeSeguro("   ")).toBe("arquivo");
    expect(nomeSeguro("a".repeat(200) + ".png").length).toBeLessThanOrEqual(80);
    expect(nomeSeguro("a".repeat(200) + ".png").endsWith(".png")).toBe(true);
  });

  it("caminhoArquivo segue a convenção pessoa/<id>/<arquivo>-<nome> ou veiculo/…", () => {
    expect(caminhoArquivo({ pessoaId: "p1" }, "a1", "Comprovante.jpg")).toBe("pessoa/p1/a1-comprovante.jpg");
    expect(caminhoArquivo({ veiculoId: "v1" }, "a2", "crlv 2026.pdf")).toBe("veiculo/v1/a2-crlv-2026.pdf");
    expect(caminhoArquivo({ viagemId: "g1" }, "a3", "Canhoto NF.jpg")).toBe("viagem/g1/a3-canhoto-nf.jpg");
  });
});

describe("arquivos: tipo e tamanho (M2)", () => {
  it("mimeDoArquivo: usa o tipo do navegador; sem ele, a extensão conhecida; senão vazio", () => {
    expect(mimeDoArquivo("x.pdf", "application/pdf")).toBe("application/pdf");
    expect(mimeDoArquivo("foto.HEIC", "")).toBe("image/heic");
    expect(mimeDoArquivo("foto.jpg", "")).toBe("image/jpeg");
    expect(mimeDoArquivo("planilha.xlsx", "")).toBe("");
    expect(mimeDoArquivo("sem-extensao", "")).toBe("");
  });

  it("erroDoArquivo: vazio, grande demais, tipo recusado, ok", () => {
    expect(erroDoArquivo(undefined)).toBe("Escolha o arquivo antes de enviar.");
    expect(erroDoArquivo({ name: "a.pdf", size: 0, type: "application/pdf" })).toBe("Escolha o arquivo antes de enviar.");
    expect(erroDoArquivo({ name: "a.pdf", size: 25e6, type: "application/pdf" })).toBe(
      "O arquivo tem 25 MB; o limite é 20 MB. Reduza ou envie em partes.",
    );
    expect(erroDoArquivo({ name: "a.xlsx", size: 10, type: "" })).toBe("Envie o arquivo em PDF, JPG, PNG ou HEIC.");
    expect(erroDoArquivo({ name: "a.txt", size: 10, type: "text/plain" })).toBe("Envie o arquivo em PDF, JPG, PNG ou HEIC.");
    expect(erroDoArquivo({ name: "a.heic", size: 10, type: "" })).toBeNull();
  });
});

describe("histórico: resumo de um evento da auditoria", () => {
  const tipos = new Map([[5, "CNH"]]);

  it("insert / delete / visualização", () => {
    expect(resumoEvento({ tabela: "pessoa", acao: "insert", dados_antes: null, dados_depois: { nome: "X" } }, { tipos }))
      .toBe("Criou a pessoa");
    expect(
      resumoEvento(
        { tabela: "arquivo", acao: "insert", dados_antes: null, dados_depois: { tipo_arquivo_id: 5, nome_original: "cnh.pdf" } },
        { tipos },
      ),
    ).toBe("CNH anexado (cnh.pdf)");
    expect(
      resumoEvento({ tabela: "arquivo", acao: "visualizacao", dados_antes: null, dados_depois: null }, { tipos, nomeArquivo: "cnh.pdf" }),
    ).toBe("Abriu documento cnh.pdf");
    expect(resumoEvento({ tabela: "arquivo", acao: "visualizacao", dados_antes: null, dados_depois: null }, { tipos }))
      .toBe("Abriu documento");
    expect(resumoEvento({ tabela: "veiculo", acao: "delete", dados_antes: { placa: "ABC1234" }, dados_depois: null }, { tipos }))
      .toBe("Apagou o veículo");
  });

  it("update lista os campos alterados com rótulos em português e ignora carimbos", () => {
    expect(
      resumoEvento(
        {
          tabela: "pessoa",
          acao: "update",
          dados_antes: { nome: "A", apelido: null, updated_at: "1", mae: "M" },
          dados_depois: { nome: "B", apelido: "Bê", updated_at: "2", mae: "M" },
        },
        { tipos },
      ),
    ).toBe("Alterou nome e apelido");
    expect(
      resumoEvento(
        {
          tabela: "arquivo",
          acao: "update",
          dados_antes: { tipo_arquivo_id: 5, validado_em: null, validado_por: null },
          dados_depois: { tipo_arquivo_id: 5, validado_em: "2026-10-23T10:00:00Z", validado_por: "u1" },
        },
        { tipos },
      ),
    ).toBe("CNH conferido");
    expect(
      resumoEvento({ tabela: "pessoa", acao: "update", dados_antes: { updated_at: "1" }, dados_depois: { updated_at: "2" } }, { tipos }),
    ).toBe("Alterou a pessoa");
  });
});
