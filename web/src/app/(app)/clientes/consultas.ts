/* Consultas das telas de Clientes (lista, ficha) e dos locais de coleta/descarga, que a tela de
   Pedidos também usa. Sempre com o cliente do usuário (RLS). */
import type { Banco, Database } from "@/lib/banco";

type Tabelas = Database["public"]["Tables"];
export type PessoaRow = Tabelas["pessoa"]["Row"];
export type ClienteRow = Tabelas["cliente"]["Row"];

/** Local de coleta/descarga do cliente (`pessoa_endereco` com tipo `coleta_descarga`). */
export type Local = Pick<
  Tabelas["pessoa_endereco"]["Row"],
  | "id"
  | "pessoa_id"
  | "cep"
  | "logradouro"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "uf"
  | "ponto_referencia"
  | "janela_atendimento"
  | "contato_local"
>;

const COLUNAS_LOCAL =
  "id, pessoa_id, cep, logradouro, numero, complemento, bairro, cidade, uf, ponto_referencia, janela_atendimento, contato_local";

/** Locais de coleta e descarga do cliente, por cidade e depois na ordem em que foram cadastrados. */
export async function listarLocais(cliente: Banco, pessoaId: string): Promise<Local[]> {
  const r = await cliente
    .from("pessoa_endereco")
    .select(COLUNAS_LOCAL)
    .eq("pessoa_id", pessoaId)
    .eq("tipo", "coleta_descarga")
    .order("cidade")
    .order("created_at")
    .order("id");
  if (r.error) throw r.error;
  return r.data ?? [];
}

/** "Rua X, 10 · Bairro" (sem cidade): a primeira linha de um local. */
export function enderecoDoLocal(l: Pick<Local, "logradouro" | "numero" | "complemento" | "bairro">): string {
  const rua = l.logradouro ? `${l.logradouro}${l.numero && l.numero !== "s/n" ? `, ${l.numero}` : ""}` : "";
  return [rua, l.complemento, l.bairro].filter(Boolean).join(" · ");
}

/* ---------- lista ---------- */

export type LinhaCliente = {
  id: string;
  tipo: "pf" | "pj";
  nome: string;
  nomeFantasia: string | null;
  /** CPF ou CNPJ, só dígitos. */
  documento: string;
  condicao: ClienteRow["condicao_faturamento"];
  exigeGr: boolean;
  gerenciadora: string | null;
  exigeSm: boolean;
  locais: number;
  /** "Apucarana/PR" dos locais, sem repetir (para a segunda linha da lista). */
  cidades: string[];
};

export async function listarClientes(db: Banco): Promise<LinhaCliente[]> {
  const [cl, ls] = await Promise.all([
    db.from("cliente").select("pessoa_id, condicao_faturamento, exige_gr, gerenciadora, exige_sm, pessoa(tipo, nome, nome_fantasia, cpf, cnpj)"),
    db.from("pessoa_endereco").select("pessoa_id, cidade, uf").eq("tipo", "coleta_descarga"),
  ]);
  for (const r of [cl, ls]) if (r.error) throw r.error;

  const locais = new Map<string, string[]>();
  for (const l of ls.data ?? []) locais.set(l.pessoa_id, [...(locais.get(l.pessoa_id) ?? []), `${l.cidade}/${l.uf}`]);

  return (cl.data ?? [])
    .map((c): LinhaCliente => {
      const p = c.pessoa!;
      const lista = locais.get(c.pessoa_id) ?? [];
      return {
        id: c.pessoa_id,
        tipo: p.tipo,
        nome: p.nome,
        nomeFantasia: p.nome_fantasia,
        documento: (p.tipo === "pj" ? p.cnpj : p.cpf) ?? "",
        condicao: c.condicao_faturamento,
        exigeGr: c.exige_gr,
        gerenciadora: c.gerenciadora,
        exigeSm: c.exige_sm,
        locais: lista.length,
        cidades: [...new Set(lista)],
      };
    })
    .sort((a, b) => (a.nomeFantasia || a.nome).localeCompare(b.nomeFantasia || b.nome, "pt-BR"));
}

/* ---------- ficha ---------- */

export type Ficha = {
  pessoa: PessoaRow;
  cliente: ClienteRow;
  tambemMotorista: boolean;
  tambemProprietario: boolean;
  locais: Local[];
};

export type SemFicha =
  | { tipo: "nao_encontrado" }
  | { tipo: "nao_cliente"; pessoa: Pick<PessoaRow, "id" | "nome" | "cpf" | "cnpj" | "tipo"> };

/** Ficha do cliente; sem o papel de cliente, diz se a pessoa existe ou não. */
export async function carregarFicha(db: Banco, id: string): Promise<Ficha | SemFicha> {
  const r = await db.from("pessoa").select("*, cliente(*), motorista(pessoa_id), proprietario(pessoa_id)").eq("id", id).maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) return { tipo: "nao_encontrado" };
  const { cliente, motorista, proprietario, ...pessoa } = r.data;
  if (!cliente)
    return { tipo: "nao_cliente", pessoa: { id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf, cnpj: pessoa.cnpj, tipo: pessoa.tipo } };
  return {
    pessoa: pessoa as PessoaRow,
    cliente: cliente as ClienteRow,
    tambemMotorista: !!motorista,
    tambemProprietario: !!proprietario,
    locais: await listarLocais(db, id),
  };
}
