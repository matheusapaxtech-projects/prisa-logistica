/* Ajudantes de consulta das contas a pagar e a receber, sempre com o cliente do usuário. */
import type { Banco } from "@/lib/banco";

/** A API devolve no máximo 1.000 linhas por vez: busca em páginas até acabar. */
export async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const TAM = 1000;
  const saida: T[] = [];
  for (let de = 0; ; de += TAM) {
    const { data, error } = await pagina(de, de + TAM - 1);
    if (error) throw error;
    saida.push(...(data ?? []));
    if (!data || data.length < TAM) return saida;
  }
}

/** Nome de cada usuário citado (quem lançou, aprovou, pagou, recebeu). */
export async function nomesDe(db: Banco, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))];
  if (unicos.length === 0) return new Map();
  const r = await db.rpc("nomes_usuarios", { p_ids: unicos });
  if (r.error) throw r.error;
  return new Map((r.data ?? []).map((n) => [n.user_id, n.nome]));
}
