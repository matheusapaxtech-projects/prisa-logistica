import { beforeEach, describe, expect, it, vi } from "vitest";

// Helpers do navegador usados pela lista de documentos e pelo canhoto da viagem (fix round 1 da Task 9).
const abrirDocumento = vi.fn();
vi.mock("@/components/documentos-acoes", () => ({ abrirDocumento: (id: string) => abrirDocumento(id) }));
vi.mock("@/components/Toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserClient: vi.fn() }));

import { abrirEmNovaJanela } from "@/lib/envio-navegador";

type Janela = { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };

let janela: Janela | null;
const open = vi.fn();

beforeEach(() => {
  abrirDocumento.mockReset();
  open.mockReset();
  janela = { opener: "quem abriu", location: { href: "" }, close: vi.fn() };
  open.mockImplementation((url: string) => (url === "" ? janela : null));
  vi.stubGlobal("open", open);
});

describe("abrirEmNovaJanela", () => {
  it("abre a janela antes da resposta (no clique) e depois leva ao link, sem opener", async () => {
    let responder: (v: unknown) => void = () => {};
    abrirDocumento.mockReturnValue(new Promise((ok) => (responder = ok)));
    const p = abrirEmNovaJanela("arq-1");
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(abrirDocumento).toHaveBeenCalledWith("arq-1");
    responder({ ok: true, dados: "https://link-assinado" });
    await expect(p).resolves.toEqual({ ok: true, dados: "https://link-assinado" });
    expect(janela!.opener).toBeNull();
    expect(janela!.location.href).toBe("https://link-assinado");
  });

  it("com erro, fecha a janela e devolve a frase", async () => {
    abrirDocumento.mockResolvedValue({ ok: false, erro: "Documento não encontrado." });
    await expect(abrirEmNovaJanela("arq-1")).resolves.toEqual({ ok: false, erro: "Documento não encontrado." });
    expect(janela!.close).toHaveBeenCalled();
  });

  it("janela bloqueada: abre o link direto, com noopener", async () => {
    janela = null;
    abrirDocumento.mockResolvedValue({ ok: true, dados: "https://link-assinado" });
    await abrirEmNovaJanela("arq-1");
    expect(open).toHaveBeenLastCalledWith("https://link-assinado", "_blank", "noopener");
  });
});
