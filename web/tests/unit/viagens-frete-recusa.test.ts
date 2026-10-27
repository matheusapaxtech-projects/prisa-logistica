import { beforeEach, describe, expect, it, vi } from "vitest";

/* Quando mudar o frete, o peso ou o pedágio deixa o frete menor que o já pago ao motorista, o banco recusa com uma frase
   pronta (migration 20261101000300). As duas portas que mudam esses valores (editar frete da viagem e mover no Quadro,
   que grava o peso) precisam mostrar a frase como está, não o erro genérico. Cliente Supabase falso. */

const FRASE =
  "O frete da viagem 42 ficou menor que o já pago ao motorista (R$ 6.300,00). Confira o peso e o frete; se estiverem certos, acerte a diferença com o motorista e peça ao administrador para corrigir o pagamento no Contas a pagar.";

const resposta = { current: { data: null as unknown, error: null as unknown } };
function consulta() {
  const q: Record<string, unknown> = {};
  for (const m of ["update", "eq", "is", "select"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => void) => ok(resposta.current);
  return q;
}
const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-op" } }, error: null })) },
  rpc: vi.fn(async () => resposta.current),
  from: vi.fn(consulta),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { moverViagem } from "@/app/(app)/quadro/actions";
import { salvarFreteViagem } from "@/app/(app)/viagens/actions";

const ID = "11111111-1111-1111-1111-111111111111";
const recusado = { code: "P0001", message: FRASE };

beforeEach(() => {
  resposta.current = { data: null, error: recusado };
});

describe("recusa do banco: frete menor que o já pago", () => {
  it("editar o frete da viagem mostra a frase do banco", async () => {
    const f = new FormData();
    f.set("viagem_id", ID);
    f.set("frete_motorista_valor", "8.000,00");
    f.set("frete_motorista_tipo", "total");
    f.set("km_viagem", "400");
    f.set("pedagio_valor", "0,00");
    expect(await salvarFreteViagem(null, f)).toEqual({ ok: false, erro: FRASE });
  });

  it("mover no Quadro com o peso (que muda o frete) mostra a frase do banco", async () => {
    const r = await moverViagem(ID, "aguardando_carregamento", "em_carregamento", { peso_saida_kg: 30000 });
    expect(r).toEqual({ ok: false, erro: FRASE });
  });
});
