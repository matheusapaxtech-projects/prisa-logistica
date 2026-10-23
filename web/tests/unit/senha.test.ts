import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Recuperação e troca de senha (/auth/confirm, /nova-senha) e as frases da entrada.
// Cliente do servidor falso: cada teste diz o que o Supabase Auth responde.
const getClaims = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();
const signInWithPassword = vi.fn();
const clienteFalso = { auth: { getClaims, verifyOtp, updateUser, signInWithPassword } };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => clienteFalso) }));

import { GET } from "@/app/auth/confirm/route";
import { definirNovaSenha } from "@/app/nova-senha/actions";
import { MSG_SENHA_FRACA, MSG_SENHA_IGUAL, validarNovaSenha } from "@/app/nova-senha/regras";
import { entrar } from "@/app/login/actions";
import { MSG_CREDENCIAIS, MSG_EMAIL_NAO_CONFIRMADO } from "@/app/login/regras";
import { MSG_SESSAO_EXPIRADA } from "@/lib/erros";

/** Destino do redirect() do Next (lançado como erro com digest "NEXT_REDIRECT;tipo;url;status;"), ou null. */
async function destino(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) throw e;
    return digest.split(";")[2] ?? null;
  }
}

const pedido = (busca: string) => ({ nextUrl: new URL(`http://localhost:3000/auth/confirm${busca}`) }) as unknown as NextRequest;

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

beforeEach(() => {
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: "u-1", email: "a@b.test" } }, error: null });
  verifyOtp.mockReset();
  updateUser.mockReset();
  signInWithPassword.mockReset();
});

describe("/auth/confirm", () => {
  it("token válido de recuperação: abre a sessão e leva para /nova-senha", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    await expect(destino(GET(pedido("?token_hash=abc&type=recovery")))).resolves.toBe("/nova-senha");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  it("token vencido ou já usado: aviso de link inválido", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { code: "otp_expired", status: 403 } });
    await expect(destino(GET(pedido("?token_hash=velho&type=recovery")))).resolves.toBe("/auth/link-invalido");
  });

  it("sem token, ou de outro tipo: aviso de link inválido, sem consultar o Supabase", async () => {
    await expect(destino(GET(pedido("")))).resolves.toBe("/auth/link-invalido");
    await expect(destino(GET(pedido("?token_hash=abc&type=signup")))).resolves.toBe("/auth/link-invalido");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("ignora qualquer destino vindo no endereço (sem redirecionamento aberto)", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    await expect(destino(GET(pedido("?token_hash=abc&type=recovery&next=https://exemplo.test")))).resolves.toBe("/nova-senha");
  });
});

describe("regras da senha nova", () => {
  it("exige 8 caracteres e as duas iguais", () => {
    expect(validarNovaSenha("", "")).toEqual({ senha: "Digite a senha nova.", confirmacao: "Repita a senha nova." });
    expect(validarNovaSenha("curta", "curta").senha).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(validarNovaSenha("senha-longa-1", "senha-longa-2").confirmacao).toBe("As duas senhas não são iguais. Digite de novo.");
    expect(validarNovaSenha("senha-longa-1", "senha-longa-1")).toEqual({});
  });
});

describe("definirNovaSenha", () => {
  it("campos inválidos voltam para a tela sem chamar o Supabase", async () => {
    await expect(definirNovaSenha(null, form({ senha: "curta", confirmacao: "outra" }))).resolves.toEqual({
      campos: { senha: "A senha precisa ter pelo menos 8 caracteres.", confirmacao: "As duas senhas não são iguais. Digite de novo." },
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("deu certo: grava com updateUser e vai para o Início", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    await expect(destino(definirNovaSenha(null, form({ senha: "senha-nova-123", confirmacao: "senha-nova-123" })))).resolves.toBe("/");
    expect(updateUser).toHaveBeenCalledWith({ password: "senha-nova-123" });
  });

  it("sem sessão: mensagem de sessão expirada, sem gravar", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(definirNovaSenha(null, form({ senha: "senha-nova-123", confirmacao: "senha-nova-123" }))).resolves.toEqual({
      erro: MSG_SESSAO_EXPIRADA,
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("erros do Supabase Auth viram frases da tela", async () => {
    const tentar = () => definirNovaSenha(null, form({ senha: "senha-nova-123", confirmacao: "senha-nova-123" }));
    updateUser.mockResolvedValueOnce({ data: {}, error: { code: "same_password", status: 422, message: "x" } });
    await expect(tentar()).resolves.toEqual({ erro: MSG_SENHA_IGUAL });
    updateUser.mockResolvedValueOnce({ data: {}, error: { code: "weak_password", status: 422, message: "x" } });
    await expect(tentar()).resolves.toEqual({ erro: MSG_SENHA_FRACA });
  });
});

describe("entrar: e-mail não confirmado", () => {
  it("tem frase própria; credencial errada continua com a do protótipo", async () => {
    const f = form({ email: "a@b.test", senha: "qualquer" });
    signInWithPassword.mockResolvedValueOnce({ error: { code: "email_not_confirmed", status: 400, message: "Email not confirmed" } });
    await expect(entrar(null, f)).resolves.toEqual({ erro: MSG_EMAIL_NAO_CONFIRMADO });
    signInWithPassword.mockResolvedValueOnce({ error: { code: "invalid_credentials", status: 400, message: "x" } });
    await expect(entrar(null, f)).resolves.toEqual({ erro: MSG_CREDENCIAIS });
  });
});
