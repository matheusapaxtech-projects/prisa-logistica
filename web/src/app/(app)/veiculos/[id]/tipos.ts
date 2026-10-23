import type { Database } from "@/lib/banco";

/** Linha de `veiculo` com os valores que a ficha edita. */
export type VeiculoFicha = Database["public"]["Tables"]["veiculo"]["Row"];
