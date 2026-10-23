/* Consultas das telas de Viagens (lista e ficha). Sempre com o cliente do usuário (RLS: pode_ler).
   A aptidão das planejadas vem de `v_viagem_planejada` (lista) e de `aptidao_da_viagem` (ficha): as
   mensagens são as do banco. Nomes de quem fez cada coisa vêm de `nomes_usuarios`. */
import type { Banco, Database } from "@/lib/banco";
import type { StatusCampo } from "@/lib/quadro";
import { nomesDeMotorista } from "../pedidos/consultas";
import { lerAptidao, type ItemAptidao, type TipoOcorrencia, type TipoPausa } from "./regras";

type Enums = Database["public"]["Enums"];
type Embutido<T> = T | T[] | null;

const um = <T>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const num = (n: number | string | null | undefined) => (n == null ? null : Number(n));

function erroDe(r: { error: unknown }) {
  if (r.error) throw r.error;
}

type PessoaNome = { nome: string; nome_fantasia: string | null };
const nomeDe = (p: PessoaNome | null) => (p ? p.nome_fantasia || p.nome : "—");
const cidadeDe = (e: { cidade: string; uf: string } | null) => (e ? `${e.cidade}/${e.uf}` : "—");

const TIPO_CANHOTO = 15;

const PEDIDO_RESUMO =
  "pedido:pedido!viagem_pedido_id_fkey(id, numero, situacao, produto, " +
  "tomador:cliente!pedido_tomador_id_fkey(pessoa(nome, nome_fantasia)), " +
  "coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf), " +
  "descarga:pessoa_endereco!pedido_local_descarga_id_fkey(cidade, uf))";

type PedidoBanco = Embutido<{
  id: string;
  numero: number;
  situacao: Enums["situacao_pedido"];
  produto: string;
  tomador: Embutido<{ pessoa: Embutido<PessoaNome> }>;
  coleta: Embutido<{ cidade: string; uf: string }>;
  descarga: Embutido<{ cidade: string; uf: string }>;
}>;

export type PedidoDaViagem = { id: string; numero: number; situacao: Enums["situacao_pedido"]; produto: string; cliente: string; origem: string; destino: string };

function pedidoDe(b: PedidoBanco): PedidoDaViagem | null {
  const p = um(b);
  if (!p) return null;
  return {
    id: p.id,
    numero: p.numero,
    situacao: p.situacao,
    produto: p.produto,
    cliente: nomeDe(um(um(p.tomador)?.pessoa)),
    origem: cidadeDe(um(p.coleta)),
    destino: cidadeDe(um(p.descarga)),
  };
}

/** Nome de cada usuário (`nomes_usuarios`); quem saiu do sistema fica sem nome. */
async function nomesDeUsuarios(db: Banco, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (!unicos.length) return new Map();
  const r = await db.rpc("nomes_usuarios", { p_ids: unicos });
  erroDe(r);
  return new Map((r.data ?? []).map((u) => [u.user_id, u.nome]));
}

/** Nomes dos objetos da pasta no bucket; `null` se não deu para listar (aí ninguém é "envio falhou"). */
async function objetosNoStorage(db: Banco, pasta: string): Promise<Set<string> | null> {
  const r = await db.storage.from("documentos").list(pasta, { limit: 1000 });
  return r.error ? null : new Set((r.data ?? []).map((o) => o.name));
}

/* ---------- lista ---------- */

export type LinhaViagem = {
  id: string;
  numero: number;
  status_campo: StatusCampo | null;
  statusDesde: string | null;
  criadaEm: string;
  finalizadaEm: string | null;
  cancelada_em: string | null;
  pedido: PedidoDaViagem | null;
  placa: string | null;
  motorista: string | null;
  /** Só das planejadas (de `v_viagem_planejada`); nulo nas outras. */
  travas: number | null;
  avisos: number | null;
};

