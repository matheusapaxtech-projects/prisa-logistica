"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { mensagemDeErro } from "@/lib/erros";
import { validacao } from "@/lib/validacao";
import {
  camposPessoaPf,
  camposPessoaPj,
  CNPJ_INVALIDO,
  CPF_INVALIDO,
  data,
  marcado,
  pessoaPfParaBanco,
  pessoaPjParaBanco,
  texto,
  uf,
  vazioOuNulo,
} from "../_pessoa/dados-pessoa";
import { errosDoZod, lerForm, RE_ID, type ResultadoForm } from "../_pessoa/formulario";
import { chaves, ROT, UFS } from "../_pessoa/rotulos";
import { faltasAoCriar, lerNumero } from "./regras";

/* Gravações das telas de Proprietários. Validação = a de prototipo/proprietario-novo.html e
   proprietario.html (mesmas mensagens). Toda escrita passa por `comSessao` (RLS: pessoa e
   proprietário = admin/operação). */

const so = validacao.soDigitos;
const NAO_ACHADO = "Proprietário não encontrado. Atualize a página.";
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };
const MSG_TEL_INCOMPLETO = "Telefone incompleto: DDD e número, 10 ou 11 dígitos.";
const MSG_RNTRC = "O RNTRC tem 9 dígitos. Confira no certificado da ANTT.";
const MSG_TAC_PJ = "TAC é só para pessoa física.";

const ENQUADRAMENTOS = ["tac", "etc", "ctc", "etc_equiparado"] as const;
const REGRAS_FRETE = [
  "peso_saida",
  "peso_chegada",
  "peso_chegada_se_menor",
  "peso_chegada_com_tolerancia",
  "peso_chegada_acima_tolerancia",
] as const;
const DESCONTOS = ["nao", "inss_sest_senat", "sest_senat"] as const;
const QUALIFICACOES_INSS = ["qualificado", "nao_qualificado", "com_pendencia"] as const;


const dinheiro = z
  .string()
  .default("")
  .refine((v) => {
    const n = lerNumero(v);
    return n === null || (Number.isFinite(n) && n < 1e10);
  }, "Valor inválido: use números, com vírgula nos centavos.");
const percentual = z
  .string()
  .default("")
  .refine((v) => {
    const n = lerNumero(v);
    return n === null || (Number.isFinite(n) && n <= 100);
  }, "Percentual inválido: use um número de 0 a 100.");
const numeroOuNulo = (v: string) => lerNumero(v);

const email = z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido: confira o endereço (ex.: nome@empresa.com.br).");
const telefoneOpcional = z.string().refine((v) => !so(v) || so(v).length >= 10, MSG_TEL_INCOMPLETO);

/* ---------- RNTRC e situação ao criar ---------- */

const Antt = {
  rntrc: z.string().refine((v) => !v || so(v).length === 9, MSG_RNTRC).default(""),
  rntrc_emissao: data.default(""),
  rntrc_validade: data.default(""),
  enquadramento_antt: z.union([z.literal(""), z.enum(ENQUADRAMENTOS)]).default(""),
  agregado: z.enum(["sim", "nao"]).default("nao"),
  agregado_desde: data.default(""),
};

/** Agregado e data de início; a data só vale para agregado (o banco recusa data sem a marcação). */
const agregadoDe = (v: { agregado: "sim" | "nao"; agregado_desde: string }) => ({
  agregado: v.agregado === "sim",
  agregado_desde: v.agregado === "sim" ? vazioOuNulo(v.agregado_desde) : null,
});

/* ---------- novo proprietário ---------- */

const NovoPf = z.object({
  cpf: z.string().refine((v) => validacao.cpf(v), CPF_INVALIDO),
  nome: z.string().min(1, "Informe o nome completo, como está no CPF.").max(110, "O nome tem até 110 caracteres."),
  apelido: texto(60).default(""),
  nascimento: data.default(""),
  celular: telefoneOpcional.default(""),
  whatsapp: z.string().optional(),
  ...Antt,
});

