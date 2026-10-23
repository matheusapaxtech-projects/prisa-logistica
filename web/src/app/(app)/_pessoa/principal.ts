/* Inclusão de item com "principal" (endereço, telefone, e-mail, conta, Pix) sem perder o principal
   anterior. Só servidor (usado pelas Server Actions de ./actions.ts).

   Cada tabela tem índice único parcial `(pessoa_id) where principal`: dois principais ao mesmo tempo
   são recusados. Por isso a ordem é:
     1. insere o item com `principal: false` (se falhar — chave Pix repetida, RLS… — nada mudou);
     2. se marcado, desmarca os outros principais da pessoa (`.neq("id", novo)`);
     3. marca o novo; se esse passo falhar, devolve o principal aos que eram (sem ficar sem nenhum).
   Resultado: exatamente um principal quando marcado; o anterior intacto quando a inclusão falha. */

export type TabelaComPrincipal = "pessoa_endereco" | "pessoa_telefone" | "pessoa_email" | "pessoa_conta_bancaria" | "pessoa_chave_pix";

type Resposta<T> = PromiseLike<{ data: T | null; error: unknown }>;

/** O pedaço do cliente do Supabase que a inclusão usa (permite testar com um cliente simulado). */
type Filtro = {
  eq(coluna: string, valor: unknown): Filtro;
  neq(coluna: string, valor: unknown): Filtro;
  in(coluna: string, valores: unknown[]): Filtro;
  select(colunas: string): Resposta<{ id: string }[]>;
};
export type ClientePrincipal = {
  from(tabela: string): {
    insert(linha: Record<string, unknown>): { select(colunas: string): { single(): Resposta<{ id: string }> } };
    update(valores: Record<string, unknown>): Filtro;
  };
};

/** Insere `linha` (já com `pessoa_id`) e, se `principal`, passa a ser o único principal da pessoa.
   Lança o erro do Supabase (a Server Action converte com `comSessao`). Devolve o id novo. */
export async function inserirComPrincipal(
  db: ClientePrincipal,
  tabela: TabelaComPrincipal,
  pessoaId: string,
  linha: Record<string, unknown>,
  principal: boolean,
): Promise<string> {
  const novo = await db.from(tabela).insert({ ...linha, principal: false }).select("id").single();
  if (novo.error) throw novo.error;
  const id = novo.data!.id;
  if (!principal) return id;

  const antes = await db.from(tabela).update({ principal: false }).eq("pessoa_id", pessoaId).eq("principal", true).neq("id", id).select("id");
  if (antes.error) throw antes.error;

  const marcar = await db.from(tabela).update({ principal: true }).eq("id", id).select("id");
  if (marcar.error || !marcar.data?.length) {
    const anteriores = (antes.data ?? []).map((r) => r.id);
    if (anteriores.length) await db.from(tabela).update({ principal: true }).in("id", anteriores).select("id");
    throw marcar.error ?? { code: "42501", message: "row-level security" };
  }
  return id;
}