type LinhaBancoLista = {
  id: string;
  numero: number;
  status_campo: StatusCampo | null;
  status_desde: string | null;
  created_at: string;
  finalizada_em: string | null;
  cancelada_em: string | null;
  motorista_id: string;
  cavalo: Embutido<{ placa: string }>;
  pedido: PedidoBanco;
};

/** Todas as viagens, da mais nova para a mais antiga, com a aptidão resumida das planejadas. */
export async function listarViagens(db: Banco): Promise<LinhaViagem[]> {
  const [r, apt] = await Promise.all([
    db
      .from("viagem")
      .select(
        "id, numero, status_campo, status_desde, created_at, finalizada_em, cancelada_em, motorista_id, " +
          `cavalo:veiculo!viagem_cavalo_id_fkey(placa), ${PEDIDO_RESUMO}`,
      )
      .order("numero", { ascending: false }),
    db.from("v_viagem_planejada").select("viagem_id, travas, avisos"),
  ]);
  erroDe(r);
  erroDe(apt);
  const linhas = (r.data ?? []) as unknown as LinhaBancoLista[];
  const aptidao = new Map((apt.data ?? []).map((a) => [a.viagem_id ?? "", { travas: a.travas ?? 0, avisos: a.avisos ?? 0 }]));
  const nomes = await nomesDeMotorista(
    db,
    linhas.map((v) => v.motorista_id),
  );
  return linhas.map((v) => {
    const a = aptidao.get(v.id);
    return {
      id: v.id,
      numero: v.numero,
      status_campo: v.status_campo,
      statusDesde: v.status_desde,
      criadaEm: v.created_at,
      finalizadaEm: v.finalizada_em,
      cancelada_em: v.cancelada_em,
      pedido: pedidoDe(v.pedido),
      placa: um(v.cavalo)?.placa ?? null,
      motorista: nomes.get(v.motorista_id) ?? null,
      travas: a?.travas ?? null,
      avisos: a?.avisos ?? null,
    };
  });
}

/* ---------- ficha ---------- */

export type EventoDaViagem = {
  id: number;
  em: string;
  por: string | null;
  de: StatusCampo | null;
  para: StatusCampo | null;
  motivo: string | null;
  dados: unknown;
};

export type PausaDaViagem = { id: string; tipo: TipoPausa; programada: boolean; colunaOrigem: StatusCampo; inicio: string; fim: string | null };

export type OcorrenciaDaViagem = {
  id: string;
  tipo: TipoOcorrencia;
  descricao: string;
  abertaEm: string;
  abertaPor: string | null;
  resolvidaEm: string | null;
  resolvidaPor: string | null;
  resolucao: string | null;
};

export type CanhotoDaViagem = { id: string; nome: string; tamanho: number | null; enviadoEm: string; caminho: string; envioFalhou: boolean };

export type FichaViagem = {
  id: string;
  numero: number;
  status_campo: StatusCampo | null;
  statusDesde: string | null;
  criadaEm: string;
  iniciadaEm: string | null;
  iniciadaPor: string | null;
  liberacaoJustificativa: string | null;
  /** Aptidão gravada no início (o que foi conferido e, com exceção, o que foi liberado). */
  liberacaoAptidao: ItemAptidao[] | null;
  pedido: PedidoDaViagem | null;
  conjuntoId: string;
  /** Placa do cavalo e, na ordem do engate, as das peças do conjunto. */
  cavalo: string | null;
  carretas: string[];
  motoristaId: string;
  motorista: string | null;
  pesoPrevistoKg: number;
  pesoSaidaKg: number | null;
  pesoChegadaKg: number | null;
  freteMotoristaValor: number | null;
  freteMotoristaTipo: Enums["tipo_tarifa"] | null;
  chaveCte: string | null;
  chaveMdfe: string | null;
  pagamentoSaidaEm: string | null;
  pagamentoSaidaPor: string | null;
  divergencia: Enums["resultado_contagem"] | null;
  divergenciaDescricao: string | null;
  resolucao: string | null;
  finalizadaEm: string | null;
  canceladaEm: string | null;
  canceladaPor: string | null;
  cancelamentoMotivo: string | null;
  observacao: string | null;
  /** Aptidão de agora (só da planejada viva; vazia nas outras). */
  aptidao: ItemAptidao[];
  eventos: EventoDaViagem[];
  pausas: PausaDaViagem[];
  /** Coluna de onde saiu a pausa aberta (a regra de cancelar depende dela). */
  origemDaPausa: StatusCampo | null;
  ocorrencias: OcorrenciaDaViagem[];
  canhotos: CanhotoDaViagem[];
};

