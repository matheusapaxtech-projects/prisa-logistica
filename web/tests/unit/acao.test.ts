import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente do servidor falso: cada teste diz se há sessão.
const getClaims = vi.fn();
const clienteFalso = { auth: { getClaims } };
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clienteFalso),
}));

import { comSessao, semSessaoNaRota } from "@/lib/acao";
import { MSG_GENERICA, MSG_PAPEL, MSG_SESSAO_EXPIRADA, MSG_SO_ADMIN } from "@/lib/erros";

const comLogin = () =>
  getClaims.mockResolvedValue({ data: { claims: { sub: "u-1", email: "a@b.test" } }, error: null });
const semLogin = () => getClaims.mockResolvedValue({ data: null, error: null });

const rls = { code: "42501", message: "new row violates row-level security policy", details: null, hint: null };

beforeEach(() => {
  getClaims.mockReset();
});

describe("comSessao", () => {
  it("sem sessão: devolve a mensagem de sessão expirada, sem rodar a ação nem lançar", async () => {
    semLogin();
    const fn = vi.fn();
    await expect(comSessao(fn)).resolves.toEqual({ ok: false, erro: MSG_SESSAO_EXPIRADA });
    expect(fn).not.toHaveBeenCalled();
  });

  it("getClaims com erro (JWT expirado) também vira sessão expirada", async () => {
    getClaims.mockResolvedValue({ data: null, error: Object.assign(new Error("JWT expired"), { status: 401 }) });
    await expect(comSessao(vi.fn())).resolves.toEqual({ ok: false, erro: MSG_SESSAO_EXPIRADA });
  });

  it("com sessão: roda a ação com o cliente e o id do usuário e devolve os dados", async () => {
    comLogin();
    const fn = vi.fn(async ({ userId }: { userId: string }) => ({ id: "p-1", por: userId }));
    await expect(comSessao(fn)).resolves.toEqual({ ok: true, dados: { id: "p-1", por: "u-1" } });
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ supabase: clienteFalso, userId: "u-1" }));
  });

  it("erro do RLS lançado pela ação: mensagem do papel", async () => {
    comLogin();
    await expect(
      comSessao(async () => {
        throw rls;
      }),
    ).resolves.toEqual({ ok: false, erro: MSG_PAPEL });
  });

  it("erro do RLS em ação só de admin: 'Só o administrador pode fazer isso.'", async () => {
    comLogin();
    await expect(
      comSessao(
        async () => {
          throw rls;
        },
        { somenteAdmin: true },
      ),
    ).resolves.toEqual({ ok: false, erro: MSG_SO_ADMIN });
  });

  it("resposta do Supabase devolvida com error também é mapeada", async () => {
    comLogin();
    await expect(comSessao(async () => ({ data: null, error: rls }), { somenteAdmin: true })).resolves.toEqual({
      ok: false,
      erro: MSG_SO_ADMIN,
    });
  });

  it("erro desconhecido vira a mensagem genérica", async () => {
    comLogin();
    await expect(
      comSessao(async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ ok: false, erro: MSG_GENERICA });
  });

  it("redirect()/notFound() de dentro da ação passam adiante (não viram mensagem)", async () => {
    comLogin();
    const redirecionar = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    await expect(
      comSessao(async () => {
        throw redirecionar;
      }),
    ).rejects.toBe(redirecionar);
  });
});

describe("semSessaoNaRota", () => {
  it("sem sessão: 401 JSON com a mensagem de sessão expirada", async () => {
    semLogin();
    const r = await semSessaoNaRota();
    expect(r).not.toBeNull();
    expect(r!.status).toBe(401);
    await expect(r!.json()).resolves.toEqual({ erro: MSG_SESSAO_EXPIRADA });
  });

  it("com sessão: null (a rota segue)", async () => {
    comLogin();
    await expect(semSessaoNaRota()).resolves.toBeNull();
  });
});