const NovoPj = z
  .object({
    cnpj: z.string().refine((v) => validacao.cnpj(v), CNPJ_INVALIDO),
    nome: z.string().min(1, "Informe a razão social, como está no cartão CNPJ.").max(110, "A razão social tem até 110 caracteres."),
    nome_fantasia: texto(110).default(""),
    fundacao: data.default(""),
    natureza_juridica: texto(200).default(""),
    cnae_principal: texto(300).default(""),
    optante_simples: z.enum(["sim", "nao"]).optional(),
    dt_consulta_simples: data.default(""),
    cep: z.string().refine((v) => !so(v) || so(v).length === 8, "CEP tem 8 dígitos.").default(""),
    logradouro: texto(200).default(""),
    numero: texto(20).default(""),
    complemento: texto(100).default(""),
    bairro: texto(100).default(""),
    cidade: texto(100).default(""),
    uf: uf.default(""),
    responsavel_nome: z.string().min(1, "Informe quem responde pela empresa.").max(110, "Até 110 caracteres."),
    responsavel_telefone: z
      .string()
      .refine((v) => !!so(v), "Informe o telefone do responsável, com DDD.")
      .refine((v) => !so(v) || so(v).length >= 10, MSG_TEL_INCOMPLETO),
    responsavel_whatsapp: z.string().optional(),
    responsavel_email: email.default(""),
    receita: z.string().optional(),
    receita_situacao: z.string().optional(),
    ...Antt,
  })
  .superRefine((v, ctx) => {
    if (v.enquadramento_antt === "tac") ctx.addIssue({ code: "custom", path: ["enquadramento_antt"], message: MSG_TAC_PJ });
    if (v.cidade) {
      if (!v.logradouro) ctx.addIssue({ code: "custom", path: ["logradouro"], message: "Informe a rua ou avenida." });
      if (!v.uf) ctx.addIssue({ code: "custom", path: ["uf"], message: "Escolha a UF." });
    }
  });

const Ligar = z.object({
  pessoa_id: z.string().regex(RE_ID, NAO_ACHADO),
  ...Antt,
});

export type Criado = { id: string; avisos: string[] };

const SEM_PAPEL = (nome: string, motivo: string, doc: "CPF" | "CNPJ") => ({
  code: "P0001",
  message:
    `${nome} foi cadastrado como pessoa, mas o cadastro de proprietário não: ${motivo} ` +
    `Para completar, digite o ${doc} de novo nesta tela e use “Cadastrar também como proprietário”.`,
});

/** Cria a pessoa (PF ou PJ) e o papel de proprietário. O cadastro nasce "normal" só com RNTRC, validade e
   enquadramento (e, com consulta, a empresa ativa na Receita); senão "pendente". Se o papel não puder ser
   gravado depois da pessoa, a pessoa fica e a mensagem diz como completar (a busca pelo documento acha a
   pessoa sem papel e oferece "Cadastrar também como proprietário"). */