const COLUNAS_FICHA =
  "id, numero, status_campo, status_desde, created_at, iniciada_em, iniciada_por, liberacao_justificativa, liberacao_aptidao, " +
  "conjunto_id, motorista_id, peso_previsto_kg, peso_saida_kg, peso_chegada_kg, frete_motorista_valor, frete_motorista_tipo, " +
  "chave_cte, chave_mdfe, pagamento_saida_em, pagamento_saida_por, divergencia, divergencia_descricao, resolucao, finalizada_em, " +
  "cancelada_em, cancelada_por, cancelamento_motivo, observacao, " +
  "cavalo:veiculo!viagem_cavalo_id_fkey(placa), " +
  "conjunto:conjunto!viagem_conjunto_id_fkey(conjunto_item(posicao, veiculo:veiculo!conjunto_item_veiculo_id_fkey(placa))), " +
  PEDIDO_RESUMO;

type LinhaBancoFicha = {
  id: string;
  numero: number;
  status_campo: StatusCampo | null;
  status_desde: string | null;
  created_at: string;
  iniciada_em: string | null;
  iniciada_por: string | null;
  liberacao_justificativa: string | null;
  liberacao_aptidao: unknown;
  conjunto_id: string;
  motorista_id: string;
  peso_previsto_kg: number;
  peso_saida_kg: number | null;
  peso_chegada_kg: number | null;
  frete_motorista_valor: number | null;
  frete_motorista_tipo: Enums["tipo_tarifa"] | null;
  chave_cte: string | null;
  chave_mdfe: string | null;
  pagamento_saida_em: string | null;
  pagamento_saida_por: string | null;
  divergencia: Enums["resultado_contagem"] | null;
  divergencia_descricao: string | null;
  resolucao: string | null;
  finalizada_em: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  cancelamento_motivo: string | null;
  observacao: string | null;
  cavalo: Embutido<{ placa: string }>;
  conjunto: Embutido<{ conjunto_item: { posicao: number; veiculo: Embutido<{ placa: string }> }[] }>;
  pedido: PedidoBanco;
};

