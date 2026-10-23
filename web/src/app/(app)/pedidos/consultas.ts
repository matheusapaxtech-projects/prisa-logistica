/* Consultas das telas de Pedidos (lista, ficha, novo e o diálogo "Nova viagem"). Sempre com o cliente
   do usuário (RLS: pode_ler). O saldo vem de `v_pedido_saldo` (peso das viagens não canceladas: o de
   saída quando já há, senão o previsto); a capacidade do conjunto, de `v_conjunto_capacidade`. */
import type { Banco, Database } from "@/lib/banco";
import type { StatusCampo } from "@/lib/quadro";
import { formato } from "@/lib/formato";
import { listarClientes, type Local } from "../clientes/consultas";

type Enums = Database["public"]["Enums"];
type Embutido<T> = T | T[] | null;

const um = <T>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const num = (n: number | string | null | undefined) => (n == null ? null : Number(n));

function erroDe(r: { error: unknown }) {
  if (r.error) throw r.error;
}

type PessoaNome = { nome: string; nome_fantasia: string | null };
/** Nome que a operação usa: o fantasia, se houver. */
const nomeDe = (p: PessoaNome | null) => (p ? p.nome_fantasia || p.nome : "—");
const cidadeDe = (e: { cidade: string; uf: string } | null) => (e ? `${e.cidade}/${e.uf}` : "—");

/** Saldo de cada pedido (`v_pedido_saldo`), pelo id do pedido. */
async function saldos(db: Banco, pedidoId?: string) {
  let q = db.from("v_pedido_saldo").select("pedido_id, peso_alocado_kg, saldo_kg, viagens");
  if (pedidoId) q = q.eq("pedido_id", pedidoId);
  const r = await q;
  erroDe(r);
  return new Map(
    (r.data ?? []).map((s) => [s.pedido_id ?? "", { alocado: num(s.peso_alocado_kg) ?? 0, saldo: num(s.saldo_kg) ?? 0, viagens: s.viagens ?? 0 }]),
  );
}

/* ---------- lista ---------- */

export type LinhaPedido = {
  id: string;
  numero: number;
  situacao: Enums["situacao_pedido"];
  tomador: string;
  origem: string;
  destino: string;
  produto: string;
  pesoTotalKg: number;
  saldoKg: number;
  viagens: number;
  coletaPrevista: string | null;
};

const COLUNAS_LISTA =
  "id, numero, situacao, produto, peso_total_kg, coleta_prevista, " +
  "tomador:cliente!pedido_tomador_id_fkey(pessoa(nome, nome_fantasia)), " +
  "coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf), " +
  "descarga:pessoa_endereco!pedido_local_descarga_id_fkey(cidade, uf)";

type LinhaBancoLista = {
  id: string;
  numero: number;
  situacao: Enums["situacao_pedido"];
  produto: string;
  peso_total_kg: number;
  coleta_prevista: string | null;
  tomador: Embutido<{ pessoa: Embutido<PessoaNome> }>;
  coleta: Embutido<{ cidade: string; uf: string }>;
  descarga: Embutido<{ cidade: string; uf: string }>;
};

/** Todos os pedidos, do mais novo para o mais antigo, com o saldo a carregar. */
export async function listarPedidos(db: Banco): Promise<LinhaPedido[]> {
  const [r, s] = await Promise.all([db.from("pedido").select(COLUNAS_LISTA).order("numero", { ascending: false }), saldos(db)]);
  erroDe(r);
  return ((r.data ?? []) as unknown as LinhaBancoLista[]).map((p) => {
    const sd = s.get(p.id);
    const total = Number(p.peso_total_kg);
    return {
      id: p.id,
      numero: p.numero,
      situacao: p.situacao,
      tomador: nomeDe(um(um(p.tomador)?.pessoa)),
      origem: cidadeDe(um(p.coleta)),
      destino: cidadeDe(um(p.descarga)),
      produto: p.produto,
      pesoTotalKg: total,
      saldoKg: sd?.saldo ?? total,
      viagens: sd?.viagens ?? 0,
      coletaPrevista: p.coleta_prevista,
    };
  });
}

/* ---------- ficha ---------- */

export type ParteFicha = { id: string; nome: string; nomeCompleto: string };
export type LocalFicha = Pick<
  Local,
  "id" | "cep" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "ponto_referencia" | "janela_atendimento" | "contato_local"
>;

export type ViagemDoPedido = {
  id: string;
  numero: number;
  status_campo: StatusCampo | null;
  cancelada_em: string | null;
  placa: string | null;
  motorista: string | null;
  pesoPrevistoKg: number;
  pesoSaidaKg: number | null;
  freteMotoristaValor: number | null;
  freteMotoristaTipo: Enums["tipo_tarifa"] | null;
};

