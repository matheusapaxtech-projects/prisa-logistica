/* Consultas à BrasilAPI (CNPJ v1 e CEP v2), feitas no servidor pelas rotas /api/cnpj e /api/cep.
   O mapeamento dos campos é porta 1:1 de `N.consultarCnpj` / `N.consultarCep`
   (prototipo/assets/nilt.js); os valores vêm como a BrasilAPI entrega (CNAE e natureza jurídica
   chegam só com dígitos, como no protótipo). */
import { validacao } from "@/lib/validacao";

const BASE = "https://brasilapi.com.br/api";
const TIMEOUT_MS = 8000;

export const ERROS_BRASILAPI = {
  cnpjNaoEncontrado: "CNPJ não encontrado na Receita.",
  cepNaoEncontrado: "CEP não encontrado.",
  semResposta: "A consulta não respondeu. Preencha à mão ou tente de novo.",
  cnpjFalhou: "A consulta de CNPJ não respondeu. Tente de novo em instantes.",
  cepFalhou: "A consulta de CEP não respondeu. Tente de novo em instantes.",
  cnpjInvalido: "CNPJ inválido: informe os 14 dígitos, só números.",
  cepInvalido: "CEP inválido: informe os 8 dígitos, só números.",
} as const;

type Texto = string | number | null | undefined;
type Cru = Record<string, unknown>;

const juntar = (...partes: Texto[]) => partes.filter(Boolean).join(" ");

export type DadosCnpj = {
  nome: string;
  nome_fantasia: string;
  fundacao: string;
  natureza_juridica: string;
  cnae_principal: string;
  optante_simples: boolean | null;
  situacao: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
};

export type DadosCep = { logradouro: string; bairro: string; cidade: string; uf: string };

const txt = (v: unknown) => (v == null ? "" : String(v));

/** Resposta de `GET /api/cnpj/v1/:cnpj` → formato de `N.consultarCnpj`. */
export function mapearCnpj(j: Cru): DadosCnpj {
  return {
    nome: txt(j.razao_social),
    nome_fantasia: txt(j.nome_fantasia),
    fundacao: txt(j.data_inicio_atividade),
    natureza_juridica: juntar(j.codigo_natureza_juridica as Texto, j.natureza_juridica as Texto),
    cnae_principal: juntar(j.cnae_fiscal as Texto, j.cnae_fiscal_descricao as Texto),
    optante_simples: typeof j.opcao_pelo_simples === "boolean" ? j.opcao_pelo_simples : null,
    situacao: txt(j.descricao_situacao_cadastral),
    endereco: {
      cep: txt(j.cep),
      logradouro: juntar(j.descricao_tipo_de_logradouro as Texto, j.logradouro as Texto),
      numero: txt(j.numero),
      complemento: txt(j.complemento),
      bairro: txt(j.bairro),
      cidade: txt(j.municipio),
      uf: txt(j.uf),
    },
  };
}

/** Resposta de `GET /api/cep/v2/:cep` → formato de `N.consultarCep`. */
export function mapearCep(j: Cru): DadosCep {
  return {
    logradouro: txt(j.street),
    bairro: txt(j.neighborhood),
    cidade: txt(j.city),
    uf: txt(j.state),
  };
}

const erro = (mensagem: string, status: number) => Response.json({ erro: mensagem }, { status });

async function consultar(
  url: string,
  naoEncontrado: string,
  falhou: string,
  mapear: (j: Cru) => unknown,
): Promise<Response> {
  let r: Response;
  try {
    // no-store: o resultado nunca é guardado em cache, nem compartilhado entre usuários.
    r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    // Estouro do tempo (TimeoutError), cancelamento (AbortError) e falha de rede.
    // Pelo nome, não por instanceof: o DOMException pode vir de outro realm (ex.: jsdom nos testes).
    const nome = (e as { name?: unknown } | null)?.name;
    return erro(ERROS_BRASILAPI.semResposta, nome === "TimeoutError" || nome === "AbortError" ? 504 : 502);
  }
  if (r.status === 404) return erro(naoEncontrado, 404);
  if (!r.ok) return erro(falhou, 502);
  try {
    const j = (await r.json()) as unknown;
    if (j === null || typeof j !== "object") return erro(falhou, 502);
    return Response.json(mapear(j as Cru));
  } catch {
    return erro(falhou, 502);
  }
}

/** Valida o parâmetro (14 dígitos com dígitos verificadores corretos) e consulta a Receita via BrasilAPI. */
export async function consultarCnpj(param: string): Promise<Response> {
  if (!/^\d{14}$/.test(param) || !validacao.cnpj(param)) return erro(ERROS_BRASILAPI.cnpjInvalido, 400);
  return consultar(
    `${BASE}/cnpj/v1/${param}`,
    ERROS_BRASILAPI.cnpjNaoEncontrado,
    ERROS_BRASILAPI.cnpjFalhou,
    mapearCnpj,
  );
}

/** Valida o parâmetro (8 dígitos) e consulta o CEP na BrasilAPI v2. */
export async function consultarCep(param: string): Promise<Response> {
  if (!/^\d{8}$/.test(param)) return erro(ERROS_BRASILAPI.cepInvalido, 400);
  return consultar(
    `${BASE}/cep/v2/${param}`,
    ERROS_BRASILAPI.cepNaoEncontrado,
    ERROS_BRASILAPI.cepFalhou,
    mapearCep,
  );
}
