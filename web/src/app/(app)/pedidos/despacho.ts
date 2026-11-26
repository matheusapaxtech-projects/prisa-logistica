/* Despacho do pedido (servidor): monta os dados do motor de despacho com o que o NILT tem. O ranking e a
   composição do lote (lib/motor/despacho.ts) rodam na tela, para a pessoa simular peso, preço, tipo de carga
   e frete acima do piso (como no despacho do sistema do sócio).
   - Motorista: o de cada conjunto aberto; eixos e capacidade das peças; RNTRC e PF/PJ do dono na ANTT do
     cavalo (proprietario_documento). Fica de fora quem já tem viagem (planejada ou em andamento) ou tem o
     cadastro cancelado.
   - Pendências: `aptidao_conjuntos` (as mesmas regras que travam o início da viagem). Com trava, o motorista
     aparece no ranking como pendente e não entra no lote.
   - Disponibilidade: a mais recente de `v_motorista_livre` (registro da operação ou "Estou livre" do app); a
     posição é a do GPS do app quando ela tem até 2 h (posicao_gps).
   - Embarque e destino: as cidades dos locais do pedido na lista de municípios; km da rota salva ou estimado. */
import type { Banco } from "@/lib/banco";
import { MUNICIPIOS_RAW } from "@/lib/calculadora/municipios-dados";
import { acharMunicipio, estimarRota, indexarSalvas, lerMunicipios, type Municipios, type RotaSalva } from "@/lib/calculadora/rota";
import type { TipoCarga } from "@/lib/calculadora/regras";
import type { CargaDespacho, Disponibilidade, MotoristaDespacho } from "@/lib/motor/despacho";
import { parametros, rotasSalvas, tabelaAntt } from "../calculadora/consultas";
import { listarConjuntosAbertos, rotaSalvaDoPedido, type FichaPedido, type OpcaoConjunto } from "./consultas";

let municipios: Municipios | null = null;
const lista = () => (municipios ??= lerMunicipios(MUNICIPIOS_RAW));

type Embutido<T> = T | T[] | null;
const um = <T,>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const erroDe = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};

export type Pendencia = { nivel: "trava" | "trava_legal" | "aviso"; mensagem: string };

export type MotoristaNoDespacho = MotoristaDespacho & {
  /** Número com WhatsApp (ou o principal), só dígitos com DDI 55. */
  whatsapp: string | null;
  /** Dono do cavalo na ANTT quando não é o próprio motorista ("por Transportes … Ltda"). */
  transportador: string | null;
  pendencias: Pendencia[];
};

export type DadosDespacho = {
  /** Sem cidade conhecida ou sem saldo: o motivo (a tela mostra no lugar do ranking). */
  indisponivel: string | null;
  kmViagem: number;
  origemKm: "salva" | "medida" | "estimada" | null;
  /** A carga do saldo do pedido, ponto de partida da simulação. */
  carga: CargaDespacho | null;
  motoristas: MotoristaNoDespacho[];
  disponibilidades: Disponibilidade[];
  /** Hora do servidor: a tela conta "há quanto tempo avisou" a partir dela (mesmo resultado no servidor e no navegador). */
  agora: string;
};

type Entrada = {
  coleta: { cidade: string; uf: string } | null;
  descarga: { cidade: string; uf: string } | null;
  saldoKg: number;
  tipo: TipoCarga;
  coletaPrevista: string | null;
  freteValor: number;
  freteTipo: "total" | "por_tonelada";
  pesoTotalKg: number;
  tomadorId: string | null;
  conjuntos: OpcaoConjunto[];
  rotas: RotaSalva[];
};

/** Coleta prevista às 8 h de Brasília; sem data, ou com a data já passada, daqui a 12 h. */
function horaDoEmbarque(coletaPrevista: string | null, agora: number): string {
  const daqui12h = agora + 12 * 36e5;
  const prevista = coletaPrevista ? Date.parse(`${coletaPrevista}T11:00:00Z`) : NaN;
  return new Date(Number.isFinite(prevista) && prevista > agora ? prevista : daqui12h).toISOString();
}

const vazio = (motivo: string): DadosDespacho => ({
  indisponivel: motivo,
  kmViagem: 0,
  origemKm: null,
  carga: null,
  motoristas: [],
  disponibilidades: [],
  agora: new Date().toISOString(),
});