export async function criarProprietario(form: FormData): Promise<ResultadoForm<Criado>> {
  const bruto = lerForm(form);
  const modo = bruto.modo;
  if (modo === "ligar") return ligarProprietario(bruto);
  if (modo !== "pf" && modo !== "pj") return { ok: false, erro: "Escolha o tipo: pessoa física ou empresa." };

  if (modo === "pf") {
    const v = NovoPf.safeParse(bruto);
    if (!v.success) return errosDoZod(v.error);
    const n = v.data;
    const situacao = faltasAoCriar(n, undefined).length ? "pendente" : "normal";
    return comSessao(async ({ supabase }) => {
      const db = tipado(supabase);
      const pessoa = await db
        .from("pessoa")
        .insert({
          tipo: "pf",
          nome: n.nome.replace(/\s+/g, " "),
          apelido: vazioOuNulo(n.apelido),
          cpf: so(n.cpf),
          nascimento: vazioOuNulo(n.nascimento),
          situacao_cadastro: situacao,
        })
        .select("id")
        .single();
      if (pessoa.error) throw pessoa.error;
      const id = pessoa.data.id;
      revalidatePath("/proprietarios");

      const pr = await db.from("proprietario").insert({
        pessoa_id: id,
        rntrc: vazioOuNulo(so(n.rntrc)),
        rntrc_emissao: vazioOuNulo(n.rntrc_emissao),
        rntrc_validade: vazioOuNulo(n.rntrc_validade),
        enquadramento_antt: vazioOuNulo(n.enquadramento_antt),
        ...agregadoDe(n),
        situacao_cadastro: situacao,
      });
      if (pr.error) throw SEM_PAPEL(n.nome, mensagemDeErro(pr.error), "CPF");

      const avisos: string[] = [];
      if (so(n.celular)) {
        const tel = await db
          .from("pessoa_telefone")
          .insert({ pessoa_id: id, numero: so(n.celular), tipo: "celular", whatsapp: marcado(n.whatsapp), principal: true });
        if (tel.error) avisos.push("O telefone não foi gravado: adicione na aba Contatos.");
      }
      return { id, avisos };
    });
  }

  const v = NovoPj.safeParse(bruto);
  if (!v.success) return errosDoZod(v.error);
  const n = v.data;
  const situacao = faltasAoCriar(n, n.receita ? (n.receita_situacao ?? "") : undefined).length ? "pendente" : "normal";
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const pessoa = await db
      .from("pessoa")
      .insert({
        tipo: "pj",
        nome: n.nome.replace(/\s+/g, " "),
        nome_fantasia: vazioOuNulo(n.nome_fantasia),
        cnpj: so(n.cnpj),
        fundacao: vazioOuNulo(n.fundacao),
        natureza_juridica: vazioOuNulo(n.natureza_juridica),
        cnae_principal: vazioOuNulo(n.cnae_principal),
        optante_simples: n.optante_simples ? n.optante_simples === "sim" : null,
        dt_consulta_simples: vazioOuNulo(n.dt_consulta_simples),
        dt_consulta_brasilapi: n.receita ? new Date().toISOString() : null,
        situacao_cadastro: situacao,
      })
      .select("id")
      .single();
    if (pessoa.error) throw pessoa.error;
    const id = pessoa.data.id;
    revalidatePath("/proprietarios");

    const pr = await db.from("proprietario").insert({
      pessoa_id: id,
      rntrc: vazioOuNulo(so(n.rntrc)),
      rntrc_emissao: vazioOuNulo(n.rntrc_emissao),
      rntrc_validade: vazioOuNulo(n.rntrc_validade),
      enquadramento_antt: vazioOuNulo(n.enquadramento_antt),
      ...agregadoDe(n),
      responsavel_nome: n.responsavel_nome.replace(/\s+/g, " "),
      responsavel_telefone: so(n.responsavel_telefone),
      responsavel_whatsapp: marcado(n.responsavel_whatsapp),
      responsavel_email: vazioOuNulo(n.responsavel_email),
      situacao_cadastro: situacao,
    });
    if (pr.error) throw SEM_PAPEL(n.nome, mensagemDeErro(pr.error), "CNPJ");

    const avisos: string[] = [];
    if (n.cidade) {
      const end = await db.from("pessoa_endereco").insert({
        pessoa_id: id,
        tipo: "comercial",
        cep: vazioOuNulo(so(n.cep)),
        logradouro: n.logradouro,
        numero: n.numero || "s/n",
        complemento: vazioOuNulo(n.complemento),
        bairro: vazioOuNulo(n.bairro),
        cidade: n.cidade,
        uf: n.uf as (typeof UFS)[number],
        principal: true,
      });
      if (end.error) avisos.push("O endereço não foi gravado: adicione na aba Contatos.");
    }
    return { id, avisos };
  });
}

/** Liga o papel de proprietário a uma pessoa que já existe (ex.: motorista). Só faltam os dados da ANTT. */
async function ligarProprietario(bruto: Record<string, string>): Promise<ResultadoForm<Criado>> {
  const v = Ligar.safeParse(bruto);
  if (!v.success) return errosDoZod(v.error);
  const l = v.data;
  const situacao = faltasAoCriar(l).length ? "pendente" : "normal";
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const ja = await db.from("proprietario").select("pessoa_id").eq("pessoa_id", l.pessoa_id).maybeSingle();
    if (ja.error) throw ja.error;
    if (ja.data) throw { code: "P0001", message: "Esta pessoa já é proprietária. Abra a ficha pela lista." };
    const { error } = await db.from("proprietario").insert({
      pessoa_id: l.pessoa_id,
      rntrc: vazioOuNulo(so(l.rntrc)),
      rntrc_emissao: vazioOuNulo(l.rntrc_emissao),
      rntrc_validade: vazioOuNulo(l.rntrc_validade),
      enquadramento_antt: vazioOuNulo(l.enquadramento_antt),
      ...agregadoDe(l),
      situacao_cadastro: situacao,
    });
    if (error) {
      if (/TAC só para pessoa física/.test(error.message)) throw { code: "P0001", message: MSG_TAC_PJ };
      throw error;
    }
    revalidatePath("/proprietarios");
    return { id: l.pessoa_id, avisos: [] };
  });
}

