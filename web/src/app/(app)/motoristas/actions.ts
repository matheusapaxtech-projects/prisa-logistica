"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao } from "@/lib/acao";
import { tipado } from "@/lib/banco";
import { hojeISO } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";
import { validacao } from "@/lib/validacao";
import { errosDoZod, lerForm, RE_ID, type ResultadoForm } from "../_pessoa/formulario";
import { chaves, ROT, UFS } from "../_pessoa/rotulos";
import { erroDigitos } from "./regras";

/* Gravações das telas de Motoristas. Validação = a de prototipo/motorista-novo.html e motorista.html
   (mesmas mensagens). Toda escrita passa por `comSessao` (RLS: pessoa e motorista = admin/operação). */

const so = validacao.soDigitos;
const NAO_ACHADO = "Motorista não encontrado. Atualize a página.";
const SEM_PERMISSAO = { code: "42501", message: "row-level security" };

const nomeCompleto = z
  .string()
  .max(110, "O nome tem até 110 caracteres.")
  .refine((v) => v.trim().split(/\s+/).length >= 2, "Informe o nome completo, com sobrenome.");
const data = z.union([z.literal(""), z.iso.date("Data inválida.")]);
/** Vazio vira null (o tipo do enum fica sem o ""). */
const vazioOuNulo = <T extends string>(v: T | "" | undefined): T | null => (v ? v : null);

/** Número de tamanho fixo (INSS, registro da CNH): vazio passa; faltando ou sobrando, `erroDigitos`. */
const digitos = (t: number) =>
  z.string().superRefine((v, ctx) => {
    const msg = erroDigitos(v, t);
    if (msg) ctx.addIssue({ code: "custom", message: msg });
  });

function idadeEmAnos(nascimento: string): number {
  const [a, m, d] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hojeISO().split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/* ---------- novo motorista ---------- */

const Cnh = {
  cnh_registro: z.string().refine((v) => so(v).length === 11, "O registro da CNH tem 11 dígitos. Confira na carteira."),
  cnh_categoria: z.enum(chaves(ROT.cnh_categoria), "Escolha a categoria."),
  cnh_validade: z.iso.date("Informe a validade da CNH."),
};

const Novo = z.object({
  cpf: z.string().refine((v) => validacao.cpf(v), "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento."),
  nome: nomeCompleto,
  nascimento: z
    .string()
    .min(1, "Informe a data de nascimento.")
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && idadeEmAnos(v) >= 18 && idadeEmAnos(v) < 100, "Confira a data: o motorista precisa ter 18 anos ou mais."),
  telefone: z.string().refine((v) => [10, 11].includes(so(v).length), "Informe o telefone com DDD: (43) 99999-0000."),
  whatsapp: z.string().optional(),
  ...Cnh,
});

const Ligar = z.object({ pessoa_id: z.string().regex(RE_ID, NAO_ACHADO), ...Cnh });

export type Criado = { id: string; avisos: string[] };

/** Cria a pessoa e o papel de motorista (cadastro pendente) e o telefone celular principal.
   Se o motorista não puder ser gravado depois da pessoa, a pessoa fica e a mensagem diz como
   completar: digitar o CPF de novo nesta tela, que oferece "Cadastrar também como motorista". */
export async function criarMotorista(form: FormData): Promise<ResultadoForm<Criado>> {
  const v = Novo.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const n = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const pessoa = await db
      .from("pessoa")
      .insert({ tipo: "pf", nome: n.nome.replace(/\s+/g, " "), cpf: so(n.cpf), nascimento: n.nascimento, situacao_cadastro: "pendente" })
      .select("id")
      .single();
    if (pessoa.error) throw pessoa.error;
    const id = pessoa.data.id;
    revalidatePath("/motoristas");

    // O telefone vai antes do motorista: se o motorista falhar, o telefone já ficou com a pessoa.
    const avisos: string[] = [];
    const tel = await db
      .from("pessoa_telefone")
      .insert({ pessoa_id: id, numero: so(n.telefone), tipo: "celular", whatsapp: n.whatsapp === "on", principal: true });
    if (tel.error) avisos.push("O telefone não foi gravado: adicione na aba Contatos.");

    const mot = await db.from("motorista").insert({
      pessoa_id: id,
      cnh_registro: so(n.cnh_registro),
      cnh_categoria: n.cnh_categoria,
      cnh_validade: n.cnh_validade,
      situacao_cadastro: "pendente",
      situacao_gr: "sem_consulta",
    });
    if (mot.error) {
      // A tela confere o CPF de novo, acha a pessoa e oferece "Cadastrar também como motorista"
      // com a CNH que já foi digitada. Saindo daqui, basta digitar o CPF de novo nesta tela.
      throw {
        code: "P0001",
        message:
          `A pessoa ${n.nome} foi criada, mas o cadastro de motorista não: ${mensagemDeErro(mot.error)} ` +
          "Confira a CNH abaixo e use “Cadastrar também como motorista” para completar.",
      };
    }
    return { id, avisos };
  });
}

