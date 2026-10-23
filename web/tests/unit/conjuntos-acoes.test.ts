import { beforeEach, describe, expect, it, vi } from "vitest";

// Guardas das Server Actions de conjunto (rodada de correção 1 da Task 10): o `salvar_conjunto`
// encerra todo conjunto aberto do cavalo, então a action confere no banco, antes da RPC, que o
// cavalo está livre (montar) e que o conjunto editado continua aberto e é do mesmo cavalo.
// Cliente falso: sessão válida; cada from(tabela) consome a próxima resposta enfileirada.
type Resposta = { data?: unknown; error?: unknown };
const filas = new Map<string, Resposta[]>();
const consultas: { tabela: string; chamadas: [string, unknown[]][] }[] = [];

function consulta(tabela: string) {
  const r = filas.get(tabela)?.shift() ?? { data: null, error: null };
  const registro = { tabela, chamadas: [] as [string, unknown[]][] };
  consultas.push(registro);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq", "is", "in", "maybeSingle", "order", "limit"]) {
    q[m] = (...args: unknown[]) => {
      registro.chamadas.push([m, args]);
      return q;
    };
  }
  q.then = (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) =>
    Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok, falha);
  return q;
}

const rpc = vi.fn<(nome: string, args: unknown) => Promise<{ data: unknown; error: unknown }>>(async () => ({ data: NOVO, error: null }));
const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-op" } }, error: null })) },
  from: vi.fn((tabela: string) => consulta(tabela)),
  rpc,
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { salvarConjunto, trocarMotorista } from "@/app/(app)/conjuntos/actions";
import { MSG_ENCERRADO, MSG_MOTORISTA } from "@/app/(app)/conjuntos/guardas";
import { MENSAGENS_CONJUNTO } from "@/lib/conjunto";

const ID = (n: number) => `00000000-0000-4000-8000-000000000${n}`;
const CAVALO = ID(205);
const OUTRO_CAVALO = ID(201);
const CARRETA = ID(217);
const CONJ = ID(301);
const NOVO = ID(399);
const MOT_NORMAL = ID(104);
const MOT_PENDENTE = ID(103);
const MOT_ATUAL = ID(101);

const enfileirar = (tabela: string, ...r: Resposta[]) => filas.set(tabela, [...(filas.get(tabela) ?? []), ...r]);
const montar = (extra: Partial<Parameters<typeof salvarConjunto>[0]> = {}) =>
  salvarConjunto({ conjuntoId: null, cavaloId: CAVALO, motoristaId: null, itens: [CARRETA], ...extra });

beforeEach(() => {
  filas.clear();
  consultas.length = 0;
  rpc.mockClear();
});

describe("salvarConjunto: montar (conjuntoId nulo)", () => {
  it("cavalo que ganhou conjunto aberto enquanto a tela estava aberta: recusa no cavalo e não chama a RPC", async () => {
    enfileirar("conjunto", { data: [{ id: ID(398) }] });
    await expect(montar()).resolves.toEqual({
      ok: false,
      erro: MENSAGENS_CONJUNTO.emOutroConjunto,
      local: { alvo: "cavalo" },
    });
    expect(rpc).not.toHaveBeenCalled();
    const q = consultas[0].chamadas;
    expect(q).toContainEqual(["eq", ["cavalo_id", CAVALO]]);
    expect(q).toContainEqual(["is", ["fim", null]]);
  });

  it("cavalo livre: chama salvar_conjunto e devolve o id novo", async () => {
    enfileirar("conjunto", { data: [] });
    await expect(montar()).resolves.toEqual({ ok: true, dados: NOVO });
    expect(rpc).toHaveBeenCalledWith("salvar_conjunto", { p_conjunto_id: null, p_cavalo_id: CAVALO, p_motorista_id: null, p_itens: [CARRETA] });
  });
});

