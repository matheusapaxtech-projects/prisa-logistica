/* Consultas da tela Início (servidor). As 5 placas usam `resumoPendencias` (a mesma conta do selo
   do menu, feita uma vez por requisição em `resumoDaRequisicao`) e só acrescentam o que ela não
   separa: quantas pendências são de cada tipo. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipado } from "@/lib/banco";
import { resumoDaRequisicao } from "@/lib/resumo-da-requisicao";
import type { PecaEngate } from "@/components/Engate";
import type { DadosCapacidade } from "@/components/Capacidade";

/** Janela da lista "Vencimentos" e quantas linhas ela mostra (protótipo: `dias <= 90`, `slice(0, 5)`). */
export const JANELA_VENCIMENTOS = 90;
export const MAX_VENCIMENTOS = 5;

export type Placas = {
  vencidos: number;
  arrendadoSemContrato: number;
  acimaCmt: number;
  semCnh: number;
  semComprovante: number;
};

export type Vencimento = {
  tipo: string;
  data: string;
  dias: number;
  /** Quem vence: pessoa (link para a ficha do motorista ou do proprietário) ou veículo. */
  dono:
    | { tipo: "pessoa"; nome: string; href: string }
    | { tipo: "veiculo"; placa: string; modelo: string | null; href: string };
};

export type Cadastros = {
  motoristas: { total: number; normal: number; pendente: number; cancelado: number };
  proprietarios: { total: number; pf: number; pj: number };
  veiculos: { total: number; cavalo: number; carreta: number; dolly: number; caminhao: number; arrendados: number };
  conjuntos: { total: number; comMaisDeUmaCarreta: number; acimaCmt: number };
  documentos: { total: number; conferidos: number; restritos: number };
};

export type ConjuntoAberto = {
  id: string;
  inicio: string;
  motorista: string;
  cavalo: PecaEngate;
  itens: PecaEngate[];
  eixos: number;
  capacidade: DadosCapacidade;
};

export type DadosInicio = {
  placas: Placas;
  vencimentos: Vencimento[];
  cadastros: Cadastros;
  conjuntos: ConjuntoAberto[];
};

type Cliente = ReturnType<typeof tipado>;

