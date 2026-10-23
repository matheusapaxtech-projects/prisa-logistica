/* Consultas à BrasilAPI (CNPJ v1 e CEP v2, com ReceitaWS e ViaCEP de reserva), feitas no servidor pelas rotas /api/cnpj e /api/cep.
   O mapeamento dos campos é porta 1:1 de `N.consultarCnpj` / `N.consultarCep`
   (prototipo/assets/nilt.js); os valores vêm como a BrasilAPI entrega (CNAE e natureza jurídica
   chegam só com dígitos, como no protótipo). */
import { validacao } from "@/lib/validacao";

const BASE = "https://brasilapi.com.br/api";
const TIMEOUT_MS = 8000;
// A BrasilAPI recusa (403) o fetch do Node sem User-Agent: sempre mandamos um.
const USER_AGENT = "NILT/1.0 (+Prisa Logística)";

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

/* ---------- provedores de reserva ---------- */

const RESERVA_CEP = "https://viacep.com.br/ws";
const RESERVA_CNPJ = "https://receitaws.com.br/v1/cnpj";

const soDigitos = (v: unknown) => txt(v).replace(/\D/g, "");

/** ViaCEP → formato de `mapearCep`. Chave `erro` (true) = CEP inexistente (a rota responde 200). */
export function mapearViaCep(j: Cru): DadosCep {
  return { logradouro: txt(j.logradouro), bairro: txt(j.bairro), cidade: txt(j.localidade), uf: txt(j.uf) };
}

/** "11/08/2009" → "2009-08-11"; o que não for essa data vira "". */
function dataIso(v: unknown): string {
  const m = txt(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** ReceitaWS → formato de `mapearCnpj` (mesmos textos que a BrasilAPI: "2062 Natureza", "4930202 Atividade"). */
export function mapearReceitaWs(j: Cru): DadosCnpj {
  const atividade = Array.isArray(j.atividade_principal) ? (j.atividade_principal[0] as Cru | undefined) : undefined;
  const simples = j.simples as Cru | null | undefined;
  return {
    nome: txt(j.nome),
    nome_fantasia: txt(j.fantasia),
    fundacao: dataIso(j.abertura),
    // "206-2 - Sociedade Empresária Limitada" → "2062 Sociedade Empresária Limitada"
    natureza_juridica: txt(j.natureza_juridica).replace(/^(\d+)-(\d)\s*-\s*/, "$1$2 "),
    cnae_principal: atividade ? juntar(soDigitos(atividade.code), txt(atividade.text)) : "",
    optante_simples: simples && typeof simples.optante === "boolean" ? simples.optante : null,
    situacao: txt(j.situacao),
    endereco: {
      cep: soDigitos(j.cep),
      logradouro: txt(j.logradouro),
      numero: txt(j.numero),
      complemento: txt(j.complemento),
      bairro: txt(j.bairro),
      cidade: txt(j.municipio),
      uf: txt(j.uf),
    },
  };
}

type Provedor = {
  url: string;
  mapear: (j: Cru) => unknown;
  /** O provedor diz "não existe" numa resposta 200 (ViaCEP `erro`, ReceitaWS `status: "ERROR"`). */
  inexistente?: (j: Cru) => boolean;
  /** Resposta 200 que não serve (ex.: ReceitaWS sem `nome`): conta como falha, não como achado. */
  valida?: (j: Cru) => boolean;
};
type Tentativa = { tipo: "ok"; dados: unknown } | { tipo: "nao_achou" } | { tipo: "falhou"; resposta: Response };

/** Uma consulta a um provedor, com timeout próprio, User-Agent e sem cache. Nunca lança. */
async function tentar(p: Provedor, falhou: string): Promise<Tentativa> {
  let r: Response;
  try {
    // no-store: o resultado nunca é guardado em cache, nem compartilhado entre usuários.
    r = await fetch(p.url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", headers: { "user-agent": USER_AGENT } });
  } catch (e) {
    // Estouro do tempo (TimeoutError), cancelamento (AbortError) e falha de rede.
    // Pelo nome, não por instanceof: o DOMException pode vir de outro realm (ex.: jsdom nos testes).
    const nome = (e as { name?: unknown } | null)?.name;
    return { tipo: "falhou", resposta: erro(ERROS_BRASILAPI.semResposta, nome === "TimeoutError" || nome === "AbortError" ? 504 : 502) };
  }
  if (r.status === 404) return { tipo: "nao_achou" };
  // Bloqueio ou limite de uso (403, 429): do ponto de vista de quem cadastra, a consulta não respondeu.
  if (r.status === 403 || r.status === 429) return { tipo: "falhou", resposta: erro(ERROS_BRASILAPI.semResposta, 504) };
  if (!r.ok) return { tipo: "falhou", resposta: erro(falhou, 502) };
  try {
    const j = (await r.json()) as unknown;
    if (j === null || typeof j !== "object") return { tipo: "falhou", resposta: erro(falhou, 502) };
    if (p.inexistente?.(j as Cru)) return { tipo: "nao_achou" };
    if (p.valida && !p.valida(j as Cru)) return { tipo: "falhou", resposta: erro(falhou, 502) };
    return { tipo: "ok", dados: p.mapear(j as Cru) };
  } catch {
    return { tipo: "falhou", resposta: erro(falhou, 502) };
  }
}

/** Tenta os provedores na ordem; o primeiro que acha vence. "Não encontrado" só quando TODOS dizem que não
   existe; se algum falhou (e nenhum achou), responde a falha do primeiro que falhou ("não respondeu"). */
async function consultar(provedores: Provedor[], naoEncontrado: string, falhou: string): Promise<Response> {
  let falha: Response | null = null;
  for (const p of provedores) {
    const t = await tentar(p, falhou);
    if (t.tipo === "ok") return Response.json(t.dados);
    if (t.tipo === "falhou") falha ??= t.resposta;
  }
  return falha ?? erro(naoEncontrado, 404);
}

/** Valida o parâmetro (14 dígitos com dígitos verificadores corretos) e consulta a Receita: BrasilAPI e, de reserva, ReceitaWS. */
export async function consultarCnpj(param: string): Promise<Response> {
  if (!/^\d{14}$/.test(param) || !validacao.cnpj(param)) return erro(ERROS_BRASILAPI.cnpjInvalido, 400);
  return consultar(
    [
      { url: `${BASE}/cnpj/v1/${param}`, mapear: mapearCnpj },
      { url: `${RESERVA_CNPJ}/${param}`, mapear: mapearReceitaWs,
        inexistente: (j) => String(j.status).toUpperCase() === "ERROR",
        valida: (j) => txt(j.nome).trim() !== "",
      },
    ],
    ERROS_BRASILAPI.cnpjNaoEncontrado,
    ERROS_BRASILAPI.cnpjFalhou,
  );
}

/** Valida o parâmetro (8 dígitos) e consulta o CEP: BrasilAPI v2 e, de reserva, ViaCEP. */
export async function consultarCep(param: string): Promise<Response> {
  if (!/^\d{8}$/.test(param)) return erro(ERROS_BRASILAPI.cepInvalido, 400);
  return consultar(
    [
      { url: `${BASE}/cep/v2/${param}`, mapear: mapearCep },
      { url: `${RESERVA_CEP}/${param}/json/`, mapear: mapearViaCep, inexistente: (j) => j.erro === true || j.erro === "true" },
    ],
    ERROS_BRASILAPI.cepNaoEncontrado,
    ERROS_BRASILAPI.cepFalhou,
  );
}
