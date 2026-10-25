/* Consultas da aba "Calculadora e negociações" do Despacho (migration 20261030000200): os fretes da fila, os
   motoristas do acervo (conjuntos abertos), o que já foi pago por rota e as negociações. A margem das
   negociações (negociacao_resultado) só volta para admin e financeiro: o RLS esconde as linhas dos outros. */
import type { Banco, Database } from "@/lib/banco";
import type { TipoCarga } from "@/lib/calculadora/regras";
import { listarConjuntosAbertos, listarPedidos, nomesDeMotorista } from "../../pedidos/consultas";

type Embutido<T> = T | T[] | null;
const um = <T,>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const erroDe = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};

export type FreteDaFila = {
  id: string;
  numero: number;
  origem: string;
  destino: string;
  cliente: string;
  tipo: TipoCarga;
  /** O que falta planejar, em t. */
  saldoT: number;
  freteClienteT: number | null;
};

export type MotoristaDoAcervo = {
  conjuntoId: string;
  motoristaId: string;
  nome: string;
  placa: string;
  eixos: number | null;
  capacidadeT: number | null;
  /** Dono do cavalo na ANTT é pessoa física (INSS de 4% no custo). */
  pf: boolean;
  /** Tem trava na aptidão (não pode ser contratado agora). */
  pendente: boolean;
};

export type FretePago = { id: string; dia: string; motorista: string; origem: string; destino: string; km: number; eixos: number; valor: number };

export type SituacaoNegociacao = Database["public"]["Enums"]["situacao_negociacao"];

export type LinhaNegociacao = {
  id: string;
  dia: string;
  motorista: string;
  placa: string | null;
  eixos: number;
  origem: string;
  destino: string;
  km: number;
  freteMotorista: number;
  valorPedido: number | null;
  margem: number | null;
  situacao: SituacaoNegociacao;
  motivo: string | null;
  cteNumero: string | null;
  viagem: { id: string; numero: number } | null;
  pedidoNumero: number | null;
};

const cidade = (l: { cidade: string; uf: string } | null) => (l ? `${l.cidade}/${l.uf}` : "");

export async function fretesDaFila(db: Banco): Promise<FreteDaFila[]> {
  const linhas = (await listarPedidos(db)).filter((p) => p.situacao === "aberto" && p.saldoKg > 0);
  if (!linhas.length) return [];
  const r = await db
    .from("pedido")
    .select(
      "id, tipo_carga_antt, frete_empresa_valor, frete_empresa_tipo, peso_total_kg, " +
        "coleta:pessoa_endereco!pedido_local_coleta_id_fkey(cidade, uf), descarga:pessoa_endereco!pedido_local_descarga_id_fkey(cidade, uf)",
    )
    .in(
      "id",
      linhas.map((l) => l.id),
    );
  erroDe(r);
  type L = {
    id: string;
    tipo_carga_antt: TipoCarga;
    frete_empresa_valor: number;
    frete_empresa_tipo: "total" | "por_tonelada";
    peso_total_kg: number;
    coleta: Embutido<{ cidade: string; uf: string }>;
    descarga: Embutido<{ cidade: string; uf: string }>;
  };
  const porId = new Map(((r.data ?? []) as unknown as L[]).map((x) => [x.id, x]));
  return linhas.flatMap((l) => {
    const x = porId.get(l.id);
    if (!x) return [];
    const total = Number(x.peso_total_kg);
    const valor = Number(x.frete_empresa_valor);
    return [
      {
        id: l.id,
        numero: l.numero,
        origem: cidade(um(x.coleta)),
        destino: cidade(um(x.descarga)),
        cliente: l.tomador,
        tipo: x.tipo_carga_antt,
        saldoT: l.saldoKg / 1000,
        freteClienteT: x.frete_empresa_tipo === "por_tonelada" ? valor : total > 0 ? valor / (total / 1000) : null,
      },
    ];
  });
}

