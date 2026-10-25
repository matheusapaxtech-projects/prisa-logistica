import { beforeEach, describe, expect, it, vi } from "vitest";

/* `moverViagem` com um cliente Supabase falso: o que a ação manda para `mover_viagem`. Os dados das travas
   do motor de despacho (checklist, NF-e, CIOT, averbação, encerramentos) precisam chegar ao banco; o que
   a passagem não lê fica de fora. */
const chamadas: { fn: string; args: Record<string, unknown> }[] = [];

const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-op" } }, error: null })) },
  rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    chamadas.push({ fn, args });
    return { data: null, error: null };
  }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { moverViagem } from "@/app/(app)/quadro/actions";

const ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  chamadas.length = 0;
});

describe("moverViagem: dados das travas do motor", () => {
  it("checklist do veículo vai como booleano", async () => {
    const r = await moverViagem(ID, "aguardando_carregamento", "em_carregamento", { checklist_veiculo: true, outro: "x" });
    expect(r.ok).toBe(true);
    expect(chamadas[0]).toEqual({
      fn: "mover_viagem",
      args: { p_viagem: ID, p_de: "aguardando_carregamento", p_para: "em_carregamento", p_dados: { checklist_veiculo: true } },
    });
  });

  it("documentos de saída: NF-e, CIOT e averbação aparados", async () => {
    await moverViagem(ID, "aguardando_nf_pagamento", "em_rota", { chave_cte: "1", chave_mdfe: "2", chave_nfe: " 3 ", ciot: "123456789012", averbacao: " AV-1 " });
    expect(chamadas[0].args.p_dados).toEqual({ chave_cte: "1", chave_mdfe: "2", chave_nfe: "3", ciot: "123456789012", averbacao: "AV-1" });
  });

  it("encerramento: MDF-e e CIOT; marca que não é booleano é recusada", async () => {
    await moverViagem(ID, "aguardando_saldo", "frete_finalizado", { mdfe_encerrado: true, ciot_encerrado: true });
    expect(chamadas[0].args.p_dados).toEqual({ mdfe_encerrado: true, ciot_encerrado: true });
    const r = await moverViagem(ID, "aguardando_saldo", "frete_finalizado", { mdfe_encerrado: "sim" });
    expect(r).toEqual({ ok: false, erro: "Dados da passagem inválidos. Atualize a página." });
    expect(chamadas).toHaveLength(1);
  });
});
