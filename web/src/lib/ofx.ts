/* Leitura do extrato bancário OFX (o arquivo que o internet banking exporta). Puro: roda no servidor e
   nos testes. Aceita os dois formatos que os bancos brasileiros usam: OFX 1.x (SGML, tags sem
   fechamento, cabeçalho "OFXHEADER:100", quase sempre em Windows-1252) e OFX 2.x (XML, UTF-8).
   Conta corrente (BANKACCTFROM) e cartão (CCACCTFROM). */

export type LancamentoOfx = {
  /** Identificador do lançamento para não duplicar: FITID do banco + data + valor (ver `idDoLancamento`). */
  fitid: string;
  /** Data do lançamento, "aaaa-mm-dd" (sem fuso: o dia que o banco informou). */
  data: string;
  /** Valor em reais, com sinal: crédito positivo, débito negativo. Duas casas. */
  valor: number;
  /** Histórico como o banco escreveu (NAME e MEMO juntos quando os dois existem). */
  descricao: string;
};

export type ExtratoOfx = {
  /** Código do banco (BANKID), sem zeros à esquerda além de três dígitos ("341"); no cartão, o ORG. */
  banco: string;
  agencia: string;
  numero: string;
  inicio: string | null;
  fim: string | null;
  /** Saldo do extrato (LEDGERBAL) e a data dele. */
  saldo: number | null;
  saldoEm: string | null;
  lancamentos: LancamentoOfx[];
};

/** Erro de leitura com a frase que a tela mostra (o problema e o que fazer). */
export class ErroOfx extends Error {}

const NAO_OFX = "Este arquivo não parece um extrato OFX. No internet banking, exporte o extrato em OFX (Money) e tente de novo.";

/** Bytes do arquivo → texto: UTF-8 quando for válido; senão Windows-1252 (o "CHARSET:1252" dos bancos). */
export function decodificarOfx(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function semEntidades(v: string): string {
  return v
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTIDADES[n.toLowerCase()] ?? m);
}

/** Valor da primeira `<TAG>` do trecho (SGML ou XML: lê até o próximo "<" ou fim de linha). */
function campo(trecho: string, tag: string): string {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(trecho);
  return m ? semEntidades(m[1]).replace(/\s+/g, " ").trim() : "";
}

/** Trecho entre `<TAG>` e `</TAG>` (ou até o fim, quando o SGML não fecha). */
function bloco(texto: string, tag: string): string {
  const ini = new RegExp(`<${tag}>`, "i").exec(texto);
  if (!ini) return "";
  const resto = texto.slice(ini.index + ini[0].length);
  const fim = new RegExp(`</${tag}>`, "i").exec(resto);
  return fim ? resto.slice(0, fim.index) : resto;
}

/** "20260902120000[-3:BRT]" → "2026-09-02"; data impossível → null. */
export function dataOfx(v: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  if (!m) return null;
  const [, a, mes, d] = m;
  const dt = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(a) || dt.getUTCMonth() !== Number(mes) - 1 || dt.getUTCDate() !== Number(d)) return null;
  return `${a}-${mes}-${d}`;
}

/** "-1234.56", "1234,56", "-1.234,56", "+50", "-.50" → número com duas casas; inválido → NaN.
   A conta é feita no texto, em centavos (metade arredonda para longe do zero, igual nos dois sinais). */
export function valorOfx(v: string): number {
  let t = v.replace(/\s/g, "").replace(/^\+/, "");
  if (!t) return Number.NaN;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula > -1 && ponto > -1) {
    // O separador que vem por último é o decimal; o outro é de milhar.
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula > -1) {
    t = t.replace(",", ".");
  }
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || !(m[2] || m[3])) return Number.NaN;
  const [, sinal, inteiro, fracao = ""] = m;
  const centavos = Number(inteiro || "0") * 100 + Number((fracao + "00").slice(0, 2)) + (Number(fracao[2] ?? "0") >= 5 ? 1 : 0);
  return ((sinal ? -1 : 1) * centavos) / 100 || 0;
}

/** Agência ou conta como identificador: só letras e dígitos, sem zeros à esquerda ("0001" e "1" são a
   mesma agência; "12345-6" e "000123456", a mesma conta). Na agência, o dígito depois do hífen sai
   (uns bancos mandam "1234-5", outros "1234"). */
export function identificador(v: string, agencia = false): string {
  const base = agencia ? v.split("-")[0] : v;
  const s = base.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : s;
}

