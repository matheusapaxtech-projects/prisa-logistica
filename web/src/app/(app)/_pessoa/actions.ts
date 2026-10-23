"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { comSessao, type ResultadoAcao } from "@/lib/acao";
import { tipado, type Banco } from "@/lib/banco";
import { validacao } from "@/lib/validacao";
import { caminhosValidos, errosDoZod, lerForm, RE_ID, type ResultadoForm } from "./formulario";
import { chaves, ROT, UFS } from "./rotulos";

/* Gravações das partes de pessoa compartilhadas por motorista e proprietário (contatos, contas e
   Pix) e a busca de pessoa pelo CPF da tela "novo". Validação = a dos diálogos de
   prototipo/motorista.html (mesmas mensagens); toda escrita passa por `comSessao` (RLS do usuário:
   contatos = admin/operação; contas e Pix = admin/operação/financeiro). */

const so = validacao.soDigitos;
const NAO_ACHADO = { code: "P0001", message: "Cadastro não encontrado. Atualize a página." };
const marcado = (v: string | undefined) => v === "on" || v === "true";
const opcional = (v: string | undefined) => (v ? v : null);

function idValido(id: string): boolean {
  return RE_ID.test(id);
}

function revalidarTudo(revalidar: string[]) {
  for (const c of caminhosValidos(revalidar)) revalidatePath(c);
}

type TabelaComPrincipal = "pessoa_endereco" | "pessoa_telefone" | "pessoa_email" | "pessoa_conta_bancaria" | "pessoa_chave_pix";

/** Só um principal por pessoa (índice único parcial): o novo principal desmarca os outros antes. */
async function desmarcarPrincipal(db: Banco, tabela: TabelaComPrincipal, pessoaId: string) {
  const { error } = await db.from(tabela).update({ principal: false }).eq("pessoa_id", pessoaId).eq("principal", true);
  if (error) throw error;
}

/* ---------- endereço ---------- */

const Endereco = z
  .object({
    cep: z.string().refine((v) => !v || so(v).length === 8, "O CEP tem 8 dígitos."),
    tipo: z.enum(chaves(ROT.tipo_endereco)).optional(),
    logradouro: z.string().min(1, "Informe a rua ou avenida."),
    numero: z.string().max(20).optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().min(1, "Informe a cidade."),
    uf: z.enum(UFS, "Escolha a UF."),
    ponto_referencia: z.string().optional(),
    coordenada: z.string().optional(),
    principal: z.string().optional(),
  });

/** Inclui um endereço da pessoa. Coordenada aceita "lat,lon" ou um link do Google Maps com os números. */
export async function adicionarEndereco(pessoaId: string, revalidar: string[], form: FormData): Promise<ResultadoForm> {
  if (!idValido(pessoaId)) return { ok: false, erro: NAO_ACHADO.message };
  const v = Endereco.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const e = v.data;
  const coord = (e.coordenada ?? "").match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    if (marcado(e.principal)) await desmarcarPrincipal(db, "pessoa_endereco", pessoaId);
    const { error } = await db.from("pessoa_endereco").insert({
      pessoa_id: pessoaId,
      tipo: e.tipo ?? null,
      cep: opcional(so(e.cep)),
      logradouro: e.logradouro,
      numero: e.numero || "s/n",
      complemento: opcional(e.complemento),
      bairro: opcional(e.bairro),
      cidade: e.cidade,
      uf: e.uf,
      ponto_referencia: opcional(e.ponto_referencia),
      latitude: coord ? Number(coord[1]) : null,
      longitude: coord ? Number(coord[2]) : null,
      principal: marcado(e.principal),
    });
    if (error) throw error;
    revalidarTudo(revalidar);
  });
}

/* ---------- telefone ---------- */

const Telefone = z.object({
  numero: z.string().refine((v) => [10, 11].includes(so(v).length), "Informe o número com DDD: (43) 99999-0000."),
  ramal: z.string().max(4, "O ramal tem até 4 dígitos.").optional(),
  tipo: z.enum(chaves(ROT.tipo_telefone)).optional(),
  contato: z.string().max(100).optional(),
  whatsapp: z.string().optional(),
  principal: z.string().optional(),
  restrito: z.string().optional(),
});

