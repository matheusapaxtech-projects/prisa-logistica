/* Despacho do pedido (servidor): monta os dados do motor de despacho com o que o NILT tem e roda o ranking e a
   composição do lote (lib/motor/despacho.ts) para o saldo do pedido.
   - Motorista: o de cada conjunto aberto; eixos e capacidade das peças; RNTRC e PF/PJ do dono na ANTT do
     cavalo (proprietario_documento); bloqueado se o cadastro não está normal ou se já está em viagem.
   - Disponibilidade: a mais recente de `v_motorista_livre` (registro da operação).
   - Embarque e destino: as cidades dos locais do pedido na lista de municípios; km da rota salva ou estimado. */
import type { Banco } from "@/lib/banco";
import { MUNICIPIOS_RAW } from "@/lib/calculadora/municipios-dados";
import { acharMunicipio, estimarRota, indexarSalvas, lerMunicipios, type Municipios, type RotaSalva } from "@/lib/calculadora/rota";
import type { Coeficiente, ParamFiscais, TipoCarga } from "@/lib/calculadora/regras";
import { comporLote, rankearMotoristas, type CargaDespacho, type Composicao, type Disponibilidade, type MotoristaDespacho } from "@/lib/motor/despacho";
import type { OpcaoConjunto } from "./consultas";

let municipios: Municipios | null = null;
const lista = () => (municipios ??= lerMunicipios(MUNICIPIOS_RAW));

type Embutido<T> = T | T[] | null;
const um = <T,>(v: Embutido<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const erroDe = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};

export type DadosDespacho = {
  /** Sem cidade conhecida ou sem saldo: o motivo (a tela mostra no lugar do ranking). */
  indisponivel: string | null;
  kmViagem: number;
  origemKm: "salva" | "medida" | "estimada" | null;
  candidatos: ReturnType<typeof rankearMotoristas>["candidatos"];
  descartados: ReturnType<typeof rankearMotoristas>["descartados"];
  composicao: Composicao | null;
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
  conjuntos: OpcaoConjunto[];
  tabela: Coeficiente[];
  fiscal: ParamFiscais;
  rotas: RotaSalva[];
};

/** Coleta prevista às 8 h de Brasília; sem data, ou com a data já passada, daqui a 12 h. */
function horaDoEmbarque(coletaPrevista: string | null): string {
  const daqui12h = Date.now() + 12 * 36e5;
  const prevista = coletaPrevista ? Date.parse(`${coletaPrevista}T11:00:00Z`) : NaN;
  return new Date(Number.isFinite(prevista) && prevista > Date.now() ? prevista : daqui12h).toISOString();
}

const vazio = (motivo: string): DadosDespacho => ({ indisponivel: motivo, kmViagem: 0, origemKm: null, candidatos: [], descartados: [], composicao: null });

