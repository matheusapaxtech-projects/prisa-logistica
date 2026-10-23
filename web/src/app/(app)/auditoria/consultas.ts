import type { SupabaseClient } from "@supabase/supabase-js";
import { tipado, type Banco } from "@/lib/banco";
import { TIPOS, ehGuid, type Filtros } from "./filtros";

/* Leituras de /auditoria (RLS: só o administrador lê `auditoria` e `perfil_usuario` inteiro). */

const COLUNAS = "id, tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, em";
const LOTE = 100;
/** Quantas aberturas de documento o painel "Quem viu documentos" lista (o número no cabeçalho é o total). */
export const MAX_VISTOS = 20;

export type Dados = Record<string, unknown> | null;
export const obj = (v: unknown): Dados => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export type Evento = {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  dados_antes: Dados;
  dados_depois: Dados;
  usuario_id: string | null;
  em: string;
};

export type DadosArquivo = {
  nome: string | null;
  restrito: boolean;
  pessoa_id: string | null;
  veiculo_id: string | null;
  tipo_arquivo_id: number;
};

/** Tudo o que os eventos citam e que a tela mostra pelo nome (quem fez, de quem é o arquivo, qual placa…). */
export type Resolucao = {
  usuarios: Map<string, { nome: string; ativo: boolean }>;
  tipos: Map<number, string>;
  arquivos: Map<string, DadosArquivo>;
  /** id da pessoa → nome. */
  pessoas: Map<string, string>;
  motoristas: Set<string>;
  proprietarios: Set<string>;
  /** id do veículo → placa. */
  veiculos: Map<string, string>;
  /** id do conjunto → id do cavalo. */
  conjuntos: Map<string, string>;
};

export type Auditoria = {
  eventos: Evento[];
  /** Eventos que passam nos filtros (o resto da lista fica atrás de "Mostrar mais"). */
  totalFiltrado: number;
  totalGeral: number;
  totalVistosGeral: number;
  /** Instante do evento mais antigo (para "nos últimos N dias"). */
  primeiro: string | null;
  vistos: Evento[];
  totalVistos: number;
  /** Quem pode aparecer no filtro "Usuário". */
  usuarios: { id: string; nome: string }[];
  /** Nome do registro filtrado (`?registro=`), quando se acha. */
  registroNome: string | null;
  res: Resolucao;
};

type Linha = Omit<Evento, "dados_antes" | "dados_depois"> & { dados_antes: unknown; dados_depois: unknown };
const evento = (l: Linha): Evento => ({ ...l, dados_antes: obj(l.dados_antes), dados_depois: obj(l.dados_depois) });