export async function motoristasDoAcervo(db: Banco): Promise<MotoristaDoAcervo[]> {
  const conjuntos = await listarConjuntosAbertos(db);
  if (!conjuntos.length) return [];
  const ids = conjuntos.map((c) => c.id);
  const [donos, apt] = await Promise.all([
    db.from("conjunto").select("id, motorista_id, cavalo:veiculo!conjunto_cavalo_id_fkey(dono:proprietario!veiculo_proprietario_documento_id_fkey(pessoa(tipo)))").in("id", ids),
    db.rpc("aptidao_conjuntos", { p_conjuntos: ids }),
  ]);
  erroDe(donos);
  erroDe(apt);
  type D = { id: string; motorista_id: string | null; cavalo: Embutido<{ dono: Embutido<{ pessoa: Embutido<{ tipo: string }> }> }> };
  const linhas = new Map(((donos.data ?? []) as unknown as D[]).map((d) => [d.id, d]));
  const pf = (id: string) => um(um(um(linhas.get(id)?.cavalo)?.dono)?.pessoa)?.tipo === "pf";
  const travados = new Set((apt.data ?? []).filter((a) => a.nivel !== "aviso").map((a) => a.conjunto_id));
  return conjuntos
    .map((c) => ({
      conjuntoId: c.id,
      motoristaId: linhas.get(c.id)?.motorista_id ?? "",
      nome: c.motorista,
      placa: c.cavalo,
      eixos: c.eixos,
      capacidadeT: c.capacidadeT,
      pf: pf(c.id),
      pendente: travados.has(c.id),
    }))
    .filter((m) => m.motoristaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O que já foi pago ao motorista (negociações aceitas e viagens), as mais recentes primeiro. */
export async function fretesPagos(db: Banco): Promise<FretePago[]> {
  const r = await db.from("v_frete_pago_rota").select("id, dia, motorista_id, origem, destino, km, eixos, valor").order("dia", { ascending: false }).limit(500);
  erroDe(r);
  const linhas = (r.data ?? []).filter((x) => x.id && x.dia && x.origem && x.destino && x.km && x.eixos && x.valor);
  const nomes = await nomesDeMotorista(db, [...new Set(linhas.map((x) => x.motorista_id!).filter(Boolean))]);
  return linhas.map((x) => ({
    id: x.id!,
    dia: x.dia!,
    motorista: nomes.get(x.motorista_id!) ?? "—",
    origem: x.origem!,
    destino: x.destino!,
    km: Number(x.km),
    eixos: Number(x.eixos),
    valor: Number(x.valor),
  }));
}

export async function listarNegociacoes(db: Banco, verMargem: boolean): Promise<LinhaNegociacao[]> {
  const r = await db
    .from("negociacao_frete")
    .select(
      "id, created_at, motorista_id, eixos, origem, destino, km, frete_motorista, valor_pedido, situacao, motivo, cte_numero, " +
        "conjunto:conjunto(cavalo:veiculo!conjunto_cavalo_id_fkey(placa)), viagem:viagem(id, numero), pedido:pedido(numero)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  erroDe(r);
  type L = {
    id: string;
    created_at: string;
    motorista_id: string;
    eixos: number;
    origem: string;
    destino: string;
    km: number;
    frete_motorista: number;
    valor_pedido: number | null;
    situacao: SituacaoNegociacao;
    motivo: string | null;
    cte_numero: string | null;
    conjunto: Embutido<{ cavalo: Embutido<{ placa: string }> }>;
    viagem: Embutido<{ id: string; numero: number }>;
    pedido: Embutido<{ numero: number }>;
  };
  const linhas = (r.data ?? []) as unknown as L[];
  const [nomes, res] = await Promise.all([
    nomesDeMotorista(db, [...new Set(linhas.map((l) => l.motorista_id))]),
    verMargem && linhas.length
      ? db
          .from("negociacao_resultado")
          .select("negociacao_id, margem_liquida")
          .in(
            "negociacao_id",
            linhas.map((l) => l.id),
          )
      : Promise.resolve({ data: [] as { negociacao_id: string; margem_liquida: number }[], error: null }),
  ]);
  erroDe(res);
  const margem = new Map((res.data ?? []).map((x) => [x.negociacao_id, Number(x.margem_liquida)]));
  return linhas.map((l) => ({
    id: l.id,
    dia: l.created_at,
    motorista: nomes.get(l.motorista_id) ?? "—",
    placa: um(um(l.conjunto)?.cavalo)?.placa ?? null,
    eixos: l.eixos,
    origem: l.origem,
    destino: l.destino,
    km: l.km,
    freteMotorista: Number(l.frete_motorista),
    valorPedido: l.valor_pedido === null ? null : Number(l.valor_pedido),
    margem: margem.get(l.id) ?? null,
    situacao: l.situacao,
    motivo: l.motivo,
    cteNumero: l.cte_numero,
    viagem: um(l.viagem),
    pedidoNumero: um(l.pedido)?.numero ?? null,
  }));
}
