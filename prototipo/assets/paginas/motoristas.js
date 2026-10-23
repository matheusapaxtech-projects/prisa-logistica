/* NILT — grupo Motoristas: dados extras e utilidades das telas motoristas.html, motorista-novo.html e motorista.html.
   Carregar depois de dados.js e antes do script da página.
   TUDO FICTÍCIO. Os nomes de campo são os das tabelas do banco (pessoa, pessoa_endereco, pessoa_telefone,
   pessoa_email, pessoa_conta_bancaria, pessoa_chave_pix, motorista, motorista_referencia, arquivo, auditoria).
   Na conversão para Next.js: os rótulos dos enums viram lib/rotulos.ts; estadoValidade/estadoGr viram
   funções puras usadas nas consultas; os dados extras somem (vêm do Supabase). */
(function () {
  const N = window.NILT;
  const D = N.dados;
  const dia = N.dia;
  const quando = (horas) => new Date(Date.now() - horas * 3600e3).toISOString();

  // CPF válido a partir de 9 dígitos (fictício), igual ao de dados.js
  function cpf(base9) {
    const d = base9.split('').map(Number);
    for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); const r = (s * 10) % 11; d.push(r === 10 ? 0 : r); }
    return d.join('');
  }

  /* ---------- rótulos dos enums do banco ---------- */
  const ROT = {
    situacao_cadastro: { normal: 'Normal', pendente: 'Pendente', cancelado: 'Cancelado' },
    situacao_cpf: { regular: 'Regular', titular_falecido: 'Titular falecido', suspensa: 'Suspensa', pendente_regularizacao: 'Pendente de regularização', cancelada_multiplicidade: 'Cancelada por multiplicidade', nula: 'Nula', cancelada_oficio: 'Cancelada de ofício' },
    sexo: { masculino: 'Masculino', feminino: 'Feminino' },
    raca_cor: { branca: 'Branca', preta: 'Preta', parda: 'Parda', amarela: 'Amarela', indigena: 'Indígena', nao_informado: 'Não informado' },
    estado_civil: { solteiro: 'Solteiro(a)', casado: 'Casado(a)', separado: 'Separado(a)', viuvo: 'Viúvo(a)', outro: 'Outro' },
    grau_instrucao: { fundamental_incompleto: 'Fundamental incompleto', fundamental_completo: 'Fundamental completo', medio_incompleto: 'Médio incompleto', medio_completo: 'Médio completo', superior_incompleto: 'Superior incompleto', superior_completo: 'Superior completo' },
    cnh_categoria: { provisoria: 'Provisória', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', ab: 'AB', ac: 'AC', ad: 'AD', ae: 'AE' },
    situacao_gr: { sem_consulta: 'Sem consulta', habilitado: 'Habilitado', vencido: 'Vencido' },
    tipo_endereco: { residencial: 'Residencial', comercial: 'Comercial', coleta_descarga: 'Coleta/descarga', cobranca: 'Cobrança', correspondencia: 'Correspondência' },
    tipo_telefone: { celular: 'Celular', residencial: 'Residencial', comercial: 'Comercial', fax: 'Fax', radio: 'Rádio' },
    tipo_conta: { corrente: 'Conta corrente', poupanca: 'Poupança', salario: 'Conta salário' },
    tipo_chave_pix: { cpf: 'CPF', cnpj: 'CNPJ', celular: 'Celular', email: 'E-mail', aleatoria: 'Chave aleatória' },
    tipo_referencia: { pessoal: 'Pessoal', comercial: 'Comercial' },
    acao: { insert: 'Inclusão', update: 'Alteração', delete: 'Exclusão', visualizacao: 'Visualização' },
  };
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  // tipos de arquivo que se aplicam a pessoa (tipo_arquivo.aplica_pessoa)
  const TIPOS_ARQ_PESSOA = ['CNH', 'COMP. RESIDÊNCIA', 'DOC PESSOAL', 'ANTT', 'ASSINATURA', 'CND', 'CONTRATO', 'FOTO', 'OUTROS'];

  /* ---------- dados extras (fictícios) ---------- */
  // campos de pessoa que dados.js não trouxe
  const comp = {
    p01: { raca_cor: 'parda', rg_emissao: '1997-06-10', dt_consulta_cpf: dia(-35) },
    p02: { raca_cor: 'branca', rg_emissao: '2002-03-21', dt_consulta_cpf: dia(-35), pai: 'Cláudio Bertoli' },
    p03: { raca_cor: 'branca', rg_emissao: '2008-09-02', dt_consulta_cpf: dia(-2), pai: 'Hélio Paz' },
    p04: { raca_cor: 'parda', rg_emissao: '2005-01-17', dt_consulta_cpf: dia(-60), pai: 'Jorge Machado' },
    p05: { raca_cor: 'nao_informado', dt_consulta_cpf: dia(-400) },
    p06: { raca_cor: 'preta', rg_emissao: '2011-04-08', dt_consulta_cpf: dia(-90), pai: 'Valter Arruda', nr_inss: '20914477310' },
    p07: { raca_cor: 'parda', dt_consulta_cpf: dia(-30) },
    p08: { raca_cor: 'branca', rg_emissao: '1988-11-30', dt_consulta_cpf: dia(-120), pai: 'Ernesto Fontana', nr_inss: '10288733419' },
  };
  Object.entries(comp).forEach(([id, c]) => { const p = N.pessoa(id); if (p) Object.keys(c).forEach((k) => { if (p[k] == null) p[k] = c[k]; }); });
  // campos de motorista que dados.js não trouxe
  const compMot = {
    p01: { cnh_observacao: 'EAR: exerce atividade remunerada.', dt_qualificacao_gmp: '2024-08-19', radio: '' },
    p02: { cnh_observacao: 'EAR: exerce atividade remunerada.' },
    p06: { cnh_renach: 'PR022918734', cnh_seguranca: '61045522903', cnh_formulario: '2290417785' },
  };
  Object.entries(compMot).forEach(([id, c]) => { const m = D.motoristas.find((x) => x.pessoa_id === id); if (m) Object.keys(c).forEach((k) => { if (m[k] == null) m[k] = c[k]; }); });

  // uma pessoa física que é só proprietária (para o caminho "cadastrar também como motorista")
  if (!N.pessoa('p12')) {
    D.pessoas.push({ id: 'p12', tipo: 'pf', nome: 'Gerson Vidal Prado', apelido: 'Gerson', cpf: cpf('276140385'), situacao_cadastro: 'normal', nascimento: '1976-02-11', rg: '6.114.902-5', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Odete Vidal', estado_civil: 'casado', grau_instrucao: 'medio_completo', sexo: 'masculino', naturalidade: 'Rolândia', naturalidade_uf: 'PR', situacao_cpf: 'regular' });
    D.proprietarios.push({ pessoa_id: 'p12', rntrc: '053390118', enquadramento_antt: 'tac', rntrc_emissao: '2018-04-12', rntrc_validade: dia(340), autoriza_desconto_inss: 'inss_sest_senat', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_saida' });
  }

  D.enderecos.push(
    { pessoa_id: 'p03', tipo: 'residencial', cep: '89801000', logradouro: 'Rua Marechal Bormann', numero: '1520', complemento: 'apto 32', bairro: 'Centro', cidade: 'Chapecó', uf: 'SC', principal: true },
    { pessoa_id: 'p04', tipo: 'residencial', cep: '86010000', logradouro: 'Rua Pará', numero: '880', bairro: 'Centro', cidade: 'Londrina', uf: 'PR', principal: true },
    { pessoa_id: 'p05', tipo: 'residencial', cep: '19010000', logradouro: 'Rua Doutor José Foz', numero: '211', bairro: 'Vila Marcondes', cidade: 'Presidente Prudente', uf: 'SP', principal: true },
    { pessoa_id: 'p06', tipo: 'residencial', cep: '87013000', logradouro: 'Avenida Brasil', numero: '4410', complemento: 'casa 2', bairro: 'Zona 1', cidade: 'Maringá', uf: 'PR', principal: true },
    { pessoa_id: 'p07', tipo: 'residencial', cep: '79800000', logradouro: 'Rua Hayel Bon Faker', numero: '75', bairro: 'Jardim Água Boa', cidade: 'Dourados', uf: 'MS', principal: true },
    { pessoa_id: 'p08', tipo: 'residencial', cep: '86181000', logradouro: 'Rua Pernambuco', numero: '602', bairro: 'Centro', cidade: 'Cambé', uf: 'PR', principal: true, ponto_referencia: 'em frente à praça da matriz' },
    { pessoa_id: 'p01', tipo: 'correspondencia', cep: '86700000', logradouro: 'Caixa Postal 118', numero: 's/n', bairro: 'Centro', cidade: 'Arapongas', uf: 'PR', principal: false },
  );
  D.telefones.push(
    { pessoa_id: 'p01', numero: '4332524410', tipo: 'residencial', whatsapp: false, principal: false, contato: 'Esposa, Márcia', restrito: true },
    { pessoa_id: 'p05', numero: '18997120334', tipo: 'celular', whatsapp: false, principal: true },
  );
  D.emails = D.emails || [];
  D.emails.push(
    { pessoa_id: 'p01', email: 'edson.figueira@exemplo.com', principal: true, recebe_cte: true },
    { pessoa_id: 'p04', email: 'silvana.machado@exemplo.com', principal: true, recebe_cte: false, observacao: 'Prefere WhatsApp.' },
    { pessoa_id: 'p08', email: 'fontana.transportes@exemplo.com', principal: true, recebe_cte: true },
  );
  D.referencias.push(
    { motorista_id: 'p04', tipo: 'comercial', nome: 'Expresso Tibagi', telefone: '4333297000', dt_referencia: dia(-180), observacao: 'Boa referência, 4 anos na empresa.' },
  );
  D.contas.push(
    { pessoa_id: 'p04', banco_codigo: '104', tipo: 'poupanca', agencia: '1873', conta: '00041127', conta_digito: '3', favorecido_nome: 'Rosa Correia', favorecido_documento: cpf('604112983'), principal: true, titular_confere: false },
    { pessoa_id: 'p06', banco_codigo: '260', tipo: 'corrente', agencia: '0001', conta: '8812047', conta_digito: '1', favorecido_nome: 'Juliano Mendes Arruda', favorecido_documento: N.pessoa('p06').cpf, principal: true, titular_confere: true },
  );
  D.pix.push(
    { pessoa_id: 'p04', tipo: 'celular', chave: '43999051470', principal: true, descricao: 'Celular da Silvana' },
    { pessoa_id: 'p06', tipo: 'aleatoria', chave: '7f3c2a91-0be4-4d6e-9a51-c28d04e7b113', principal: true },
  );
  // pix ligado à conta (conta_id): usamos o índice da conta como id no protótipo
  D.contas.forEach((c, i) => { if (!c.id) c.id = 'cb' + (i + 1); });
  D.pix.forEach((x) => { if (x.conta_id === undefined) { const c = D.contas.find((k) => k.pessoa_id === x.pessoa_id && k.principal); x.conta_id = c ? c.id : null; } });

  D.arquivos.push(
    { id: 'a21', tipo: 'DOC PESSOAL', pessoa_id: 'p01', nome_original: 'rg-edson-frente-verso.pdf', tamanho_bytes: 310000, validado_em: quando(900), validado_por: 'Rafaela', restrito: true, numero: '8.421.336-2' },
  );
  D.auditoria.push(
    { id: 9012, em: quando(2200), usuario: 'Rafaela', tabela: 'pessoa', registro_id: 'p01', acao: 'insert', resumo: 'Pessoa cadastrada (importada do ATUA)' },
    { id: 9013, em: quando(2199), usuario: 'Rafaela', tabela: 'motorista', registro_id: 'p01', acao: 'insert', resumo: 'Motorista cadastrado' },
    { id: 9018, em: quando(900), usuario: 'Rafaela', tabela: 'arquivo', registro_id: 'a01', acao: 'update', resumo: 'CNH conferida' },
    { id: 9026, em: quando(160), usuario: 'Carla', tabela: 'pessoa_chave_pix', registro_id: 'p01', acao: 'insert', resumo: 'Chave Pix CPF cadastrada' },
    { id: 9031, em: quando(52), usuario: 'Denílson', tabela: 'pessoa_telefone', registro_id: 'p01', acao: 'update', resumo: 'Telefone residencial marcado como restrito' },
    { id: 9033, em: quando(31), usuario: 'Matheus', tabela: 'arquivo', registro_id: 'a21', acao: 'visualizacao', resumo: 'Abriu rg-edson-frente-verso.pdf' },
    { id: 9029, em: quando(48), usuario: 'Rafaela', tabela: 'motorista_referencia', registro_id: 'p03', acao: 'insert', resumo: 'Referência comercial: Oeste Cargas Ltda' },
    { id: 9030, em: quando(47), usuario: 'Rafaela', tabela: 'motorista', registro_id: 'p03', acao: 'update', resumo: 'Situação do cadastro: pendente (CNH vencida)' },
    { id: 9025, em: quando(300), usuario: 'Rafaela', tabela: 'arquivo', registro_id: 'a06', acao: 'update', resumo: 'CNH conferida' },
    { id: 9027, em: quando(120), usuario: 'Carla', tabela: 'pessoa_conta_bancaria', registro_id: 'p04', acao: 'insert', resumo: 'Conta Caixa cadastrada (favorecido: Rosa Correia)' },
  );
  D.auditoria.sort((a, b) => (a.em < b.em ? 1 : -1));

  /* ---------- motoristas criados nesta sessão do protótipo (simulação) ---------- */
  const CHAVE = 'nilt.motoristas.novos';
  function lerNovos() { try { return JSON.parse(sessionStorage.getItem(CHAVE) || '[]'); } catch { return []; } }
  function guardarNovo(reg) { try { const l = lerNovos().filter((x) => x.pessoa.id !== reg.pessoa.id); l.push(reg); sessionStorage.setItem(CHAVE, JSON.stringify(l)); return true; } catch { return false; } }
  lerNovos().forEach((r) => {
    if (!N.pessoa(r.pessoa.id)) D.pessoas.push(r.pessoa);
    if (!D.motoristas.some((m) => m.pessoa_id === r.pessoa.id)) D.motoristas.push(r.motorista);
    (r.telefones || []).forEach((t) => D.telefones.push(t));
    (r.arquivos || []).forEach((a) => D.arquivos.push(a));
    (r.auditoria || []).forEach((a) => D.auditoria.unshift(a));
  });

  /* ---------- situação de validade e da gerenciadora ---------- */
  // cls: normal | vencendo (até 30 dias) | vencido | neutro (sem data)
  function estadoValidade(iso) {
    if (!iso) return { cls: 'neutro', dias: null, texto: 'sem validade' };
    const dias = N.diasAte(iso);
    const cls = dias < 0 ? 'vencido' : dias <= 30 ? 'vencendo' : 'normal';
    return { cls, dias, texto: N.fmt.dias(dias) };
  }
  // situação da gerenciadora de risco, com "vencendo" derivado da validade
  function estadoGr(m) {
    if (!m.situacao_gr || m.situacao_gr === 'sem_consulta') return { chave: 'sem_consulta', cls: 'neutro', rot: 'Sem consulta', sub: 'nunca consultado' };
    const v = estadoValidade(m.gr_validade);
    if (m.situacao_gr === 'vencido' || v.cls === 'vencido') return { chave: 'vencido', cls: 'vencido', rot: 'Vencido', sub: m.gr_validade ? `${N.fmt.dias(v.dias)}` : 'consulta vencida' };
    if (v.cls === 'vencendo') return { chave: 'vencendo', cls: 'vencendo', rot: 'Habilitado', sub: N.fmt.dias(v.dias) };
    return { chave: 'habilitado', cls: 'normal', rot: 'Habilitado', sub: m.gr_validade ? `até ${N.fmt.data(m.gr_validade)}` : 'sem validade' };
  }
  // marca de validade: losango/círculo + data, só ganha cor quando vence em até 30 dias ou já venceu
  function marcaValidade(iso, prefixo = '') {
    if (!iso) return '<span class="dash">—</span>';
    const e = estadoValidade(iso);
    const cls = e.cls === 'normal' ? '' : ` val-${e.cls}`;
    return `<span class="val${cls}">${prefixo}${N.fmt.data(iso)}</span>`;
  }

  const motorista = (id) => D.motoristas.find((m) => m.pessoa_id === id);
  const enderecoPrincipal = (id) => D.enderecos.find((e) => e.pessoa_id === id && e.principal) || D.enderecos.find((e) => e.pessoa_id === id);
  const telefonePrincipal = (id) => D.telefones.find((t) => t.pessoa_id === id && t.principal) || D.telefones.find((t) => t.pessoa_id === id);
  const cidade = (id) => { const e = enderecoPrincipal(id); return e ? `${e.cidade}/${e.uf}` : null; };
  // documentos com validade vencida ou vencendo em até 30 dias (CNH, gerenciadora ou arquivo)
  function docsAtencao(m) {
    const itens = [];
    const cnh = estadoValidade(m.cnh_validade); if (cnh.cls === 'vencido' || cnh.cls === 'vencendo') itens.push({ tipo: 'CNH', ...cnh });
    if (m.gr_validade && m.situacao_gr !== 'sem_consulta') { const g = estadoValidade(m.gr_validade); if (g.cls === 'vencido' || g.cls === 'vencendo') itens.push({ tipo: 'Consulta de risco', ...g }); }
    D.arquivos.filter((a) => a.pessoa_id === m.pessoa_id && a.validade && a.tipo !== 'CNH').forEach((a) => { const e = estadoValidade(a.validade); if (e.cls === 'vencido' || e.cls === 'vencendo') itens.push({ tipo: a.tipo, ...e }); });
    return itens;
  }
  // último veículo dirigido e conjunto atual
  function conjuntoAtual(id) { return D.conjuntos.find((c) => c.motorista_id === id) || null; }
  function ultimoVeiculo(id) {
    const c = conjuntoAtual(id); if (c) return N.veiculo(c.cavalo_id);
    const v = D.veiculos.find((x) => x.ultimo_motorista_id === id); if (v) return v;
    const h = (D.conjuntosHistorico || []).filter((x) => x.motorista_id === id).sort((a, b) => (a.fim < b.fim ? 1 : -1))[0];
    return h ? N.veiculo(h.cavalo_id) : null;
  }

  const opcoesSelect = (mapa, atual, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') + Object.entries(mapa).map(([k, v]) => `<option value="${k}"${k === atual ? ' selected' : ''}>${v}</option>`).join('');
  const opcoesUf = (atual) => '<option value="">UF</option>' + UFS.map((u) => `<option${u === atual ? ' selected' : ''}>${u}</option>`).join('');

  N.mot = { ROT, UFS, TIPOS_ARQ_PESSOA, cpf, estadoValidade, estadoGr, marcaValidade, motorista, enderecoPrincipal, telefonePrincipal, cidade, docsAtencao, conjuntoAtual, ultimoVeiculo, opcoesSelect, opcoesUf, lerNovos, guardarNovo, quando };
})();
