import { describe, expect, it } from "vitest";
import { hojeISO } from "@/lib/datas";
import { estadoRntrc } from "@/app/(app)/proprietarios/consultas";
import { faltasAoCriar, lerNumero } from "@/app/(app)/proprietarios/regras";

const dia = (n: number) => {
  const d = new Date(hojeISO() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("lerNumero", () => {
  it("lê o formato brasileiro", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("R$ 35")).toBe(35);
    expect(lerNumero("70%")).toBe(70);
    expect(lerNumero("2,5")).toBe(2.5);
  });
  it("vazio é null e lixo é NaN", () => {
    expect(lerNumero("")).toBeNull();
    expect(lerNumero(undefined)).toBeNull();
    expect(lerNumero("abc")).toBeNaN();
    expect(lerNumero("-3")).toBeNaN();
  });
});

describe("faltasAoCriar", () => {
  const ok = { rntrc: "123456789", rntrc_validade: "2030-01-01", enquadramento_antt: "tac" };
  it("completo nasce normal", () => expect(faltasAoCriar(ok)).toEqual([]));
  it("diz o que falta, na ordem do protótipo", () => {
    expect(faltasAoCriar({ ...ok, rntrc: "123" })).toEqual(["o RNTRC"]);
    expect(faltasAoCriar({ ...ok, rntrc_validade: "" })).toEqual(["a validade do RNTRC"]);
    expect(faltasAoCriar({ ...ok, enquadramento_antt: "" })).toEqual(["o enquadramento"]);
  });
  it("empresa consultada precisa estar ativa na Receita", () => {
    expect(faltasAoCriar(ok, "ATIVA")).toEqual([]);
    expect(faltasAoCriar(ok, "BAIXADA")).toEqual(["a situação ativa na Receita"]);
  });
});

describe("estadoRntrc", () => {
  it("sem número, sem validade, vencido, vencendo e ok", () => {
    expect(estadoRntrc({ rntrc: null, rntrc_validade: null }).estado).toBe("sem");
    expect(estadoRntrc({ rntrc: "1", rntrc_validade: null }).estado).toBe("sem_validade");
    expect(estadoRntrc({ rntrc: "1", rntrc_validade: dia(-3) })).toMatchObject({ estado: "vencido", dias: -3 });
    expect(estadoRntrc({ rntrc: "1", rntrc_validade: dia(30) }).estado).toBe("vencendo");
    expect(estadoRntrc({ rntrc: "1", rntrc_validade: dia(31) }).estado).toBe("ok");
  });
});