export type FichaPedido = {
  id: string;
  numero: number;
  situacao: Enums["situacao_pedido"];
  tomador: ParteFicha;
  remetente: ParteFicha;
  destinatario: ParteFicha;
  coleta: LocalFicha | null;
  descarga: LocalFicha | null;
  produto: string;
  pesoTotalKg: number;
  coletaPrevista: string | null;
  entregaPrevista: string | null;
  freteValor: number;
  freteTipo: Enums["tipo_tarifa"];
  freteOrigem: Enums["origem_frete"];
  observacao: string | null;
  criadoEm: string;
  alocadoKg: number;
  saldoKg: number;
  viagens: ViagemDoPedido[];
};

const COLUNAS_LOCAL = "id, cep, logradouro, numero, complemento, bairro, cidade, uf, ponto_referencia, janela_atendimento, contato_local";
const COLUNAS_FICHA =
  "id, numero, situacao, produto, peso_total_kg, coleta_prevista, entrega_prevista, frete_empresa_valor, frete_empresa_tipo, " +
  "frete_empresa_origem, observacao, created_at, tomador_id, remetente_id, destinatario_id, " +
  "tomador:cliente!pedido_tomador_id_fkey(pessoa(nome, nome_fantasia)), " +
  "remetente:cliente!pedido_remetente_id_fkey(pessoa(nome, nome_fantasia)), " +
  "destinatario:cliente!pedido_destinatario_id_fkey(pessoa(nome, nome_fantasia)), " +
  `coleta:pessoa_endereco!pedido_local_coleta_id_fkey(${COLUNAS_LOCAL}), ` +
  `descarga:pessoa_endereco!pedido_local_descarga_id_fkey(${COLUNAS_LOCAL})`;

type ParteBanco = Embutido<{ pessoa: Embutido<PessoaNome> }>;
type LinhaBancoFicha = {
  id: string;
  numero: number;
  situacao: Enums["situacao_pedido"];
  produto: string;
  peso_total_kg: number;
  coleta_prevista: string | null;
  entrega_prevista: string | null;
  frete_empresa_valor: number;
  frete_empresa_tipo: Enums["tipo_tarifa"];
  frete_empresa_origem: Enums["origem_frete"];
  observacao: string | null;
  created_at: string;
  tomador_id: string;
  remetente_id: string;
  destinatario_id: string;
  tomador: ParteBanco;
  remetente: ParteBanco;
  destinatario: ParteBanco;
  coleta: Embutido<LocalFicha>;
  descarga: Embutido<LocalFicha>;
};

function parte(id: string, b: ParteBanco): ParteFicha {
  const p = um(um(b)?.pessoa);
  return { id, nome: nomeDe(p), nomeCompleto: p?.nome ?? "—" };
}

/** Viagens do pedido (inclusive as canceladas), na ordem em que foram criadas. */
export async function listarViagensDoPedido(db: Banco, pedidoId: string): Promise<ViagemDoPedido[]> {
  const r = await db
    .from("viagem")
    .select(
      "id, numero, status_campo, cancelada_em, peso_previsto_kg, peso_saida_kg, frete_motorista_valor, frete_motorista_tipo, motorista_id, " +
        "cavalo:veiculo!viagem_cavalo_id_fkey(placa)",
    )
    .eq("pedido_id", pedidoId)
    .order("numero");
  erroDe(r);
  const linhas = (r.data ?? []) as unknown as {
    id: string;
    numero: number;
    status_campo: StatusCampo | null;
    cancelada_em: string | null;
    peso_previsto_kg: number;
    peso_saida_kg: number | null;
    frete_motorista_valor: number | null;
    frete_motorista_tipo: Enums["tipo_tarifa"] | null;
    motorista_id: string;
    cavalo: Embutido<{ placa: string }>;
  }[];
  const nomes = await nomesDeMotorista(db, linhas.map((v) => v.motorista_id));
  return linhas.map((v) => ({
    id: v.id,
    numero: v.numero,
    status_campo: v.status_campo,
    cancelada_em: v.cancelada_em,
    placa: um(v.cavalo)?.placa ?? null,
    motorista: nomes.get(v.motorista_id) ?? null,
    pesoPrevistoKg: Number(v.peso_previsto_kg),
    pesoSaidaKg: num(v.peso_saida_kg),
    freteMotoristaValor: num(v.frete_motorista_valor),
    freteMotoristaTipo: v.frete_motorista_tipo,
  }));
}