export async function adicionarTelefone(pessoaId: string, revalidar: string[], form: FormData): Promise<ResultadoForm> {
  if (!idValido(pessoaId)) return { ok: false, erro: NAO_ACHADO.message };
  const v = Telefone.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const t = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    if (marcado(t.principal)) await desmarcarPrincipal(db, "pessoa_telefone", pessoaId);
    const { error } = await db.from("pessoa_telefone").insert({
      pessoa_id: pessoaId,
      numero: so(t.numero),
      ramal: opcional(so(t.ramal)),
      contato: opcional(t.contato),
      tipo: t.tipo ?? null,
      whatsapp: marcado(t.whatsapp),
      principal: marcado(t.principal),
      restrito: marcado(t.restrito),
    });
    if (error) throw error;
    revalidarTudo(revalidar);
  });
}

/* ---------- e-mail ---------- */

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Email = z.object({
  email: z.string().regex(RE_EMAIL, "E-mail inválido: confira o @ e o domínio."),
  observacao: z.string().optional(),
  principal: z.string().optional(),
  recebe_cte: z.string().optional(),
});

export async function adicionarEmail(pessoaId: string, revalidar: string[], form: FormData): Promise<ResultadoForm> {
  if (!idValido(pessoaId)) return { ok: false, erro: NAO_ACHADO.message };
  const v = Email.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const m = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    if (marcado(m.principal)) await desmarcarPrincipal(db, "pessoa_email", pessoaId);
    const { error } = await db.from("pessoa_email").insert({
      pessoa_id: pessoaId,
      email: m.email.toLowerCase(),
      observacao: opcional(m.observacao),
      principal: marcado(m.principal),
      recebe_cte: marcado(m.recebe_cte),
    });
    if (error) throw error;
    revalidarTudo(revalidar);
  });
}

/* ---------- conta bancária ---------- */

const Conta = z.object({
  banco_codigo: z.string().regex(/^\d{3}$/, "Escolha o banco."),
  tipo: z.enum(chaves(ROT.tipo_conta)).optional(),
  agencia: z.string().refine((v) => so(v).length > 0 && so(v).length <= 5, "Informe a agência."),
  agencia_digito: z.string().max(2).optional(),
  conta: z.string().refine((v) => so(v).length > 0 && so(v).length <= 20, "Informe o número da conta."),
  conta_digito: z.string().max(2).optional(),
  favorecido_nome: z.string().optional(),
  favorecido_documento: z
    .string()
    .refine((v) => validacao.cpf(v) || validacao.cnpj(v), "Documento do favorecido inválido: confira os dígitos."),
  principal: z.string().optional(),
});

/** Inclui uma conta. `titular_confere` é calculado pelo banco (favorecido = CPF/CNPJ da pessoa). */
export async function adicionarConta(pessoaId: string, revalidar: string[], form: FormData): Promise<ResultadoForm> {
  if (!idValido(pessoaId)) return { ok: false, erro: NAO_ACHADO.message };
  const v = Conta.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const c = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    let favorecido = c.favorecido_nome;
    if (!favorecido) {
      const p = await db.from("pessoa").select("nome").eq("id", pessoaId).maybeSingle();
      if (p.error) throw p.error;
      favorecido = p.data?.nome ?? "";
    }
    if (marcado(c.principal)) await desmarcarPrincipal(db, "pessoa_conta_bancaria", pessoaId);
    const { error } = await db.from("pessoa_conta_bancaria").insert({
      pessoa_id: pessoaId,
      banco_codigo: c.banco_codigo,
      tipo: c.tipo ?? null,
      agencia: so(c.agencia),
      agencia_digito: opcional(c.agencia_digito),
      conta: so(c.conta),
      conta_digito: opcional(c.conta_digito),
      favorecido_nome: opcional(favorecido),
      favorecido_documento: so(c.favorecido_documento),
      principal: marcado(c.principal),
    });
    if (error) throw error;
    revalidarTudo(revalidar);
  });
}

/* ---------- chave Pix ---------- */

const MSG_PIX: Record<string, string> = {
  cpf: "CPF inválido: confira os dígitos.",
  cnpj: "CNPJ inválido: confira os dígitos.",
  celular: "Celular com DDD, 11 dígitos.",
  email: "E-mail inválido.",
  aleatoria: "A chave aleatória tem de 32 a 37 caracteres.",
};

function chavePixValida(tipo: string, chave: string): boolean {
  const d = so(chave);
  if (tipo === "cpf") return validacao.cpf(d);
  if (tipo === "cnpj") return validacao.cnpj(d);
  if (tipo === "celular") return d.length === 11;
  if (tipo === "email") return RE_EMAIL.test(chave);
  return chave.length >= 32 && chave.length <= 37;
}

