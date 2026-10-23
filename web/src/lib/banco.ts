/* Tipos do banco (gerados em supabase/types/database.ts) para os clientes do Supabase.
   Os clientes de lib/supabase/* nascem sem tipo; `tipado()` só muda o tipo, não o comportamento. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../../supabase/types/database";

export type { Database, Json };
export type Banco = SupabaseClient<Database>;

export function tipado(cliente: SupabaseClient): Banco {
  return cliente as unknown as Banco;
}
