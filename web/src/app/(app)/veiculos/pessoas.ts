/* Proprietários e motoristas nos seletores das telas de veículo: tipos, consulta e leitura. Só servidor
   (as ações em `actions.ts` chamam isto). */
import type { Banco } from "@/lib/banco";
import { formato } from "@/lib/formato";
import { termoBusca } from "@/lib/busca";
import { nomeCurto, um, type TipoPessoaDoc } from "./pessoas-tipos";

export type { OpcaoPessoa } from "./pessoas-tipos";
import type { OpcaoPessoa } from "./pessoas-tipos";

export type TipoSeletor = "proprietario" | "motorista";

const MAX = 8;

type LinhaPessoa = {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  tipo: TipoPessoaDoc;
  cpf: string | null;
  cnpj: string | null;
  situacao_cadastro: string;
  proprietario?: unknown;
};
type DadosProp = {
  rntrc: string | null;
  enquadramento_antt: string | null;
  rntrc_validade: string | null;
  situacao_cadastro: string;
};

function paraOpcao(p: LinhaPessoa): OpcaoPessoa {
  const prop = um(p.proprietario as DadosProp | DadosProp[] | null);
  return {
    id: p.id,
    nome: nomeCurto(p),
    nomeCompleto: p.nome,
    tipo: p.tipo,
    doc: formato.doc(p),
    situacao_cadastro: prop?.situacao_cadastro ?? p.situacao_cadastro,
    rntrc: prop?.rntrc ?? null,
    enquadramento: prop?.enquadramento_antt ?? null,
    rntrc_validade: prop?.rntrc_validade ?? null,
  };
}

const COLUNAS = "id, nome, nome_fantasia, tipo, cpf, cnpj, situacao_cadastro";
const PROPRIETARIO = "proprietario!inner(rntrc, enquadramento_antt, rntrc_validade, situacao_cadastro)";

/** Opções para os ids dados (valor inicial dos seletores). Id que não é do tipo pedido some. */
export async function opcoesPorId(db: Banco, tipo: TipoSeletor, ids: (string | null | undefined)[]): Promise<Map<string, OpcaoPessoa>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))];
  const mapa = new Map<string, OpcaoPessoa>();
  if (!unicos.length) return mapa;
  const sel = tipo === "proprietario" ? `${COLUNAS}, ${PROPRIETARIO}` : `${COLUNAS}, motorista!inner(pessoa_id)`;
  const { data, error } = await db.from("pessoa").select(sel).in("id", unicos);
  if (error) throw error;
  for (const p of (data ?? []) as unknown as LinhaPessoa[]) mapa.set(p.id, paraOpcao(p));
  return mapa;
}

/** Busca por nome, apelido, nome fantasia ou dígitos do CPF/CNPJ (até 8, por nome). Termo curto
   (menos de 2 caracteres) devolve os primeiros por nome. O termo só tem letras, dígitos e espaço
   (`termoBusca`) antes de entrar no filtro `.or()`. */
export async function buscarOpcoes(db: Banco, tipo: TipoSeletor, termo: string): Promise<OpcaoPessoa[]> {
  const t = termoBusca(String(termo ?? "").slice(0, 80));
  const sel = tipo === "proprietario" ? `${COLUNAS}, ${PROPRIETARIO}` : `${COLUNAS}, motorista!inner(pessoa_id)`;
  let q = db.from("pessoa").select(sel);
  if (t) {
    const filtros = [`nome.ilike.*${t.texto}*`, `apelido.ilike.*${t.texto}*`, `nome_fantasia.ilike.*${t.texto}*`];
    if (t.digitos.length >= 3) filtros.push(`cpf.like.*${t.digitos}*`, `cnpj.like.*${t.digitos}*`);
    q = q.or(filtros.join(","));
  }
  const { data, error } = await q.order("nome").limit(MAX);
  if (error) throw error;
  return ((data ?? []) as unknown as LinhaPessoa[]).map(paraOpcao);
}
