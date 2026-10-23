import { beforeEach, describe, expect, it, vi } from "vitest";

/* `salvarLimites` (Task 11) com um cliente Supabase falso: sessão válida e `from("quadro_limite")`
   que registra os updates. O RLS do banco (só admin) devolve zero linhas, sem erro, para quem não é. */
type Atualizacao = { valores: Record<string, unknown>; chave?: unknown };
const atualizacoes: Atualizacao[] = [];
let linhasAtingidas: (chave: unknown) => { chave: unknown }[] = (chave) => [{ chave }];
let erroDoBanco: unknown = null;

const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-admin" } }, error: null })) },
  from: vi.fn((tabela: string) => {
    expect(tabela).toBe("quadro_limite");
    return {
      update: (valores: Record<string, unknown>) => {
        const a: Atualizacao = { valores };
        atualizacoes.push(a);
        const q = {
          eq: (_coluna: string, chave: unknown) => {
            a.chave = chave;
            return q;
          },
          select: () => q,
          then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
            Promise.resolve({ data: erroDoBanco ? null : linhasAtingidas(a.chave), error: erroDoBanco }).then(ok, falha),
        };
        return q;
      },
    };
  }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { salvarLimites } from "@/app/(app)/quadro/actions";
import { CHAVES_LIMITE } from "@/app/(app)/quadro/regras";

const MSG = "O vermelho precisa ser maior que o âmbar.";

function form(troca: Record<string, string> = {}) {
  const f = new FormData();
  for (const { chave } of CHAVES_LIMITE) {
    f.set(`ambar_${chave}`, "60");
    f.set(`vermelho_${chave}`, "120");
  }
  for (const [k, v] of Object.entries(troca)) f.set(k, v);
  return f;
}

beforeEach(() => {
  atualizacoes.length = 0;
  linhasAtingidas = (chave) => [{ chave }];
  erroDoBanco = null;
  clienteFalso.from.mockClear();
});

describe("salvarLimites", () => {
  it("cobre as 8 chaves de quadro_limite", () => {
    expect(CHAVES_LIMITE.map((c) => c.chave).sort()).toEqual([
      "aguardando_carregamento",
      "aguardando_contagem",
      "aguardando_descarga",
      "aguardando_nf_pagamento",
      "em_carregamento",
      "pausa_nao_programada",
      "pausa_programada",
      "resolucao_divergencia",
    ]);
  });

  it("vermelho menor ou igual ao âmbar devolve a frase e não grava nada", async () => {
    for (const vermelho of ["60", "59"]) {
      const r = await salvarLimites(null, form({ vermelho_em_carregamento: vermelho }));
      expect(r).toEqual({ ok: false, erro: MSG });
    }
    expect(clienteFalso.from).not.toHaveBeenCalled();
  });

  it("minutos que não são número inteiro positivo são recusados", async () => {
    for (const ruim of ["", "abc", "0", "-5", "1,5", "30 min"]) {
      const r = await salvarLimites(null, form({ ambar_em_carregamento: ruim }));
      expect(r.ok).toBe(false);
    }
    expect(clienteFalso.from).not.toHaveBeenCalled();
  });

  it("grava âmbar e vermelho de cada chave (só minutos_*)", async () => {
    const r = await salvarLimites(null, form({ ambar_aguardando_carregamento: " 90 ", vermelho_aguardando_carregamento: "180" }));
    expect(r.ok).toBe(true);
    expect(atualizacoes).toHaveLength(8);
    const a = atualizacoes.find((x) => x.chave === "aguardando_carregamento");
    expect(a?.valores).toEqual({ minutos_ambar: 90, minutos_vermelho: 180 });
    expect(atualizacoes.find((x) => x.chave === "pausa_nao_programada")?.valores).toEqual({ minutos_ambar: 60, minutos_vermelho: 120 });
  });

  it("quem não é administrador: o RLS não atinge linha nenhuma e a tela diz que é só do administrador", async () => {
    linhasAtingidas = () => [];
    const r = await salvarLimites(null, form());
    expect(r).toEqual({ ok: false, erro: "Só o administrador pode fazer isso." });
  });

  it("a trava do banco (vermelho depois do âmbar) volta com a mesma frase", async () => {
    erroDoBanco = { code: "23514", message: 'violates check constraint "quadro_limite_vermelho_depois_do_ambar"' };
    const r = await salvarLimites(null, form());
    expect(r).toEqual({ ok: false, erro: MSG });
  });
});
