/* Consultas da lista de veículos (somente servidor, com a sessão do usuário: o RLS vale). */
import type { Banco } from "@/lib/banco";
import { validacao } from "@/lib/validacao";
import {
  capacidadeEfetiva,
  marcaCurta,
  nomeCurto,
  rotuloTipo,
  um,
  type CategoriaVeiculo,
  type SituacaoCadastro,
  type SituacaoOperacional,
} from "./rotulos";

export type ConjuntoDoVeiculo =
  /** O veículo é o cavalo: puxa `total` peças desde `inicio`. */
  | { papel: "cavalo"; total: number; inicio: string }
  /** O veículo é uma peça: posição `posicao` de `total`, atrás do cavalo `cavaloPlaca`. */
  | { papel: "peca"; posicao: number; total: number; cavaloPlaca: string };

export type LinhaVeiculo = {
  id: string;
  placa: string;
  renavam: string | null;
  chassi: string | null;
  categoria: CategoriaVeiculo;
  /** "Cavalo trucado", "Carreta graneleiro trucada"… */
  tipo: string;
  eixos: number;
  marca: string;
  modelo: string;
  anos: string;
  posse: string;
  documento: string;
  arrendado: boolean;
  cmt_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
  /** Capacidade efetiva (informada, ou PBT − tara). */
  capacidade_t: number | null;
  situacao_cadastro: SituacaoCadastro;
  situacao_operacional: SituacaoOperacional;
  conjunto: ConjuntoDoVeiculo | null;
};

type Embutido<T> = T | T[] | null;
type Pessoa = { nome: string; nome_fantasia: string | null; tipo: string };
type Dono = { pessoa: Embutido<Pessoa> };

const COLUNAS =
  "id, placa, renavam, chassi, modelo, ano_fabricacao, ano_modelo, arrendado, situacao_cadastro, situacao_operacional, cmt_t, pbt_t, tara_t, capacidade_carga_t, " +
  "tipo_veiculo(nome, categoria, eixos, configuracao_cavalo), marca_veiculo(nome), " +
  "posse:proprietario!veiculo_proprietario_posse_id_fkey(pessoa(nome, nome_fantasia, tipo)), " +
  "doc:proprietario!veiculo_proprietario_documento_id_fkey(pessoa(nome, nome_fantasia, tipo))";

const PAGINA = 1000; // limite de linhas por resposta do PostgREST
const MAX_PAGINAS = 10;

type Bruto = {
  id: string;
  placa: string;
  renavam: string | null;
  chassi: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  arrendado: boolean;
  situacao_cadastro: SituacaoCadastro;
  situacao_operacional: SituacaoOperacional;
  cmt_t: number | null;
  pbt_t: number | null;
  tara_t: number | null;
  capacidade_carga_t: number | null;
  tipo_veiculo: Embutido<{ nome: string; categoria: CategoriaVeiculo; eixos: number; configuracao_cavalo: "toco" | "trucado" | null }>;
  marca_veiculo: Embutido<{ nome: string }>;
  posse: Embutido<Dono>;
  doc: Embutido<Dono>;
};

