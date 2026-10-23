/* Validação (zod) dos formulários de veículo, no servidor. As mensagens são as do protótipo
   (veiculo-novo.html e veiculo.html); os limites são os das colunas e dos checks de `veiculo`
   (migration 0600). Puro: o teste de unidade chama estas funções direto. */
import { z } from "zod";
import { validacao } from "@/lib/validacao";
import { ASSOALHO, RASTREAMENTO, RECEBEDOR, SITUACAO_CADASTRO, SITUACAO_OPERACIONAL, UFS, lerNum } from "./rotulos";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Id de linha do banco (as seeds usam ids fora da RFC 9562, então só o formato 8-4-4-4-12). */
export const ehId = (v: unknown): v is string => typeof v === "string" && GUID.test(v);

const anoAtual = () => new Date().getFullYear();

/* ---------- peças ---------- */
const vazioParaNulo = (v: string) => (v === "" ? null : v);

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform(vazioParaNulo);

const data = z
  .string()
  .trim()
  .transform(vazioParaNulo)
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Use uma data válida.");

const idOpcional = z
  .string()
  .trim()
  .transform(vazioParaNulo)
  .refine((v) => v === null || ehId(v), "Escolha uma opção da lista.");

const idObrigatorio = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => ehId(v), msg);

/** Código numérico de uma lista de apoio (smallint): vazio = nulo. */
const codigo = (msg: string) =>
  z
    .string()
    .trim()
    .transform(vazioParaNulo)
    .refine((v) => v === null || /^\d{1,5}$/.test(v), msg)
    .transform((v) => (v === null ? null : Number(v)));

const inteiro = (max: number) =>
  z
    .string()
    .trim()
    .transform(vazioParaNulo)
    .refine((v) => v === null || /^\d+$/.test(v), "Use só números.")
    .transform((v) => (v === null ? null : Number(v)))
    .refine((v) => v === null || v <= max, `Use um número até ${max}.`);

/** Número com vírgula; `max` é exclusivo (limite da coluna numeric). */
const decimal = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || lerNum(v) != null, "Use só números, com vírgula nos decimais.")
    .transform((v) => (v === "" ? null : lerNum(v)))
    .refine((v) => v === null || v >= 0, "Não pode ser negativo.")
    .refine((v) => v === null || v < max, `Use um valor menor que ${max.toLocaleString("pt-BR")}.`);

const opcao = <T extends string>(valores: readonly T[], msg = "Escolha uma das opções.") =>
  z
    .string()
    .trim()
    .transform(vazioParaNulo)
    .refine((v) => v === null || (valores as readonly string[]).includes(v), msg)
    .transform((v) => v as T | null);

/* ---------- campos do CRLV (comuns ao novo e à ficha) ---------- */
export const placaDe = z
  .string()
  .transform((v) => validacao.normalizarPlaca(v))
  .refine((v) => validacao.placa(v), "Placa inválida: use ABC1234 ou ABC1D23.");

const renavam = z
  .string()
  .transform((v) => validacao.soDigitos(v))
  .refine((v) => v === "" || v.length === 11, "Renavam tem 11 dígitos.")
  .transform(vazioParaNulo);

const chassiBruto = z.string().transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""));

const anoFabricacao = z
  .string()
  .transform((v) => validacao.soDigitos(v))
  .refine((v) => v === "" || (v.length === 4 && +v >= 1970 && +v <= anoAtual() + 1), { error: () => `Use um ano entre 1970 e ${anoAtual() + 1}.` })
  .transform((v) => (v === "" ? null : Number(v)));

const anoModelo = z
  .string()
  .transform((v) => validacao.soDigitos(v))
  .refine((v) => v === "" || v.length === 4, "Use o ano com 4 dígitos.")
  .transform((v) => (v === "" ? null : Number(v)));

/** O ano do modelo é o de fabricação ou o seguinte (regra do protótipo). */
function conferirAnos(v: { ano_fabricacao?: number | null; ano_modelo?: number | null }, ctx: z.RefinementCtx) {
  const fab = v.ano_fabricacao;
  const mod = v.ano_modelo;
  if (fab && mod && (mod < fab || mod > fab + 1))
    ctx.addIssue({ code: "custom", path: ["ano_modelo"], message: `O ano do modelo é ${fab} ou ${fab + 1}.` });
}

function dinheiro() {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || lerNum(v) != null, "Use só números, com vírgula nos centavos.")
    .transform((v) => (v === "" ? null : lerNum(v)))
    .refine((v) => v === null || v >= 0, "Não pode ser negativo.")
    .refine((v) => v === null || v < 1e10, "Use um valor menor.");
}

/* ---------- novo veículo ---------- */
export const NovoVeiculo = z
  .object({
    placa: placaDe,
    tipo_veiculo_id: z
      .string()
      .trim()
      .refine((v) => /^\d{1,5}$/.test(v), "Escolha o tipo.")
      .transform(Number),
    renavam: renavam.refine((v) => v !== null, "Informe o Renavam."),
    chassi: chassiBruto
      .refine((v) => !/[IOQ]/.test(v), "Chassi não tem as letras I, O ou Q. Confira se é 1 ou 0.")
      .refine((v) => v.length === 17, "Chassi tem 17 caracteres."),
    cor: texto(40),
    marca_id: z
      .string()
      .trim()
      .refine((v) => /^\d{1,5}$/.test(v), "Escolha a marca.")
      .transform(Number),
    modelo: z.string().trim().min(1, "Informe o modelo.").max(80, "Use até 80 caracteres."),
    ano_fabricacao: anoFabricacao.refine((v) => v !== null, "Informe o ano de fabricação."),
    ano_modelo: anoModelo.refine((v) => v !== null, "Informe o ano do modelo."),
    uf_emplacamento: opcao(UFS),
    cidade_emplacamento: texto(80),
    proprietario_posse_id: idObrigatorio("Escolha o proprietário da posse."),
    proprietario_documento_id: idOpcional,
  })
  .superRefine(conferirAnos);