/** A viagem do endereço com pedido, conjunto, aptidão, eventos, pausas, ocorrências e canhoto; `null` = não existe. */
export async function carregarViagem(db: Banco, id: string): Promise<FichaViagem | null> {
  const r = await db.from("viagem").select(COLUNAS_FICHA).eq("id", id).maybeSingle();
  erroDe(r);
  const v = r.data as unknown as LinhaBancoFicha | null;
  if (!v) return null;

  const planejadaViva = v.status_campo === null && !v.cancelada_em;
  const [apt, eventos, pausas, ocorrencias, canhotos, noStorage, motoristas] = await Promise.all([
    planejadaViva ? db.rpc("aptidao_da_viagem", { p_viagem: id }) : Promise.resolve({ data: [], error: null }),
    db.from("viagem_evento").select("id, em, por, de, para, motivo, dados").eq("viagem_id", id).order("em").order("id"),
    db.from("viagem_pausa").select("id, tipo, programada, coluna_origem, inicio, fim").eq("viagem_id", id).order("inicio"),
    db
      .from("viagem_ocorrencia")
      .select("id, tipo, descricao, aberta_em, aberta_por, resolvida_em, resolvida_por, resolucao")
      .eq("viagem_id", id)
      .order("aberta_em"),
    db
      .from("arquivo")
      .select("id, nome_original, tamanho_bytes, created_at, storage_path")
      .eq("viagem_id", id)
      .eq("tipo_arquivo_id", TIPO_CANHOTO)
      .order("created_at"),
    objetosNoStorage(db, `viagem/${id}`),
    nomesDeMotorista(db, [v.motorista_id]),
  ]);
  erroDe(apt);
  erroDe(eventos);
  erroDe(pausas);
  erroDe(ocorrencias);
  erroDe(canhotos);

  const nomes = await nomesDeUsuarios(db, [
    v.iniciada_por,
    v.pagamento_saida_por,
    v.cancelada_por,
    ...(eventos.data ?? []).map((e) => e.por),
    ...(ocorrencias.data ?? []).flatMap((o) => [o.aberta_por, o.resolvida_por]),
  ]);
  const nome = (u: string | null) => (u ? (nomes.get(u) ?? "usuário removido") : null);
  const listaPausas = pausas.data ?? [];

  return {
    id: v.id,
    numero: v.numero,
    status_campo: v.status_campo,
    statusDesde: v.status_desde,
    criadaEm: v.created_at,
    iniciadaEm: v.iniciada_em,
    iniciadaPor: nome(v.iniciada_por),
    liberacaoJustificativa: v.liberacao_justificativa,
    liberacaoAptidao: v.liberacao_aptidao == null ? null : lerAptidao(v.liberacao_aptidao),
    pedido: pedidoDe(v.pedido),
    conjuntoId: v.conjunto_id,
    cavalo: um(v.cavalo)?.placa ?? null,
    carretas: [...(um(v.conjunto)?.conjunto_item ?? [])].sort((a, b) => a.posicao - b.posicao).map((i) => um(i.veiculo)?.placa ?? "—"),
    motoristaId: v.motorista_id,
    motorista: motoristas.get(v.motorista_id) ?? null,
    pesoPrevistoKg: Number(v.peso_previsto_kg),
    pesoSaidaKg: num(v.peso_saida_kg),
    pesoChegadaKg: num(v.peso_chegada_kg),
    freteMotoristaValor: num(v.frete_motorista_valor),
    freteMotoristaTipo: v.frete_motorista_tipo,
    chaveCte: v.chave_cte,
    chaveMdfe: v.chave_mdfe,
    pagamentoSaidaEm: v.pagamento_saida_em,
    pagamentoSaidaPor: nome(v.pagamento_saida_por),
    divergencia: v.divergencia,
    divergenciaDescricao: v.divergencia_descricao,
    resolucao: v.resolucao,
    finalizadaEm: v.finalizada_em,
    canceladaEm: v.cancelada_em,
    canceladaPor: nome(v.cancelada_por),
    cancelamentoMotivo: v.cancelamento_motivo,
    observacao: v.observacao,
    aptidao: lerAptidao(apt.data),
    eventos: (eventos.data ?? []).map((e) => ({ id: e.id, em: e.em, por: nome(e.por), de: e.de, para: e.para, motivo: e.motivo, dados: e.dados })),
    pausas: listaPausas.map((p) => ({ id: p.id, tipo: p.tipo, programada: p.programada, colunaOrigem: p.coluna_origem, inicio: p.inicio, fim: p.fim })),
    origemDaPausa: listaPausas.find((p) => p.fim === null)?.coluna_origem ?? null,
    ocorrencias: (ocorrencias.data ?? []).map((o) => ({
      id: o.id,
      tipo: o.tipo,
      descricao: o.descricao,
      abertaEm: o.aberta_em,
      abertaPor: nome(o.aberta_por),
      resolvidaEm: o.resolvida_em,
      resolvidaPor: nome(o.resolvida_por),
      resolucao: o.resolucao,
    })),
    canhotos: (canhotos.data ?? []).map((a) => ({
      id: a.id,
      nome: a.nome_original ?? a.storage_path.split("/").pop() ?? "",
      tamanho: a.tamanho_bytes,
      enviadoEm: a.created_at,
      caminho: a.storage_path,
      envioFalhou: noStorage ? !noStorage.has(a.storage_path.split("/").pop() ?? "") : false,
    })),
  };
}