/** Liga o papel de motorista a uma pessoa que já existe (ex.: proprietária). Só falta a CNH. */
export async function ligarMotorista(form: FormData): Promise<ResultadoForm<Criado>> {
  const v = Ligar.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const l = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const ja = await db.from("motorista").select("pessoa_id").eq("pessoa_id", l.pessoa_id).maybeSingle();
    if (ja.error) throw ja.error;
    if (ja.data) throw { code: "P0001", message: "Esta pessoa já é motorista. Abra a ficha pela lista." };
    const { error } = await db.from("motorista").insert({
      pessoa_id: l.pessoa_id,
      cnh_registro: so(l.cnh_registro),
      cnh_categoria: l.cnh_categoria,
      cnh_validade: l.cnh_validade,
      situacao_cadastro: "pendente",
      situacao_gr: "sem_consulta",
    });
    if (error) {
      if (/pessoa física/.test(error.message)) throw { code: "P0001", message: "Motorista precisa ser pessoa física." };
      throw error;
    }
    revalidatePath("/motoristas");
    return { id: l.pessoa_id, avisos: [] };
  });
}

/* ---------- ficha: dados pessoais, CNH e gerenciadora (um formulário, uma barra de salvar) ---------- */

const enumOpcional = <T extends Record<string, string>>(mapa: T) => z.union([z.literal(""), z.enum(chaves(mapa))]);
const uf = z.union([z.literal(""), z.enum(UFS)]);
const texto = (max: number) => z.string().max(max, `Até ${max} caracteres.`);

const Ficha = z.object({
  "motorista.situacao_cadastro": z.enum(chaves(ROT.situacao_cadastro), "Escolha a situação do cadastro."),
  "motorista.radio": texto(100).default(""),
  "pessoa.situacao_cpf": enumOpcional(ROT.situacao_cpf).default(""),
  "pessoa.dt_consulta_cpf": data.default(""),
  "pessoa.nome": nomeCompleto,
  "pessoa.apelido": texto(60).default(""),
  "pessoa.sexo": enumOpcional(ROT.sexo).default(""),
  "pessoa.raca_cor": enumOpcional(ROT.raca_cor).default(""),
  "pessoa.nascimento": data.default(""),
  "pessoa.naturalidade": texto(80).default(""),
  "pessoa.naturalidade_uf": uf.default(""),
  "pessoa.grau_instrucao": enumOpcional(ROT.grau_instrucao).default(""),
  "pessoa.estado_civil": enumOpcional(ROT.estado_civil).default(""),
  "pessoa.rg": texto(20).default(""),
  "pessoa.rg_orgao": texto(20).default(""),
  "pessoa.rg_uf": uf.default(""),
  "pessoa.rg_emissao": data.default(""),
  "pessoa.pai": texto(80).default(""),
  "pessoa.mae": texto(80).default(""),
  "pessoa.nr_inss": digitos(11).default(""),
  "motorista.cnh_registro": digitos(11).default(""),
  "motorista.cnh_formulario": texto(10).default(""),
  "motorista.cnh_seguranca": texto(11).default(""),
  "motorista.cnh_renach": texto(11).default(""),
  "motorista.cnh_categoria": enumOpcional(ROT.cnh_categoria).default(""),
  "motorista.cnh_validade": data.default(""),
  "motorista.cnh_emissao": data.default(""),
  "motorista.cnh_primeira_habilitacao": data.default(""),
  "motorista.cnh_cidade_emissao": texto(80).default(""),
  "motorista.cnh_uf": uf.default(""),
  "motorista.cnh_observacao": texto(500).default(""),
  "motorista.situacao_gr": z.enum(chaves(ROT.situacao_gr)).default("sem_consulta"),
  "motorista.gr_validade": data.default(""),
  "motorista.qualificado_gmp": z.enum(["sim", "nao"]).default("nao"),
  "motorista.dt_qualificacao_gmp": data.default(""),
});