/** Só dígitos, com 55 na frente quando falta (link wa.me). */
function numeroWhatsapp(n: string): string | null {
  const d = n.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

/** As cidades do pedido viram pontos do mapa e a rota (km e pedágio por eixo/km). */
export function rotaDoPedido(e: Pick<Entrada, "coleta" | "descarga" | "rotas">) {
  const m = lista();
  const a = e.coleta ? acharMunicipio(m, `${e.coleta.cidade}/${e.coleta.uf}`).municipio : null;
  const b = e.descarga ? acharMunicipio(m, `${e.descarga.cidade}/${e.descarga.uf}`).municipio : null;
  if (!a || !b) return null;
  const est = estimarRota([a, b], indexarSalvas(e.rotas));
  return est ? { a, b, est } : null;
}

export async function despachoDoPedido(db: Banco, e: Entrada): Promise<DadosDespacho> {
  if (!(e.saldoKg > 0)) return vazio("Todo o peso deste pedido já está em viagens.");
  const r = rotaDoPedido(e);
  if (!r) return vazio("A cidade de coleta ou de descarga não está na lista de municípios: confira o cadastro do local.");
  const { a, b, est } = r;

  const conjuntoIds = e.conjuntos.map((c) => c.id);
  const [cj, livres, ativas, apt] = await Promise.all([
    conjuntoIds.length
      ? db
          .from("conjunto")
          .select(
            "id, motorista_id, motorista:motorista!conjunto_motorista_id_fkey(cnh_validade, situacao_cadastro, pessoa(pessoa_telefone(numero, whatsapp, principal))), " +
              "cavalo:veiculo!conjunto_cavalo_id_fkey(dono:proprietario!veiculo_proprietario_documento_id_fkey(pessoa_id, rntrc, pessoa(tipo, nome, apelido)))",
          )
          .in("id", conjuntoIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("v_motorista_livre").select("motorista_id, cidade, latitude, longitude, livre_desde, livre_ate, created_at, viagens_finalizadas, ocorrencias, posicao_gps"),
    // Viagens que ocupam o motorista: as planejadas (já contratado) e as em andamento.
    db
      .from("viagem")
      .select("numero, motorista_id, status_campo")
      .is("cancelada_em", null)
      .or("status_campo.is.null,status_campo.not.in.(aguardando_saldo,frete_finalizado)"),
    conjuntoIds.length
      ? db.rpc("aptidao_conjuntos", { p_conjuntos: conjuntoIds, ...(e.tomadorId ? { p_tomador: e.tomadorId } : {}) })
      : Promise.resolve({ data: [], error: null }),
  ]);
  erroDe(cj);
  erroDe(livres);
  erroDe(ativas);
  erroDe(apt);

  type LinhaConjunto = {
    id: string;
    motorista_id: string | null;
    motorista: Embutido<{
      cnh_validade: string | null;
      situacao_cadastro: string;
      pessoa: Embutido<{ pessoa_telefone: { numero: string; whatsapp: boolean; principal: boolean }[] }>;
    }>;
    cavalo: Embutido<{
      dono: Embutido<{ pessoa_id: string; rntrc: string | null; pessoa: Embutido<{ tipo: string; nome: string; apelido: string | null }> }>;
    }>;
  };
  const porConjunto = new Map(((cj.data ?? []) as unknown as LinhaConjunto[]).map((c) => [c.id, c]));
  const ocupado = new Map((ativas.data ?? []).map((v) => [v.motorista_id, v.status_campo === null ? `Já contratado na viagem #${v.numero} (planejada)` : "Já está em viagem"]));
  const hist = new Map((livres.data ?? []).map((l) => [l.motorista_id, l]));
  // "Em viagem" vira descarte (bloqueio), não pendência: o motorista simplesmente não está livre.
  const EM_VIAGEM = new Set(["motorista_em_viagem", "cavalo_em_viagem"]);
  const pend = new Map<string, Pendencia[]>();
  for (const x of apt.data ?? []) {
    if (EM_VIAGEM.has(x.codigo)) continue;
    const l = pend.get(x.conjunto_id) ?? [];
    l.push({ nivel: x.nivel as Pendencia["nivel"], mensagem: x.mensagem });
    pend.set(x.conjunto_id, l);
  }
  /** O número com WhatsApp; senão o principal; senão o primeiro que dá para discar. */
  const whatsappDe = (fones: { numero: string; whatsapp: boolean; principal: boolean }[] | undefined) =>
    [...(fones ?? [])]
      .sort((x, y) => Number(y.whatsapp) - Number(x.whatsapp) || Number(y.principal) - Number(x.principal))
      .map((f) => numeroWhatsapp(f.numero))
      .find((n) => n !== null) ?? null;

  const motoristas: MotoristaNoDespacho[] = e.conjuntos.flatMap((c) => {
    const x = porConjunto.get(c.id);
    if (!x?.motorista_id) return [];
    const mot = um(x.motorista);
    const dono = um(um(x.cavalo)?.dono);
    const pessoaDono = um(dono?.pessoa);
    const h = hist.get(x.motorista_id);
    const bloqueio =
      mot?.situacao_cadastro === "cancelado" ? "Cadastro do motorista cancelado" : ocupado.get(x.motorista_id);
    return [
      {
        id: x.motorista_id,
        nome: c.motorista,
        conjuntoId: c.id,
        placaCavalo: c.cavalo,
        tipo: pessoaDono?.tipo === "pf" ? "PF" : "PJ",
        eixos: c.eixos ?? 0,
        capacidadeT: c.capacidadeT ?? 0,
        rntrc: dono?.rntrc ?? null,
        cnhValidade: mot?.cnh_validade ?? null,
        viagensPrisa: h?.viagens_finalizadas ?? 0,
        ocorrencias: h?.ocorrencias ?? 0,
        ...(bloqueio ? { bloqueio } : {}),
        whatsapp: whatsappDe(um(mot?.pessoa)?.pessoa_telefone),
        transportador: dono && dono.pessoa_id !== x.motorista_id && pessoaDono ? pessoaDono.apelido?.trim() || pessoaDono.nome : null,
        pendencias: pend.get(c.id) ?? [],
      },
    ];
  });

  const disponibilidades: Disponibilidade[] = (livres.data ?? []).flatMap((l) =>
    l.motorista_id && l.latitude !== null && l.longitude !== null && l.created_at
      ? [
          {
            motoristaId: l.motorista_id,
            posicao: { lat: Number(l.latitude), lon: Number(l.longitude), uf: (l.cidade ?? "").slice(-2), cidade: l.posicao_gps ? "GPS do app" : (l.cidade ?? undefined) },
            em: l.created_at,
            livreDesde: l.livre_desde ?? undefined,
            livreAte: l.livre_ate ?? undefined,
          },
        ]
      : [],
  );

  const agora = Date.now();
  const carga: CargaDespacho = {
    origem: { lat: a.lat, lon: a.lon, uf: a.uf, cidade: a.nome },
    destino: { lat: b.lat, lon: b.lon, uf: b.uf, cidade: b.nome },
    pesoT: e.saldoKg / 1000,
    tipo: e.tipo,
    embarqueEm: horaDoEmbarque(e.coletaPrevista, agora),
    fretePorT: e.freteTipo === "por_tonelada" ? e.freteValor : e.pesoTotalKg > 0 ? e.freteValor / (e.pesoTotalKg / 1000) : undefined,
    kmViagem: est.km,
    pedagioEixoKm: est.pedagioEixoKm,
  };
  return {
    indisponivel: null,
    kmViagem: est.km,
    origemKm: est.origemKm,
    carga,
    motoristas,
    disponibilidades,
    agora: new Date(agora).toISOString(),
  };
}

/** Tudo o que o painel do despacho precisa para um pedido aberto (ficha do pedido e fila do Despacho). */
export async function prepararDespacho(db: Banco, f: FichaPedido) {
  const [conjuntos, rotaSalva, tabela, param, rotas] = await Promise.all([
    listarConjuntosAbertos(db),
    f.coleta && f.descarga ? rotaSalvaDoPedido(db, `${f.coleta.cidade}/${f.coleta.uf}`, `${f.descarga.cidade}/${f.descarga.uf}`) : Promise.resolve(null),
    tabelaAntt(db),
    parametros(db),
    rotasSalvas(db),
  ]);
  const dados = await despachoDoPedido(db, {
    coleta: f.coleta,
    descarga: f.descarga,
    saldoKg: f.saldoKg,
    tipo: f.tipoCarga,
    coletaPrevista: f.coletaPrevista,
    freteValor: f.freteValor,
    freteTipo: f.freteTipo,
    pesoTotalKg: f.pesoTotalKg,
    tomadorId: f.tomador.id,
    conjuntos,
    rotas,
  });
  return { conjuntos, rotaSalva, tabela, fiscal: param.fiscal, dados };
}