const dadosDe = (e: Evento): Dados => e.dados_depois ?? e.dados_antes;
const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** `.in()` com listas grandes estoura o tamanho da URL: busca em lotes. */
async function emLotes<T>(ids: Iterable<string>, buscar: (lote: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const todos = [...new Set(ids)];
  const saida: T[] = [];
  for (let i = 0; i < todos.length; i += LOTE) {
    const { data, error } = await buscar(todos.slice(i, i + LOTE));
    if (error) throw error;
    saida.push(...(data ?? []));
  }
  return saida;
}

function consulta(db: Banco, f: Filtros, acao: string) {
  let q = db.from("auditoria").select(COLUNAS, { count: "exact" });
  if (f.usuario === "sistema") q = q.is("usuario_id", null);
  else if (f.usuario) q = q.eq("usuario_id", f.usuario);
  const tipo = TIPOS.find((t) => t.id === f.tipo);
  if (tipo) q = q.in("tabela", [...tipo.tabelas]);
  if (acao) q = q.eq("acao", acao);
  if (f.registro) q = q.eq("registro_id", f.registro);
  return q.order("em", { ascending: false }).order("id", { ascending: false });
}

const contar = (db: Banco, acao?: string) => {
  const q = db.from("auditoria").select("id", { count: "exact", head: true });
  return acao ? q.eq("acao", acao) : q;
};

export async function carregarAuditoria(supabase: SupabaseClient, f: Filtros): Promise<Auditoria> {
  const db = tipado(supabase);
  // Com um filtro de ação que não é visualização, o painel de quem viu documentos fica vazio.
  const painelVazio = Boolean(f.acao) && f.acao !== "visualizacao";

  const [principal, vistosQ, geral, vistosGeral, primeiroQ, perfis, tipos, nomeReg] = await Promise.all([
    consulta(db, f, f.acao).limit(f.limite),
    painelVazio ? null : consulta(db, f, "visualizacao").limit(MAX_VISTOS),
    contar(db),
    contar(db, "visualizacao"),
    db.from("auditoria").select("em").order("em", { ascending: true }).limit(1),
    db.from("perfil_usuario").select("user_id, nome, ativo").order("nome"),
    db.from("tipo_arquivo").select("id, nome"),
    f.registro && ehGuid(f.registro) ? nomeDoRegistro(db, f.registro) : null,
  ]);
  for (const r of [principal, vistosQ, geral, vistosGeral, primeiroQ, perfis, tipos]) if (r?.error) throw r.error;

  const eventos = ((principal.data ?? []) as Linha[]).map(evento);
  const vistos = ((vistosQ?.data ?? []) as Linha[]).map(evento);
  const todos = [...eventos, ...vistos];

  const res: Resolucao = {
    usuarios: new Map((perfis.data ?? []).map((p) => [p.user_id, { nome: p.nome, ativo: p.ativo }])),
    tipos: new Map((tipos.data ?? []).map((t) => [t.id, t.nome])),
    arquivos: new Map(),
    pessoas: new Map(),
    motoristas: new Set(),
    proprietarios: new Set(),
    veiculos: new Map(),
    conjuntos: new Map(),
  };

  // 1ª rodada: o que os eventos citam direto (arquivos e conjuntos).
  const idsArquivo = todos.filter((e) => e.tabela === "arquivo").map((e) => e.registro_id);
  const idsConjunto = todos.flatMap((e) =>
    e.tabela === "conjunto" ? [e.registro_id] : e.tabela === "conjunto_item" ? [texto(dadosDe(e)?.conjunto_id)].filter((x): x is string => !!x) : [],
  );
  const [arquivos, conjuntos] = await Promise.all([
    emLotes(idsArquivo, (ids) => db.from("arquivo").select("id, nome_original, restrito, pessoa_id, veiculo_id, tipo_arquivo_id").in("id", ids)),
    emLotes(idsConjunto, (ids) => db.from("conjunto").select("id, cavalo_id").in("id", ids)),
  ]);
  for (const a of arquivos) {
    res.arquivos.set(a.id, { nome: a.nome_original, restrito: a.restrito, pessoa_id: a.pessoa_id, veiculo_id: a.veiculo_id, tipo_arquivo_id: a.tipo_arquivo_id });
  }
  for (const c of conjuntos) res.conjuntos.set(c.id, c.cavalo_id);

  // 2ª rodada: de quem (pessoa) e qual placa (veículo).
  const idsPessoa = new Set<string>();
  for (const e of todos) {
    if (["pessoa", "motorista", "proprietario"].includes(e.tabela)) idsPessoa.add(e.registro_id);
    else if (e.tabela.startsWith("pessoa_") || e.tabela === "motorista_referencia") {
      const id = texto(dadosDe(e)?.pessoa_id) ?? texto(dadosDe(e)?.motorista_id);
      if (id) idsPessoa.add(id);
    }
  }
  for (const a of res.arquivos.values()) if (a.pessoa_id) idsPessoa.add(a.pessoa_id);
  const idsVeiculo = new Set<string>(todos.filter((e) => e.tabela === "veiculo").map((e) => e.registro_id));
  for (const a of res.arquivos.values()) if (a.veiculo_id) idsVeiculo.add(a.veiculo_id);
  for (const cavalo of res.conjuntos.values()) idsVeiculo.add(cavalo);

  const [pessoas, motoristas, proprietarios, veiculos] = await Promise.all([
    emLotes(idsPessoa, (ids) => db.from("pessoa").select("id, nome").in("id", ids)),
    emLotes(idsPessoa, (ids) => db.from("motorista").select("pessoa_id").in("pessoa_id", ids)),
    emLotes(idsPessoa, (ids) => db.from("proprietario").select("pessoa_id").in("pessoa_id", ids)),
    emLotes(idsVeiculo, (ids) => db.from("veiculo").select("id, placa").in("id", ids)),
  ]);
  for (const p of pessoas) res.pessoas.set(p.id, p.nome);
  for (const m of motoristas) res.motoristas.add(m.pessoa_id);
  for (const p of proprietarios) res.proprietarios.add(p.pessoa_id);
  for (const v of veiculos) res.veiculos.set(v.id, v.placa);

  return {
    eventos,
    totalFiltrado: principal.count ?? eventos.length,
    totalGeral: geral.count ?? 0,
    totalVistosGeral: vistosGeral.count ?? 0,
    primeiro: primeiroQ.data?.[0]?.em ?? null,
    vistos,
    totalVistos: painelVazio ? 0 : (vistosQ?.count ?? vistos.length),
    usuarios: (perfis.data ?? []).map((p) => ({ id: p.user_id, nome: p.nome })),
    registroNome: nomeReg ?? res.usuarios.get(f.registro)?.nome ?? null,
    res,
  };
}

/** Nome de uma pessoa ou placa de um veículo (o chip "Só …" do filtro por registro). */
async function nomeDoRegistro(db: Banco, id: string): Promise<string | null> {
  const [pessoa, veiculo] = await Promise.all([
    db.from("pessoa").select("nome").eq("id", id).maybeSingle(),
    db.from("veiculo").select("placa").eq("id", id).maybeSingle(),
  ]);
  return pessoa.data?.nome ?? veiculo.data?.placa ?? null;
}
