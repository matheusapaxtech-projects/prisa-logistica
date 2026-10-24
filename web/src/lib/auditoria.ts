/* Texto dos eventos de `public.auditoria` para o histórico do registro (só admin vê).
   `dados_antes`/`dados_depois` são a linha inteira (to_jsonb) antes/depois; `visualizacao` não tem dados. */

type Dados = Record<string, unknown> | null;

export type EventoAuditoria = {
  tabela: string;
  acao: string;
  dados_antes: Dados;
  dados_depois: Dados;
};

/** Objeto do verbo ("Criou a pessoa"). Mesmos textos de `OBJETO` em prototipo/auditoria.html. */
const OBJETO: Record<string, string> = {
  pessoa: "a pessoa",
  motorista: "o motorista",
  proprietario: "o proprietário",
  veiculo: "o veículo",
  conjunto: "o conjunto",
  conjunto_item: "a peça do conjunto",
  arquivo: "o arquivo",
  pessoa_endereco: "o endereço",
  pessoa_telefone: "o telefone",
  pessoa_email: "o e-mail",
  pessoa_conta_bancaria: "a conta bancária",
  pessoa_chave_pix: "a chave Pix",
  motorista_referencia: "a referência",
  perfil_usuario: "o perfil de usuário",
  fin_conta: "a conta do financeiro",
  fin_importacao: "o extrato importado",
  fin_lancamento: "o lançamento",
  fin_regra: "a regra de categoria",
};

/** "em …" da linha de baixo. Mesmos textos de `TABELA` em prototipo/motorista.html. */
export const TABELA_ROTULO: Record<string, string> = {
  pessoa: "dados pessoais",
  motorista: "motorista",
  proprietario: "proprietário",
  veiculo: "veículo",
  conjunto: "conjunto",
  conjunto_item: "conjunto",
  arquivo: "documento",
  pessoa_telefone: "telefone",
  pessoa_endereco: "endereço",
  pessoa_email: "e-mail",
  pessoa_conta_bancaria: "conta bancária",
  pessoa_chave_pix: "chave Pix",
  motorista_referencia: "referência",
  perfil_usuario: "usuário",
  fin_conta: "financeiro",
  fin_importacao: "financeiro",
  fin_lancamento: "financeiro",
  fin_regra: "financeiro",
};

/** Rótulo da ação. Mesmos textos de `ROT.acao` em prototipo/assets/paginas/motoristas.js. */
export const ACAO_ROTULO: Record<string, string> = {
  insert: "Inclusão",
  update: "Alteração",
  delete: "Exclusão",
  visualizacao: "Visualização",
};

/** Carimbos que mudam em toda gravação: não contam como "campo alterado". */
const IGNORAR = new Set([
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "dados_brasilapi",
  // mudam junto com a categoria do lançamento
  "classificado_em",
  "classificado_por",
]);