/** Código do banco com três dígitos ("0341" → "341", "1" → "001"); texto que não é número fica como veio. */
function codigoBanco(v: string): string {
  return /^\d+$/.test(v) ? String(Number(v)).padStart(3, "0") : v;
}

/**
 * Identificador do lançamento: FITID + data + valor em centavos. Alguns bancos repetem o FITID em dias
 * diferentes (ou em todo extrato novo); com a data e o valor juntos, importar o mesmo arquivo de novo
 * não duplica e dois lançamentos diferentes com o mesmo FITID não se perdem.
 */
export function idDoLancamento(fitid: string, data: string, valor: number): string {
  return `${fitid || "sem-fitid"}|${data}|${Math.round(valor * 100)}`;
}

/** Lê o texto do OFX. Lança `ErroOfx` com a frase da tela quando o arquivo não serve. */
export function lerOfx(texto: string): ExtratoOfx {
  const inicioOfx = /<OFX>/i.exec(texto);
  if (!inicioOfx) throw new ErroOfx(NAO_OFX);
  const corpo = texto.slice(inicioOfx.index);

  const contaBanco = bloco(corpo, "BANKACCTFROM");
  const contaCartao = contaBanco ? "" : bloco(corpo, "CCACCTFROM");
  const conta = contaBanco || contaCartao;
  if (!conta) throw new ErroOfx("O extrato não diz qual é a conta. Exporte o arquivo OFX de novo pelo banco.");

  // Só o cabeçalho de cada extrato conta: um lançamento de transferência pode trazer a conta de destino
  // (BANKACCTTO/CCACCTTO, com ACCTID dentro), e ela não é outra conta do arquivo.
  const contas = new Set(
    [...corpo.matchAll(/<(?:BANK|CC)ACCTFROM>([\s\S]*?)(?=<\/(?:BANK|CC)ACCTFROM>|<BANKTRANLIST>|$)/gi)].map((m) =>
      identificador(campo(m[1], "ACCTID")),
    ),
  );
  if (contas.size > 1) throw new ErroOfx("O arquivo tem mais de uma conta. Exporte o extrato de uma conta por vez.");

  const numero = identificador(campo(conta, "ACCTID"));
  if (!numero) throw new ErroOfx("O extrato não diz qual é a conta. Exporte o arquivo OFX de novo pelo banco.");
  const banco = contaBanco
    ? codigoBanco(campo(conta, "BANKID"))
    : campo(bloco(corpo, "FI"), "ORG") || campo(bloco(corpo, "FI"), "FID") || "Cartão";
  const agencia = contaBanco ? identificador(campo(conta, "BRANCHID"), true) : "";

  const lista = bloco(corpo, "BANKTRANLIST");
  const blocos = [...corpo.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi)].map((m) => m[1]);

  const vistos = new Map<string, number>();
  const lancamentos: LancamentoOfx[] = blocos.map((b, i) => {
    const data = dataOfx(campo(b, "DTPOSTED"));
    const valor = valorOfx(campo(b, "TRNAMT"));
    if (!data || Number.isNaN(valor)) {
      throw new ErroOfx(
        `O lançamento ${i + 1} do extrato está com a data ou o valor em formato desconhecido. Exporte o arquivo OFX de novo pelo banco.`,
      );
    }
    const nome = campo(b, "NAME");
    const memo = campo(b, "MEMO");
    const descricao =
      (nome && memo ? (memo.toUpperCase().includes(nome.toUpperCase()) ? memo : `${nome} - ${memo}`) : nome || memo) ||
      campo(b, "TRNTYPE") ||
      "Sem histórico";
    // O mesmo id duas vezes no arquivo (bancos que não mandam FITID, ou lançamentos iguais no mesmo dia)
    // ganha um sufixo pela ordem, que é a mesma a cada exportação.
    const base = idDoLancamento(campo(b, "FITID"), data, valor);
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return { fitid: n === 1 ? base : `${base}#${n}`, data, valor, descricao };
  });

  const saldoBloco = bloco(corpo, "LEDGERBAL");
  const saldo = saldoBloco ? valorOfx(campo(saldoBloco, "BALAMT")) : Number.NaN;

  return {
    banco,
    agencia,
    numero,
    inicio: dataOfx(campo(lista, "DTSTART")),
    fim: dataOfx(campo(lista, "DTEND")),
    saldo: Number.isNaN(saldo) ? null : saldo,
    saldoEm: saldoBloco ? dataOfx(campo(saldoBloco, "DTASOF")) : null,
    lancamentos,
  };
}
