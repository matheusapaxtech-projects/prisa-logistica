/* NILT — proprietários: dados extras de demonstração (TODOS FICTÍCIOS) e utilidades das três telas
   (proprietarios.html, proprietario-novo.html, proprietario.html).
   Os campos usam os nomes das tabelas do banco (supabase/migrations 0400 e 0500). Três campos ainda
   não existem nas migrations e foram propostos com nome de coluna:
     pessoa.qualificacao_inss                 ('qualificado' | 'nao_qualificado' | 'com_pendencia')
     proprietario.frete_empresa_motorista_valor / frete_empresa_motorista_percentual
   Carrega depois de dados.js e antes de nilt.js. */
(function () {
  const N = window.NILT, D = N.dados, dia = N.dia;
  const quando = (horas) => new Date(Date.now() - horas * 3600e3).toISOString();
  const pessoa = (id) => D.pessoas.find((p) => p.id === id);
  const prop = (id) => D.proprietarios.find((p) => p.pessoa_id === id);

  /* ---------- campos que dados.js não traz ---------- */
  const extraProp = {
    p01: { alto_desempenho: false, qualificado_gmp: true, dt_qualificacao_gmp: '2024-03-11', limite_adiantamento_percentual: 80, limite_adiantamento_valor: 6000, frete_empresa_motorista_percentual: 92 },
    p08: { alto_desempenho: false, qualificado_gmp: false, limite_adiantamento_percentual: 70 },
    p09: { alto_desempenho: true, qualificado_gmp: true, dt_qualificacao_gmp: '2023-08-30', taxa_adm_valor: 35, limite_adiantamento_valor: 15000, frete_empresa_motorista_percentual: 88 },
    p10: { alto_desempenho: false, qualificado_gmp: false, taxa_adm_percentual: 3, limite_adiantamento_valor: 12000 },
    p11: { alto_desempenho: false, qualificado_gmp: false },
  };
  const extraPessoa = {
    p01: { raca_cor: 'parda', rg_emissao: '1998-06-10', dt_consulta_cpf: dia(-30), qualificacao_inss: 'qualificado', inscricao_estadual_isento: true },
    p08: { raca_cor: 'branca', rg_emissao: '1987-02-19', dt_consulta_cpf: dia(-95), nr_inss: '10833265407', qualificacao_inss: 'com_pendencia', inscricao_estadual_isento: true },
    p09: { inscricao_municipal: '48221-6', dt_consulta_simples: dia(-45), dt_consulta_brasilapi: quando(45 * 24) },
    p10: { inscricao_municipal: '1.204.773-0', dt_consulta_simples: dia(-200), dt_consulta_brasilapi: quando(200 * 24) },
    p11: { dt_consulta_brasilapi: quando(29.6) },
  };
  Object.entries(extraProp).forEach(([id, x]) => { const p = prop(id); if (p) Object.entries(x).forEach(([k, v]) => { if (p[k] == null) p[k] = v; }); });
  Object.entries(extraPessoa).forEach(([id, x]) => { const p = pessoa(id); if (p) Object.entries(x).forEach(([k, v]) => { if (p[k] == null) p[k] = v; }); });

  D.emails = D.emails || [];
  D.emails.push(
    { pessoa_id: 'p01', email: 'edson.figueira@email.exemplo', principal: true, recebe_cte: false, observacao: '' },
    { pessoa_id: 'p09', email: 'fiscal@tsc.exemplo', principal: true, recebe_cte: true, observacao: 'Recebe CT-e e contrato de frete' },
    { pessoa_id: 'p09', email: 'operacional@tsc.exemplo', principal: false, recebe_cte: false, observacao: '' },
    { pessoa_id: 'p10', email: 'frota@rodonorte.exemplo', principal: true, recebe_cte: true, observacao: '' },
  );
  D.enderecos.push(
    { pessoa_id: 'p08', tipo: 'residencial', cep: '86181000', logradouro: 'Rua Pará', numero: '77', bairro: 'Centro', cidade: 'Cambé', uf: 'PR', principal: true },
    { pessoa_id: 'p10', tipo: 'comercial', cep: '86020000', logradouro: 'Avenida Dez de Dezembro', numero: '4410', complemento: 'Barracão 2', bairro: 'Jardim Piza', cidade: 'Londrina', uf: 'PR', principal: true },
    { pessoa_id: 'p11', tipo: 'comercial', cep: '87013000', logradouro: 'Avenida Colombo', numero: '9120', bairro: 'Zona 7', cidade: 'Maringá', uf: 'PR', principal: true },
  );
  D.telefones.push(
    { pessoa_id: 'p10', numero: '4333271900', tipo: 'comercial', whatsapp: false, principal: true, contato: 'Frota' },
    { pessoa_id: 'p11', numero: '4430262215', tipo: 'comercial', whatsapp: false, principal: true, contato: 'Escritório' },
  );
  D.arquivos.push(
    { id: 'a51', tipo: 'ANTT', pessoa_id: 'p01', nome_original: 'rntrc-edson.pdf', tamanho_bytes: 134000, validade: dia(210), validado_em: quando(24 * 200), validado_por: 'Rafaela' },
    { id: 'a52', tipo: 'ANTT', pessoa_id: 'p10', nome_original: 'rntrc-rodo-norte.pdf', tamanho_bytes: 118000, validade: dia(-12), validado_em: quando(24 * 380), validado_por: 'Denílson' },
    { id: 'a53', tipo: 'CND', pessoa_id: 'p10', nome_original: 'cnd-federal-rodo-norte.pdf', tamanho_bytes: 96000, validade: dia(74) },
    { id: 'a54', tipo: 'CONTRATO', pessoa_id: 'p11', nome_original: 'contrato-social-ivai.pdf', tamanho_bytes: 1240000, restrito: true },
  );
  D.auditoria.push(
    { id: 8120, em: quando(3 * 24), usuario: 'Rafaela', tabela: 'arquivo', registro_id: 'a51', acao: 'visualizacao', resumo: 'Abriu rntrc-edson.pdf' },
    { id: 8031, em: quando(200 * 24), usuario: 'Rafaela', tabela: 'proprietario', registro_id: 'p01', acao: 'update', resumo: 'RNTRC renovado: nova validade' },
    { id: 8011, em: quando(9 * 24), usuario: 'Denílson', tabela: 'proprietario', registro_id: 'p08', acao: 'update', resumo: 'Autoriza desconto: INSS + Sest/Senat' },
    { id: 8104, em: quando(48), usuario: 'Rafaela', tabela: 'proprietario', registro_id: 'p09', acao: 'update', resumo: 'Limite de adiantamento: 60% para 70%' },
    { id: 8090, em: quando(45 * 24), usuario: 'Matheus', tabela: 'pessoa', registro_id: 'p09', acao: 'update', resumo: 'Dados atualizados pela Receita (BrasilAPI)' },
    { id: 7012, em: quando(400 * 24), usuario: 'Rafaela', tabela: 'proprietario', registro_id: 'p09', acao: 'insert', resumo: 'Proprietário cadastrado' },
    { id: 8101, em: quando(12 * 24), usuario: 'Denílson', tabela: 'proprietario', registro_id: 'p10', acao: 'update', resumo: 'Regra de pagamento: peso de saída' },
    { id: 9033, em: quando(29.6), usuario: 'Rafaela', tabela: 'pessoa', registro_id: 'p11', acao: 'insert', resumo: 'Empresa cadastrada pela consulta de CNPJ' },
    { id: 9032, em: quando(29.5), usuario: 'Rafaela', tabela: 'proprietario', registro_id: 'p11', acao: 'insert', resumo: 'Proprietário cadastrado sem RNTRC' },
  );

  /* ---------- criado nesta sessão (simulação do insert) ---------- */
  const CHAVE = 'nilt.proprietario.criado';
  let criado = null;
  try { criado = JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); } catch (e) { criado = null; }
  if (criado && criado.proprietario) {
    if (criado.pessoa && !pessoa(criado.pessoa.id)) D.pessoas.push(criado.pessoa);
    if (!prop(criado.proprietario.pessoa_id)) D.proprietarios.push(criado.proprietario);
    (criado.enderecos || []).forEach((e) => D.enderecos.push(e));
    (criado.telefones || []).forEach((t) => D.telefones.push(t));
    (criado.emails || []).forEach((t) => D.emails.push(t));
    D.auditoria.push({ id: 9990, em: criado.em, usuario: N.usuarioAtual.nome, tabela: 'proprietario', registro_id: criado.proprietario.pessoa_id, acao: 'insert', resumo: 'Proprietário cadastrado' });
  }

  /* ---------- utilidades ---------- */
  const ENQ = { tac: 'TAC', etc: 'ETC', ctc: 'CTC', etc_equiparado: 'ETC equiparado' };
  const ENQ_LONGO = { tac: 'TAC · transportador autônomo', etc: 'ETC · empresa de transporte', ctc: 'CTC · cooperativa', etc_equiparado: 'ETC equiparado' };
  function rntrcEstado(pr) {
    if (!pr || !pr.rntrc) return { estado: 'sem', dias: null };
    if (!pr.rntrc_validade) return { estado: 'sem_validade', dias: null };
    const dias = N.diasAte(pr.rntrc_validade);
    return { estado: dias < 0 ? 'vencido' : dias <= 30 ? 'vencendo' : 'ok', dias };
  }
  function veiculosDe(id) {
    const posse = D.veiculos.filter((v) => v.proprietario_posse_id === id);
    const documento = D.veiculos.filter((v) => v.proprietario_documento_id === id);
    const todos = D.veiculos.filter((v) => v.proprietario_posse_id === id || v.proprietario_documento_id === id);
    return { posse, documento, todos, arrendados: todos.filter((v) => v.arrendado) };
  }
  const ehMotorista = (id) => D.motoristas.some((m) => m.pessoa_id === id);
  function salvarCriado(reg) { try { sessionStorage.setItem(CHAVE, JSON.stringify(reg)); return true; } catch (e) { return false; } }

  N.prop = { pessoa, prop, ENQ, ENQ_LONGO, rntrcEstado, veiculosDe, ehMotorista, salvarCriado, criado };
})();
