import { tipado, type Banco } from "@/lib/banco";
import { ACAO_ROTULO, TABELA_ROTULO, resumoEvento } from "@/lib/auditoria";
import { formato } from "@/lib/formato";
import { getPerfil, pode } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Ponto } from "@/components/Ponto";

/** Tabela ligada ao registro por uma coluna da linha (ex.: `{ tabela: "arquivo", coluna: "pessoa_id" }`):
   entram todos os eventos dessas linhas, inclusive as aberturas de documento (que não têm dados). */
export type Relacionada = { tabela: string; coluna: string };

type Props = {
  /** Tabela(s) do registro, sem schema, como gravado em `auditoria.tabela` (ex.: "veiculo" ou
     ["pessoa", "motorista"] para a ficha do motorista, que tem a mesma chave). */
  tabela: string | string[];
  /** Chave primária do registro em texto (`auditoria.registro_id`). */
  registroId: string;
  /** Linhas filhas cujos eventos também contam (documentos, telefones, endereços...). */
  relacionadas?: Relacionada[];
  /** Título do painel. Padrão: "Histórico do registro". */
  titulo?: string;
  /** Frase quando não há eventos. Padrão: "Nenhuma alteração registrada desde a importação." */
  vazio?: string;
};

const LIMITE = 200;
const COLUNAS = "id, tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, em";

type Linha = {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  dados_antes: unknown;
  dados_depois: unknown;
  usuario_id: string | null;
  em: string;
};

type Dados = Record<string, unknown> | null;
const obj = (v: unknown): Dados => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

async function idsRelacionados(db: Banco, rel: Relacionada, registroId: string): Promise<string[]> {
  const [depois, antes] = await Promise.all([
    db.from("auditoria").select("registro_id").eq("tabela", rel.tabela).eq(`dados_depois->>${rel.coluna}`, registroId).limit(LIMITE),
    db.from("auditoria").select("registro_id").eq("tabela", rel.tabela).eq(`dados_antes->>${rel.coluna}`, registroId).limit(LIMITE),
  ]);
  if (depois.error) throw depois.error;
  if (antes.error) throw antes.error;
  return [...new Set([...(depois.data ?? []), ...(antes.data ?? [])].map((r) => r.registro_id))];
}

/* Histórico do registro (linha do tempo de `auditoria`), mais novo primeiro. Só o administrador vê:
   para os demais não renderiza nada (o RLS de auditoria também só deixa o admin ler). */
export async function Historico({ tabela, registroId, relacionadas = [], titulo, vazio }: Props) {
  const perfil = await getPerfil();
  if (!pode(perfil, "admin")) return null;

  const db = tipado(await createClient());
  const tabelas = Array.isArray(tabela) ? tabela : [tabela];

  const proprios = db
    .from("auditoria")
    .select(COLUNAS)
    .in("tabela", tabelas)
    .eq("registro_id", registroId)
    .order("em", { ascending: false })
    .limit(LIMITE);
  const filhos = relacionadas.map(async (rel) => {
    const ids = await idsRelacionados(db, rel, registroId);
    if (!ids.length) return [] as Linha[];
    const r = await db
      .from("auditoria")
      .select(COLUNAS)
      .eq("tabela", rel.tabela)
      .in("registro_id", ids)
      .order("em", { ascending: false })
      .limit(LIMITE);
    if (r.error) throw r.error;
    return (r.data ?? []) as Linha[];
  });
  const [rp, f] = await Promise.all([proprios, Promise.all(filhos)]);
  if (rp.error) throw rp.error;

  const vistos = new Set<number>();
  const eventos = [...((rp.data ?? []) as Linha[]), ...f.flat()]
    .filter((e) => (vistos.has(e.id) ? false : (vistos.add(e.id), true)))
    .sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : b.id - a.id))
    .slice(0, LIMITE);

  // Nomes de quem fez, tipos de documento e nomes dos arquivos abertos.
  const usuarios = [...new Set(eventos.map((e) => e.usuario_id).filter((u): u is string => !!u))];
  const idsArquivo = [...new Set(eventos.filter((e) => e.tabela === "arquivo").map((e) => e.registro_id))];
  const [perfis, tipos, arquivos] = await Promise.all([
    usuarios.length ? db.from("perfil_usuario").select("user_id, nome").in("user_id", usuarios) : null,
    idsArquivo.length ? db.from("tipo_arquivo").select("id, nome") : null,
    idsArquivo.length ? db.from("arquivo").select("id, nome_original").in("id", idsArquivo) : null,
  ]);
  for (const r of [perfis, tipos, arquivos]) if (r?.error) throw r.error;

  const nomeUsuario = new Map((perfis?.data ?? []).map((u) => [u.user_id, u.nome]));
  const mapaTipos = new Map((tipos?.data ?? []).map((t) => [t.id, t.nome]));
  const nomeArquivo = new Map((arquivos?.data ?? []).map((a) => [a.id, a.nome_original]));
  // Arquivo já apagado: o nome fica nos dados do evento de inclusão.
  for (const e of eventos) {
    const d = obj(e.dados_depois) ?? obj(e.dados_antes);
    if (e.tabela === "arquivo" && !nomeArquivo.get(e.registro_id) && typeof d?.nome_original === "string") {
      nomeArquivo.set(e.registro_id, d.nome_original);
    }
  }

  return (
    <div className="subsecao">
      <div className="painel-cab">
        <h2>{titulo ?? "Histórico do registro"}</h2>
        <span className="dir">
          <span className="muted small">
            {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}
            <Ponto />
            só administradores veem
          </span>
        </span>
      </div>
      {eventos.length ? (
        <ol className="linha-tempo">
          {eventos.map((e) => (
            <li key={e.id}>
              <time dateTime={e.em}>
                {formato.dataHora(e.em)}
                <span className="meta">{formato.relativo(e.em)}</span>
              </time>
              <span className={`ponto-acao ${e.acao}`} aria-hidden="true" />
              <span>
                <b>
                  {resumoEvento(
                    { tabela: e.tabela, acao: e.acao, dados_antes: obj(e.dados_antes), dados_depois: obj(e.dados_depois) },
                    { tipos: mapaTipos, nomeArquivo: e.tabela === "arquivo" ? nomeArquivo.get(e.registro_id) : null },
                  )}
                </b>
                <span className="meta">
                  {e.usuario_id ? (nomeUsuario.get(e.usuario_id) ?? "Usuário removido") : "Sistema"}
                  <Ponto />
                  {ACAO_ROTULO[e.acao] ?? e.acao} em {TABELA_ROTULO[e.tabela] ?? e.tabela}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <EstadoVazio>{vazio ?? "Nenhuma alteração registrada desde a importação."}</EstadoVazio>
      )}
    </div>
  );
}
