import { describe, expect, it } from "vitest";
import {
  MSG_DUPLICADO,
  MSG_GENERICA,
  MSG_PAPEL,
  MSG_SESSAO_EXPIRADA,
  MSG_SO_ADMIN,
  mensagemDeErro,
} from "@/lib/erros";

// Formato do PostgrestError do supabase-js: { code, message, details, hint }.
const pg = (code: string, message = "", extra: Record<string, unknown> = {}) => ({
  code,
  message,
  details: null,
  hint: null,
  ...extra,
});

describe("mensagens fixas", () => {
  it("têm o texto combinado no plano", () => {
    expect(MSG_SESSAO_EXPIRADA).toBe(
      "Sua sessão expirou. Entre de novo; o que você digitou continua na tela.",
    );
    expect(MSG_SO_ADMIN).toBe("Só o administrador pode fazer isso.");
    expect(MSG_PAPEL).toBe("Seu papel não permite essa alteração.");
    expect(MSG_DUPLICADO).toBe("Já existe um cadastro com esse documento.");
  });
});

describe("mensagemDeErro — RLS / 42501", () => {
  const rls = pg("42501", 'new row violates row-level security policy for table "pessoa"');

  it("ação só de admin: 'Só o administrador pode fazer isso.'", () => {
    expect(mensagemDeErro(rls, { somenteAdmin: true })).toBe(MSG_SO_ADMIN);
  });

  it("ação comum: 'Seu papel não permite essa alteração.'", () => {
    expect(mensagemDeErro(rls)).toBe(MSG_PAPEL);
    expect(mensagemDeErro(rls, { somenteAdmin: false })).toBe(MSG_PAPEL);
  });

  it("reconhece 42501 sem a frase em inglês", () => {
    expect(mensagemDeErro(pg("42501", "permission denied for table arquivo"))).toBe(MSG_PAPEL);
  });

  it("reconhece a frase de RLS sem código (erro do Storage)", () => {
    const storage = Object.assign(new Error("new row violates row-level security policy"), {
      statusCode: "403",
    });
    expect(mensagemDeErro(storage, { somenteAdmin: true })).toBe(MSG_SO_ADMIN);
  });
});

describe("mensagemDeErro — documento duplicado", () => {
  it("23505 vira 'Já existe um cadastro com esse documento.'", () => {
    const e = pg("23505", 'duplicate key value violates unique constraint "pessoa_cpf_key"');
    expect(mensagemDeErro(e)).toBe(MSG_DUPLICADO);
  });
});

describe("mensagemDeErro — sessão expirada", () => {
  it("PGRST301 (JWT inválido/expirado no PostgREST)", () => {
    expect(mensagemDeErro(pg("PGRST301", "JWT expired"))).toBe(MSG_SESSAO_EXPIRADA);
  });

  it("PGRST303 (JWT expirado nas versões novas do PostgREST)", () => {
    expect(mensagemDeErro(pg("PGRST303", "JWT expired"))).toBe(MSG_SESSAO_EXPIRADA);
  });

  it("mensagem 'JWT expired' sem código", () => {
    expect(mensagemDeErro(new Error("JWT expired"))).toBe(MSG_SESSAO_EXPIRADA);
  });

  it("status 401", () => {
    expect(mensagemDeErro({ message: "Unauthorized", status: 401 })).toBe(MSG_SESSAO_EXPIRADA);
  });

  it("erro do Auth sem sessão (AuthSessionMissingError)", () => {
    const e = Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
      status: 400,
    });
    expect(mensagemDeErro(e)).toBe(MSG_SESSAO_EXPIRADA);
  });

  it("códigos do Auth de sessão vencida", () => {
    for (const code of ["session_expired", "session_not_found", "refresh_token_not_found", "bad_jwt"]) {
      expect(mensagemDeErro({ message: "x", code, status: 403 })).toBe(MSG_SESSAO_EXPIRADA);
    }
  });
});

describe("mensagemDeErro — raise exception do banco (P0001)", () => {
  it("passa a mensagem do banco como está", () => {
    const msg = "O conjunto já tem um cavalo. Feche o conjunto antes de trocar.";
    expect(mensagemDeErro(pg("P0001", msg))).toBe(msg);
  });

  it("P0001 sem mensagem cai na genérica", () => {
    expect(mensagemDeErro(pg("P0001", ""))).toBe(MSG_GENERICA);
  });
});

describe("mensagemDeErro — desconhecido", () => {
  it("erro qualquer vira a genérica em pt-BR, sem inglês nem stack", () => {
    const e = new TypeError("fetch failed");
    const msg = mensagemDeErro(e);
    expect(msg).toBe(MSG_GENERICA);
    expect(msg).not.toMatch(/fetch|failed|Error|at /);
  });

  it("código Postgres não mapeado vira a genérica", () => {
    expect(mensagemDeErro(pg("23514", 'new row for relation "veiculo" violates check constraint'))).toBe(
      MSG_GENERICA,
    );
  });

  it("valores que nem são erro (null, string, número) viram a genérica", () => {
    expect(mensagemDeErro(null)).toBe(MSG_GENERICA);
    expect(mensagemDeErro(undefined)).toBe(MSG_GENERICA);
    expect(mensagemDeErro("deu ruim")).toBe(MSG_GENERICA);
    expect(mensagemDeErro(42)).toBe(MSG_GENERICA);
  });

  it("a genérica é pt-BR e manda falar com o administrador", () => {
    expect(MSG_GENERICA).toMatch(/administrador/);
  });
});