/** Conta linhas (HEAD, sem baixar nada). Erro de banco sobe para o error boundary. */
async function contar(consulta: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type LinhaVeiculo = {
  placa: string;
  pbt_t: number | null;
  tara_t: number | null;
  capacidade_carga_t: number | null;
  tipo_veiculo: {
    categoria: PecaEngate["categoria"];
    configuracao_cavalo: PecaEngate["configuracao_cavalo"];
    eixos: number;
  } | null;
};

/** Peça do desenho do engate. Carreta leva a capacidade efetiva: a informada, ou PBT − tara. */
function peca(v: LinhaVeiculo): PecaEngate {
  const categoria = v.tipo_veiculo?.categoria ?? "outros";
  const efetiva =
    v.capacidade_carga_t ?? (v.pbt_t != null && v.tara_t != null ? r2(v.pbt_t - v.tara_t) : null);
  return {
    placa: v.placa,
    categoria,
    configuracao_cavalo: v.tipo_veiculo?.configuracao_cavalo ?? null,
    eixos: v.tipo_veiculo?.eixos ?? 0,
    capacidade_carga_t: categoria === "carreta" ? efetiva : null,
  };
}

async function carregarVencimentos(db: Cliente): Promise<Vencimento[]> {
  const { data, error } = await db
    .from("v_vencimentos")
    .select("tipo, data, dias, pessoa_id, veiculo_id")
    .lte("dias", JANELA_VENCIMENTOS)
    .order("dias", { ascending: true })
    .order("tipo", { ascending: true })
    // Desempate determinístico (mesmo dia e mesmo tipo): data, arquivo, pessoa, veículo.
    .order("data", { ascending: true })
    .order("arquivo_id", { ascending: true })
    .order("pessoa_id", { ascending: true })
    .order("veiculo_id", { ascending: true })
    .limit(MAX_VENCIMENTOS);
  if (error) throw error;
  const linhas = data ?? [];

  const pessoaIds = [...new Set(linhas.map((l) => l.pessoa_id).filter((x): x is string => !!x))];
  const veiculoIds = [...new Set(linhas.map((l) => l.veiculo_id).filter((x): x is string => !!x))];
  const [pessoas, motoristas, veiculos] = await Promise.all([
    pessoaIds.length ? db.from("pessoa").select("id, nome").in("id", pessoaIds) : { data: [], error: null },
    pessoaIds.length ? db.from("motorista").select("pessoa_id").in("pessoa_id", pessoaIds) : { data: [], error: null },
    veiculoIds.length ? db.from("veiculo").select("id, placa, modelo").in("id", veiculoIds) : { data: [], error: null },
  ]);
  for (const r of [pessoas, motoristas, veiculos]) if (r.error) throw r.error;

  const nomes = new Map((pessoas.data ?? []).map((p) => [p.id, p.nome]));
  const ehMotorista = new Set((motoristas.data ?? []).map((m) => m.pessoa_id));
  const placas = new Map((veiculos.data ?? []).map((v) => [v.id, v]));

  return linhas.flatMap((l): Vencimento[] => {
    if (l.dias == null || !l.data || !l.tipo) return [];
    const base = { tipo: l.tipo, data: l.data, dias: l.dias };
    if (l.pessoa_id) {
      const rota = ehMotorista.has(l.pessoa_id) ? "motoristas" : "proprietarios";
      return [{ ...base, dono: { tipo: "pessoa", nome: nomes.get(l.pessoa_id) ?? "—", href: `/${rota}/${l.pessoa_id}` } }];
    }
    const v = l.veiculo_id ? placas.get(l.veiculo_id) : undefined;
    if (!l.veiculo_id || !v) return [];
    return [{ ...base, dono: { tipo: "veiculo", placa: v.placa, modelo: v.modelo, href: `/veiculos/${l.veiculo_id}` } }];
  });
}

async function carregarConjuntos(db: Cliente): Promise<ConjuntoAberto[]> {
  const { data, error } = await db
    .from("conjunto")
    .select(
      `id, inicio, motorista_id,
       cavalo:veiculo!conjunto_cavalo_id_fkey(placa, pbt_t, tara_t, capacidade_carga_t, tipo_veiculo(categoria, configuracao_cavalo, eixos)),
       conjunto_item(posicao, veiculo(placa, pbt_t, tara_t, capacidade_carga_t, tipo_veiculo(categoria, configuracao_cavalo, eixos)))`,
    )
    .is("fim", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  const conjuntos = data ?? [];
  if (!conjuntos.length) return [];

  const ids = conjuntos.map((c) => c.id);
  const motoristaIds = [...new Set(conjuntos.map((c) => c.motorista_id).filter((x): x is string => !!x))];
  const [cap, pessoas] = await Promise.all([
    db
      .from("v_conjunto_capacidade")
      .select("conjunto_id, cmt_t, tara_total_t, capacidade_total_t, excede_cmt")
      .in("conjunto_id", ids),
    motoristaIds.length ? db.from("pessoa").select("id, nome").in("id", motoristaIds) : { data: [], error: null },
  ]);
  if (cap.error) throw cap.error;
  if (pessoas.error) throw pessoas.error;
  const capPorId = new Map((cap.data ?? []).map((c) => [c.conjunto_id, c]));
  const nomes = new Map((pessoas.data ?? []).map((p) => [p.id, p.nome]));

  return conjuntos.flatMap((c): ConjuntoAberto[] => {
    if (!c.cavalo) return [];
    const cavalo = peca(c.cavalo as LinhaVeiculo);
    const itens = [...c.conjunto_item]
      .sort((a, b) => a.posicao - b.posicao)
      .flatMap((i) => (i.veiculo ? [peca(i.veiculo as LinhaVeiculo)] : []));
    const v = capPorId.get(c.id);
    const cmt = v?.cmt_t ?? null;
    const tara = v?.tara_total_t ?? 0;
    return [
      {
        id: c.id,
        inicio: c.inicio,
        motorista: (c.motorista_id && nomes.get(c.motorista_id)) || "—",
        cavalo,
        itens,
        eixos: cavalo.eixos + itens.reduce((s, x) => s + x.eixos, 0),
        capacidade: {
          limite_t: cmt == null ? null : r2(cmt - tara),
          capacidade_total_t: v?.capacidade_total_t ?? 0,
          excede_cmt: v?.excede_cmt ?? false,
        },
      },
    ];
  });
}

/** Contagens dos cadastros (só HEAD/count, em paralelo com o resto da tela). */
async function contarCadastros(db: Cliente) {
  const motorista = (situacao?: "normal" | "pendente" | "cancelado") => {
    const q = db.from("motorista").select("*", { count: "exact", head: true });
    return contar(situacao ? q.eq("situacao_cadastro", situacao) : q);
  };
  const veiculo = (categoria?: PecaEngate["categoria"]) => {
    if (!categoria) return contar(db.from("veiculo").select("*", { count: "exact", head: true }));
    return contar(
      db
        .from("veiculo")
        .select("*, tipo_veiculo!inner(categoria)", { count: "exact", head: true })
        .eq("tipo_veiculo.categoria", categoria),
    );
  };
  const arquivo = (filtro?: "conferidos" | "restritos") => {
    const q = db.from("arquivo").select("*", { count: "exact", head: true });
    return contar(filtro === "conferidos" ? q.not("validado_em", "is", null) : filtro === "restritos" ? q.eq("restrito", true) : q);
  };

  const [
    mTotal, mNormal, mPendente, mCancelado,
    pTotal, pPj,
    vTotal, vCavalo, vCarreta, vDolly, vCaminhao, vArrendados,
    aTotal, aConferidos, aRestritos,
  ] = await Promise.all([
    motorista(), motorista("normal"), motorista("pendente"), motorista("cancelado"),
    contar(db.from("proprietario").select("*", { count: "exact", head: true })),
    contar(
      db
        .from("proprietario")
        .select("*, pessoa!inner(tipo)", { count: "exact", head: true })
        .eq("pessoa.tipo", "pj"),
    ),
    veiculo(), veiculo("cavalo"), veiculo("carreta"), veiculo("dolly"), veiculo("caminhao"),
    contar(db.from("veiculo").select("*", { count: "exact", head: true }).eq("arrendado", true)),
    arquivo(), arquivo("conferidos"), arquivo("restritos"),
  ]);

  return {
    motoristas: { total: mTotal, normal: mNormal, pendente: mPendente, cancelado: mCancelado },
    proprietarios: { total: pTotal, pf: pTotal - pPj, pj: pPj },
    veiculos: { total: vTotal, cavalo: vCavalo, carreta: vCarreta, dolly: vDolly, caminhao: vCaminhao, arrendados: vArrendados },
    documentos: { total: aTotal, conferidos: aConferidos, restritos: aRestritos },
  };
}

/** Cadastros = contagens + a linha de conjuntos, que vem dos conjuntos abertos já carregados. */
function montarCadastros(contagens: Awaited<ReturnType<typeof contarCadastros>>, conjuntos: ConjuntoAberto[], acimaCmt: number): Cadastros {
  return {
    ...contagens,
    conjuntos: {
      total: conjuntos.length,
      comMaisDeUmaCarreta: conjuntos.filter((c) => c.itens.filter((i) => i.categoria === "carreta").length > 1).length,
      acimaCmt,
    },
  };
}

/**
 * Tudo da tela Início, com o RLS de quem consulta. `placas.vencidos`, `acimaCmt` e a soma das
 * três pendências de documento vêm de `resumoPendencias`: a soma das 5 placas é o número do selo
 * "Pendências" do menu.
 */
export async function carregarInicio(cliente: SupabaseClient): Promise<DadosInicio> {
  const db = tipado(cliente);
  const tipo = (t: string) =>
    contar(db.from("v_pendencias_documentos").select("*", { count: "exact", head: true }).eq("tipo_pendencia", t));

  // Tudo em paralelo: as contagens dos cadastros não esperam os conjuntos (só a montagem final usa os dois).
  const [resumo, arrendadoSemContrato, semCnh, semComprovante, vencimentos, conjuntos, contagens] = await Promise.all([
    resumoDaRequisicao(),
    tipo("veiculo_arrendado_sem_contrato"),
    tipo("motorista_sem_cnh"),
    tipo("motorista_sem_comprovante"),
    carregarVencimentos(db),
    carregarConjuntos(db),
    contarCadastros(db),
  ]);
  const cadastros = montarCadastros(contagens, conjuntos, resumo.acimaCmt);

  return {
    placas: { vencidos: resumo.vencidos, arrendadoSemContrato, acimaCmt: resumo.acimaCmt, semCnh, semComprovante },
    vencimentos,
    cadastros,
    conjuntos,
  };
}
