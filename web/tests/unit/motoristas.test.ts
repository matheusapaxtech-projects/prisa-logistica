import { describe, expect, it } from "vitest";
import { z } from "zod";
import { hojeISO } from "@/lib/datas";
import { caminhosValidos, errosDoZod, lerForm } from "@/app/(app)/_pessoa/formulario";
import { estadoGr } from "@/app/(app)/motoristas/consultas";

const em = (dias: number) => {
  const d = new Date(hojeISO() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

describe("motoristas: situação na gerenciadora de risco (estadoGr do protótipo)", () => {
  it("sem consulta, habilitado, vencendo em até 30 dias e vencido", () => {
    expect(estadoGr({ situacao_gr: "sem_consulta", gr_validade: em(90) })).toEqual({ chave: "sem_consulta", rot: "Sem consulta", sub: "nunca consultado" });
    expect(estadoGr({ situacao_gr: "habilitado", gr_validade: em(9) })).toEqual({ chave: "vencendo", rot: "Habilitado", sub: "vence em 9 dias" });
    expect(estadoGr({ situacao_gr: "habilitado", gr_validade: em(-3) }).chave).toBe("vencido");
    expect(estadoGr({ situacao_gr: "vencido", gr_validade: null })).toEqual({ chave: "vencido", rot: "Vencido", sub: "consulta vencida" });
    expect(estadoGr({ situacao_gr: "habilitado", gr_validade: "2099-12-26" }).sub).toBe("até 26/12/2099");
    expect(estadoGr({ situacao_gr: "habilitado", gr_validade: null }).sub).toBe("sem validade");
  });
});

describe("_pessoa: apoio aos formulários", () => {
  it("errosDoZod devolve a primeira mensagem de cada campo", () => {
    const r = z
      .object({ nome: z.string().min(3, "Curto."), uf: z.enum(["PR"], "Escolha a UF.") })
      .safeParse({ nome: "a", uf: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(errosDoZod(r.error)).toEqual({ ok: false, erro: "Faltam dados: veja os campos marcados.", campos: { nome: "Curto.", uf: "Escolha a UF." } });
  });

  it("lerForm apara os textos e caminhosValidos só aceita rotas internas", () => {
    const f = new FormData();
    f.set("nome", "  Ana  ");
    f.set("principal", "on");
    expect(lerForm(f)).toEqual({ nome: "Ana", principal: "on" });
    expect(caminhosValidos(["/motoristas", "/motoristas/abc-1", "https://x.com", "//x", "/a b"])).toEqual(["/motoristas", "/motoristas/abc-1"]);
  });
});