export type DadosNovoVeiculo = z.output<typeof NovoVeiculo>;

/* ---------- ficha ---------- */
const SIM_NAO = ["true", "false"] as const;

/** Todo campo é opcional: chave ausente = a aba não mostra o campo (ex.: CMT só no cavalo), então
   a coluna não é tocada. */
export const FichaVeiculo = z
  .object({
    // CRLV
    renavam: renavam.optional(),
    placa: placaDe.optional(),
    exercicio_doc: z
      .string()
      .transform((v) => validacao.soDigitos(v))
      .refine((v) => v === "" || (v.length === 4 && +v >= 1990 && +v <= anoAtual() + 1), "Use o ano com 4 dígitos.")
      .transform((v) => (v === "" ? null : Number(v)))
      .optional(),
    dt_emissao_crlv: data.optional(),
    ano_fabricacao: anoFabricacao.optional(),
    ano_modelo: anoModelo.optional(),
    nr_certificado_doc: texto(20).optional(),
    nr_seguranca_crlv: texto(40).optional(),
    nr_registro_crlv: texto(40).optional(),
    marca_id: codigo("Escolha a marca.").optional(),
    modelo: texto(80).optional(),
    tipo_veiculo_id: z
      .string()
      .trim()
      .refine((v) => /^\d{1,5}$/.test(v), "Escolha o tipo.")
      .transform(Number)
      .optional(),
    cor: texto(40).optional(),
    chassi: chassiBruto
      .refine((v) => v.length <= 25, "Chassi tem no máximo 25 caracteres.")
      .transform(vazioParaNulo)
      .optional(),
    uf_emplacamento: opcao(UFS).optional(),
    cidade_emplacamento: texto(80).optional(),
    situacao_cadastro: opcao(SITUACAO_CADASTRO.map(([k]) => k))
      .refine((v) => v !== null, "Escolha a situação.")
      .optional(),
    observacao: texto(2000).optional(),
    // Proprietários
    proprietario_posse_id: idObrigatorio("Escolha o proprietário da posse.").optional(),
    proprietario_documento_id: idObrigatorio("Escolha o proprietário do documento (ANTT).").optional(),
    recebedor_valores: opcao(RECEBEDOR.map(([k]) => k)).optional(),
    ultimo_motorista_id: idOpcional.optional(),
    // Características
    tipo_assoalho: opcao(ASSOALHO.map(([k]) => k)).optional(),
    comprimento_m: decimal(1000).optional(),
    largura_m: decimal(1000).optional(),
    altura_m: decimal(1000).optional(),
    pbt_t: decimal(10000).optional(),
    tara_t: decimal(10000).optional(),
    capacidade_carga_t: decimal(10000).optional(),
    cap_auto: z.string().optional(),
    cmt_t: decimal(10000).optional(),
    // TAG e seguro
    tag_numero: texto(40).optional(),
    tag_operadora_id: codigo("Escolha a operadora.").optional(),
    seguradora: texto(80).optional(),
    apolice: texto(40).optional(),
    seguro_validade: data.optional(),
    // Rastreamento
    rastreador_empresa: texto(80).optional(),
    rastreador_modelo: texto(80).optional(),
    rastreador_numero: texto(40).optional(),
    rastreamento_tipo: opcao(RASTREAMENTO.map(([k]) => k)).optional(),
    rastreador_observacao: texto(2000).optional(),
    pgr_sm_automatica: opcao(SIM_NAO)
      .transform((v) => (v === null ? null : v === "true"))
      .optional(),
    // Frota
    nr_frota: texto(20).optional(),
    unidade_operacional_id: codigo("Escolha a unidade.").optional(),
    situacao_operacional: opcao(SITUACAO_OPERACIONAL.map(([k]) => k))
      .refine((v) => v !== null, "Escolha a situação.")
      .optional(),
    potencia_motor: texto(40).optional(),
    hp: inteiro(32767).optional(),
    nr_motor: texto(40).optional(),
    litros_tanque: decimal(100000).optional(),
    media_padrao_carregado: decimal(1000).optional(),
    media_padrao_vazio: decimal(1000).optional(),
    km_inicial: z
      .string()
      .transform((v) => validacao.soDigitos(v))
      .refine((v) => v === "" || +v <= 2147483647, "Use um número menor.")
      .transform((v) => (v === "" ? null : Number(v)))
      .optional(),
    aquisicao: data.optional(),
    vl_compra: dinheiro().optional(),
    vl_mercado: dinheiro().optional(),
    venc_ipva: data.optional(),
  })
  .superRefine(conferirAnos)
  .superRefine((v, ctx) => {
    // Capacidade informada à mão: tem de haver número (sem a marca "calcular").
    if (v.cap_auto === undefined && "capacidade_carga_t" in v && v.capacidade_carga_t == null)
      ctx.addIssue({ code: "custom", path: ["capacidade_carga_t"], message: "Informe a capacidade ou volte a calcular." });
  });

export type DadosFicha = z.output<typeof FichaVeiculo>;

/** Primeira mensagem de cada campo, no formato que as telas mostram ao lado do campo. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const i of erro.issues) {
    const k = String(i.path[0] ?? "");
    if (k && !campos[k]) campos[k] = i.message;
  }
  return campos;
}

/** `FormData` → objeto de textos (só chaves de texto; arquivos não entram). */
export function textosDe(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}
