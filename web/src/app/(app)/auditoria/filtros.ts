/* Filtros de /auditoria: leitura e escrita na URL. Puro (sem servidor): o Server Component lê com
   `lerFiltros` e o Client Component dos selects monta o link com `montarBusca`. */

/** Grupo do filtro "Tipo de registro" → tabelas do banco. Os de prototipo/auditoria.html (`TIPOS`),
   com as tabelas filhas junto da principal para o filtro não deixar eventos de fora. */
export const TIPOS: readonly { id: string; rot: string; tabelas: readonly string[] }[] = [
  { id: "pessoa", rot: "Pessoa", tabelas: ["pessoa", "pessoa_endereco", "pessoa_telefone", "pessoa_email"] },
  { id: "motorista", rot: "Motorista", tabelas: ["motorista", "motorista_referencia"] },
  { id: "proprietario", rot: "Proprietário", tabelas: ["proprietario"] },
  { id: "veiculo", rot: "Veículo", tabelas: ["veiculo"] },
  { id: "conjunto", rot: "Conjunto", tabelas: ["conjunto", "conjunto_item"] },
  { id: "arquivo", rot: "Arquivo", tabelas: ["arquivo"] },
  { id: "conta", rot: "Conta bancária e Pix", tabelas: ["pessoa_conta_bancaria", "pessoa_chave_pix"] },
  { id: "perfil", rot: "Perfil de usuário", tabelas: ["perfil_usuario"] },
];

export const ACOES: readonly { id: string; rot: string }[] = [
  { id: "insert", rot: "Criou" },
  { id: "update", rot: "Alterou" },
  { id: "delete", rot: "Apagou" },
  { id: "visualizacao", rot: "Visualizou documento" },
];

export type Filtros = {
  /** `user_id` de quem fez, ou "sistema" (eventos sem usuário: seed, importação, gatilhos). */
  usuario: string;
  /** Id de um grupo de `TIPOS`. */
  tipo: string;
  /** Uma ação de `ACOES`. */
  acao: string;
  /** `registro_id` exato (o link do Histórico de cada ficha usa). */
  registro: string;
  /** Quantos eventos carregar (cresce de `PASSO` em `PASSO` com "Mostrar mais"). */
  limite: number;
};

export const PASSO = 50;
export const LIMITE_MAXIMO = 500;

const RE_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_REGISTRO = /^[A-Za-z0-9:_-]{1,200}$/;

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** Lê `?usuario=&tipo=&acao=&registro=&limite=` (e o `?tabela=` que a ficha usava, que vira `tipo`).
   Valor inválido some em silêncio: a URL nunca derruba a tela. */
export function lerFiltros(busca: Busca): Filtros {
  const usuario = um(busca.usuario);
  let tipo = um(busca.tipo);
  if (!tipo && busca.tabela) tipo = TIPOS.find((t) => t.tabelas.includes(um(busca.tabela)))?.id ?? "";
  const acao = um(busca.acao);
  const registro = um(busca.registro);
  const limite = Number(um(busca.limite));
  return {
    usuario: usuario === "sistema" || RE_GUID.test(usuario) ? usuario : "",
    tipo: TIPOS.some((t) => t.id === tipo) ? tipo : "",
    acao: ACOES.some((a) => a.id === acao) ? acao : "",
    registro: RE_REGISTRO.test(registro) ? registro : "",
    limite: Number.isInteger(limite) && limite > PASSO ? Math.min(limite, LIMITE_MAXIMO) : PASSO,
  };
}

/** Texto de busca da URL (`?acao=update&tipo=pessoa`), só com o que está preenchido. Vazio → "". */
export function montarBusca(f: Partial<Filtros>): string {
  const p = new URLSearchParams();
  if (f.usuario) p.set("usuario", f.usuario);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.acao) p.set("acao", f.acao);
  if (f.registro) p.set("registro", f.registro);
  if (f.limite && f.limite > PASSO) p.set("limite", String(f.limite));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const algumFiltro = (f: Filtros): boolean => Boolean(f.usuario || f.tipo || f.acao || f.registro);

export const ehGuid = (v: string): boolean => RE_GUID.test(v);
