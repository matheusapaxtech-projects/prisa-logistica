/* `?aba=` e `?tipo=` de /pendencias, validados com zod em listas fechadas (valor fora da lista = padrão).
   A tela Início linka `/pendencias?tipo=<tipo>` para cada placa de advertência e
   `/pendencias?aba=vencimentos|documentos` para as listas. */
import { z } from "zod";

export const ABAS_PENDENCIAS = ["pendencias", "vencimentos", "documentos"] as const;
export type AbaPendencias = (typeof ABAS_PENDENCIAS)[number];

/** Os grupos da aba Pendências, na ordem do protótipo (os mesmos `tipo` da tela Início). */
export const TIPOS_PENDENCIA = [
  "arquivo_vencido",
  "veiculo_arrendado_sem_contrato",
  "conjunto_acima_cmt",
  "motorista_sem_cnh",
  "motorista_sem_comprovante",
] as const;
export type TipoPendencia = (typeof TIPOS_PENDENCIA)[number];

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const Busca = z.object({
  aba: z.preprocess(primeiro, z.enum(ABAS_PENDENCIAS)).catch("pendencias"),
  tipo: z.preprocess(primeiro, z.enum(TIPOS_PENDENCIA).nullable()).catch(null),
});

/** Aba ativa e filtro de tipo. Sem `?aba=` → "pendencias" (a primeira); `?tipo=` só vale se estiver na lista. */
export function abaPendencias(busca: Record<string, string | string[] | undefined>): {
  aba: AbaPendencias;
  tipo: TipoPendencia | null;
} {
  const r = Busca.parse({ aba: busca.aba, tipo: busca.tipo ?? null });
  return { aba: r.aba, tipo: r.tipo };
}
