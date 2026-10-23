/* Consultas das telas de Proprietários (lista, novo e ficha). Cliente do usuário (RLS). */
import type { Banco, Database } from "@/lib/banco";
import { diasAte } from "@/lib/datas";
import { contarContatosEContas } from "../_pessoa/consultas";

type Tabelas = Database["public"]["Tables"];
export type PessoaRow = Tabelas["pessoa"]["Row"];
export type ProprietarioRow = Tabelas["proprietario"]["Row"];

/** Enquadramento na ANTT, rótulo curto (`ENQ` de proprietarios.js). */
export const ENQ: Record<string, string> = { tac: "TAC", etc: "ETC", ctc: "CTC", etc_equiparado: "ETC equiparado" };

/* ---------- RNTRC (rntrcEstado de proprietarios.js) ---------- */

export type EstadoRntrc = {
  estado: "sem" | "sem_validade" | "vencido" | "vencendo" | "ok";
  dias: number | null;
};

/** Sem número → "sem"; sem validade → "sem_validade"; senão vencido (< 0), vencendo (até 30 dias) ou ok. */
export function estadoRntrc(pr: { rntrc: string | null; rntrc_validade: string | null }): EstadoRntrc {
  if (!pr.rntrc) return { estado: "sem", dias: null };
  if (!pr.rntrc_validade) return { estado: "sem_validade", dias: null };
  const dias = diasAte(pr.rntrc_validade);
  return { estado: dias < 0 ? "vencido" : dias <= 30 ? "vencendo" : "ok", dias };
}

/* ---------- lista ---------- */

export type ContagemVeiculos = { posse: number; documento: number; todos: number; arrendados: number };

export type LinhaProprietario = {
  id: string;
  tipo: "pf" | "pj";
  nome: string;
  nomeFantasia: string | null;
  apelido: string | null;
  /** CPF ou CNPJ, só dígitos. */
  documento: string;
  situacao: "normal" | "pendente" | "cancelado";
  enquadramento: string | null;
  rntrc: string | null;
  rntrcValidade: string | null;
  r: EstadoRntrc;
  veic: ContagemVeiculos;
  responsavel: { nome: string | null; telefone: string | null; whatsapp: boolean } | null;
  tambemMotorista: boolean;
};

export type ListaProprietarios = { linhas: LinhaProprietario[]; arrendadosTotal: number };

