/* Dados cadastrais da pessoa (identificação PF/PJ e inscrições) editados na aba "Dados" das fichas
   de proprietário e de cliente: os campos do zod e a conversão para o `update` da tabela `pessoa`.
   Puro (servidor e cliente). O que é de um papel (ANTT, INSS do autônomo, faturamento…) fica no
   esquema da própria ficha, que estende estes campos. */
import { z } from "zod";
import { validacao } from "@/lib/validacao";
import { chaves, ROT, UFS } from "./rotulos";

const so = validacao.soDigitos;

export const CPF_INVALIDO = "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.";
export const CNPJ_INVALIDO = "CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.";

export const data = z.union([z.literal(""), z.iso.date("Data inválida.")]);
export const texto = (max: number) => z.string().max(max, `Até ${max} caracteres.`);
export const vazioOuNulo = <T extends string>(v: T | "" | undefined): T | null => (v ? v : null);
export const marcado = (v: string | undefined) => v === "on" || v === "true";
export const enumOpcional = <T extends Record<string, string>>(mapa: T) => z.union([z.literal(""), z.enum(chaves(mapa))]);
export const uf = z.union([z.literal(""), z.enum(UFS)]);

/** Inscrições e atividade principal (PF e PJ), e a marca de "consultado na Receita agora". */
const camposComuns = {
  inscricao_estadual_isento: z.string().optional(),
  inscricao_estadual: texto(30).default(""),
  inscricao_municipal: texto(30).default(""),
  cnae_principal: texto(300).default(""),
  receita_consultada: z.string().optional(),
};

/** Campos da pessoa física no formulário da ficha. */
export const camposPessoaPf = {
  ...camposComuns,
  nome: z.string().min(1, "Informe o nome completo, como está no CPF.").max(110, "O nome tem até 110 caracteres."),
  apelido: texto(60).default(""),
  cpf: z.string().refine((v) => validacao.cpf(v), CPF_INVALIDO),
  situacao_cpf: enumOpcional(ROT.situacao_cpf).default(""),
  dt_consulta_cpf: data.default(""),
  nascimento: data.default(""),
  sexo: enumOpcional(ROT.sexo).default(""),
  raca_cor: enumOpcional(ROT.raca_cor).default(""),
  estado_civil: enumOpcional(ROT.estado_civil).default(""),
  naturalidade: texto(80).default(""),
  naturalidade_uf: uf.default(""),
  grau_instrucao: enumOpcional(ROT.grau_instrucao).default(""),
  rg: texto(20).default(""),
  rg_orgao: texto(20).default(""),
  rg_uf: uf.default(""),
  rg_emissao: data.default(""),
  pai: texto(80).default(""),
  mae: texto(80).default(""),
};

/** Campos da empresa no formulário da ficha. */
export const camposPessoaPj = {
  ...camposComuns,
  nome: z.string().min(1, "Informe a razão social, como está no cartão CNPJ.").max(110, "A razão social tem até 110 caracteres."),
  cnpj: z.string().refine((v) => validacao.cnpj(v), CNPJ_INVALIDO),
  nome_fantasia: texto(110).default(""),
  fundacao: data.default(""),
  natureza_juridica: texto(200).default(""),
  optante_simples: z.enum(["sim", "nao"]).optional(),
  dt_consulta_simples: data.default(""),
};

export const esquemaPessoaPf = z.object(camposPessoaPf);
export const esquemaPessoaPj = z.object(camposPessoaPj);
export type DadosPessoaPf = z.infer<typeof esquemaPessoaPf>;
export type DadosPessoaPj = z.infer<typeof esquemaPessoaPj>;

function comuns(f: DadosPessoaPf | DadosPessoaPj) {
  const isento = marcado(f.inscricao_estadual_isento);
  return {
    nome: f.nome.trim().replace(/\s+/g, " "),
    inscricao_estadual_isento: isento,
    inscricao_estadual: isento ? null : vazioOuNulo(f.inscricao_estadual),
    inscricao_municipal: vazioOuNulo(f.inscricao_municipal),
    cnae_principal: vazioOuNulo(f.cnae_principal),
  };
}

/** `update` da pessoa física: só os campos do formulário (nada de papel nem de INSS). */
export function pessoaPfParaBanco(f: DadosPessoaPf) {
  const n = vazioOuNulo;
  return {
    ...comuns(f),
    cpf: so(f.cpf),
    apelido: n(f.apelido),
    situacao_cpf: n(f.situacao_cpf),
    dt_consulta_cpf: n(f.dt_consulta_cpf),
    nascimento: n(f.nascimento),
    sexo: n(f.sexo),
    raca_cor: n(f.raca_cor),
    estado_civil: n(f.estado_civil),
    naturalidade: n(f.naturalidade),
    naturalidade_uf: n(f.naturalidade_uf),
    grau_instrucao: n(f.grau_instrucao),
    rg: n(f.rg),
    rg_orgao: n(f.rg_orgao),
    rg_uf: n(f.rg_uf),
    rg_emissao: n(f.rg_emissao),
    pai: n(f.pai),
    mae: n(f.mae),
  };
}

/** `update` da empresa. Com `receita_consultada`, marca agora como a data da consulta à Receita. */
export function pessoaPjParaBanco(f: DadosPessoaPj, agora: () => string = () => new Date().toISOString()) {
  const n = vazioOuNulo;
  return {
    ...comuns(f),
    cnpj: so(f.cnpj),
    nome_fantasia: n(f.nome_fantasia),
    fundacao: n(f.fundacao),
    natureza_juridica: n(f.natureza_juridica),
    optante_simples: f.optante_simples ? f.optante_simples === "sim" : null,
    dt_consulta_simples: n(f.dt_consulta_simples),
    ...(f.receita_consultada ? { dt_consulta_brasilapi: agora() } : {}),
  };
}
