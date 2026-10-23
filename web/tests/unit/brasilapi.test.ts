import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// As rotas exigem sessão (Task 4): cliente do servidor falso, com sessão por padrão.
const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));
import { mapearCep, mapearCnpj, mapearReceitaWs, mapearViaCep } from "@/lib/brasilapi";
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

beforeEach(() => {
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "u-1" } }, error: null });
});

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

describe("sem sessão", () => {
  const MSG_SESSAO = "Sua sessão expirou. Entre de novo; o que você digitou continua na tela.";
  it("/api/cnpj e /api/cep respondem 401 em JSON sem chamar a BrasilAPI", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const rCnpj = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(rCnpj.status).toBe(401);
    expect(await rCnpj.json()).toEqual({ erro: MSG_SESSAO });
    const rCep = await getCep(req("/api/cep/86800000"), ctxCep("86800000"));
    expect(rCep.status).toBe(401);
    expect(await rCep.json()).toEqual({ erro: MSG_SESSAO });
    expect(fetchMock).not.toHaveBeenCalled();
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
    // Sem User-Agent a BrasilAPI responde 403 ao fetch do Node.
    expect(opcoes.headers["user-agent"]).toMatch(/^NILT\//);
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
  it.each([403, 429])("%i (bloqueio ou limite de uso) vira 504 com a mensagem de preencher à mão", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status })));
    const res = await getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it("outro status da BrasilAPI vira 502 com mensagem genérica", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "erro" }, 500)));
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
    expect(fetchMock.mock.calls[0][1].headers["user-agent"]).toMatch(/^NILT\//);
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

/* ---------- provedores de reserva (ViaCEP e ReceitaWS) ---------- */

const respostaReceitaWs = {
  status: "OK",
  nome: "TRANSPORTES SERRA DO CADEADO LTDA",
  fantasia: "TSC TRANSPORTES",
  abertura: "11/08/2009",
  natureza_juridica: "206-2 - Sociedade Empresária Limitada",
  atividade_principal: [{ code: "49.30-2-02", text: "Transporte rodoviário de carga" }],
  situacao: "ATIVA",
  cep: "86.800-000",
  logradouro: "R DAS FLORES",
  numero: "120",
  complemento: "SALA 2",
  bairro: "CENTRO",
  municipio: "APUCARANA",
  uf: "PR",
  simples: { optante: false },
};

type Opcoes = RequestInit & { headers: Record<string, string> };

/** fetch simulado por provedor: a chave é um trecho do endereço. */
function provedores(respostas: Record<string, () => Response | Promise<Response>>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- o 2º parâmetro tipa `mock.calls[i][1]`
  const fetchMock = vi.fn(async (url: string | URL, _opcoes?: RequestInit) => {
    const chave = Object.keys(respostas).find((k) => String(url).includes(k));
    if (!chave) throw new Error(`sem resposta simulada para ${url}`);
    return respostas[chave]();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const chamou = (m: ReturnType<typeof provedores>, trecho: string) => m.mock.calls.some(([u]) => String(u).includes(trecho));
const opcoesDe = (m: ReturnType<typeof provedores>, trecho: string) => m.mock.calls.find(([u]) => String(u).includes(trecho))![1] as Opcoes;

describe("mapearViaCep e mapearReceitaWs", () => {
  it("ViaCEP: localidade vira cidade", () => {
    expect(mapearViaCep({ cep: "86800-000", logradouro: "Rua das Flores", bairro: "Centro", localidade: "Apucarana", uf: "PR" })).toEqual({
      logradouro: "Rua das Flores",
      bairro: "Centro",
      cidade: "Apucarana",
      uf: "PR",
    });
  });
  it("ReceitaWS: mesmo formato da BrasilAPI (data ISO, natureza e CNAE com dígitos, CEP sem máscara)", () => {
    expect(mapearReceitaWs(respostaReceitaWs)).toEqual({
      nome: "TRANSPORTES SERRA DO CADEADO LTDA",
      nome_fantasia: "TSC TRANSPORTES",
      fundacao: "2009-08-11",
      natureza_juridica: "2062 Sociedade Empresária Limitada",
      cnae_principal: "4930202 Transporte rodoviário de carga",
      optante_simples: false,
      situacao: "ATIVA",
      endereco: { cep: "86800000", logradouro: "R DAS FLORES", numero: "120", complemento: "SALA 2", bairro: "CENTRO", cidade: "APUCARANA", uf: "PR" },
    });
  });
  it("ReceitaWS sem os campos opcionais não vira undefined", () => {
    const r = mapearReceitaWs({ status: "OK", nome: "X LTDA", abertura: "xx" });
    expect(r.fundacao).toBe("");
    expect(r.cnae_principal).toBe("");
    expect(r.optante_simples).toBeNull();
  });
});

describe("CEP com reserva (ViaCEP)", () => {
  const brasil = "brasilapi.com.br/api/cep";
  const via = "viacep.com.br/ws/86800000/json/";
  const cep = () => getCep(req("/api/cep/86800000"), ctxCep("86800000"));
  const viaOk = () => json({ cep: "86800-000", logradouro: "Rua das Flores", bairro: "Centro", localidade: "Apucarana", uf: "PR" });
  const esperado = { logradouro: "Rua das Flores", bairro: "Centro", cidade: "Apucarana", uf: "PR" };

  it("BrasilAPI ok: a reserva não é chamada", async () => {
    const m = provedores({ [brasil]: () => json({ street: "Rua das Flores", neighborhood: "Centro", city: "Apucarana", state: "PR" }), [via]: viaOk });
    const res = await cep();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(esperado);
    expect(chamou(m, "viacep")).toBe(false);
  });
  it.each([
    ["404", () => json({ message: "nao" }, 404)],
    ["500", () => json({ message: "erro" }, 500)],
    ["403", () => new Response("Forbidden", { status: 403 })],
  ])("BrasilAPI %s + ViaCEP ok → 200 com o mesmo formato, com User-Agent e sem cache", async (_nome, falha) => {
    const m = provedores({ [brasil]: falha, [via]: viaOk });
    const res = await cep();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(esperado);
    const opcoes = opcoesDe(m, "viacep");
    expect(opcoes.headers["user-agent"]).toMatch(/^NILT\//);
    expect(opcoes.cache).toBe("no-store");
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });
  it("BrasilAPI com timeout + ViaCEP ok → 200", async () => {
    provedores({ [brasil]: () => Promise.reject(new DOMException("timeout", "TimeoutError")), [via]: viaOk });
    const res = await cep();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(esperado);
  });
  it("BrasilAPI 404 + ViaCEP {erro:true} → não encontrado (todos dizem que não existe)", async () => {
    provedores({ [brasil]: () => json({ message: "nao" }, 404), [via]: () => json({ erro: true }) });
    const res = await cep();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: "CEP não encontrado." });
  });
  it("BrasilAPI 404 + ViaCEP fora do ar → não respondeu (não dá para afirmar que não existe)", async () => {
    provedores({ [brasil]: () => json({ message: "nao" }, 404), [via]: () => Promise.reject(new TypeError("fetch failed")) });
    const res = await cep();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it("todos falham (timeout e 403) → não respondeu", async () => {
    provedores({ [brasil]: () => Promise.reject(new DOMException("timeout", "TimeoutError")), [via]: () => new Response("x", { status: 403 }) });
    const res = await cep();
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
});

describe("CNPJ com reserva (ReceitaWS)", () => {
  const brasil = "brasilapi.com.br/api/cnpj";
  const recWs = "receitaws.com.br/v1/cnpj/11222333000181";
  const cnpj = () => getCnpj(req("/api/cnpj/11222333000181"), ctxCnpj("11222333000181"));

  it("BrasilAPI ok: a reserva não é chamada", async () => {
    const m = provedores({ [brasil]: () => json(respostaCnpj), [recWs]: () => json(respostaReceitaWs) });
    const res = await cnpj();
    expect(res.status).toBe(200);
    expect((await res.json()).nome).toBe("TRANSPORTES SERRA DO CADEADO LTDA");
    expect(chamou(m, "receitaws")).toBe(false);
  });
  it.each([
    ["404", () => json({ message: "nao" }, 404)],
    ["429", () => new Response("limite", { status: 429 })],
    ["rede", () => Promise.reject(new TypeError("fetch failed"))],
  ])("BrasilAPI %s + ReceitaWS ok → 200 no mesmo formato, com User-Agent e sem cache", async (_nome, falha) => {
    const m = provedores({ [brasil]: falha, [recWs]: () => json(respostaReceitaWs) });
    const res = await cnpj();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mapearReceitaWs(respostaReceitaWs));
    const opcoes = opcoesDe(m, "receitaws");
    expect(opcoes.headers["user-agent"]).toMatch(/^NILT\//);
    expect(opcoes.cache).toBe("no-store");
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });
  it('BrasilAPI 404 + ReceitaWS status "ERROR" → não encontrado', async () => {
    provedores({ [brasil]: () => json({ message: "nao" }, 404), [recWs]: () => json({ status: "ERROR", message: "CNPJ rejeitado pela Receita Federal" }) });
    const res = await cnpj();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erro: "CNPJ não encontrado na Receita." });
  });
  it("BrasilAPI 404 + ReceitaWS 429 → não respondeu", async () => {
    provedores({ [brasil]: () => json({ message: "nao" }, 404), [recWs]: () => new Response("limite", { status: 429 }) });
    const res = await cnpj();
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
  it("todos falham (403 e timeout) → não respondeu", async () => {
    provedores({ [brasil]: () => new Response("Forbidden", { status: 403 }), [recWs]: () => Promise.reject(new DOMException("timeout", "TimeoutError")) });
    const res = await cnpj();
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ erro: MSG_TIMEOUT });
  });
});
