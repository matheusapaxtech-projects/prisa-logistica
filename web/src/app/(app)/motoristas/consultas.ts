/* Consultas das telas de Motoristas (lista, novo e ficha). Cliente do usuário (RLS). */
import type { Banco, Database } from "@/lib/banco";
import { estadoValidade, type EstadoValidade } from "@/lib/datas";
import { formato } from "@/lib/formato";
import type { PecaEngate } from "@/components/Engate";
import { contarContatosEContas, principal } from "../_pessoa/consultas";
import { ROT, rotulo } from "../_pessoa/rotulos";

type Tabelas = Database["public"]["Tables"];
export type PessoaRow = Tabelas["pessoa"]["Row"];
export type MotoristaRow = Tabelas["motorista"]["Row"];

/* ---------- situação de validade e da gerenciadora (motoristas.js) ---------- */

export type EstadoGr = {
  chave: "sem_consulta" | "habilitado" | "vencendo" | "vencido";
  /** Rótulo curto (Habilitado, Vencido, Sem consulta). */
  rot: string;
  /** Segunda linha: "até 26/12/2026", "vence em 9 dias", "nunca consultado"… */
  sub: string;
};

/** Texto de um estado de validade: "vence em 9 dias", "venceu há 6 dias"; sem data → "sem validade". */
export function textoValidade(e: EstadoValidade): string {
  return e.dias === null ? "sem validade" : formato.dias(e.dias);
}

/** Situação na gerenciadora de risco, com "vencendo" derivado da validade (`estadoGr` do protótipo). */
export function estadoGr(m: Pick<MotoristaRow, "situacao_gr" | "gr_validade">): EstadoGr {
  if (!m.situacao_gr || m.situacao_gr === "sem_consulta") return { chave: "sem_consulta", rot: "Sem consulta", sub: "nunca consultado" };
  const v = estadoValidade(m.gr_validade);
  if (m.situacao_gr === "vencido" || v.cls === "vencido")
    return { chave: "vencido", rot: "Vencido", sub: m.gr_validade ? textoValidade(v) : "consulta vencida" };
  if (v.cls === "vencendo") return { chave: "vencendo", rot: "Habilitado", sub: textoValidade(v) };
  return { chave: "habilitado", rot: "Habilitado", sub: m.gr_validade ? `até ${formato.data(m.gr_validade)}` : "sem validade" };
}

export const categoriaCnh = (c: string | null) => rotulo(ROT.cnh_categoria, c);

/* ---------- lista ---------- */

export type LinhaMotorista = {
  id: string;
  nome: string;
  apelido: string | null;
  cpf: string;
  situacao: "normal" | "pendente" | "cancelado";
  cnhCategoria: string | null;
  cnhValidade: string | null;
  cnh: EstadoValidade;
  grValidade: string | null;
  gr: EstadoGr;
  telefone: { numero: string; tipo: string } | null;
  cidade: string | null;
  /** Documentos (CNH, consulta de risco, arquivos) vencidos ou vencendo em até 30 dias. */
  atencao: number;
};

