import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente do servidor falso: sessão sempre válida; cada chamada a from(tabela) consome a próxima
// resposta enfileirada para a tabela e registra os métodos chamados na consulta.
type Resposta = { data?: unknown; error?: unknown };
const filas = new Map<string, Resposta[]>();
const consultas: { tabela: string; chamadas: [string, unknown[]][] }[] = [];

function consulta(tabela: string) {
  const r = filas.get(tabela)?.shift() ?? { data: null, error: null };
  const registro = { tabela, chamadas: [] as [string, unknown[]][] };
  consultas.push(registro);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "is", "in", "single", "maybeSingle", "order", "limit"]) {
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

const getPerfil = vi.fn();
vi.mock("@/lib/permissoes", async () => {
  const papeis = await import("@/lib/papeis");
  return { getPerfil: () => getPerfil(), pode: papeis.pode };
});

import { conferirDocumento, prepararEnvio } from "@/components/documentos-acoes";
import { MSG_PAPEL, MSG_SO_ADMIN } from "@/lib/erros";

const PESSOA = "00000000-0000-4000-8000-000000000101";
const ARQ = "00000000-0000-4000-8000-000000000401";
const perfil = (papel: "admin" | "operacao") => ({ userId: "u-op", nome: "Fulano", papel, ativo: true });
const envio = (restrito: boolean) => ({
  pessoaId: PESSOA,
  tipoArquivoId: 5,
  nome: "CNH Edson.pdf",
  mime: "application/pdf" as const,
  tamanho: 1000,
  validade: null,
  numero: null,
  restrito,
});
const enfileirar = (tabela: string, ...r: Resposta[]) => filas.set(tabela, [...(filas.get(tabela) ?? []), ...r]);
const metodo = (i: number, nome: string) => consultas[i]?.chamadas.find(([m]) => m === nome)?.[1];

beforeEach(() => {
  filas.clear();
  consultas.length = 0;
  getPerfil.mockReset();
});

describe("prepararEnvio (M1: restrito só para admin)", () => {
  it("não admin pedindo restrito: 'Só o administrador pode fazer isso.' e nada é gravado", async () => {
    getPerfil.mockResolvedValue(perfil("operacao"));
    await expect(prepararEnvio(envio(true))).resolves.toEqual({ ok: false, erro: MSG_SO_ADMIN });
    expect(consultas).toHaveLength(0);
  });

  it("não admin sem restrito: grava a linha com o caminho da convenção", async () => {
    getPerfil.mockResolvedValue(perfil("operacao"));
    enfileirar("arquivo", { error: null });
    const r = await prepararEnvio(envio(false));
    expect(r.ok).toBe(true);
    const linha = metodo(0, "insert")?.[0] as Record<string, unknown>;
    expect(linha.restrito).toBe(false);
    expect(linha.storage_path).toMatch(new RegExp(`^pessoa/${PESSOA}/[0-9a-f-]{36}-cnh-edson\\.pdf$`));
    if (r.ok) expect(r.dados.caminho).toBe(linha.storage_path);
  });

  it("admin pode marcar restrito", async () => {
    getPerfil.mockResolvedValue(perfil("admin"));
    enfileirar("arquivo", { error: null });
    await expect(prepararEnvio(envio(true))).resolves.toMatchObject({ ok: true });
    expect((metodo(0, "insert")?.[0] as Record<string, unknown>).restrito).toBe(true);
  });

  it("tipo fora dos aceitos é recusado antes do banco", async () => {
    const r = await prepararEnvio({ ...envio(false), mime: "text/plain" as "application/pdf" });
    expect(r.ok).toBe(false);
    expect(consultas).toHaveLength(0);
  });
});

describe("conferirDocumento (M3: só o que ainda não foi conferido)", () => {
  it("ainda não conferido: atualiza com filtro validado_em is null e quem conferiu", async () => {
    enfileirar("arquivo", { data: { validado_em: null } }, { data: [{ id: ARQ }] });
    await expect(conferirDocumento(ARQ)).resolves.toEqual({ ok: true, dados: undefined });
    expect(metodo(1, "is")).toEqual(["validado_em", null]);
    expect(metodo(1, "update")?.[0]).toMatchObject({ validado_por: "u-op" });
  });

  it("já conferido: mensagem clara e nenhuma atualização", async () => {
    enfileirar("arquivo", { data: { validado_em: "2026-10-01T12:00:00Z" } });
    await expect(conferirDocumento(ARQ)).resolves.toEqual({
      ok: false,
      erro: "Este documento já foi conferido. Atualize a página para ver quem conferiu.",
    });
    expect(consultas).toHaveLength(1);
  });

  it("documento inexistente (ou invisível pelo RLS)", async () => {
    enfileirar("arquivo", { data: null });
    await expect(conferirDocumento(ARQ)).resolves.toEqual({ ok: false, erro: "Documento não encontrado." });
  });

  it("update sem linha afetada (papel sem permissão): mensagem do papel", async () => {
    enfileirar("arquivo", { data: { validado_em: null } }, { data: [] });
    await expect(conferirDocumento(ARQ)).resolves.toEqual({ ok: false, erro: MSG_PAPEL });
  });

  it("id inválido não chega ao banco", async () => {
    await expect(conferirDocumento("x'; drop")).resolves.toEqual({ ok: false, erro: "Documento não encontrado." });
    expect(consultas).toHaveLength(0);
  });
});
