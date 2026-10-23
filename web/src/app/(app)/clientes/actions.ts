"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { mensagemDeErro } from "@/lib/erros";
import { validacao } from "@/lib/validacao";
import {
  CNPJ_INVALIDO,
  CPF_INVALIDO,
  data,
  esquemaPessoaPf,
  esquemaPessoaPj,
  pessoaPfParaBanco,
  pessoaPjParaBanco,
  texto as textoMax,
  uf,
  vazioOuNulo,
} from "../_pessoa/dados-pessoa";
import { errosDoZod, lerForm, RE_ID, type ResultadoForm } from "../_pessoa/formulario";
import { UFS } from "../_pessoa/rotulos";
import { esquemaFaturamento, esquemaLocal, NAO_ACHADO } from "./regras";

/* Gravações das telas de Clientes. Toda escrita passa por `comSessao` (RLS: pessoa, cliente e
   endereço = admin/operação; apagar local = só admin). */

const so = validacao.soDigitos;
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };

const texto = (max: number) => textoMax(max).default("");
const nulo = vazioOuNulo;

function revalidarCliente(id: string) {
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

/* ---------- novo cliente ---------- */

const NovoPf = z.object({
  cpf: z.string().refine((v) => validacao.cpf(v), CPF_INVALIDO),
  nome: z.string().min(1, "Informe o nome completo, como está no CPF.").max(110, "O nome tem até 110 caracteres."),
});

const NovoPj = z
  .object({
    cnpj: z.string().refine((v) => validacao.cnpj(v), CNPJ_INVALIDO),
    nome: z.string().min(1, "Informe a razão social, como está no cartão CNPJ.").max(110, "A razão social tem até 110 caracteres."),
    nome_fantasia: texto(110),
    fundacao: data.default(""),
    natureza_juridica: texto(200),
    cnae_principal: texto(300),
    optante_simples: z.enum(["sim", "nao"]).optional(),
    cep: z
      .string()
      .default("")
      .refine((v) => !so(v) || so(v).length === 8, "O CEP tem 8 dígitos."),
    logradouro: texto(200),
    numero: texto(20),
    complemento: texto(100),
    bairro: texto(100),
    cidade: texto(100),
    uf: uf.default(""),
    receita: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.cidade) {
      if (!v.logradouro) ctx.addIssue({ code: "custom", path: ["logradouro"], message: "Informe a rua ou avenida." });
      if (!v.uf) ctx.addIssue({ code: "custom", path: ["uf"], message: "Escolha a UF." });
    }
  });

const Ligar = z.object({ pessoa_id: z.string().regex(RE_ID, NAO_ACHADO) });

const SEM_PAPEL = (nome: string, motivo: string, doc: "CPF" | "CNPJ") => ({
  code: "P0001",
  message:
    `${nome} foi cadastrado como pessoa, mas o cadastro de cliente não: ${motivo} ` +
    `Para completar, digite o ${doc} de novo nesta tela e use “Cadastrar também como cliente”.`,
});

/** Cliente criado: o id da pessoa e se o endereço da sede (PJ) ficou sem gravar. */
export type Criado = { id: string; semEndereco: boolean };

/** Cria o cliente: a pessoa (PF ou PJ) e o papel de cliente, ou só o papel para quem já está no NILT
   (`modo=ligar`). Faturamento e exigências nascem no padrão (por CT-e, sem exigências) e são
   completados na ficha. Devolve o id da pessoa e se o endereço da sede deixou de ser gravado (o
   cliente fica criado; a ficha avisa para incluir o endereço em Contatos). */
export async function salvarCliente(_antes: ResultadoForm<Criado> | null, form: FormData): Promise<ResultadoForm<Criado>> {
  const bruto = lerForm(form);
  const modo = bruto.modo;

  if (modo === "ligar") {
    const v = Ligar.safeParse(bruto);
    if (!v.success) return errosDoZod(v.error);
    const id = v.data.pessoa_id;
    return comSessao(async ({ supabase }) => {
      const db = tipado(supabase);
      const ja = await db.from("cliente").select("pessoa_id").eq("pessoa_id", id).maybeSingle();
      if (ja.error) throw ja.error;
      if (ja.data) throw { code: "P0001", message: "Esta pessoa já é cliente. Abra a ficha pela lista." };
      const { error } = await db.from("cliente").insert({ pessoa_id: id });
      if (error) throw error;
      revalidarCliente(id);
      return { id, semEndereco: false };
    });
  }

  if (modo === "pf") {
    const v = NovoPf.safeParse(bruto);
    if (!v.success) return errosDoZod(v.error);
    const n = v.data;
    return comSessao(async ({ supabase }) => {
      const db = tipado(supabase);
      const pessoa = await db
        .from("pessoa")
        .insert({ tipo: "pf", nome: n.nome.replace(/\s+/g, " "), cpf: so(n.cpf) })
        .select("id")
        .single();
      if (pessoa.error) throw pessoa.error;
      const id = pessoa.data.id;
      const cl = await db.from("cliente").insert({ pessoa_id: id });
      if (cl.error) throw SEM_PAPEL(n.nome, mensagemDeErro(cl.error), "CPF");
      revalidarCliente(id);
      return { id, semEndereco: false };
    });
  }

  if (modo !== "pj") return { ok: false, erro: "Escolha o tipo: empresa ou pessoa física." };
  const v = NovoPj.safeParse(bruto);
  if (!v.success) return errosDoZod(v.error);
  const n = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const pessoa = await db
      .from("pessoa")
      .insert({
        tipo: "pj",
        nome: n.nome.replace(/\s+/g, " "),
        nome_fantasia: nulo(n.nome_fantasia),
        cnpj: so(n.cnpj),
        fundacao: nulo(n.fundacao),
        natureza_juridica: nulo(n.natureza_juridica),
        cnae_principal: nulo(n.cnae_principal),
        optante_simples: n.optante_simples ? n.optante_simples === "sim" : null,
        dt_consulta_brasilapi: n.receita ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (pessoa.error) throw pessoa.error;
    const id = pessoa.data.id;
    const cl = await db.from("cliente").insert({ pessoa_id: id });
    if (cl.error) throw SEM_PAPEL(n.nome, mensagemDeErro(cl.error), "CNPJ");
    revalidarCliente(id);

    // Endereço da sede (o da Receita): fica nos Contatos. Falhar aqui não desfaz o cliente, mas a
    // tela avisa (`semEndereco`) para incluir o endereço à mão.
    let semEndereco = false;
    if (n.cidade) {
      const end = await db.from("pessoa_endereco").insert({
        pessoa_id: id,
        tipo: "comercial",
        cep: nulo(so(n.cep)),
        logradouro: n.logradouro,
        numero: n.numero || "s/n",
        complemento: nulo(n.complemento),
        bairro: nulo(n.bairro),
        cidade: n.cidade,
        uf: n.uf as (typeof UFS)[number],
        principal: true,
      });
      semEndereco = !!end.error;
    }
    return { id, semEndereco };
  });
}