export async function listarMotoristas(db: Banco): Promise<LinhaMotorista[]> {
  const mot = await db
    .from("motorista")
    .select("pessoa_id, situacao_cadastro, cnh_categoria, cnh_validade, situacao_gr, gr_validade, pessoa(nome, apelido, cpf)");
  if (mot.error) throw mot.error;
  const ids = (mot.data ?? []).map((m) => m.pessoa_id);
  if (!ids.length) return [];

  const [tels, ends, arqs] = await Promise.all([
    db.from("pessoa_telefone").select("pessoa_id, numero, tipo, whatsapp, principal, restrito").in("pessoa_id", ids).order("created_at"),
    db.from("pessoa_endereco").select("pessoa_id, cidade, uf, principal").in("pessoa_id", ids).order("created_at"),
    db.from("arquivo").select("pessoa_id, validade, tipo_arquivo(nome)").in("pessoa_id", ids).not("validade", "is", null),
  ]);
  for (const r of [tels, ends, arqs]) if (r.error) throw r.error;

  const porPessoa = <T extends { pessoa_id: string | null }>(lista: T[]) => {
    const mapa = new Map<string, T[]>();
    for (const x of lista) if (x.pessoa_id) mapa.set(x.pessoa_id, [...(mapa.get(x.pessoa_id) ?? []), x]);
    return mapa;
  };
  const telsP = porPessoa((tels.data ?? []).filter((t) => !t.restrito));
  const endsP = porPessoa(ends.data ?? []);
  const arqsP = porPessoa(arqs.data ?? []);

  return (mot.data ?? [])
    .map((m): LinhaMotorista => {
      const p = m.pessoa!;
      const tel = principal(telsP.get(m.pessoa_id) ?? []);
      const end = principal(endsP.get(m.pessoa_id) ?? []);
      const cnh = estadoValidade(m.cnh_validade);
      const atencao = [
        cnh,
        ...(m.gr_validade && m.situacao_gr !== "sem_consulta" ? [estadoValidade(m.gr_validade)] : []),
        ...(arqsP.get(m.pessoa_id) ?? []).filter((a) => a.tipo_arquivo?.nome !== "CNH").map((a) => estadoValidade(a.validade)),
      ].filter((e) => e.cls === "vencido" || e.cls === "vencendo").length;
      return {
        id: m.pessoa_id,
        nome: p.nome,
        apelido: p.apelido,
        cpf: p.cpf ?? "",
        situacao: m.situacao_cadastro,
        cnhCategoria: categoriaCnh(m.cnh_categoria),
        cnhValidade: m.cnh_validade,
        cnh,
        grValidade: m.gr_validade,
        gr: estadoGr(m),
        telefone: tel ? { numero: tel.numero, tipo: tel.whatsapp ? "WhatsApp" : (rotulo(ROT.tipo_telefone, tel.tipo) ?? "") } : null,
        cidade: end ? `${end.cidade}/${end.uf}` : null,
        atencao,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/* ---------- ficha ---------- */

export type VeiculoResumo = {
  id: string;
  placa: string;
  marcaModelo: string;
};

export type ResumoVeiculo =
  | { tipo: "conjunto"; conjuntoId: string; inicio: string; eixos: number; cavalo: VeiculoResumo; pecas: PecaEngate[]; cavaloPeca: PecaEngate }
  | { tipo: "ultimo"; veiculo: VeiculoResumo; texto: string }
  | { tipo: "nenhum" };

export type Ficha = {
  pessoa: PessoaRow;
  motorista: MotoristaRow;
  telefone: { numero: string; whatsapp: boolean } | null;
  cidade: string | null;
  temEndereco: boolean;
  /** Nomes dos tipos de arquivo que a pessoa já tem (para "Falta anexar…"). */
  tiposArquivo: string[];
  /** Quando e por quem foi cadastrado no NILT; `por` nulo = veio de importação/seed (a linha some). */
  cadastro: { em: string; por: string | null };
  veiculo: ResumoVeiculo;
  contagens: { contatos: number; referencias: number; contas: number; documentos: number };
};

export type SemFicha =
  | { tipo: "nao_encontrado" }
  | { tipo: "nao_motorista"; pessoa: Pick<PessoaRow, "id" | "nome" | "cpf" | "tipo">; proprietario: boolean };

type VeiculoDb = {
  id: string;
  placa: string;
  modelo: string | null;
  capacidade_carga_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
  marca_veiculo: { nome: string } | null;
  tipo_veiculo: { nome: string; categoria: PecaEngate["categoria"]; configuracao_cavalo: "toco" | "trucado" | null; eixos: number } | null;
};
const COLUNAS_VEICULO =
  "id, placa, modelo, capacidade_carga_t, pbt_t, tara_t, marca_veiculo(nome), tipo_veiculo(nome, categoria, configuracao_cavalo, eixos)";

const resumoVeiculo = (v: VeiculoDb): VeiculoResumo => ({
  id: v.id,
  placa: v.placa,
  marcaModelo: [v.marca_veiculo?.nome, v.modelo].filter(Boolean).join(" "),
});

function peca(v: VeiculoDb): PecaEngate {
  const cap = v.capacidade_carga_t ?? (v.pbt_t != null && v.tara_t != null ? Math.round((v.pbt_t - v.tara_t) * 10) / 10 : null);
  return {
    placa: v.placa,
    categoria: v.tipo_veiculo?.categoria ?? "outros",
    configuracao_cavalo: v.tipo_veiculo?.configuracao_cavalo ?? null,
    eixos: v.tipo_veiculo?.eixos ?? 0,
    capacidade_carga_t: cap,
    tipo: v.tipo_veiculo?.nome ?? null,
  };
}

async function carregarVeiculo(db: Banco, motoristaId: string): Promise<ResumoVeiculo> {
  const aberto = await db
    .from("conjunto")
    .select("id, inicio, cavalo_id, conjunto_item(posicao, veiculo_id)")
    .eq("motorista_id", motoristaId)
    .is("fim", null)
    .order("inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aberto.error) throw aberto.error;

  if (aberto.data) {
    const itens = [...(aberto.data.conjunto_item ?? [])].sort((a, b) => a.posicao - b.posicao);
    const ids = [aberto.data.cavalo_id, ...itens.map((i) => i.veiculo_id)];
    const vs = await db.from("veiculo").select(COLUNAS_VEICULO).in("id", ids);
    if (vs.error) throw vs.error;
    const porId = new Map((vs.data as unknown as VeiculoDb[]).map((v) => [v.id, v]));
    const cavalo = porId.get(aberto.data.cavalo_id);
    if (cavalo) {
      const pecas = itens.map((i) => porId.get(i.veiculo_id)).filter((v): v is VeiculoDb => !!v).map(peca);
      const cavaloPeca = peca(cavalo);
      return {
        tipo: "conjunto",
        conjuntoId: aberto.data.id,
        inicio: aberto.data.inicio,
        eixos: cavaloPeca.eixos + pecas.reduce((s, x) => s + x.eixos, 0),
        cavalo: resumoVeiculo(cavalo),
        cavaloPeca,
        pecas,
      };
    }
  }

  // Último veículo: o que tem este motorista como último, senão o cavalo do último conjunto encerrado.
  const [ultimo, historico] = await Promise.all([
    db.from("veiculo").select(COLUNAS_VEICULO).eq("ultimo_motorista_id", motoristaId).limit(1).maybeSingle(),
    db
      .from("conjunto")
      .select("cavalo_id, fim, conjunto_item(veiculo_id)")
      .eq("motorista_id", motoristaId)
      .not("fim", "is", null)
      .order("fim", { ascending: false })
      .limit(20),
  ]);
  if (ultimo.error) throw ultimo.error;
  if (historico.error) throw historico.error;
  let v = ultimo.data as unknown as VeiculoDb | null;
  if (!v && historico.data?.length) {
    const r = await db.from("veiculo").select(COLUNAS_VEICULO).eq("id", historico.data[0].cavalo_id).maybeSingle();
    if (r.error) throw r.error;
    v = r.data as unknown as VeiculoDb | null;
  }
  if (!v) return { tipo: "nenhum" };

  const hist = (historico.data ?? []).find((c) => c.cavalo_id === v.id || (c.conjunto_item ?? []).some((i) => i.veiculo_id === v.id));
  const ate = hist?.fim ? `dirigiu até ${formato.dataHora(hist.fim).slice(0, 10)}` : "sem conjunto aberto com este motorista";
  // Quem está com o veículo agora (conjunto aberto com ele como cavalo ou peça).
  const [comoCavalo, comoItem] = await Promise.all([
    db.from("conjunto").select("motorista_id").eq("cavalo_id", v.id).is("fim", null).limit(1).maybeSingle(),
    db.from("conjunto_item").select("conjunto!inner(motorista_id, fim)").eq("veiculo_id", v.id).is("conjunto.fim", null).limit(1).maybeSingle(),
  ]);
  if (comoCavalo.error) throw comoCavalo.error;
  if (comoItem.error) throw comoItem.error;
  const outroId = comoCavalo.data?.motorista_id ?? (comoItem.data?.conjunto as { motorista_id: string | null } | null)?.motorista_id ?? null;
  let texto = ate;
  if (comoCavalo.data || comoItem.data) {
    let quem = "outro motorista";
    if (outroId) {
      const p = await db.from("pessoa").select("nome").eq("id", outroId).maybeSingle();
      if (p.error) throw p.error;
      quem = p.data?.nome ?? quem;
    }
    texto = `${ate} · hoje com ${quem}`;
  }
  return { tipo: "ultimo", veiculo: resumoVeiculo(v), texto };
}

/** Ficha do motorista; sem motorista com esse id, diz se a pessoa existe (proprietário, empresa) ou não. */
export async function carregarFicha(db: Banco, id: string, admin: boolean): Promise<Ficha | SemFicha> {
  const r = await db.from("pessoa").select("*, motorista(*), proprietario(pessoa_id)").eq("id", id).maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) return { tipo: "nao_encontrado" };
  const { motorista, proprietario, ...pessoa } = r.data;
  if (!motorista)
    return { tipo: "nao_motorista", pessoa: { id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf, tipo: pessoa.tipo }, proprietario: !!proprietario };

  const [tels, ends, arqs, refs, contagens, veiculo, criador] = await Promise.all([
    db.from("pessoa_telefone").select("numero, whatsapp, principal, restrito").eq("pessoa_id", id).order("created_at"),
    db.from("pessoa_endereco").select("cidade, uf, principal").eq("pessoa_id", id).order("created_at"),
    db.from("arquivo").select("restrito, tipo_arquivo(nome)").eq("pessoa_id", id),
    db.from("motorista_referencia").select("id", { count: "exact", head: true }).eq("motorista_id", id),
    contarContatosEContas(db, id),
    carregarVeiculo(db, id),
    pessoa.created_by ? db.rpc("nomes_usuarios", { p_ids: [pessoa.created_by] }) : null,
  ]);
  for (const x of [tels, ends, arqs, refs]) if (x.error) throw x.error;
  if (criador?.error) throw criador.error;

  const tel = principal((tels.data ?? []).filter((t) => admin || !t.restrito));
  const end = principal(ends.data ?? []);
  const arquivos = (arqs.data ?? []).filter((a) => admin || !a.restrito);
  // O telefone restrito não conta para quem não o vê.
  const restritos = admin ? 0 : (tels.data ?? []).filter((t) => t.restrito).length;

  return {
    pessoa: pessoa as PessoaRow,
    motorista: motorista as MotoristaRow,
    telefone: tel ? { numero: tel.numero, whatsapp: tel.whatsapp } : null,
    cidade: end ? `${end.cidade}/${end.uf}` : null,
    temEndereco: (ends.data ?? []).length > 0,
    tiposArquivo: [...new Set(arquivos.map((a) => a.tipo_arquivo?.nome).filter((n): n is string => !!n))],
    cadastro: { em: pessoa.created_at, por: criador?.data?.[0]?.nome ?? null },
    veiculo,
    contagens: {
      contatos: contagens.contatos - restritos,
      referencias: refs.count ?? 0,
      contas: contagens.contas,
      documentos: arquivos.length,
    },
  };
}

/** Motoristas para a página de "não encontrado" (nome, apelido, CPF e situação), por nome. */
export async function motoristasParaEscolher(db: Banco) {
  const r = await db.from("motorista").select("pessoa_id, situacao_cadastro, pessoa(nome, apelido, cpf)");
  if (r.error) throw r.error;
  return (r.data ?? [])
    .map((m) => ({ id: m.pessoa_id, situacao: m.situacao_cadastro, nome: m.pessoa?.nome ?? "", apelido: m.pessoa?.apelido ?? null, cpf: m.pessoa?.cpf ?? "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Tipos de arquivo de pessoa (id e nome), para o envio da CNH na tela "novo". */
export async function idTipoArquivo(db: Banco, nome: string): Promise<number | null> {
  const r = await db.from("tipo_arquivo").select("id").eq("nome", nome).eq("aplica_pessoa", true).maybeSingle();
  if (r.error) throw r.error;
  return r.data?.id ?? null;
}