describe("salvarConjunto: trocar peças (conjuntoId informado)", () => {
  it("conjunto encerrado nesse meio-tempo: 'Este conjunto já foi encerrado…' e não chama a RPC", async () => {
    enfileirar("conjunto", { data: { id: CONJ, cavalo_id: CAVALO, motorista_id: null, fim: "2026-10-23T12:00:00Z" } });
    await expect(montar({ conjuntoId: CONJ })).resolves.toEqual({ ok: false, erro: MSG_ENCERRADO, local: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("conjunto de outro cavalo (pedido forjado): recusa e não chama a RPC", async () => {
    enfileirar("conjunto", { data: { id: CONJ, cavalo_id: OUTRO_CAVALO, motorista_id: null, fim: null } });
    await expect(montar({ conjuntoId: CONJ })).resolves.toEqual({ ok: false, erro: MSG_ENCERRADO, local: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("conjunto inexistente (ou escondido pelo RLS): recusa", async () => {
    enfileirar("conjunto", { data: null });
    await expect(montar({ conjuntoId: CONJ })).resolves.toEqual({ ok: false, erro: MSG_ENCERRADO, local: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("conjunto aberto do mesmo cavalo: grava", async () => {
    enfileirar("conjunto", { data: { id: CONJ, cavalo_id: CAVALO, motorista_id: null, fim: null } });
    await expect(montar({ conjuntoId: CONJ })).resolves.toEqual({ ok: true, dados: NOVO });
    expect(rpc).toHaveBeenCalledOnce();
  });
});

describe("M2: motorista precisa ter cadastro normal", () => {
  it("montar com motorista pendente: recusa sem chamar a RPC", async () => {
    enfileirar("conjunto", { data: [] });
    enfileirar("motorista", { data: { situacao_cadastro: "pendente" } });
    await expect(montar({ motoristaId: MOT_PENDENTE })).resolves.toEqual({ ok: false, erro: MSG_MOTORISTA, local: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("montar com motorista normal: grava", async () => {
    enfileirar("conjunto", { data: [] });
    enfileirar("motorista", { data: { situacao_cadastro: "normal" } });
    await expect(montar({ motoristaId: MOT_NORMAL })).resolves.toEqual({ ok: true, dados: NOVO });
  });

  it("trocar peças mantendo o motorista atual (mesmo que pendente): não consulta o cadastro e grava", async () => {
    enfileirar("conjunto", { data: { id: CONJ, cavalo_id: CAVALO, motorista_id: MOT_ATUAL, fim: null } });
    await expect(montar({ conjuntoId: CONJ, motoristaId: MOT_ATUAL })).resolves.toEqual({ ok: true, dados: NOVO });
    expect(consultas.map((c) => c.tabela)).toEqual(["conjunto"]);
  });

  it("trocarMotorista para motorista cancelado: recusa e não faz o update", async () => {
    enfileirar("conjunto", { data: { motorista_id: MOT_ATUAL, fim: null } });
    enfileirar("motorista", { data: { situacao_cadastro: "cancelado" } });
    await expect(trocarMotorista({ conjuntoId: CONJ, motoristaId: MOT_PENDENTE })).resolves.toEqual({ ok: false, erro: MSG_MOTORISTA });
    expect(consultas.some((c) => c.chamadas.some(([m]) => m === "update"))).toBe(false);
  });

  it("trocarMotorista em conjunto já encerrado: 'Este conjunto já foi encerrado…'", async () => {
    enfileirar("conjunto", { data: { motorista_id: null, fim: "2026-10-23T12:00:00Z" } });
    await expect(trocarMotorista({ conjuntoId: CONJ, motoristaId: MOT_NORMAL })).resolves.toEqual({ ok: false, erro: MSG_ENCERRADO });
  });

  it("trocarMotorista para motorista normal: faz o update só no conjunto aberto", async () => {
    enfileirar("conjunto", { data: { motorista_id: null, fim: null } }, { data: [{ id: CONJ }] });
    enfileirar("motorista", { data: { situacao_cadastro: "normal" } });
    await expect(trocarMotorista({ conjuntoId: CONJ, motoristaId: MOT_NORMAL })).resolves.toEqual({ ok: true, dados: undefined });
    const update = consultas.find((c) => c.chamadas.some(([m]) => m === "update"))!.chamadas;
    expect(update).toContainEqual(["update", [{ motorista_id: MOT_NORMAL }]]);
    expect(update).toContainEqual(["is", ["fim", null]]);
  });
});
