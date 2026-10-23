/* Regras puras das telas de Clientes (servidor e cliente): rótulos e os esquemas de validação de
   faturamento e de local de coleta/descarga. Fora de actions.ts porque um arquivo "use server" só
   exporta funções assíncronas (e os testes usam os esquemas direto). */
import { z } from "zod";
import { validacao } from "@/lib/validacao";
import { RE_ID } from "../_pessoa/formulario";
import { UFS } from "../_pessoa/rotulos";

const so = validacao.soDigitos;

/** Condição de faturamento (enum `condicao_faturamento`), na ordem da tela. */
export const CONDICOES = {
  por_cte: "Por CT-e",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
} as const;

export const NAO_ACHADO = "Cliente não encontrado. Atualize a página.";
export const MSG_EMAIL = "E-mail inválido";
export const MSG_GERENCIADORA = "Informe a gerenciadora";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const marcado = (v: string | undefined) => v === "on" || v === "true";
const nulo = (v: string | undefined) => (v ? v : null);
const texto = (max: number) => z.string().max(max, `Até ${max} caracteres.`).default("");
const email = z
  .string()
  .default("")
  .refine((v) => !v || RE_EMAIL.test(v), MSG_EMAIL);

/** Aba "Faturamento e exigências". Saída já no formato da tabela `cliente`. */
export const esquemaFaturamento = z
  .object({
    pessoa_id: z.string().regex(RE_ID, NAO_ACHADO),
    condicao_faturamento: z.enum(["por_cte", "semanal", "quinzenal", "mensal"], "Escolha a condição de faturamento."),
    email_xml: email,
    email_cobranca: email,
    exige_gr: z.string().optional(),
    gerenciadora: texto(110),
    exige_sm: z.string().optional(),
    exigencias: texto(2000),
  })
  .superRefine((v, ctx) => {
    if (marcado(v.exige_gr) && !v.gerenciadora) ctx.addIssue({ code: "custom", path: ["gerenciadora"], message: MSG_GERENCIADORA });
  })
  .transform((v) => {
    const gr = marcado(v.exige_gr);
    return {
      pessoa_id: v.pessoa_id,
      condicao_faturamento: v.condicao_faturamento,
      email_xml: nulo(v.email_xml.toLowerCase()),
      email_cobranca: nulo(v.email_cobranca.toLowerCase()),
      exige_gr: gr,
      // Sem exigir GR, a gerenciadora não significa nada: não fica gravada.
      gerenciadora: gr ? v.gerenciadora.replace(/\s+/g, " ") : null,
      exige_sm: marcado(v.exige_sm),
      exigencias: nulo(v.exigencias),
    };
  });

export type DadosFaturamento = z.output<typeof esquemaFaturamento>;

/** Local de coleta/descarga (`pessoa_endereco` com tipo `coleta_descarga`). Com `id`, altera; sem, inclui. */
export const esquemaLocal = z
  .object({
    pessoa_id: z.string().regex(RE_ID, NAO_ACHADO),
    id: z.union([z.literal(""), z.string().regex(RE_ID, "Local não encontrado. Atualize a página.")]).default(""),
    cep: z
      .string()
      .default("")
      .refine((v) => !so(v) || so(v).length === 8, "O CEP tem 8 dígitos."),
    logradouro: texto(200),
    numero: texto(20),
    complemento: texto(100),
    bairro: texto(100),
    cidade: z.string().min(1, "Informe a cidade.").max(100, "Até 100 caracteres."),
    uf: z.enum(UFS, "Escolha a UF."),
    ponto_referencia: texto(200),
    janela_atendimento: texto(200),
    contato_local: texto(200),
  })
  .transform((v) => ({
    pessoa_id: v.pessoa_id,
    id: v.id || null,
    cep: nulo(so(v.cep)),
    logradouro: nulo(v.logradouro),
    numero: v.numero || "s/n",
    complemento: nulo(v.complemento),
    bairro: nulo(v.bairro),
    cidade: v.cidade,
    uf: v.uf,
    ponto_referencia: nulo(v.ponto_referencia),
    janela_atendimento: nulo(v.janela_atendimento),
    contato_local: nulo(v.contato_local),
  }));

export type DadosLocal = z.output<typeof esquemaLocal>;