/** Todos os veículos (em páginas de 1000), por placa, já com tipo, marca, donos e conjunto aberto. */
export async function listarVeiculos(db: Banco): Promise<LinhaVeiculo[]> {
  const brutos: Bruto[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const { data, error } = await db
      .from("veiculo")
      .select(COLUNAS)
      .order("placa")
      .range(p * PAGINA, (p + 1) * PAGINA - 1);
    if (error) throw error;
    brutos.push(...((data ?? []) as unknown as Bruto[]));
    if ((data?.length ?? 0) < PAGINA) break;
  }

  const abertos = await db
    .from("conjunto")
    .select("id, cavalo_id, inicio, cavalo:veiculo!conjunto_cavalo_id_fkey(placa), conjunto_item(veiculo_id, posicao)")
    .is("fim", null);
  if (abertos.error) throw abertos.error;

  const conjuntoDe = new Map<string, ConjuntoDoVeiculo>();
  for (const c of abertos.data ?? []) {
    const itens = (c.conjunto_item ?? []) as { veiculo_id: string; posicao: number }[];
    const cavalo = um(c.cavalo as Embutido<{ placa: string }>);
    conjuntoDe.set(c.cavalo_id, { papel: "cavalo", total: itens.length, inicio: c.inicio });
    for (const i of itens) {
      conjuntoDe.set(i.veiculo_id, { papel: "peca", posicao: i.posicao, total: itens.length, cavaloPlaca: cavalo?.placa ?? "" });
    }
  }

  return brutos.map((v) => {
    const tipo = um(v.tipo_veiculo);
    const nomePessoa = (d: Embutido<Dono>) => nomeCurto(um(um(d)?.pessoa));
    return {
      id: v.id,
      placa: v.placa,
      renavam: v.renavam,
      chassi: v.chassi,
      categoria: tipo?.categoria ?? "outros",
      tipo: tipo ? rotuloTipo(tipo) : "—",
      eixos: tipo?.eixos ?? 0,
      marca: marcaCurta(um(v.marca_veiculo)?.nome),
      modelo: v.modelo ?? "",
      anos: v.ano_fabricacao ? `${v.ano_fabricacao}/${v.ano_modelo ?? v.ano_fabricacao}` : "",
      posse: nomePessoa(v.posse),
      documento: nomePessoa(v.doc),
      arrendado: v.arrendado,
      cmt_t: v.cmt_t,
      pbt_t: v.pbt_t,
      tara_t: v.tara_t,
      capacidade_t: capacidadeEfetiva(v),
      situacao_cadastro: v.situacao_cadastro,
      situacao_operacional: v.situacao_operacional,
      conjunto: conjuntoDe.get(v.id) ?? null,
    };
  });
}

/** A busca da lista (`casaBusca` do protótipo): placa, Renavam, chassi, marca e modelo ou dono. */
export function casaBusca(v: LinhaVeiculo, termo: string): boolean {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  const placa = validacao.normalizarPlaca(t);
  const digitos = validacao.soDigitos(t);
  return (
    (placa.length >= 2 && v.placa.includes(placa)) ||
    (digitos.length >= 3 && (v.renavam ?? "").includes(digitos)) ||
    (placa.length >= 3 && (v.chassi ?? "").toUpperCase().includes(placa)) ||
    `${v.marca} ${v.modelo}`.toLowerCase().includes(t) ||
    v.posse.toLowerCase().includes(t) ||
    v.documento.toLowerCase().includes(t)
  );
}

export type Filtro = "todos" | "cavalos" | "carretas" | "dollies" | "outros" | "arrendados" | "pendentes";

export const ABAS: { id: Filtro; rotulo: string; casa: (v: LinhaVeiculo) => boolean }[] = [
  { id: "todos", rotulo: "Todos", casa: () => true },
  { id: "cavalos", rotulo: "Cavalos", casa: (v) => v.categoria === "cavalo" },
  { id: "carretas", rotulo: "Carretas", casa: (v) => v.categoria === "carreta" },
  { id: "dollies", rotulo: "Dollies", casa: (v) => v.categoria === "dolly" },
  { id: "outros", rotulo: "Outros", casa: (v) => v.categoria === "caminhao" || v.categoria === "outros" },
  { id: "arrendados", rotulo: "Arrendados", casa: (v) => v.arrendado },
  { id: "pendentes", rotulo: "Pendentes", casa: (v) => v.situacao_cadastro === "pendente" },
];

/** Quantos arrendados estão sem contrato anexado (a pendência `veiculo_arrendado_sem_contrato`). */
export async function contarArrendadosSemContrato(db: Banco): Promise<number> {
  const { count, error } = await db
    .from("v_pendencias_documentos")
    .select("*", { count: "exact", head: true })
    .eq("tipo_pendencia", "veiculo_arrendado_sem_contrato");
  if (error) throw error;
  return count ?? 0;
}
