/* Consultas da tela de Pendências (servidor, RLS de quem consulta).
   - Pendências: `v_pendencias_documentos` (arrendado sem contrato, motorista sem CNH, sem comprovante),
     os vencimentos já vencidos de `v_vencimentos` (cadastro + arquivos, sem repetir documento) e os
     conjuntos abertos acima do CMT (`v_conjunto_capacidade`). É a mesma conta de `resumoPendencias`
     (lib/consultas.ts), que dá os números do título, das abas e do selo do menu.
   - Vencimentos: `v_vencimentos` inteiro.
   - Documentos: `arquivo` (o restrito só aparece para o administrador, pelo RLS). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipado, type Banco } from "@/lib/banco";
import { resumoPendencias, type ResumoPendencias } from "@/lib/consultas";
import { diasAte, hojeISO } from "@/lib/datas";
import { formato } from "@/lib/formato";
import { tipoSemEixos } from "../conjuntos/regras";
import type { TipoPendencia } from "./filtros";

/** De quem é a linha: pessoa (avatar, documento e papel) ou veículo (placa desenhada). */
export type Objeto =
  | { tipo: "pessoa"; id: string; nome: string; doc: string; papel: string; href: string }
  | { tipo: "veiculo"; id: string; placa: string; titulo: string; sub: string; href: string };

export type LinhaPendencia = {
  chave: string;
  objeto: Objeto;
  /** Linha de cima (negrito) e de baixo do texto; `vencido` pinta a de cima de vermelho. */
  titulo: string;
  vencido?: boolean;
  /** Linha de baixo em pedaços (separados pelo ponto do meio); um pedaço pode juntar texto e `{ cod }` (fonte mono). */
  sub: (string | (string | { cod: string })[])[];
  acao: { rotulo: string; href: string; icone: "paperclip" | "link-2" };
};

export type Vencimento = {
  chave: string;
  tipo: string;
  data: string;
  dias: number;
  href: string;
  quem: { tipo: "pessoa"; nome: string } | { tipo: "veiculo"; placa: string; modelo: string };
};

export type Documento = {
  id: string;
  tipo: string;
  nome: string;
  tamanho: string;
  restrito: boolean;
  validade: string | null;
  dias: number | null;
  conferido: { por: string; quando: string } | null;
  dono: { tipo: "pessoa"; nome: string } | { tipo: "veiculo"; placa: string };
  href: string;
};

export type DadosPendencias = {
  resumo: ResumoPendencias;
  grupos: Record<TipoPendencia, LinhaPendencia[]>;
  vencimentos: Vencimento[];
  documentos: Documento[];
  aConferir: number;
  arrendados: number;
};

const ACAO_VENCIDO: Record<string, string> = {
  CNH: "Anexar CNH renovada",
  RNTRC: "Anexar RNTRC renovado",
  "Consulta de risco": "Registrar nova consulta",
  Seguro: "Anexar apólice renovada",
  IPVA: "Anexar CRLV do exercício",
};
/** Tipo de arquivo de cada vencimento do cadastro (o arquivo ANTT é o RNTRC). */
const TIPO_ARQUIVO_DE: Record<string, string> = { CNH: "CNH", RNTRC: "ANTT" };

const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
const ok = <T,>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