/** Rótulos das colunas mais comuns; as demais viram o nome da coluna com espaços. */
const CAMPO: Record<string, string> = {
  nome: "nome",
  apelido: "apelido",
  nome_fantasia: "nome fantasia",
  cpf: "CPF",
  cnpj: "CNPJ",
  rg: "RG",
  rg_orgao: "órgão do RG",
  rg_uf: "UF do RG",
  rg_emissao: "emissão do RG",
  nascimento: "nascimento",
  mae: "mãe",
  pai: "pai",
  sexo: "sexo",
  raca_cor: "raça/cor",
  estado_civil: "estado civil",
  grau_instrucao: "grau de instrução",
  naturalidade: "naturalidade",
  naturalidade_uf: "UF da naturalidade",
  nr_inss: "número do INSS",
  observacao: "observação",
  situacao_cadastro: "situação do cadastro",
  situacao_cpf: "situação do CPF",
  inscricao_estadual: "inscrição estadual",
  inscricao_municipal: "inscrição municipal",
  cnh_registro: "registro da CNH",
  cnh_categoria: "categoria da CNH",
  cnh_validade: "validade da CNH",
  cnh_emissao: "emissão da CNH",
  cnh_uf: "UF da CNH",
  cnh_primeira_habilitacao: "primeira habilitação",
  situacao_gr: "situação na gerenciadora",
  gr_validade: "validade da consulta de risco",
  radio: "rádio",
  rntrc: "RNTRC",
  rntrc_validade: "validade do RNTRC",
  placa: "placa",
  renavam: "Renavam",
  chassi: "chassi",
  modelo: "modelo",
  marca_id: "marca",
  tipo_veiculo_id: "tipo",
  ano_fabricacao: "ano de fabricação",
  ano_modelo: "ano do modelo",
  cor: "cor",
  tara_t: "tara",
  pbt_t: "PBT",
  cmt_t: "CMT",
  capacidade_carga_t: "capacidade de carga",
  arrendado: "arrendado",
  seguro_validade: "validade do seguro",
  venc_ipva: "vencimento do IPVA",
  situacao_operacional: "situação operacional",
  proprietario_documento_id: "proprietário no documento",
  proprietario_posse_id: "proprietário na posse",
  motorista_id: "motorista",
  fim: "encerramento",
  tipo_arquivo_id: "tipo do documento",
  validade: "validade",
  numero: "número",
  restrito: "acesso restrito",
  validado_em: "conferência",
  validado_por: "conferência",
  principal: "principal",
  telefone: "telefone",
  email: "e-mail",
  logradouro: "logradouro",
  cep: "CEP",
  cidade: "cidade",
  uf: "UF",
  papel: "papel",
  ativo: "ativo",
  categoria: "categoria",
  descricao: "histórico",
  chave: "descrição da regra",
  nome_arquivo: "arquivo",
  novos: "lançamentos novos",
};

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Colunas alteradas num update (sem os carimbos), na ordem da linha. */
export function camposAlterados(antes: Dados, depois: Dados): string[] {
  const a = antes ?? {};
  const d = depois ?? {};
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(d)])];
  return chaves.filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null));
}

type Contexto = {
  /** `tipo_arquivo.id` → nome ("CNH"). */
  tipos: Map<number, string>;
  /** Nome do arquivo (para `visualizacao`, que não traz dados). */
  nomeArquivo?: string | null;
};

/** Frase do evento: "Criou a pessoa", "CNH anexado (cnh.pdf)", "Alterou nome e apelido",
   "CNH conferido", "Apagou o veículo", "Abriu documento cnh.pdf". */
export function resumoEvento(ev: EventoAuditoria, ctx: Contexto): string {
  const linha = ev.dados_depois ?? ev.dados_antes ?? {};
  const objeto = OBJETO[ev.tabela] ?? "o registro";
  const arquivo = ev.tabela === "arquivo";
  const tipo = arquivo ? (ctx.tipos.get(Number(linha.tipo_arquivo_id)) ?? "Documento") : "";
  const nome = (typeof linha.nome_original === "string" && linha.nome_original) || ctx.nomeArquivo || "";

  switch (ev.acao) {
    case "visualizacao":
      return `Abriu documento${ctx.nomeArquivo ? ` ${ctx.nomeArquivo}` : ""}`;
    case "insert":
      return arquivo ? `${tipo} anexado${nome ? ` (${nome})` : ""}` : `Criou ${objeto}`;
    case "delete":
      return arquivo ? `Apagou ${tipo}${nome ? ` (${nome})` : ""}` : `Apagou ${objeto}`;
    case "update": {
      const campos = camposAlterados(ev.dados_antes, ev.dados_depois);
      if (arquivo && ev.dados_antes?.validado_em == null && ev.dados_depois?.validado_em != null) {
        return `${tipo} conferido`;
      }
      if (!campos.length) return `Alterou ${objeto}`;
      const rotulos = [...new Set(campos.map((c) => CAMPO[c] ?? c.replace(/_/g, " ")))];
      const mostrados = rotulos.length > 4 ? [...rotulos.slice(0, 3), `mais ${rotulos.length - 3} campos`] : rotulos;
      return `Alterou ${lista(mostrados)}`;
    }
    default:
      return ev.acao;
  }
}