const Pix = z
  .object({
    tipo: z.enum(chaves(ROT.tipo_chave_pix)),
    chave: z.string().max(77),
    conta_id: z.string().optional(),
    descricao: z.string().max(30, "A descrição tem até 30 caracteres.").optional(),
    principal: z.string().optional(),
  })
  .superRefine((x, ctx) => {
    if (!chavePixValida(x.tipo, x.chave)) ctx.addIssue({ code: "custom", path: ["chave"], message: MSG_PIX[x.tipo] });
    if (x.conta_id && !RE_ID.test(x.conta_id)) ctx.addIssue({ code: "custom", path: ["conta_id"], message: "Escolha uma conta da lista." });
  });

export async function adicionarPix(pessoaId: string, revalidar: string[], form: FormData): Promise<ResultadoForm> {
  if (!idValido(pessoaId)) return { ok: false, erro: NAO_ACHADO.message };
  const v = Pix.safeParse(lerForm(form));
  if (!v.success) return errosDoZod(v.error);
  const x = v.data;
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    if (x.conta_id) {
      // A conta ligada tem de ser desta pessoa.
      const c = await db.from("pessoa_conta_bancaria").select("id").eq("id", x.conta_id).eq("pessoa_id", pessoaId).maybeSingle();
      if (c.error) throw c.error;
      if (!c.data) throw { code: "P0001", message: "A conta escolhida não é desta pessoa. Atualize a página." };
    }
    if (marcado(x.principal)) await desmarcarPrincipal(db, "pessoa_chave_pix", pessoaId);
    const { error } = await db.from("pessoa_chave_pix").insert({
      pessoa_id: pessoaId,
      tipo: x.tipo,
      chave: ["cpf", "cnpj", "celular"].includes(x.tipo) ? so(x.chave) : x.chave,
      conta_id: x.conta_id || null,
      descricao: opcional(x.descricao),
      principal: marcado(x.principal),
    });
    if (error) {
      // unique (tipo, chave): a mesma chave já está cadastrada (nesta ou em outra pessoa).
      if (error.code === "23505") throw { code: "P0001", message: "Esta chave Pix já está cadastrada." };
      throw error;
    }
    revalidarTudo(revalidar);
  });
}

/* ---------- busca pelo documento (telas "novo") ---------- */

export type PessoaAchada = {
  id: string;
  tipo: "pf" | "pj";
  nome: string;
  /** CPF ou CNPJ, só dígitos. */
  documento: string;
  /** Telefone principal (ou o primeiro) não restrito, só dígitos. */
  telefone: string | null;
  motorista: { situacao_cadastro: string } | null;
  proprietario: { enquadramento_antt: string | null; rntrc: string | null } | null;
};

const MSG_DOC_INVALIDO = {
  cpf: "CPF inválido: os dois últimos dígitos não conferem. Copie de novo do documento.",
  cnpj: "CNPJ inválido: os dois últimos dígitos não conferem. Copie de novo do cartão CNPJ.",
};

/** Procura a pessoa pelo CPF (11 dígitos) ou CNPJ (14 dígitos) válido. `null` = ainda não cadastrada.
   Os papéis vêm junto para a tela decidir: abrir a ficha, ligar o papel ou criar a pessoa. */
export async function buscarPessoa(documento: string): Promise<ResultadoAcao<PessoaAchada | null>> {
  const d = so(documento);
  const coluna = d.length === 14 ? "cnpj" : "cpf";
  if (!validacao[coluna](d)) return { ok: false, erro: MSG_DOC_INVALIDO[coluna] };
  return comSessao(async ({ supabase }) => {
    const db = tipado(supabase);
    const { data, error } = await db
      .from("pessoa")
      .select(
        "id, tipo, nome, cpf, cnpj, motorista(situacao_cadastro), proprietario(enquadramento_antt, rntrc), pessoa_telefone(numero, principal, restrito)",
      )
      .eq(coluna, d)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const tels = (data.pessoa_telefone ?? []).filter((t) => !t.restrito);
    const tel = tels.find((t) => t.principal) ?? tels[0];
    return {
      id: data.id,
      tipo: data.tipo,
      nome: data.nome,
      documento: data.cpf ?? data.cnpj ?? d,
      telefone: tel?.numero ?? null,
      motorista: data.motorista ? { situacao_cadastro: data.motorista.situacao_cadastro } : null,
      proprietario: data.proprietario
        ? { enquadramento_antt: data.proprietario.enquadramento_antt, rntrc: data.proprietario.rntrc }
        : null,
    };
  });
}
