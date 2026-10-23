/* Resumo de pendências da requisição atual (servidor). O layout (selo do menu) e as telas Início e
   Pendências pedem a mesma conta no mesmo render: com `cache` do React ela vai ao banco uma vez só. */
import { cache } from "react";
import { resumoPendencias } from "@/lib/consultas";
import { createClient } from "@/lib/supabase/server";

export const resumoDaRequisicao = cache(async () => resumoPendencias(await createClient()));
