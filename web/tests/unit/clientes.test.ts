import { describe, expect, it } from "vitest";
import { esquemaFaturamento, esquemaLocal } from "@/app/(app)/clientes/regras";

/** Primeira mensagem do zod para o campo (o que a tela mostra ao lado dele). */
function erroDe(r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, campo: string) {
  return r.error?.issues.find((i) => i.path[0] === campo)?.message;
}

describe("esquemaFaturamento (salvarFaturamento)", () => {
  const base = { pessoa_id: "11111111-1111-1111-1111-111111111111", condicao_faturamento: "por_cte" };

  it("aceita o mínimo e grava os vazios como nulo", () => {
    const r = esquemaFaturamento.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      condicao_faturamento: "por_cte",
      email_xml: null,
      email_cobranca: null,
      exige_gr: false,
      gerenciadora: null,
      exige_sm: false,
      exigencias: null,
    });
  });

  it('e-mail do XML inválido → "E-mail inválido"', () => {
    const r = esquemaFaturamento.safeParse({ ...base, email_xml: "xml@semdominio" });
    expect(r.success).toBe(false);
    expect(erroDe(r, "email_xml")).toBe("E-mail inválido");
  });

  it('e-mail de cobrança inválido → "E-mail inválido"', () => {
    const r = esquemaFaturamento.safeParse({ ...base, email_cobranca: "cobranca.empresa.com" });
    expect(erroDe(r, "email_cobranca")).toBe("E-mail inválido");
  });

  it('exige GR sem gerenciadora → "Informe a gerenciadora"', () => {
    const r = esquemaFaturamento.safeParse({ ...base, exige_gr: "on", gerenciadora: "" });
    expect(r.success).toBe(false);
    expect(erroDe(r, "gerenciadora")).toBe("Informe a gerenciadora");
  });

  it("exige GR com gerenciadora passa; e-mails em minúsculas", () => {
    const r = esquemaFaturamento.safeParse({
      ...base,
      condicao_faturamento: "mensal",
      exige_gr: "on",
      gerenciadora: "Gerenciadora Teste",
      exige_sm: "on",
      email_xml: "XML@Teste.com.br",
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ exige_gr: true, gerenciadora: "Gerenciadora Teste", exige_sm: true, email_xml: "xml@teste.com.br" });
  });

  it("sem exigir GR, a gerenciadora não é gravada", () => {
    const r = esquemaFaturamento.safeParse({ ...base, gerenciadora: "Sobrou do antes" });
    expect(r.data?.gerenciadora).toBeNull();
  });

  it("condição fora da lista é recusada", () => {
    expect(esquemaFaturamento.safeParse({ ...base, condicao_faturamento: "anual" }).success).toBe(false);
  });
});

describe("esquemaLocal (salvarLocal)", () => {
  const base = { pessoa_id: "11111111-1111-1111-1111-111111111111", cidade: "Apucarana", uf: "PR" };

  it("sem cidade é recusado", () => {
    const r = esquemaLocal.safeParse({ ...base, cidade: "" });
    expect(r.success).toBe(false);
    expect(erroDe(r, "cidade")).toBeTruthy();
  });

  it("sem UF é recusado", () => {
    const r = esquemaLocal.safeParse({ ...base, uf: "" });
    expect(r.success).toBe(false);
    expect(erroDe(r, "uf")).toBeTruthy();
  });

  it("CEP formatado 86800-000 vira 86800000", () => {
    const r = esquemaLocal.safeParse({ ...base, cep: "86800-000" });
    expect(r.success).toBe(true);
    expect(r.data?.cep).toBe("86800000");
  });

  it("CEP incompleto é recusado; vazio vira nulo", () => {
    expect(esquemaLocal.safeParse({ ...base, cep: "86800" }).success).toBe(false);
    expect(esquemaLocal.safeParse({ ...base, cep: "" }).data?.cep).toBeNull();
  });

  it("guarda janela de atendimento e contato do local; número vazio vira s/n", () => {
    const r = esquemaLocal.safeParse({
      ...base,
      logradouro: "Rodovia Teste, km 1",
      janela_atendimento: "Seg a sex, 7h às 17h",
      contato_local: "Portaria (43) 3000-0000",
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ janela_atendimento: "Seg a sex, 7h às 17h", contato_local: "Portaria (43) 3000-0000", numero: "s/n" });
  });

  it("id de edição precisa ser um id válido", () => {
    expect(esquemaLocal.safeParse({ ...base, id: "abc" }).success).toBe(false);
    expect(esquemaLocal.safeParse({ ...base, id: "22222222-2222-2222-2222-222222222222" }).success).toBe(true);
  });
});
