import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions de Clientes com um cliente Supabase falso (sessão válida; cada from(tabela) consome a
// próxima resposta enfileirada e registra as chamadas): o endereço da sede que falha não desfaz o
// cliente, mas volta como `semEndereco`; a aba Dados grava só os campos da pessoa.
type Resposta = { data?: unknown; error?: unknown };
const filas = new Map<string, Resposta[]>();
const consultas: { tabela: string; chamadas: [string, unknown[]][] }[] = [];

function consulta(tabela: string) {
  const r = filas.get(tabela)?.shift() ?? { data: null, error: null };
  const registro = { tabela, chamadas: [] as [string, unknown[]][] };
  consultas.push(registro);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "maybeSingle", "single"]) {
    q[m] = (...args: unknown[]) => {
      registro.chamadas.push([m, args]);
      return q;
    };
  }
  q.then = (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) =>
    Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok, falha);
  return q;
}

const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-op" } }, error: null })) },
  from: vi.fn((tabela: string) => consulta(tabela)),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { salvarCliente, salvarDadosCliente } from "@/app/(app)/clientes/actions";
import { NAO_ACHADO } from "@/app/(app)/clientes/regras";

const ID = "00000000-0000-4000-8000-000000000901";
const enfileirar = (tabela: string, ...r: Resposta[]) => filas.set(tabela, [...(filas.get(tabela) ?? []), ...r]);
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const chamadas = (tabela: string, metodo: string) =>
  consultas.filter((c) => c.tabela === tabela).flatMap((c) => c.chamadas.filter(([m]) => m === metodo).map(([, a]) => a[0]));

const PJ = {
  modo: "pj",
  cnpj: "90.765.431/0001-31",
  nome: "Empresa  Teste Ltda",
  cidade: "Apucarana",
  uf: "PR",
  logradouro: "Rua Teste",
  numero: "10",
  cep: "86800-000",
};

beforeEach(() => {
  filas.clear();
  consultas.length = 0;
});

describe("salvarCliente (PJ): endereço da sede", () => {
  it("falha ao gravar a sede: o cliente fica criado e a resposta avisa (semEndereco)", async () => {
    enfileirar("pessoa", { data: { id: ID } });
    enfileirar("cliente", { data: null });
    enfileirar("pessoa_endereco", { error: { code: "42501", message: "row-level security" } });
    const r = await salvarCliente(null, form(PJ));
    expect(r).toEqual({ ok: true, dados: { id: ID, semEndereco: true } });
    expect(chamadas("cliente", "insert")).toEqual([{ pessoa_id: ID }]);
    expect(chamadas("pessoa_endereco", "insert")[0]).toMatchObject({ pessoa_id: ID, tipo: "comercial", cep: "86800000", principal: true });
  });

  it("sede gravada: semEndereco falso", async () => {
    enfileirar("pessoa", { data: { id: ID } });
    const r = await salvarCliente(null, form(PJ));
    expect(r).toEqual({ ok: true, dados: { id: ID, semEndereco: false } });
  });

  it("sem cidade não tenta gravar sede", async () => {
    enfileirar("pessoa", { data: { id: ID } });
    const r = await salvarCliente(null, form({ ...PJ, cidade: "", logradouro: "", uf: "" }));
    expect(r).toEqual({ ok: true, dados: { id: ID, semEndereco: false } });
    expect(chamadas("pessoa_endereco", "insert")).toEqual([]);
  });
});

describe("salvarDadosCliente (aba Dados)", () => {
  const PF = {
    pessoa_id: ID,
    nome: "  Maria   Teste  ",
    cpf: "529.982.247-25",
    rg: "123",
    inscricao_estadual_isento: "on",
    inscricao_estadual: "999",
  };

  it("PF: grava só os campos da pessoa (sem INSS nem papel), com o tipo vindo do banco", async () => {
    enfileirar("pessoa", { data: { tipo: "pf", cliente: { pessoa_id: ID } } }, { data: [{ id: ID }] });
    const r = await salvarDadosCliente(null, form(PF));
    expect(r).toEqual({ ok: true, dados: undefined });
    const update = chamadas("pessoa", "update")[0] as Record<string, unknown>;
    expect(update).toMatchObject({ nome: "Maria Teste", cpf: "52998224725", rg: "123", inscricao_estadual_isento: true, inscricao_estadual: null });
    expect(update).not.toHaveProperty("nr_inss");
    expect(update).not.toHaveProperty("cnpj");
  });

  it("PJ: CNPJ inválido marca o campo e não grava", async () => {
    enfileirar("pessoa", { data: { tipo: "pj", cliente: { pessoa_id: ID } } });
    const r = await salvarDadosCliente(null, form({ pessoa_id: ID, nome: "Empresa", cnpj: "90.765.431/0001-32" }));
    expect(r.ok).toBe(false);
    expect("campos" in r && r.campos.cnpj).toMatch(/CNPJ inválido/);
    expect(chamadas("pessoa", "update")).toEqual([]);
  });

  it("pessoa que não é cliente: recusa", async () => {
    enfileirar("pessoa", { data: { tipo: "pf", cliente: null } });
    const r = await salvarDadosCliente(null, form(PF));
    expect(r).toEqual({ ok: false, erro: NAO_ACHADO });
  });

  it("update sem linha devolvida (RLS): erro de permissão", async () => {
    enfileirar("pessoa", { data: { tipo: "pf", cliente: { pessoa_id: ID } } }, { data: [] });
    const r = await salvarDadosCliente(null, form(PF));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/papel/);
  });
});
