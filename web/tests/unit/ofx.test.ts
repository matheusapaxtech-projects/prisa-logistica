import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dataOfx, decodificarOfx, ErroOfx, idDoLancamento, identificador, lerOfx, valorOfx } from "@/lib/ofx";

// Leitura do extrato OFX: o arquivo fictício de tests/fixtures (SGML, como os bancos brasileiros
// exportam), a versão XML (OFX 2), cartão de crédito, acentos em Windows-1252 e os casos que recusam.
const FICTICIO = fs.readFileSync(path.join(__dirname, "..", "fixtures", "extrato-ficticio.ofx"));

const xml = (trns: string, conta = "<BANKACCTFROM><BANKID>0341</BANKID><BRANCHID>1234</BRANCHID><ACCTID>99999-1</ACCTID></BANKACCTFROM>") => `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF>${conta}
<BANKTRANLIST><DTSTART>20261001</DTSTART><DTEND>20261031</DTEND>${trns}</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00</BALAMT><DTASOF>20261031</DTASOF></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const trn = (fitid: string, data: string, valor: string, memo: string, nome = "") =>
  `<STMTTRN><TRNTYPE>OTHER</TRNTYPE><DTPOSTED>${data}</DTPOSTED><TRNAMT>${valor}</TRNAMT>${fitid ? `<FITID>${fitid}</FITID>` : ""}${nome ? `<NAME>${nome}</NAME>` : ""}<MEMO>${memo}</MEMO></STMTTRN>`;

describe("lerOfx: extrato fictício (OFX 1, SGML)", () => {
  const e = lerOfx(decodificarOfx(FICTICIO));

  it("lê a conta, o período e o saldo", () => {
    expect(e).toMatchObject({ banco: "999", agencia: "1", numero: "123456", inicio: "2026-09-01", fim: "2026-10-22", saldo: 88200.8, saldoEm: "2026-10-22" });
  });

  it("lê os 17 lançamentos com data, valor com sinal e histórico", () => {
    expect(e.lancamentos).toHaveLength(17);
    expect(e.lancamentos[2]).toEqual({ fitid: "FIC0003|2026-09-04|-1230000", data: "2026-09-04", valor: -12300, descricao: "ROADCARD PAGAMENTO FRETE 778812" });
    expect(e.lancamentos[6].valor).toBe(22100.5);
  });

  it("a soma dos lançamentos fecha em centavos", () => {
    const soma = e.lancamentos.reduce((s, l) => s + Math.round(l.valor * 100), 0);
    expect(soma).toBe(8331025);
  });

  it("ids únicos", () => {
    expect(new Set(e.lancamentos.map((l) => l.fitid)).size).toBe(17);
  });
});

describe("lerOfx: OFX 2 (XML) e casos dos bancos", () => {
  it("lê o XML, normaliza o código do banco e junta NAME e MEMO", () => {
    const e = lerOfx(xml(trn("A1", "20261005", "-150.00", "PAGTO BOLETO", "POSTO EXEMPLO")));
    expect(e.banco).toBe("341");
    expect(e.agencia).toBe("1234");
    expect(e.numero).toBe("999991");
    expect(e.lancamentos[0]).toMatchObject({ data: "2026-10-05", valor: -150, descricao: "POSTO EXEMPLO - PAGTO BOLETO" });
  });

  it("não repete o nome quando o MEMO já o contém", () => {
    const e = lerOfx(xml(trn("A1", "20261005", "10", "PIX RECEBIDO JOAO", "JOAO")));
    expect(e.lancamentos[0].descricao).toBe("PIX RECEBIDO JOAO");
  });

  it("aceita vírgula decimal e separador de milhar", () => {
    const e = lerOfx(xml(trn("A1", "20261005", "-1.234,56", "X") + trn("A2", "20261006", "2,5", "Y")));
    expect(e.lancamentos.map((l) => l.valor)).toEqual([-1234.56, 2.5]);
  });

  it("sem FITID ou com FITID repetido no mesmo dia e valor, os ids continuam únicos e estáveis", () => {
    const t = trn("", "20261005", "-10.00", "TARIFA") + trn("", "20261005", "-10.00", "TARIFA") + trn("R", "20261006", "5", "A") + trn("R", "20261007", "5", "B");
    const a = lerOfx(xml(t)).lancamentos.map((l) => l.fitid);
    expect(new Set(a).size).toBe(4);
    expect(lerOfx(xml(t)).lancamentos.map((l) => l.fitid)).toEqual(a);
    expect(a[1]).toBe(`${a[0]}#2`);
  });

  it("decodifica entidades e acentos em Windows-1252", () => {
    const texto = `<OFX><BANKACCTFROM><BANKID>1<ACCTID>1-1</BANKACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261001<TRNAMT>-1<FITID>1<MEMO>MANUTENÇÃO &amp; PEÇAS</STMTTRN></BANKTRANLIST></OFX>`;
    const bytes = Uint8Array.from(texto, (c) => c.charCodeAt(0));
    const e = lerOfx(decodificarOfx(bytes));
    expect(e.lancamentos[0].descricao).toBe("MANUTENÇÃO & PEÇAS");
    expect(e.banco).toBe("001");
  });

  it("cartão de crédito usa o ORG como banco", () => {
    const e = lerOfx(
      `<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Cartao Exemplo</ORG></FI></SONRS></SIGNONMSGSRSV1><CREDITCARDMSGSRSV1><CCSTMTRS><CCACCTFROM><ACCTID>5555</ACCTID></CCACCTFROM><BANKTRANLIST>${trn("C1", "20261002", "-99.90", "LOJA")}</BANKTRANLIST></CCSTMTRS></CREDITCARDMSGSRSV1></OFX>`,
    );
    expect(e).toMatchObject({ banco: "Cartao Exemplo", agencia: "", numero: "5555" });
    expect(e.lancamentos).toHaveLength(1);
  });

  it("recusa arquivo que não é OFX", () => {
    expect(() => lerOfx("Data;Historico;Valor\n01/10;X;10")).toThrow(ErroOfx);
  });

  it("recusa extrato sem conta", () => {
    expect(() => lerOfx("<OFX><BANKTRANLIST></BANKTRANLIST></OFX>")).toThrow(/qual é a conta/);
  });

  it("conta de destino de uma transferência (BANKACCTTO) não é outra conta do arquivo", () => {
    const t = `<STMTTRN><TRNTYPE>XFER</TRNTYPE><DTPOSTED>20261001</DTPOSTED><TRNAMT>-50</TRNAMT><FITID>X</FITID><MEMO>TRANSF</MEMO><BANKACCTTO><BANKID>237</BANKID><ACCTID>777</ACCTID></BANKACCTTO></STMTTRN>`;
    expect(lerOfx(xml(t)).lancamentos).toHaveLength(1);
  });

  it("a mesma conta escrita de outro jeito no mesmo arquivo não conta como duas", () => {
    const conta = "<BANKACCTFROM><BANKID>1</BANKID><BRANCHID>0001</BRANCHID><ACCTID>00012345-6</ACCTID></BANKACCTFROM>";
    const e = lerOfx(xml(trn("A", "20261001", "1", "X"), conta) + "<BANKACCTFROM><BANKID>1<ACCTID>123456</BANKACCTFROM>");
    expect(e).toMatchObject({ agencia: "1", numero: "123456" });
  });

  it("recusa arquivo com duas contas", () => {
    const duas = xml(trn("A", "20261001", "1", "X")) + "<BANKACCTFROM><BANKID>1<ACCTID>OUTRA</BANKACCTFROM>";
    expect(() => lerOfx(duas)).toThrow(/mais de uma conta/);
  });

  it("recusa lançamento com data ou valor inválido, dizendo qual", () => {
    expect(() => lerOfx(xml(trn("A", "20261001", "1", "X") + trn("B", "20261340", "1", "Y")))).toThrow(/lançamento 2/);
    expect(() => lerOfx(xml(trn("A", "20261001", "abc", "X")))).toThrow(/lançamento 1/);
  });
});

