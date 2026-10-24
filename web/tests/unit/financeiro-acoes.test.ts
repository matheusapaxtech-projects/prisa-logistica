import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions do Financeiro com um cliente Supabase falso (sessão válida): a importação lê o OFX,
// manda à função do banco os lançamentos com a chave das regras e devolve o resumo; a classificação
// valida id e categoria e manda null para tirar a categoria.
const rpc = vi.fn();
const clienteFalso = {
  auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "u-fin" } }, error: null })) },
  rpc,
};
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { classificarLancamento, importarExtrato } from "@/app/(app)/financeiro/actions";

const ID = "00000000-0000-4000-8000-000000000901";
const FICTICIO = fs.readFileSync(path.join(__dirname, "..", "fixtures", "extrato-ficticio.ofx"));
const form = (arquivo?: File) => {
  const f = new FormData();
  if (arquivo) f.set("arquivo", arquivo);
  return f;
};

beforeEach(() => {
  rpc.mockReset();
});

describe("importarExtrato", () => {
  it("lê o OFX e manda conta, saldo e lançamentos com chave à função do banco", async () => {
    rpc.mockResolvedValueOnce({ data: { total: 17, novos: 15, classificados: 4, suspeitos: 1 }, error: null });
    const r = await importarExtrato(null, form(new File([FICTICIO], "setembro.ofx")));
    expect(r).toEqual({
      ok: true,
      dados: { total: 17, novos: 15, repetidos: 2, classificados: 4, suspeitos: 1, banco: "999", agencia: "1", numero: "123456", primeiroMes: "2026-09", ultimoMes: "2026-10" },
    });
    const [nome, args] = rpc.mock.calls[0];
    expect(nome).toBe("fin_importar_extrato");
    expect(args.p).toMatchObject({ banco: "999", agencia: "1", numero: "123456", nome_arquivo: "setembro.ofx", saldo: 88200.8, saldo_em: "2026-10-22" });
    expect(args.p.lancamentos).toHaveLength(17);
    expect(args.p.lancamentos[2]).toEqual({
      fitid: "FIC0003|2026-09-04|-1230000",
      data: "2026-09-04",
      valor: -12300,
      descricao: "ROADCARD PAGAMENTO FRETE 778812",
      chave: "ROADCARD PAGAMENTO FRETE",
    });
  });

  it("sem sessão, recusa antes de ler o arquivo", async () => {
    clienteFalso.auth.getClaims.mockResolvedValueOnce({ data: null, error: { message: "sem sessão" } } as never);
    const r = await importarExtrato(null, form(new File([FICTICIO], "x.ofx")));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/sessão expirou/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem arquivo, pede o arquivo e não chama o banco", async () => {
    expect(await importarExtrato(null, form())).toEqual({ ok: false, erro: "Escolha o arquivo OFX do extrato." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("arquivo que não é OFX volta com a frase do leitor", async () => {
    const r = await importarExtrato(null, form(new File(["Data;Valor\n01/10;10"], "extrato.csv")));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/não parece um extrato OFX/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("arquivo grande demais é recusado antes de ler", async () => {
    const grande = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "grande.ofx");
    const r = await importarExtrato(null, form(grande));
    expect(!r.ok && r.erro).toMatch(/passa de 4 MB/);
  });

  it("erro de permissão do banco vira a frase do papel", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Só o administrador e o financeiro importam extratos." } });
    const r = await importarExtrato(null, form(new File([FICTICIO], "x.ofx")));
    expect(r).toEqual({ ok: false, erro: "Seu papel não permite essa alteração." });
  });
});

describe("classificarLancamento", () => {
  it("manda a categoria e o lembrar; devolve quantos parecidos e se a regra foi gravada", async () => {
    rpc.mockResolvedValueOnce({ data: { outros: 3, regra: true }, error: null });
    expect(await classificarLancamento(ID, "despesa", true)).toEqual({ ok: true, dados: { outros: 3, regra: true, pediuRegra: true } });
    expect(rpc).toHaveBeenCalledWith("fin_classificar_lancamento", { p_id: ID, p_categoria: "despesa", p_lembrar: true });
  });

  it("descrição genérica: pediu regra e o banco não gravou", async () => {
    rpc.mockResolvedValueOnce({ data: { outros: 0, regra: false }, error: null });
    expect(await classificarLancamento(ID, "receita_frete", true)).toEqual({ ok: true, dados: { outros: 0, regra: false, pediuRegra: true } });
  });

  it("categoria vazia tira a classificação (null) e nunca grava regra", async () => {
    rpc.mockResolvedValueOnce({ data: { outros: 0, regra: false }, error: null });
    await classificarLancamento(ID, "", true);
    expect(rpc).toHaveBeenCalledWith("fin_classificar_lancamento", { p_id: ID, p_categoria: null, p_lembrar: false });
  });

  it("recusa id e categoria inválidos sem chamar o banco", async () => {
    expect(await classificarLancamento("x", "despesa", false)).toEqual({ ok: false, erro: "Lançamento não encontrado. Atualize a página." });
    expect(await classificarLancamento(ID, "pix" as never, false)).toEqual({ ok: false, erro: "Escolha uma categoria da lista." });
    expect(rpc).not.toHaveBeenCalled();
  });
});