/** O pedido do endereço com partes, locais, saldo e viagens; `null` = não existe (ou o RLS esconde). */
export async function carregarPedido(db: Banco, id: string): Promise<FichaPedido | null> {
  const r = await db.from("pedido").select(COLUNAS_FICHA).eq("id", id).maybeSingle();
  erroDe(r);
  const p = r.data as unknown as LinhaBancoFicha | null;
  if (!p) return null;
  const [s, viagens] = await Promise.all([saldos(db, id), listarViagensDoPedido(db, id)]);
  const total = Number(p.peso_total_kg);
  const sd = s.get(id);
  return {
    id: p.id,
    numero: p.numero,
    situacao: p.situacao,
    tomador: parte(p.tomador_id, p.tomador),
    remetente: parte(p.remetente_id, p.remetente),
    destinatario: parte(p.destinatario_id, p.destinatario),
    coleta: um(p.coleta),
    descarga: um(p.descarga),
    produto: p.produto,
    pesoTotalKg: total,
    coletaPrevista: p.coleta_prevista,
    entregaPrevista: p.entrega_prevista,
    freteValor: Number(p.frete_empresa_valor),
    freteTipo: p.frete_empresa_tipo,
    freteOrigem: p.frete_empresa_origem,
    observacao: p.observacao,
    criadoEm: p.created_at,
    alocadoKg: sd?.alocado ?? 0,
    saldoKg: sd?.saldo ?? total,
    viagens,
  };
}

/* ---------- motoristas e conjuntos ---------- */

/** Nome do motorista (o completo; o apelido entre parênteses, se houver). */
export async function nomesDeMotorista(db: Banco, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map();
  const r = await db.from("pessoa").select("id, nome, apelido").in("id", unicos);
  erroDe(r);
  return new Map((r.data ?? []).map((p) => [p.id, p.apelido?.trim() ? `${p.nome} (${p.apelido.trim()})` : p.nome]));
}

/** Conjunto aberto e com motorista: o que o diálogo "Nova viagem" oferece. */
export type OpcaoConjunto = {
  id: string;
  cavalo: string;
  /** Placas das peças engatadas, na ordem do engate. */
  carretas: string[];
  motorista: string;
  /** Capacidade de carga das carretas (t), de `v_conjunto_capacidade`; nula quando não há como saber. */
  capacidadeT: number | null;
};

/** Conjuntos abertos (fim nulo) com motorista, na ordem em que foram montados. */
export async function listarConjuntosAbertos(db: Banco): Promise<OpcaoConjunto[]> {
  const r = await db
    .from("conjunto")
    .select("id, cavalo_id, motorista_id, conjunto_item(posicao, veiculo_id)")
    .is("fim", null)
    .not("motorista_id", "is", null)
    .order("inicio")
    .order("id");
  erroDe(r);
  const conjuntos = r.data ?? [];
  if (!conjuntos.length) return [];

  const veiculoIds = [...new Set(conjuntos.flatMap((c) => [c.cavalo_id, ...c.conjunto_item.map((i) => i.veiculo_id)]))];
  const [vs, nomes, caps] = await Promise.all([
    db.from("veiculo").select("id, placa").in("id", veiculoIds),
    nomesDeMotorista(db, conjuntos.map((c) => c.motorista_id!)),
    db
      .from("v_conjunto_capacidade")
      .select("conjunto_id, capacidade_total_t")
      .in(
        "conjunto_id",
        conjuntos.map((c) => c.id),
      ),
  ]);
  erroDe(vs);
  erroDe(caps);
  const placas = new Map((vs.data ?? []).map((v) => [v.id, v.placa]));
  const capacidade = new Map((caps.data ?? []).map((c) => [c.conjunto_id ?? "", num(c.capacidade_total_t)]));

  return conjuntos.map((c) => ({
    id: c.id,
    cavalo: placas.get(c.cavalo_id) ?? "—",
    carretas: [...c.conjunto_item].sort((a, b) => a.posicao - b.posicao).map((i) => placas.get(i.veiculo_id) ?? "—"),
    motorista: nomes.get(c.motorista_id!) ?? "—",
    capacidadeT: capacidade.get(c.id) ?? null,
  }));
}

/* ---------- novo pedido ---------- */

/** Cliente nas opções de tomador, remetente e destinatário. */
export type OpcaoCliente = {
  id: string;
  /** Nome curto (fantasia, se houver). */
  nome: string;
  nomeCompleto: string;
  /** CPF ou CNPJ formatado. */
  doc: string;
  /** Quantos locais de coleta/descarga tem. */
  locais: number;
};

/** Todos os clientes como opção de busca (a lista de clientes é curta: vai inteira para a tela). */
export async function opcoesDeClientes(db: Banco): Promise<OpcaoCliente[]> {
  const linhas = await listarClientes(db);
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nomeFantasia || l.nome,
    nomeCompleto: l.nome,
    doc: l.tipo === "pj" ? formato.cnpj(l.documento) : formato.cpf(l.documento),
    locais: l.locais,
  }));
}