describe("partes", () => {
  it("dataOfx", () => {
    expect(dataOfx("20260229")).toBeNull();
    expect(dataOfx("20280229120000[-3:BRT]")).toBe("2028-02-29");
    expect(dataOfx("")).toBeNull();
  });

  it("valorOfx", () => {
    expect(valorOfx("+50")).toBe(50);
    expect(valorOfx("1,234.56")).toBe(1234.56);
    expect(valorOfx("0.1")).toBe(0.1);
    expect(valorOfx("1.2.3")).toBeNaN();
    expect(valorOfx("-.50")).toBe(-0.5);
    expect(valorOfx(".5")).toBe(0.5);
    expect(valorOfx("-")).toBeNaN();
    expect(valorOfx(".")).toBeNaN();
    // arredonda igual nos dois sinais e sem erro de ponto flutuante
    expect(valorOfx("0.125")).toBe(0.13);
    expect(valorOfx("-0.125")).toBe(-0.13);
    expect(valorOfx("1.005")).toBe(1.01);
    expect(valorOfx("-0.004")).toBe(0);
    expect(valorOfx("")).toBeNaN();
  });

  it("identificador da agência e da conta", () => {
    expect(identificador("0001", true)).toBe("1");
    expect(identificador("1234-5", true)).toBe("1234");
    expect(identificador("12345-6")).toBe("123456");
    expect(identificador("000123456")).toBe("123456");
    expect(identificador("0")).toBe("0");
    expect(identificador("5555 xxxx 1234")).toBe("5555XXXX1234");
  });

  it("idDoLancamento usa centavos", () => {
    expect(idDoLancamento("X", "2026-10-01", -0.1)).toBe("X|2026-10-01|-10");
  });
});