/* ---------- dados da pessoa (aba Dados) ---------- */

/** Grava a identificação e as inscrições da pessoa do cliente (os mesmos campos e regras da ficha de
   proprietário, de `_pessoa/dados-pessoa`). O tipo (PF/PJ) vem do banco, nunca do formulário. */
export async function salvarDadosCliente(_antes: ResultadoForm | null, form: FormData): Promise<ResultadoForm> {
  const bruto = lerForm(form);
  const id = bruto.pessoa_id ?? "";
  if (!RE_ID.test(id)) return { ok: false, erro: NAO_ACHADO };
  const tipo = await comSessao(async ({ supabase }) => {
    const atual = await tipado(supabase).from("pessoa").select("tipo, cliente(pessoa_id)").eq("id", id).maybeSingle();
    if (atual.error) throw atual.error;
    if (!atual.data?.cliente) throw { code: "P0001", message: NAO_ACHADO };
    return atual.data.tipo;
  });
  if (!tipo.ok) return tipo;
  const pj = tipo.dados === "pj";
  const v = (pj ? esquemaPessoaPj : esquemaPessoaPf).safeParse(bruto);
  if (!v.success) return errosDoZod(v.error);
  const dados = pj ? pessoaPjParaBanco(v.data as z.infer<typeof esquemaPessoaPj>) : pessoaPfParaBanco(v.data as z.infer<typeof esquemaPessoaPf>);
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("pessoa").update(dados).eq("id", id).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidarCliente(id);
  });
}

/* ---------- faturamento e exigências ---------- */

export async function salvarFaturamento(_antes: ResultadoForm | null, form: FormData): Promise<ResultadoForm> {
  const v = esquemaFaturamento.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const { pessoa_id: id, ...dados } = v.data;
  return comSessao(async ({ supabase }) => {
    const r = await tipado(supabase).from("cliente").update(dados).eq("pessoa_id", id).select("pessoa_id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw SEM_PERMISSAO;
    revalidarCliente(id);
  });
}

/* ---------- locais de coleta e descarga ---------- */

/** Inclui (sem `id`) ou altera (com `id`) um local de coleta/descarga do cliente. */
export async function salvarLocal(_antes: ResultadoForm | null, form: FormData): Promise<ResultadoForm> {
  const v = esquemaLocal.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const { id, pessoa_id: pessoaId, ...dados } = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    if (id) {
      // Só altera local de coleta/descarga deste cliente.
      const r = await db
        .from("pessoa_endereco")
        .update(dados)
        .eq("id", id)
        .eq("pessoa_id", pessoaId)
        .eq("tipo", "coleta_descarga")
        .select("id");
      if (r.error) throw r.error;
      if (!r.data?.length) throw SEM_PERMISSAO;
    } else {
      const ehCliente = await db.from("cliente").select("pessoa_id").eq("pessoa_id", pessoaId).maybeSingle();
      if (ehCliente.error) throw ehCliente.error;
      if (!ehCliente.data) throw { code: "P0001", message: NAO_ACHADO };
      const r = await db.from("pessoa_endereco").insert({ ...dados, pessoa_id: pessoaId, tipo: "coleta_descarga", principal: false });
      if (r.error) throw r.error;
    }
    revalidarCliente(pessoaId);
  });
}

/** Apaga um local de coleta/descarga (só o administrador). Local usado em pedido não sai. */
export async function apagarLocal(id: string): Promise<ResultadoAcao> {
  if (!RE_ID.test(id)) return { ok: false, erro: "Local não encontrado. Atualize a página." };
  return comSessao(
    async ({ supabase }) => {
      const r = await tipado(supabase).from("pessoa_endereco").delete().eq("id", id).eq("tipo", "coleta_descarga").select("pessoa_id");
      if (r.error) {
        if (r.error.code === "23503") throw { code: "P0001", message: "Este local está em pedidos e não pode ser apagado." };
        throw r.error;
      }
      if (!r.data?.length) throw SEM_PERMISSAO;
      revalidarCliente(r.data[0].pessoa_id);
    },
    { somenteAdmin: true },
  );
}
