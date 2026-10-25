/* Rótulos dos enums do banco (ROT de prototipo/assets/paginas/motoristas.js) e listas de apoio das
   fichas de pessoa (motorista e proprietário). Puro: pode ser usado no servidor e no cliente. */

export const ROT = {
  situacao_cadastro: { normal: "Normal", pendente: "Pendente", cancelado: "Cancelado" },
  situacao_cpf: {
    regular: "Regular",
    titular_falecido: "Titular falecido",
    suspensa: "Suspensa",
    pendente_regularizacao: "Pendente de regularização",
    cancelada_multiplicidade: "Cancelada por multiplicidade",
    nula: "Nula",
    cancelada_oficio: "Cancelada de ofício",
  },
  sexo: { masculino: "Masculino", feminino: "Feminino" },
  raca_cor: {
    branca: "Branca",
    preta: "Preta",
    parda: "Parda",
    amarela: "Amarela",
    indigena: "Indígena",
    nao_informado: "Não informado",
  },
  estado_civil: {
    solteiro: "Solteiro(a)",
    casado: "Casado(a)",
    separado: "Separado(a)",
    viuvo: "Viúvo(a)",
    outro: "Outro",
  },
  grau_instrucao: {
    fundamental_incompleto: "Fundamental incompleto",
    fundamental_completo: "Fundamental completo",
    medio_incompleto: "Médio incompleto",
    medio_completo: "Médio completo",
    superior_incompleto: "Superior incompleto",
    superior_completo: "Superior completo",
  },
  cnh_categoria: {
    provisoria: "Provisória",
    a: "A",
    b: "B",
    c: "C",
    d: "D",
    e: "E",
    ab: "AB",
    ac: "AC",
    ad: "AD",
    ae: "AE",
  },
  situacao_gr: { sem_consulta: "Sem consulta", habilitado: "Habilitado", vencido: "Vencido", recusado: "Recusado" },
  tipo_endereco: {
    residencial: "Residencial",
    comercial: "Comercial",
    coleta_descarga: "Coleta/descarga",
    cobranca: "Cobrança",
    correspondencia: "Correspondência",
  },
  tipo_telefone: { celular: "Celular", residencial: "Residencial", comercial: "Comercial", fax: "Fax", radio: "Rádio" },
  tipo_conta: { corrente: "Conta corrente", poupanca: "Poupança", salario: "Conta salário" },
  tipo_chave_pix: { cpf: "CPF", cnpj: "CNPJ", celular: "Celular", email: "E-mail", aleatoria: "Chave aleatória" },
  tipo_referencia: { pessoal: "Pessoal", comercial: "Comercial" },
} as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type Uf = (typeof UFS)[number];

/** Chaves de um mapa de rótulos, como tupla para o `z.enum`. */
export function chaves<T extends Record<string, string>>(mapa: T): [keyof T & string, ...(keyof T & string)[]] {
  return Object.keys(mapa) as [keyof T & string, ...(keyof T & string)[]];
}

/** Rótulo de um valor de enum; desconhecido ou vazio → null (a tela mostra o travessão). */
export function rotulo<T extends Record<string, string>>(mapa: T, v: string | null | undefined): string | null {
  return v && v in mapa ? mapa[v as keyof T] : null;
}