/** Grava a ficha (pessoa e motorista). O CPF não muda por aqui (campo só leitura). */
export async function salvarFicha(pessoaId: string, form: FormData): Promise<ResultadoForm> {
  if (!RE_ID.test(pessoaId)) return { ok: false, erro: NAO_ACHADO };
  const v = Ficha.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const f = v.data;
  const n = vazioOuNulo;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const p = await db
      .from("pessoa")
      .update({
        nome: f["pessoa.nome"].trim().replace(/\s+/g, " "),
        apelido: n(f["pessoa.apelido"]),
        situacao_cpf: n(f["pessoa.situacao_cpf"]),
        dt_consulta_cpf: n(f["pessoa.dt_consulta_cpf"]),
        sexo: n(f["pessoa.sexo"]),
        raca_cor: n(f["pessoa.raca_cor"]),
        nascimento: n(f["pessoa.nascimento"]),
        naturalidade: n(f["pessoa.naturalidade"]),
        naturalidade_uf: n(f["pessoa.naturalidade_uf"]),
        grau_instrucao: n(f["pessoa.grau_instrucao"]),
        estado_civil: n(f["pessoa.estado_civil"]),
        rg: n(f["pessoa.rg"]),
        rg_orgao: n(f["pessoa.rg_orgao"]),
        rg_uf: n(f["pessoa.rg_uf"]),
        rg_emissao: n(f["pessoa.rg_emissao"]),
        pai: n(f["pessoa.pai"]),
        mae: n(f["pessoa.mae"]),
        nr_inss: n(so(f["pessoa.nr_inss"])),
      })
      .eq("id", pessoaId)
      .select("id");
    if (p.error) throw p.error;
    if (!p.data?.length) throw SEM_PERMISSAO;

    const m = await db
      .from("motorista")
      .update({
        situacao_cadastro: f["motorista.situacao_cadastro"],
        radio: n(f["motorista.radio"]),
        cnh_registro: n(so(f["motorista.cnh_registro"])),
        cnh_formulario: n(f["motorista.cnh_formulario"]),
        cnh_seguranca: n(f["motorista.cnh_seguranca"]),
        cnh_renach: n(f["motorista.cnh_renach"]),
        cnh_categoria: n(f["motorista.cnh_categoria"]),
        cnh_validade: n(f["motorista.cnh_validade"]),
        cnh_emissao: n(f["motorista.cnh_emissao"]),
        cnh_primeira_habilitacao: n(f["motorista.cnh_primeira_habilitacao"]),
        cnh_cidade_emissao: n(f["motorista.cnh_cidade_emissao"]),
        cnh_uf: n(f["motorista.cnh_uf"]),
        cnh_observacao: n(f["motorista.cnh_observacao"]),
        situacao_gr: f["motorista.situacao_gr"],
        gr_validade: n(f["motorista.gr_validade"]),
        qualificado_gmp: f["motorista.qualificado_gmp"] === "sim",
        dt_qualificacao_gmp: n(f["motorista.dt_qualificacao_gmp"]),
      })
      .eq("pessoa_id", pessoaId)
      .select("pessoa_id");
    if (m.error) throw m.error;
    if (!m.data?.length) throw SEM_PERMISSAO;
    revalidatePath(`/motoristas/${pessoaId}`);
    revalidatePath("/motoristas");
  });
}

/* ---------- referências ---------- */

const Referencia = z.object({
  tipo: z.enum(chaves(ROT.tipo_referencia)),
  nome: z.string().min(3, "Informe o nome da empresa ou da pessoa."),
  telefone: z.string().refine((v) => !so(v) || so(v).length >= 10, "Informe o telefone com DDD."),
  dt_referencia: data.default(""),
  observacao: texto(500).default(""),
});

export async function adicionarReferencia(motoristaId: string, form: FormData): Promise<ResultadoForm> {
  if (!RE_ID.test(motoristaId)) return { ok: false, erro: NAO_ACHADO };
  const v = Referencia.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const r = v.data;
  return comSessao(async ({ supabase }) => {
    const { error } = await tipado(supabase)
      .from("motorista_referencia")
      .insert({
        motorista_id: motoristaId,
        tipo: r.tipo,
        nome: r.nome,
        telefone: vazioOuNulo(so(r.telefone)),
        dt_referencia: vazioOuNulo(r.dt_referencia),
        observacao: vazioOuNulo(r.observacao),
      });
    if (error) throw error;
    revalidatePath(`/motoristas/${motoristaId}`);
  });
}