export type PessoaParaLigar = {
  nascimento: string | null;
  naturalidade: string | null;
  naturalidade_uf: string | null;
  telefone: string | null;
  whatsapp: boolean;
};

/** Dados que o "ligar" mostra da pessoa que já existe (nascimento, naturalidade e telefone principal não restrito). */
export async function dadosParaLigar(pessoaId: string): Promise<ResultadoAcao<PessoaParaLigar>> {
  if (!RE_ID.test(pessoaId)) return { ok: false, erro: NAO_ACHADO };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const [p, t] = await Promise.all([
      db.from("pessoa").select("nascimento, naturalidade, naturalidade_uf").eq("id", pessoaId).maybeSingle(),
      db.from("pessoa_telefone").select("numero, whatsapp, principal, restrito").eq("pessoa_id", pessoaId).order("created_at"),
    ]);
    if (p.error) throw p.error;
    if (t.error) throw t.error;
    const tels = (t.data ?? []).filter((x) => !x.restrito);
    const tel = tels.find((x) => x.principal) ?? tels[0];
    return {
      nascimento: p.data?.nascimento ?? null,
      naturalidade: p.data?.naturalidade ?? null,
      naturalidade_uf: p.data?.naturalidade_uf ?? null,
      telefone: tel?.numero ?? null,
      whatsapp: tel?.whatsapp ?? false,
    };
  });
}

/* ---------- ficha: Dados, ANTT, Responsável e Pagamento (um formulário, uma barra de salvar) ---------- */

const Comum = {
  situacao_cadastro: z.enum(chaves(ROT.situacao_cadastro), "Escolha a situação do cadastro."),
  rntrc: z.string().refine((v) => !v || so(v).length === 9, MSG_RNTRC).default(""),
  rntrc_emissao: data.default(""),
  rntrc_validade: data.default(""),
  enquadramento_antt: z.union([z.literal(""), z.enum(ENQUADRAMENTOS)]).default(""),
  alto_desempenho: z.enum(["sim", "nao"]).default("nao"),
  agregado: z.enum(["sim", "nao"]).default("nao"),
  agregado_desde: data.default(""),
  qualificado_gmp: z.enum(["sim", "nao"]).optional(),
  dt_qualificacao_gmp: data.default(""),
  regra_pgto_frete: z.enum(REGRAS_FRETE).optional(),
  taxa_adm_valor: dinheiro,
  taxa_adm_percentual: percentual,
  limite_adiantamento_percentual: percentual,
  limite_adiantamento_valor: dinheiro,
  frete_empresa_motorista_valor: dinheiro,
  frete_empresa_motorista_percentual: percentual,
};

const FichaPf = z.object({
  ...Comum,
  ...camposPessoaPf,
  nr_inss: z
    .string()
    .refine((v) => !so(v) || so(v).length === 11, "O NIT tem 11 dígitos.")
    .default(""),
  qualificacao_inss: z.union([z.literal(""), z.enum(QUALIFICACOES_INSS)]).default(""),
  nr_dependentes: z
    .string()
    .refine((v) => v === "" || (/^\d{1,2}$/.test(v)), "Dependentes: um número de 0 a 99.")
    .default(""),
  autoriza_desconto_inss: z.enum(DESCONTOS).default("nao"),
});

const FichaPj = z
  .object({
    ...Comum,
    ...camposPessoaPj,
    responsavel_nome: texto(110).default(""),
    responsavel_telefone: telefoneOpcional.default(""),
    responsavel_whatsapp: z.string().optional(),
    responsavel_email: email.default(""),
  })
  .superRefine((v, ctx) => {
    if (v.enquadramento_antt === "tac") ctx.addIssue({ code: "custom", path: ["enquadramento_antt"], message: MSG_TAC_PJ });
  });