export async function despachoDoPedido(db: Banco, e: Entrada): Promise<DadosDespacho> {
  if (!(e.saldoKg > 0)) return vazio("Todo o peso deste pedido já está em viagens.");
  const m = lista();
  const a = e.coleta ? acharMunicipio(m, `${e.coleta.cidade}/${e.coleta.uf}`).municipio : null;
  const b = e.descarga ? acharMunicipio(m, `${e.descarga.cidade}/${e.descarga.uf}`).municipio : null;
  if (!a || !b) return vazio("A cidade de coleta ou de descarga não está na lista de municípios: confira o cadastro do local.");
  const est = estimarRota([a, b], indexarSalvas(e.rotas));
  if (!est) return vazio("Não foi possível calcular o km da rota.");

  const conjuntoIds = e.conjuntos.map((c) => c.id);
  const [cj, livres, ativas] = await Promise.all([
    conjuntoIds.length
      ? db
          .from("conjunto")
          .select(
            "id, motorista_id, motorista:motorista!conjunto_motorista_id_fkey(cnh_validade, situacao_cadastro), " +
              "cavalo:veiculo!conjunto_cavalo_id_fkey(dono:proprietario!veiculo_proprietario_documento_id_fkey(rntrc, pessoa(tipo)))",
          )
          .in("id", conjuntoIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("v_motorista_livre").select("motorista_id, cidade, latitude, longitude, livre_desde, livre_ate, created_at, viagens_finalizadas, ocorrencias"),
    db.from("viagem").select("motorista_id").is("cancelada_em", null).not("status_campo", "is", null).not("status_campo", "in", "(aguardando_saldo,frete_finalizado)"),
  ]);
  erroDe(cj);
  erroDe(livres);
  erroDe(ativas);

  type LinhaConjunto = {
    id: string;
    motorista_id: string | null;
    motorista: Embutido<{ cnh_validade: string | null; situacao_cadastro: string }>;
    cavalo: Embutido<{ dono: Embutido<{ rntrc: string | null; pessoa: Embutido<{ tipo: string }> }> }>;
  };
  const porConjunto = new Map(((cj.data ?? []) as unknown as LinhaConjunto[]).map((c) => [c.id, c]));
  const emViagem = new Set((ativas.data ?? []).map((v) => v.motorista_id));
  const hist = new Map((livres.data ?? []).map((l) => [l.motorista_id, l]));

  const motoristas: MotoristaDespacho[] = e.conjuntos.flatMap((c) => {
    const x = porConjunto.get(c.id);
    if (!x?.motorista_id) return [];
    const mot = um(x.motorista);
    const dono = um(um(x.cavalo)?.dono);
    const h = hist.get(x.motorista_id);
    const bloqueio =
      mot && mot.situacao_cadastro !== "normal"
        ? "Cadastro do motorista não está normal"
        : emViagem.has(x.motorista_id)
          ? "Já está em viagem"
          : undefined;
    return [
      {
        id: x.motorista_id,
        nome: c.motorista,
        conjuntoId: c.id,
        placaCavalo: c.cavalo,
        tipo: um(dono?.pessoa)?.tipo === "pf" ? "PF" : "PJ",
        eixos: c.eixos ?? 0,
        capacidadeT: c.capacidadeT ?? 0,
        rntrc: dono?.rntrc ?? null,
        cnhValidade: mot?.cnh_validade ?? null,
        viagensPrisa: h?.viagens_finalizadas ?? 0,
        ocorrencias: h?.ocorrencias ?? 0,
        ...(bloqueio ? { bloqueio } : {}),
      },
    ];
  });

  const disponibilidades: Disponibilidade[] = (livres.data ?? []).flatMap((l) =>
    l.motorista_id && l.latitude !== null && l.longitude !== null && l.created_at
      ? [
          {
            motoristaId: l.motorista_id,
            posicao: { lat: Number(l.latitude), lon: Number(l.longitude), uf: (l.cidade ?? "").slice(-2), cidade: l.cidade ?? undefined },
            em: l.created_at,
            livreDesde: l.livre_desde ?? undefined,
            livreAte: l.livre_ate ?? undefined,
          },
        ]
      : [],
  );

  const pesoT = e.saldoKg / 1000;
  const carga: CargaDespacho = {
    origem: { lat: a.lat, lon: a.lon, uf: a.uf, cidade: a.nome },
    destino: { lat: b.lat, lon: b.lon, uf: b.uf, cidade: b.nome },
    pesoT,
    tipo: e.tipo,
    embarqueEm: horaDoEmbarque(e.coletaPrevista),
    fretePorT: e.freteTipo === "por_tonelada" ? e.freteValor : e.pesoTotalKg > 0 ? e.freteValor / (e.pesoTotalKg / 1000) : undefined,
    kmViagem: est.km,
    pedagioEixoKm: est.pedagioEixoKm,
  };
  const r = rankearMotoristas(carga, motoristas, disponibilidades, e.tabela);
  const composicao = r.candidatos.length && pesoT > Math.min(...r.candidatos.map((c) => c.motorista.capacidadeT)) ? comporLote(carga, r.candidatos, { param: e.fiscal }) : null;
  return { indisponivel: null, kmViagem: est.km, origemKm: est.origemKm, candidatos: r.candidatos, descartados: r.descartados, composicao };
}
