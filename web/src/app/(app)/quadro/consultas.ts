/* Consultas do Quadro da operação. Puras (só tipos): rodam no servidor (primeira carga, com o cliente
   do servidor) e no navegador (recarga a cada mudança do tempo real, com o cliente do navegador).
   Sempre com a sessão do usuário (RLS: pode_ler). A Task 11 (Hoje) reusa `carregarQuadro`. */
import type { Banco, Database } from "@/lib/banco";
import type { Cartao, StatusCampo } from "@/lib/quadro";

export type Limite = Database["public"]["Tables"]["quadro_limite"]["Row"];

export type DadosQuadro = {
  /** Um cartão por viagem no quadro (`v_quadro`). */
  cartoes: Cartao[];
  /** Tempos-limite por coluna (`quadro_limite`), para a cor do cartão. */
  limites: Limite[];
  /** Coluna de onde saiu a pausa aberta, por viagem (Pausa só volta para ela; `v_quadro` não traz). */
  origensDaPausa: Record<string, StatusCampo>;
};

/** Cartões do quadro, tempos-limite e a origem das pausas abertas, numa ida ao banco (em paralelo). */
export async function carregarQuadro(cliente: Banco): Promise<DadosQuadro> {
  const [cartoes, limites, pausas] = await Promise.all([
    cliente.from("v_quadro").select("*"),
    cliente.from("quadro_limite").select("chave, minutos_ambar, minutos_vermelho"),
    cliente.from("viagem_pausa").select("viagem_id, coluna_origem").is("fim", null),
  ]);
  if (cartoes.error) throw cartoes.error;
  if (limites.error) throw limites.error;
  if (pausas.error) throw pausas.error;
  return {
    cartoes: cartoes.data ?? [],
    limites: limites.data ?? [],
    origensDaPausa: Object.fromEntries((pausas.data ?? []).map((p) => [p.viagem_id, p.coluna_origem])),
  };
}