/** Grava a ficha (pessoa e proprietário). O tipo (PF/PJ) vem do banco, nunca do formulário. */
export async function salvarFicha(pessoaId: string, form: FormData): Promise<ResultadoForm> {
  if (!RE_ID.test(pessoaId)) return { ok: false, erro: NAO_ACHADO };
  const bruto = lerForm(form);
  // O tipo (PF/PJ) decide quais campos valem; vem do banco, nunca do formulário.
  const tipo = await comSessao(async ({ supabase }) => {
    const atual = await tipado(supabase).from("pessoa").select("tipo").eq("id", pessoaId).maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data) throw { code: "P0001", message: NAO_ACHADO };
    return atual.data.tipo;
  });
  if (!tipo.ok) return tipo;
  const pj = tipo.dados === "pj";
  const v = (pj ? FichaPj : FichaPf).safeParse(bruto);
  if (!v.success) return errosDoZod(v.error);
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const f = v.data as z.infer<typeof FichaPf> & z.infer<typeof FichaPj>;
    const n = vazioOuNulo;

    // Pessoa: identificação e inscrições (_pessoa/dados-pessoa) e, na PF, o INSS do autônomo.
    const p = await db
      .from("pessoa")
      .update(
        pj
          ? pessoaPjParaBanco(f)
          : {
              ...pessoaPfParaBanco(f),
              nr_inss: n(so(f.nr_inss)),
              qualificacao_inss: n(f.qualificacao_inss),
              nr_dependentes: f.nr_dependentes === "" ? null : Number(f.nr_dependentes),
            },
      )
      .eq("id", pessoaId)
      .select("id");
    if (p.error) throw p.error;
    if (!p.data?.length) throw SEM_PERMISSAO;

    const pr = await db
      .from("proprietario")
      .update({
        situacao_cadastro: f.situacao_cadastro,
        rntrc: n(so(f.rntrc)),
        rntrc_emissao: n(f.rntrc_emissao),
        rntrc_validade: n(f.rntrc_validade),
        enquadramento_antt: n(f.enquadramento_antt),
        alto_desempenho: f.alto_desempenho === "sim",
        agregado: f.agregado === "sim",
        // A data de início só vale para agregado (o banco recusa data sem a marcação).
        agregado_desde: f.agregado === "sim" ? n(f.agregado_desde) : null,
        qualificado_gmp: f.qualificado_gmp ? f.qualificado_gmp === "sim" : null,
        dt_qualificacao_gmp: n(f.dt_qualificacao_gmp),
        regra_pgto_frete: f.regra_pgto_frete ?? null,
        taxa_adm_valor: numeroOuNulo(f.taxa_adm_valor),
        taxa_adm_percentual: numeroOuNulo(f.taxa_adm_percentual),
        limite_adiantamento_percentual: numeroOuNulo(f.limite_adiantamento_percentual),
        limite_adiantamento_valor: numeroOuNulo(f.limite_adiantamento_valor),
        frete_empresa_motorista_valor: numeroOuNulo(f.frete_empresa_motorista_valor),
        frete_empresa_motorista_percentual: numeroOuNulo(f.frete_empresa_motorista_percentual),
        ...(pj
          ? {
              responsavel_nome: n(f.responsavel_nome),
              responsavel_telefone: n(so(f.responsavel_telefone)),
              responsavel_whatsapp: marcado(f.responsavel_whatsapp),
              responsavel_email: n(f.responsavel_email),
            }
          : { autoriza_desconto_inss: f.autoriza_desconto_inss }),
      })
      .eq("pessoa_id", pessoaId)
      .select("pessoa_id");
    if (pr.error) {
      if (/TAC só para pessoa física/.test(pr.error.message)) throw { code: "P0001", message: MSG_TAC_PJ };
      throw pr.error;
    }
    if (!pr.data?.length) throw SEM_PERMISSAO;
    revalidatePath(`/proprietarios/${pessoaId}`);
    revalidatePath("/proprietarios");
  });
}