async function porIds<T>(ids: string[], consulta: (ids: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  if (!ids.length) return [];
  return ok(await consulta(ids)) ?? [];
}

export async function carregarPendencias(cliente: SupabaseClient): Promise<DadosPendencias> {
  const db: Banco = tipado(cliente);
  const [resumo, pend, venc, arquivos, tipos, capacidades] = await Promise.all([
    resumoPendencias(cliente),
    db.from("v_pendencias_documentos").select("tipo_pendencia, pessoa_id, veiculo_id, arquivo_id").neq("tipo_pendencia", "arquivo_vencido"),
    db.from("v_vencimentos").select("tipo, pessoa_id, veiculo_id, arquivo_id, data, dias").order("dias").order("tipo"),
    db
      .from("arquivo")
      .select("id, tipo_arquivo_id, pessoa_id, veiculo_id, nome_original, tamanho_bytes, validade, restrito, validado_em, validado_por"),
    db.from("tipo_arquivo").select("id, nome"),
    db.from("v_conjunto_capacidade").select("conjunto_id, cavalo_id, cmt_t, tara_total_t, capacidade_total_t").eq("excede_cmt", true),
  ]);
  const pendencias = ok(pend) ?? [];
  const vencimentos = (ok(venc) ?? []).filter((v) => v.tipo && v.data && v.dias != null);
  const arqs = ok(arquivos) ?? [];
  const nomeTipo = new Map((ok(tipos) ?? []).map((t) => [t.id, t.nome]));
  const acima = ok(capacidades) ?? [];

  // só os conjuntos ainda abertos (a view traz os encerrados também)
  const abertosAcima = await porIds(unicos(acima.map((c) => c.conjunto_id)), (ids) =>
    db.from("conjunto").select("id").is("fim", null).in("id", ids),
  );
  const idsAbertos = new Set(abertosAcima.map((c) => c.id));
  const acimaAbertos = acima.filter((c) => c.conjunto_id && idsAbertos.has(c.conjunto_id));

  const pessoaIds = unicos([...pendencias.map((p) => p.pessoa_id), ...vencimentos.map((v) => v.pessoa_id), ...arqs.map((a) => a.pessoa_id)]);
  const veiculoIds = unicos([
    ...pendencias.map((p) => p.veiculo_id),
    ...vencimentos.map((v) => v.veiculo_id),
    ...arqs.map((a) => a.veiculo_id),
    ...acimaAbertos.map((c) => c.cavalo_id),
  ]);

  const veiculos = await porIds(veiculoIds, (ids) =>
    db
      .from("veiculo")
      .select("id, placa, modelo, proprietario_posse_id, proprietario_documento_id, tipo_veiculo(nome), marca_veiculo(nome)")
      .in("id", ids),
  );
  const todasPessoas = unicos([...pessoaIds, ...veiculos.flatMap((v) => [v.proprietario_posse_id, v.proprietario_documento_id])]);
  const [pessoas, motoristas, proprietarios, enderecos, conferentes] = await Promise.all([
    porIds(todasPessoas, (ids) => db.from("pessoa").select("id, nome, nome_fantasia, tipo, cpf, cnpj").in("id", ids)),
    porIds(pessoaIds, (ids) => db.from("motorista").select("pessoa_id, cnh_registro, cnh_categoria, cnh_validade").in("pessoa_id", ids)),
    porIds(pessoaIds, (ids) => db.from("proprietario").select("pessoa_id").in("pessoa_id", ids)),
    porIds(
      unicos(pendencias.filter((p) => p.tipo_pendencia === "motorista_sem_comprovante").map((p) => p.pessoa_id)),
      (ids) => db.from("pessoa_endereco").select("pessoa_id, logradouro, numero, cidade, uf").eq("principal", true).in("pessoa_id", ids),
    ),
    (async () => {
      const ids = unicos(arqs.map((a) => a.validado_por));
      if (!ids.length) return [] as { user_id: string; nome: string }[];
      return ok(await db.rpc("nomes_usuarios", { p_ids: ids })) ?? [];
    })(),
  ]);

  const P = new Map(pessoas.map((p) => [p.id, p]));
  const M = new Map(motoristas.map((m) => [m.pessoa_id, m]));
  const ehProprietario = new Set(proprietarios.map((p) => p.pessoa_id));
  const V = new Map(veiculos.map((v) => [v.id, v]));
  const E = new Map(enderecos.map((e) => [e.pessoa_id, e]));
  const nomeUsuario = new Map(conferentes.map((u) => [u.user_id, u.nome]));
  const curto = (id: string | null) => {
    const p = id ? P.get(id) : undefined;
    return p ? p.nome_fantasia || p.nome : "—";
  };

  const fichaPessoa = (id: string) => (M.has(id) ? `/motoristas/${id}` : `/proprietarios/${id}`);
  /** Ficha aberta na aba de documentos (`fichaDocs` do protótipo). */
  const fichaDocs = (x: { pessoa_id: string | null; veiculo_id: string | null }) =>
    x.pessoa_id ? `${fichaPessoa(x.pessoa_id)}?aba=documentos` : `/veiculos/${x.veiculo_id}?aba=arquivos`;

  function objeto(x: { pessoa_id: string | null; veiculo_id: string | null }): Objeto | null {
    if (x.pessoa_id) {
      const p = P.get(x.pessoa_id);
      if (!p) return null;
      const papel = [M.has(p.id) && "motorista", ehProprietario.has(p.id) && "proprietário"].filter(Boolean).join(" e ");
      return { tipo: "pessoa", id: p.id, nome: p.nome, doc: formato.doc(p), papel, href: fichaPessoa(p.id) };
    }
    const v = x.veiculo_id ? V.get(x.veiculo_id) : undefined;
    if (!v) return null;
    const marca = (v.marca_veiculo as { nome: string } | null)?.nome ?? "";
    const tipo = (v.tipo_veiculo as { nome: string } | null)?.nome ?? "";
    return { tipo: "veiculo", id: v.id, placa: v.placa, titulo: `${marca} ${v.modelo ?? ""}`.trim(), sub: tipoSemEixos(tipo), href: `/veiculos/${v.id}` };
  }

  const tipoDoArquivo = (a: { tipo_arquivo_id: number }) => nomeTipo.get(a.tipo_arquivo_id) ?? "Documento";
  const hoje = hojeISO();
  const linhas: Record<TipoPendencia, LinhaPendencia[]> = {
    arquivo_vencido: [],
    veiculo_arrendado_sem_contrato: [],
    conjunto_acima_cmt: [],
    motorista_sem_cnh: [],
    motorista_sem_comprovante: [],
  };

  // documentos vencidos (v_vencimentos com dias < 0), com o arquivo do mesmo documento quando houver
  vencimentos
    .filter((v) => v.dias! < 0)
    .forEach((v, i) => {
      const o = objeto(v);
      if (!o) return;
      const arq = v.arquivo_id
        ? arqs.find((a) => a.id === v.arquivo_id)
        : arqs.find(
            (a) =>
              TIPO_ARQUIVO_DE[v.tipo!] === tipoDoArquivo(a) &&
              a.validade != null &&
              a.validade < hoje &&
              (v.pessoa_id ? a.pessoa_id === v.pessoa_id : a.veiculo_id === v.veiculo_id),
          );
      linhas.arquivo_vencido.push({
        chave: `venc-${i}`,
        objeto: o,
        titulo: `${v.tipo} ${formato.dias(v.dias!)}`,
        vencido: true,
        sub: [`Validade ${formato.data(v.data)}`, arq ? `arquivo ${arq.nome_original ?? ""}` : "sem arquivo anexado"],
        acao: { rotulo: ACAO_VENCIDO[v.tipo!] ?? "Anexar documento renovado", href: fichaDocs(v), icone: "paperclip" },
      });
    });

  pendencias.forEach((p, i) => {
    const o = objeto(p);
    if (!o) return;
    const base = { chave: `pend-${i}`, objeto: o };
    if (p.tipo_pendencia === "veiculo_arrendado_sem_contrato") {
      const v = V.get(p.veiculo_id!);
      linhas.veiculo_arrendado_sem_contrato.push({
        ...base,
        titulo: "Sem contrato de arrendamento",
        sub: [`Posse no CRLV: ${curto(v?.proprietario_posse_id ?? null)}`, `ANTT: ${curto(v?.proprietario_documento_id ?? null)}`],
        acao: { rotulo: "Anexar contrato", href: fichaDocs(p), icone: "paperclip" },
      });
    } else if (p.tipo_pendencia === "motorista_sem_cnh") {
      const m = M.get(p.pessoa_id!);
      linhas.motorista_sem_cnh.push({
        ...base,
        titulo: "CNH sem arquivo",
        sub: [
          ["Registro ", { cod: m?.cnh_registro ?? "—" }],
          `categoria ${(m?.cnh_categoria ?? "—").toUpperCase()}`,
          `até ${formato.data(m?.cnh_validade)}`,
        ],
        acao: { rotulo: "Anexar CNH", href: fichaDocs(p), icone: "paperclip" },
      });
    } else if (p.tipo_pendencia === "motorista_sem_comprovante") {
      const e = E.get(p.pessoa_id!);
      linhas.motorista_sem_comprovante.push({
        ...base,
        titulo: "Sem comprovante de residência",
        sub: [e ? `Endereço: ${e.logradouro ?? ""}, ${e.numero ?? ""}, ${e.cidade}/${e.uf}` : "Nenhum endereço cadastrado ainda"],
        acao: { rotulo: "Anexar comprovante", href: fichaDocs(p), icone: "paperclip" },
      });
    }
  });

  acimaAbertos.forEach((c, i) => {
    const o = objeto({ pessoa_id: null, veiculo_id: c.cavalo_id });
    if (!o || c.cmt_t == null) return;
    const tara = c.tara_total_t ?? 0;
    const cap = c.capacidade_total_t ?? 0;
    const limite = Math.round((c.cmt_t - tara) * 100) / 100;
    linhas.conjunto_acima_cmt.push({
      chave: `cmt-${i}`,
      objeto: o,
      titulo: `Passa ${formato.t(+(cap - limite).toFixed(1))} do CMT`,
      vencido: true,
      sub: [`Carretas ${formato.t(cap)}`, `limite ${formato.t(limite)} (CMT ${formato.t(c.cmt_t)} menos ${formato.t(tara)} de tara)`],
      acao: { rotulo: "Ver conjunto", href: `/conjuntos/${c.conjunto_id}`, icone: "link-2" },
    });
  });

  // vencimentos (todos)
  const listaVenc = vencimentos.flatMap((v, i): Vencimento[] => {
    const href = fichaDocs(v);
    if (v.pessoa_id) {
      const p = P.get(v.pessoa_id);
      if (!p) return [];
      return [{ chave: `v-${i}`, tipo: v.tipo!, data: v.data!, dias: v.dias!, href, quem: { tipo: "pessoa", nome: p.nome } }];
    }
    const x = v.veiculo_id ? V.get(v.veiculo_id) : undefined;
    if (!x) return [];
    const marca = (x.marca_veiculo as { nome: string } | null)?.nome ?? "";
    return [
      { chave: `v-${i}`, tipo: v.tipo!, data: v.data!, dias: v.dias!, href, quem: { tipo: "veiculo", placa: x.placa, modelo: `${marca} ${x.modelo ?? ""}`.trim() } },
    ];
  });

  // documentos: validade mais próxima primeiro, sem validade no fim
  const documentos = arqs
    .flatMap((a): Documento[] => {
      const dono = a.pessoa_id ? P.get(a.pessoa_id) : undefined;
      const veic = a.veiculo_id ? V.get(a.veiculo_id) : undefined;
      if (!dono && !veic) return [];
      return [
        {
          id: a.id,
          tipo: tipoDoArquivo(a),
          nome: a.nome_original ?? "",
          tamanho: a.tamanho_bytes != null ? formato.kb(a.tamanho_bytes) : "",
          restrito: a.restrito,
          validade: a.validade,
          dias: a.validade ? diasAte(a.validade) : null,
          conferido: a.validado_em
            ? { por: (a.validado_por && nomeUsuario.get(a.validado_por)) || "", quando: formato.relativo(a.validado_em) }
            : null,
          dono: dono ? { tipo: "pessoa", nome: dono.nome } : { tipo: "veiculo", placa: veic!.placa },
          href: fichaDocs(a),
        },
      ];
    })
    .sort((a, b) => ((a.validade ?? "9999") < (b.validade ?? "9999") ? -1 : (a.validade ?? "9999") > (b.validade ?? "9999") ? 1 : 0));

  return {
    resumo,
    grupos: linhas,
    vencimentos: listaVenc,
    documentos,
    aConferir: arqs.filter((a) => !a.validado_em).length,
    arrendados: linhas.veiculo_arrendado_sem_contrato.length,
  };
}
