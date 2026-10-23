/* Regras de preenchimento do cadastro de veículo (`regras` e `checarPlaca` de veiculo-novo.html).
   Puras: o formulário as usa ao vivo e o servidor repete a validação (`schema.ts`). */

const POS = ["letra", "letra", "letra", "número", "letra ou número", "número", "número"] as const;
const LETRA = /[A-Z]/;
const DIGITO = /[0-9]/;
const ALFANUM = /[A-Z0-9]/;

/** A posição (0 a 6) aceita este caractere? Padrão antigo ABC1234 ou Mercosul ABC1D23. */
function casa(c: string, i: number): boolean {
  return (i < 3 ? LETRA : i === 3 || i > 4 ? DIGITO : ALFANUM).test(c);
}

export type EstadoPlaca = {
  /** Texto normalizado (maiúsculas, sem símbolos, até 7). */
  placa: string;
  /** Índice do primeiro caractere fora do padrão, ou -1. */
  errado: number;
  completa: boolean;
  /** Mercosul (5º caractere é letra); antes de existir o 5º, assume Mercosul. */
  mercosul: boolean;
  /** Frase de ajuda ou de erro para o campo. */
  mensagem: string;
  /** A mensagem é um erro (vermelho)? */
  invalida: boolean;
};

export function estadoPlaca(bruto: string): EstadoPlaca {
  const placa = bruto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
  const errado = [...placa].findIndex((c, i) => !casa(c, i));
  const completa = placa.length === 7 && errado < 0;
  const mercosul = placa.length >= 5 ? LETRA.test(placa[4]) : true;
  let mensagem = "ABC1234 (antiga) ou ABC1D23 (Mercosul).";
  if (errado >= 0) mensagem = `A ${errado + 1}ª posição precisa ser ${POS[errado]}. Use ABC1234 ou ABC1D23.`;
  else if (placa && !completa) mensagem = `Próximo: ${POS[placa.length]}.`;
  return { placa, errado, completa, mercosul, mensagem, invalida: errado >= 0 };
}

export type ContextoRegras = {
  /** Ano de hoje (limite superior: ano atual + 1). */
  anoAtual: number;
  /** Ano de fabricação digitado (para o do modelo). */
  anoFabricacao: string;
  /** Placa do veículo que já usa o Renavam digitado, se a consulta achou. */
  renavamEmUso: string | null;
};

/** Mensagem do campo ("" = ok). Só os campos com regra: renavam, chassi, ano_fabricacao, ano_modelo. */
export function regraCampo(campo: string, v: string, c: ContextoRegras): string {
  switch (campo) {
    case "renavam":
      if (!v) return "";
      if (v.length !== 11) return `Renavam tem 11 dígitos; faltam ${11 - v.length}.`;
      return c.renavamEmUso ? `Renavam já cadastrado na placa ${c.renavamEmUso}. Confira o documento.` : "";
    case "chassi":
      if (!v) return "";
      if (/[IOQ]/.test(v)) return "Chassi não tem as letras I, O ou Q. Confira se é 1 ou 0.";
      return v.length !== 17 ? `Chassi tem 17 caracteres; faltam ${17 - v.length}.` : "";
    case "ano_fabricacao":
      if (!v) return "";
      return v.length !== 4 || +v < 1970 || +v > c.anoAtual + 1 ? `Use um ano entre 1970 e ${c.anoAtual + 1}.` : "";
    case "ano_modelo": {
      if (!v) return "";
      const fab = +c.anoFabricacao;
      if (v.length !== 4) return "Use o ano com 4 dígitos.";
      if (fab && (+v < fab || +v > fab + 1)) return `O ano do modelo é ${fab} ou ${fab + 1}.`;
      return "";
    }
    default:
      return "";
  }
}
