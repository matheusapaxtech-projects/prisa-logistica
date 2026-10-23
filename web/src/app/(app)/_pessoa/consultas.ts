/* Consultas das partes de pessoa que motorista e proprietário compartilham (contatos, contas e Pix).
   Sempre com o cliente do usuário (RLS). */
import type { Banco, Database } from "@/lib/banco";

type Tabelas = Database["public"]["Tables"];
export type Endereco = Tabelas["pessoa_endereco"]["Row"];
export type Telefone = Tabelas["pessoa_telefone"]["Row"];
export type Email = Tabelas["pessoa_email"]["Row"];
export type Conta = Tabelas["pessoa_conta_bancaria"]["Row"];
export type ChavePix = Tabelas["pessoa_chave_pix"]["Row"];
export type BancoLinha = Tabelas["banco"]["Row"];

export type Contatos = { enderecos: Endereco[]; telefones: Telefone[]; emails: Email[] };
export type Contas = { contas: Conta[]; pix: ChavePix[]; bancos: BancoLinha[] };

/** Endereços, telefones e e-mails da pessoa, na ordem em que foram cadastrados. */
export async function carregarContatos(db: Banco, pessoaId: string): Promise<Contatos> {
  const [e, t, m] = await Promise.all([
    db.from("pessoa_endereco").select("*").eq("pessoa_id", pessoaId).order("created_at").order("id"),
    db.from("pessoa_telefone").select("*").eq("pessoa_id", pessoaId).order("created_at").order("id"),
    db.from("pessoa_email").select("*").eq("pessoa_id", pessoaId).order("created_at").order("id"),
  ]);
  for (const r of [e, t, m]) if (r.error) throw r.error;
  return { enderecos: e.data ?? [], telefones: t.data ?? [], emails: m.data ?? [] };
}

/** Contas bancárias, chaves Pix e a tabela de bancos (para nomes e para o diálogo). */
export async function carregarContas(db: Banco, pessoaId: string): Promise<Contas> {
  const [c, x, b] = await Promise.all([
    db.from("pessoa_conta_bancaria").select("*").eq("pessoa_id", pessoaId).order("created_at").order("id"),
    db.from("pessoa_chave_pix").select("*").eq("pessoa_id", pessoaId).order("created_at").order("id"),
    db.from("banco").select("codigo, nome").order("codigo"),
  ]);
  for (const r of [c, x, b]) if (r.error) throw r.error;
  return { contas: c.data ?? [], pix: x.data ?? [], bancos: b.data ?? [] };
}

/** Quantos itens cada aba mostra (para o número das abas sem carregar as listas inteiras). */
export async function contarContatosEContas(db: Banco, pessoaId: string) {
  const conta = (t: "pessoa_endereco" | "pessoa_telefone" | "pessoa_email" | "pessoa_conta_bancaria" | "pessoa_chave_pix") =>
    db.from(t).select("id", { count: "exact", head: true }).eq("pessoa_id", pessoaId);
  const rs = await Promise.all([
    conta("pessoa_endereco"),
    conta("pessoa_telefone"),
    conta("pessoa_email"),
    conta("pessoa_conta_bancaria"),
    conta("pessoa_chave_pix"),
  ]);
  for (const r of rs) if (r.error) throw r.error;
  const [e, t, m, c, x] = rs.map((r) => r.count ?? 0);
  return { contatos: e + t + m, contas: c + x };
}

/** Principal (ou o primeiro) de uma lista com `principal`. */
export function principal<T extends { principal: boolean }>(lista: T[]): T | undefined {
  return lista.find((x) => x.principal) ?? lista[0];
}