export async function listarProprietarios(db: Banco): Promise<ListaProprietarios> {
  const [pr, vs, ms] = await Promise.all([
    db
      .from("proprietario")
      .select(
        "pessoa_id, situacao_cadastro, rntrc, enquadramento_antt, rntrc_validade, responsavel_nome, responsavel_telefone, responsavel_whatsapp, pessoa(tipo, nome, nome_fantasia, apelido, cpf, cnpj)",
      ),
    db.from("veiculo").select("proprietario_posse_id, proprietario_documento_id, arrendado"),
    db.from("motorista").select("pessoa_id"),
  ]);
  for (const r of [pr, vs, ms]) if (r.error) throw r.error;

  const veiculos = vs.data ?? [];
  const motoristas = new Set((ms.data ?? []).map((m) => m.pessoa_id));
  const contagem = (id: string): ContagemVeiculos => {
    const posse = veiculos.filter((v) => v.proprietario_posse_id === id);
    const documento = veiculos.filter((v) => v.proprietario_documento_id === id);
    const todos = veiculos.filter((v) => v.proprietario_posse_id === id || v.proprietario_documento_id === id);
    return { posse: posse.length, documento: documento.length, todos: todos.length, arrendados: todos.filter((v) => v.arrendado).length };
  };

  const linhas = (pr.data ?? [])
    .map((p): LinhaProprietario => {
      const pe = p.pessoa!;
      return {
        id: p.pessoa_id,
        tipo: pe.tipo,
        nome: pe.nome,
        nomeFantasia: pe.nome_fantasia,
        apelido: pe.apelido,
        documento: (pe.tipo === "pj" ? pe.cnpj : pe.cpf) ?? "",
        situacao: p.situacao_cadastro,
        enquadramento: p.enquadramento_antt,
        rntrc: p.rntrc,
        rntrcValidade: p.rntrc_validade,
        r: estadoRntrc(p),
        veic: contagem(p.pessoa_id),
        responsavel: pe.tipo === "pj" ? { nome: p.responsavel_nome, telefone: p.responsavel_telefone, whatsapp: !!p.responsavel_whatsapp } : null,
        tambemMotorista: motoristas.has(p.pessoa_id),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { linhas, arrendadosTotal: veiculos.filter((v) => v.arrendado).length };
}

/* ---------- ficha ---------- */

export type VeiculoDoProprietario = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  tipo: string | null;
  situacao: string;
  arrendado: boolean;
  posse: boolean;
  documento: boolean;
  /** O outro proprietário do veículo (quando este não é posse ou não é documento). */
  outro: { id: string; nome: string; naPosse: boolean } | null;
  semContrato: boolean;
};

export type Ficha = {
  pessoa: PessoaRow;
  proprietario: ProprietarioRow;
  tambemMotorista: boolean;
  veiculos: VeiculoDoProprietario[];
  /** Arquivos que o usuário vê (restritos só para admin): tipo, validade. */
  arquivos: { tipo: string | null; validade: string | null }[];
  contagens: { contatos: number; contas: number };
  /** Há conta com titular que não confere (a aba Contas ganha o alerta). */
  temContaForaDoTitular: boolean;
  /** Há conta com favorecido de outro documento e nenhum arquivo OUTROS (autorização) anexado. */
  terceiroSemAutorizacao: boolean;
};

export type SemFicha =
  | { tipo: "nao_encontrado" }
  | { tipo: "nao_proprietario"; pessoa: Pick<PessoaRow, "id" | "nome" | "cpf" | "cnpj" | "tipo">; motorista: boolean };

const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

async function carregarVeiculos(db: Banco, id: string): Promise<VeiculoDoProprietario[]> {
  const r = await db
    .from("veiculo")
    .select("id, placa, modelo, arrendado, situacao_operacional, proprietario_posse_id, proprietario_documento_id, marca_veiculo(nome), tipo_veiculo(nome)")
    .or(`proprietario_posse_id.eq.${id},proprietario_documento_id.eq.${id}`)
    .order("placa");
  if (r.error) throw r.error;
  const lista = r.data ?? [];
  if (!lista.length) return [];

  const outrosIds = [
    ...new Set(
      lista
        .flatMap((v) => [v.proprietario_posse_id, v.proprietario_documento_id])
        .filter((x) => x !== id),
    ),
  ];
  const arrendadosIds = lista.filter((v) => v.arrendado).map((v) => v.id);
  const [pes, contratos] = await Promise.all([
    outrosIds.length ? db.from("pessoa").select("id, nome, nome_fantasia").in("id", outrosIds) : null,
    arrendadosIds.length ? db.from("arquivo").select("veiculo_id, tipo_arquivo(nome)").in("veiculo_id", arrendadosIds) : null,
  ]);
  if (pes?.error) throw pes.error;
  if (contratos?.error) throw contratos.error;
  const nomes = new Map((pes?.data ?? []).map((p) => [p.id, p.nome_fantasia || p.nome]));
  const comContrato = new Set((contratos?.data ?? []).filter((a) => a.tipo_arquivo?.nome === "CONTRATO").map((a) => a.veiculo_id));

  return lista.map((v): VeiculoDoProprietario => {
    const posse = v.proprietario_posse_id === id;
    const documento = v.proprietario_documento_id === id;
    const outroId = !posse ? v.proprietario_posse_id : !documento ? v.proprietario_documento_id : null;
    return {
      id: v.id,
      placa: v.placa,
      marca: v.marca_veiculo?.nome ?? null,
      modelo: v.modelo,
      tipo: v.tipo_veiculo?.nome ?? null,
      situacao: v.situacao_operacional,
      arrendado: v.arrendado ?? false,
      posse,
      documento,
      outro: outroId ? { id: outroId, nome: nomes.get(outroId) ?? "outro proprietário", naPosse: !posse } : null,
      semContrato: !!v.arrendado && !comContrato.has(v.id),
    };
  });
}

/** Ficha do proprietário; sem papel de proprietário, diz se a pessoa existe (motorista, pessoa avulsa) ou não. */
export async function carregarFicha(db: Banco, id: string, admin: boolean): Promise<Ficha | SemFicha> {
  const r = await db.from("pessoa").select("*, proprietario(*), motorista(pessoa_id)").eq("id", id).maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) return { tipo: "nao_encontrado" };
  const { proprietario, motorista, ...pessoa } = r.data;
  if (!proprietario)
    return {
      tipo: "nao_proprietario",
      pessoa: { id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf, cnpj: pessoa.cnpj, tipo: pessoa.tipo },
      motorista: !!motorista,
    };

  const [veiculos, arqs, contas, contagens] = await Promise.all([
    carregarVeiculos(db, id),
    db.from("arquivo").select("restrito, validade, tipo_arquivo(nome)").eq("pessoa_id", id),
    db.from("pessoa_conta_bancaria").select("titular_confere, favorecido_documento").eq("pessoa_id", id),
    contarContatosEContas(db, id),
  ]);
  for (const x of [arqs, contas]) if (x.error) throw x.error;

  const arquivos = (arqs.data ?? []).filter((a) => admin || !a.restrito).map((a) => ({ tipo: a.tipo_arquivo?.nome ?? null, validade: a.validade }));
  const doc = soDigitos(pessoa.cpf ?? pessoa.cnpj);
  // Conta fora do titular: documento do favorecido ausente de propósito não conta (o aviso da própria
  // aba pede o documento); só quem tem documento diferente do proprietário exige autorização.
  const foraDoTitular = (contas.data ?? []).filter((c) => !c.titular_confere);
  const terceiros = (contas.data ?? []).filter((c) => soDigitos(c.favorecido_documento) && soDigitos(c.favorecido_documento) !== doc);

  return {
    pessoa: pessoa as PessoaRow,
    proprietario: proprietario as ProprietarioRow,
    tambemMotorista: !!motorista,
    veiculos,
    arquivos,
    contagens,
    temContaForaDoTitular: foraDoTitular.length > 0,
    terceiroSemAutorizacao: terceiros.length > 0 && !arquivos.some((a) => a.tipo === "OUTROS"),
  };
}
