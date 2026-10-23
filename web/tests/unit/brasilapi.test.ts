import { afterEach, describe, expect, it, vi } from "vitest";
import { mapearCep, mapearCnpj } from "@/lib/brasilapi";
import { GET as getCep } from "@/app/api/cep/[cep]/route";
import { GET as getCnpj } from "@/app/api/cnpj/[cnpj]/route";

const MSG_TIMEOUT = "A consulta não respondeu. Preencha à mão ou tente de novo.";

const respostaCnpj = {
  razao_social: "TRANSPORTES SERRA DO CADEADO LTDA",
  nome_fantasia: "TSC TRANSPORTES",
  data_inicio_atividade: "2009-08-11",
  codigo_natureza_juridica: 2062,
  natureza_juridica: "Sociedade Empresária Limitada",
  cnae_fiscal: 4930202,
  cnae_fiscal_descricao: "Transporte rodoviário de carga",
  opcao_pelo_simples: false,
  descricao_situacao_cadastral: "ATIVA",
  cep: "86800000",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "DAS FLORES",
  numero: "120",
  complemento: "SALA 2",
  bairro: "CENTRO",
  municipio: "APUCARANA",
  uf: "PR",
};

function ctxCnpj(cnpj: string) {
  return { params: Promise.resolve({ cnpj }) };
}
function ctxCep(cep: string) {
  return { params: Promise.resolve({ cep }) };
}
const req = (caminho: string) => new Request(`http://localhost${caminho}`);
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mapearCnpj", () => {
  it("converte a resposta da BrasilAPI no formato de N.consultarCnpj", () => {
    expect(mapearCnpj(respostaCnpj)).toEqual({
      nome: "TRANSPORTES SERRA DO CADEADO LTDA",
      nome_fantasia: "TSC TRANSPORTES",
      fundacao: "2009-08-11",
      natureza_juridica: "2062 Sociedade Empresária Limitada",
      cnae_principal: "4930202 Transporte rodoviário de carga",
      optante_simples: false,
      situacao: "ATIVA",
      endereco: {
        cep: "86800000",
        logradouro: "RUA DAS FLORES",
        numero: "120",
        complemento: "SALA 2",
        bairro: "CENTRO",
        cidade: "APUCARANA",
        uf: "PR",
      },
    });
  });
  it("campos ausentes não viram a palavra undefined", () => {
    const r = mapearCnpj({ razao_social: "X LTDA", logradouro: "AV BRASIL" });
    expect(r.natureza_juridica).toBe("");
    expect(r.cnae_principal).toBe("");
    expect(r.endereco.logradouro).toBe("AV BRASIL");
  });
});

describe("mapearCep", () => {
  it("converte a resposta v2 da BrasilAPI", () => {
    expect(
      mapearCep({ cep: "86800000", street: "Rua das Flores", neighborhood: "Centro", city: "Apucarana", state: "PR" }),
    ).toEqual({ logradouro: "Rua das Flores", bairro: "Centro", cidade: "Apucarana", uf: "PR" });
  });
});

describe("GET /api/cnpj/:cnpj", () => {
  it("consulta a BrasilAPI v1 com timeout e devolve o JSON mapeado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(respostaCnpj));
    vi.stubGlobal("fetch", fetchMock);
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(200);
    expect((await res.json()).nome).toBe("TRANSPORTES SERRA DO CADEADO LTDA");
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://brasilapi.com.br/api/cnpj/v1/11222333000181");
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(opcoes.cache).toBe("no-store");
  });
  it("404 da BrasilAPI vira 404 com a mensagem da Receita", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "CNPJ não encontrado" }, 404)));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: "CNPJ não encontrado na Receita." });
  });
  it("timeout vira 504 com a mensagem de preencher à mão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it("erro de rede vira 502 com a mesma mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it("outro status da BrasilAPI vira 502 com mensagem genérica", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "limite" }, 429)));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ erro: "A consulta de CNPJ não respondeu. Tente de novo em instantes." });
  });
  it("corpo que não é JSON vira 502 genérico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(502);
  });
  it.each(["1122233300018", "11222333000180", "11.222.333/0001-81", "abc", "11111111111111"])(
    "parâmetro inválido %s dá 400 sem chamar a BrasilAPI",
    async (valor) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await getCnpj(req("/api/cnpj/x"), ctxCnpj(valor));
      expect(res.status).toBe(400);
      expect((await res.json()).erro).toMatch(/^CNPJ inválido/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/cep/:cep", () => {
  it("consulta a BrasilAPI v2 e devolve o JSON mapeado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ street: "Rua das Flores", neighborhood: "Centro", city: "Apucarana", state: "PR" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await getCep(req("/api/cep/86800000"), ctxCep("86800000"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ logradouro: "Rua das Flores", bairro: "Centro", cidade: "Apucarana", uf: "PR" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://brasilapi.com.br/api/cep/v2/86800000");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("404 vira 404 com a mensagem do protótipo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "CEP não encontrado" }, 404)));
    const res = await getCep(req("/api/cep/86800000"), ctxCep("86800000"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: "CEP não encontrado." });
  });
  it("timeout vira 504 com a mensagem de preencher à mão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    const res = await getCep(req("/api/cep/86800000"), ctxCep("86800000"));
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it.each(["8680000", "868000000", "86800-000", "abcdefgh"])("parâmetro inválido %s dá 400", async (valor) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await getCep(req("/api/cep/x"), ctxCep(valor));
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/^CEP inválido/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
