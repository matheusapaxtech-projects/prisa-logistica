/* NILT — dados de demonstração (TODOS FICTÍCIOS).
   Os nomes de campo são os mesmos das tabelas do banco (supabase/migrations), para que a
   conversão em Next.js troque este arquivo por consultas ao Supabase sem renomear nada.
   Datas de validade são relativas a hoje, para o protótipo sempre mostrar vencimentos reais. */
(function () {
  const HOJE = new Date(); HOJE.setHours(0, 0, 0, 0);
  const dia = (n) => { const d = new Date(HOJE); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const quando = (horas) => new Date(Date.now() - horas * 3600e3).toISOString();

  // CPF/CNPJ válidos gerados a partir de uma base (fictícios)
  function cpf(base9) {
    const d = base9.split('').map(Number);
    for (const n of [9, 10]) {
      let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i);
      const r = (s * 10) % 11; d.push(r === 10 ? 0 : r);
    }
    return d.join('');
  }
  function cnpj(base12) {
    const d = base12.split('').map(Number);
    const pesos = [[5,4,3,2,9,8,7,6,5,4,3,2], [6,5,4,3,2,9,8,7,6,5,4,3,2]];
    for (const p of pesos) {
      const s = p.reduce((a, w, i) => a + w * d[i], 0);
      const r = s % 11; d.push(r < 2 ? 0 : 11 - r);
    }
    return d.join('');
  }

  const pessoas = [
    { id: 'p01', tipo: 'pf', nome: 'Edson Ramos Figueira', apelido: 'Edinho', cpf: cpf('318265904'), situacao_cadastro: 'normal', nascimento: '1979-03-14', rg: '8.421.336-2', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Lurdes Ramos', pai: 'Osvaldo Figueira', estado_civil: 'casado', grau_instrucao: 'medio_completo', sexo: 'masculino', naturalidade: 'Arapongas', naturalidade_uf: 'PR', nr_inss: '12765409831', situacao_cpf: 'regular' },
    { id: 'p02', tipo: 'pf', nome: 'Cláudio Bertoli Neto', apelido: 'Bertoli', cpf: cpf('407193526'), situacao_cadastro: 'normal', nascimento: '1984-11-02', rg: '9.110.205-7', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Ivone Bertoli', estado_civil: 'solteiro', grau_instrucao: 'medio_completo', sexo: 'masculino', naturalidade: 'Apucarana', naturalidade_uf: 'PR', situacao_cpf: 'regular' },
    { id: 'p03', tipo: 'pf', nome: 'Reinaldo Toledo Paz', apelido: 'Paz', cpf: cpf('225804117'), situacao_cadastro: 'pendente', nascimento: '1990-07-21', rg: '10.442.871-0', rg_orgao: 'SSP', rg_uf: 'SC', mae: 'Marta Toledo', estado_civil: 'casado', grau_instrucao: 'fundamental_completo', sexo: 'masculino', naturalidade: 'Chapecó', naturalidade_uf: 'SC', situacao_cpf: 'regular' },
    { id: 'p04', tipo: 'pf', nome: 'Silvana Correia Machado', apelido: 'Sil', cpf: cpf('519337260'), situacao_cadastro: 'normal', nascimento: '1987-01-30', rg: '7.903.118-4', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Rosa Correia', estado_civil: 'separado', grau_instrucao: 'medio_completo', sexo: 'feminino', naturalidade: 'Londrina', naturalidade_uf: 'PR', situacao_cpf: 'regular' },
    { id: 'p05', tipo: 'pf', nome: 'Adilson Pereira Gaspar', apelido: 'Gaspar', cpf: cpf('630418252'), situacao_cadastro: 'cancelado', nascimento: '1972-05-09', rg: '5.220.774-1', rg_orgao: 'SSP', rg_uf: 'SP', mae: 'Neusa Pereira', estado_civil: 'casado', grau_instrucao: 'fundamental_incompleto', sexo: 'masculino', naturalidade: 'Presidente Prudente', naturalidade_uf: 'SP', situacao_cpf: 'regular' },
    { id: 'p06', tipo: 'pf', nome: 'Juliano Mendes Arruda', apelido: 'Ju', cpf: cpf('742091638'), situacao_cadastro: 'normal', nascimento: '1993-09-17', rg: '11.320.506-9', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Célia Mendes', estado_civil: 'solteiro', grau_instrucao: 'medio_incompleto', sexo: 'masculino', naturalidade: 'Maringá', naturalidade_uf: 'PR', situacao_cpf: 'regular' },
    { id: 'p07', tipo: 'pf', nome: 'Marcos Vinícius Albuquerque', apelido: 'Albuquerque', cpf: cpf('153620849'), situacao_cadastro: 'pendente', nascimento: '1982-12-05', rg: '6.880.143-3', rg_orgao: 'SSP', rg_uf: 'MS', mae: 'Joana Albuquerque', estado_civil: 'casado', grau_instrucao: 'medio_completo', sexo: 'masculino', naturalidade: 'Dourados', naturalidade_uf: 'MS', situacao_cpf: 'regular' },
    { id: 'p08', tipo: 'pf', nome: 'Otávio Lacerda Fontana', apelido: 'Fontana', cpf: cpf('864275103'), situacao_cadastro: 'normal', nascimento: '1969-04-27', rg: '4.310.992-8', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Ana Lacerda', estado_civil: 'viuvo', grau_instrucao: 'fundamental_completo', sexo: 'masculino', naturalidade: 'Cambé', naturalidade_uf: 'PR', situacao_cpf: 'regular', nr_dependentes: 2 },
    { id: 'p12', tipo: 'pf', nome: 'Gerson Vidal Prado', apelido: 'Gerson', cpf: cpf('276140385'), situacao_cadastro: 'normal', nascimento: '1976-02-11', rg: '6.114.902-5', rg_orgao: 'SSP', rg_uf: 'PR', mae: 'Odete Vidal', estado_civil: 'casado', grau_instrucao: 'medio_completo', sexo: 'masculino', naturalidade: 'Rolândia', naturalidade_uf: 'PR', situacao_cpf: 'regular' },
    // proprietários pessoa jurídica (empresas fictícias)
    { id: 'p09', tipo: 'pj', nome: 'Transportes Serra do Cadeado Ltda', nome_fantasia: 'TSC Transportes', cnpj: cnpj('453218760001'), situacao_cadastro: 'normal', fundacao: '2009-08-11', natureza_juridica: '206-2 Sociedade Empresária Limitada', cnae_principal: '4930-2/02 Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional', optante_simples: false, inscricao_estadual: '90544712-03' },
    { id: 'p10', tipo: 'pj', nome: 'Rodo Norte Pioneiro Logística Ltda', nome_fantasia: 'Rodo Norte', cnpj: cnpj('287605194001'), situacao_cadastro: 'normal', fundacao: '2015-02-23', natureza_juridica: '206-2 Sociedade Empresária Limitada', cnae_principal: '4930-2/02 Transporte rodoviário de carga, intermunicipal, interestadual e internacional', optante_simples: true, inscricao_estadual: '90711236-48' },
    { id: 'p11', tipo: 'pj', nome: 'Locadora de Implementos Ivaí Ltda', nome_fantasia: 'Ivaí Implementos', cnpj: cnpj('610934528001'), situacao_cadastro: 'pendente', fundacao: '2018-06-04', natureza_juridica: '206-2 Sociedade Empresária Limitada', cnae_principal: '7719-5/99 Locação de outros meios de transporte não especificados anteriormente, sem condutor', optante_simples: false, inscricao_estadual_isento: true },
  ];

  const motoristas = [
    { pessoa_id: 'p01', cnh_registro: '04817265530', cnh_categoria: 'e', cnh_validade: dia(412), cnh_emissao: '2021-05-18', cnh_primeira_habilitacao: '1999-08-02', cnh_renach: 'PR015544210', cnh_seguranca: '73312658804', cnh_formulario: '2215548766', cnh_cidade_emissao: 'Apucarana', cnh_uf: 'PR', situacao_cadastro: 'normal', situacao_gr: 'habilitado', gr_validade: dia(64), qualificado_gmp: true },
    { pessoa_id: 'p02', cnh_registro: '05523190876', cnh_categoria: 'e', cnh_validade: dia(18), cnh_emissao: '2021-10-04', cnh_primeira_habilitacao: '2005-03-15', cnh_cidade_emissao: 'Apucarana', cnh_uf: 'PR', situacao_cadastro: 'normal', situacao_gr: 'habilitado', gr_validade: dia(9) },
    { pessoa_id: 'p03', cnh_registro: '06612904417', cnh_categoria: 'd', cnh_validade: dia(-6), cnh_emissao: '2016-09-22', cnh_primeira_habilitacao: '2010-01-11', cnh_cidade_emissao: 'Chapecó', cnh_uf: 'SC', situacao_cadastro: 'pendente', situacao_gr: 'sem_consulta' },
    { pessoa_id: 'p04', cnh_registro: '03990128745', cnh_categoria: 'e', cnh_validade: dia(780), cnh_emissao: '2023-02-14', cnh_primeira_habilitacao: '2008-06-30', cnh_cidade_emissao: 'Londrina', cnh_uf: 'PR', situacao_cadastro: 'normal', situacao_gr: 'habilitado', gr_validade: dia(120) },
    { pessoa_id: 'p05', cnh_registro: '02218476650', cnh_categoria: 'e', cnh_validade: dia(-210), cnh_emissao: '2014-01-08', cnh_primeira_habilitacao: '1994-11-19', cnh_cidade_emissao: 'Presidente Prudente', cnh_uf: 'SP', situacao_cadastro: 'cancelado', situacao_gr: 'vencido', gr_validade: dia(-190) },
    { pessoa_id: 'p06', cnh_registro: '07741230998', cnh_categoria: 'e', cnh_validade: dia(1040), cnh_emissao: '2024-04-02', cnh_primeira_habilitacao: '2014-02-20', cnh_cidade_emissao: 'Maringá', cnh_uf: 'PR', situacao_cadastro: 'normal', situacao_gr: 'habilitado', gr_validade: dia(27) },
    { pessoa_id: 'p07', cnh_registro: '05107783342', cnh_categoria: 'e', cnh_validade: dia(301), cnh_emissao: '2020-07-29', cnh_primeira_habilitacao: '2003-09-08', cnh_cidade_emissao: 'Dourados', cnh_uf: 'MS', situacao_cadastro: 'pendente', situacao_gr: 'sem_consulta' },
    { pessoa_id: 'p08', cnh_registro: '01654490213', cnh_categoria: 'e', cnh_validade: dia(46), cnh_emissao: '2018-11-12', cnh_primeira_habilitacao: '1991-05-06', cnh_cidade_emissao: 'Cambé', cnh_uf: 'PR', situacao_cadastro: 'normal', situacao_gr: 'habilitado', gr_validade: dia(80) },
  ];

  const proprietarios = [
    { pessoa_id: 'p01', rntrc: '052177340', enquadramento_antt: 'tac', rntrc_emissao: '2019-03-02', rntrc_validade: dia(210), autoriza_desconto_inss: 'inss_sest_senat', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_chegada_se_menor' },
    { pessoa_id: 'p08', rntrc: '048812295', enquadramento_antt: 'tac', rntrc_emissao: '2017-10-20', rntrc_validade: dia(23), autoriza_desconto_inss: 'inss_sest_senat', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_saida' },
    { pessoa_id: 'p09', rntrc: '061190473', enquadramento_antt: 'etc', rntrc_emissao: '2020-05-14', rntrc_validade: dia(530), responsavel_nome: 'Gilberto Saldanha', responsavel_telefone: '43998127766', responsavel_whatsapp: true, responsavel_email: 'operacional@tsc.exemplo', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_chegada_com_tolerancia', taxa_adm_percentual: 2.5, limite_adiantamento_percentual: 70 },
    { pessoa_id: 'p10', rntrc: '058834016', enquadramento_antt: 'etc', rntrc_emissao: '2021-01-09', rntrc_validade: dia(-12), responsavel_nome: 'Patrícia Okamoto', responsavel_telefone: '43991540028', responsavel_whatsapp: true, responsavel_email: 'frota@rodonorte.exemplo', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_saida', limite_adiantamento_percentual: 60 },
    { pessoa_id: 'p12', rntrc: '053390118', enquadramento_antt: 'tac', rntrc_emissao: '2018-04-12', rntrc_validade: dia(340), autoriza_desconto_inss: 'inss_sest_senat', situacao_cadastro: 'normal', regra_pgto_frete: 'peso_saida' },
    { pessoa_id: 'p11', rntrc: '', enquadramento_antt: 'etc_equiparado', responsavel_nome: 'Fábio Tanaka', responsavel_telefone: '43988201174', responsavel_whatsapp: false, situacao_cadastro: 'pendente' },
  ];

  // ids de tipo_veiculo e marca_veiculo = carga do banco (EV-001)
  const tipos = {
    6: { nome: 'CAVALO SIMPLES - 2 EIXOS', categoria: 'cavalo', eixos: 2, configuracao_cavalo: 'toco' },
    7: { nome: 'CAVALO TRUCADO - 3 EIXOS', categoria: 'cavalo', eixos: 3, configuracao_cavalo: 'trucado' },
    11: { nome: 'CARRETA BAU - 3 EIXOS', categoria: 'carreta', eixos: 3 },
    14: { nome: 'CARRETA BASCULANTE - 3 EIXOS', categoria: 'carreta', eixos: 3 },
    10: { nome: 'CARRETA GRANELEIRO TRUCADA - 3 EIXOS', categoria: 'carreta', eixos: 3 },
    8: { nome: 'CARRETA SIDER - 3 EIXOS', categoria: 'carreta', eixos: 3 },
    18: { nome: 'DOLLY - 2 EIXOS', categoria: 'dolly', eixos: 2 },
    31: { nome: 'TRUCK - 3 EIXOS', categoria: 'caminhao', eixos: 3 },
  };

  const veiculos = [
    { id: 'v01', placa: 'BRA2E19', tipo_veiculo_id: 7, marca: 'SCANIA', modelo: 'R 450 A6x4', ano_fabricacao: 2021, ano_modelo: 2022, cor: 'Branca', renavam: '01283746590', chassi: '9BSR6X40003947712', proprietario_posse_id: 'p01', proprietario_documento_id: 'p01', situacao_operacional: 'ativo', situacao_cadastro: 'normal', cmt_t: 74, pbt_t: 23, tara_t: 9.4, tag_numero: '0014 7751 2290', tag_operadora: 'PAMCARD TAG SEM PARAR', seguro_validade: dia(142), venc_ipva: dia(160), exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Arapongas', rastreador_empresa: 'Onixsat', rastreamento_tipo: 'rastreador', rastreador_numero: '771205', ultimo_motorista_id: 'p01' },
    { id: 'v02', placa: 'QHT4C27', tipo_veiculo_id: 7, marca: 'VOLVO', modelo: 'FH 540 6x4', ano_fabricacao: 2022, ano_modelo: 2023, cor: 'Azul', renavam: '01309821446', chassi: '9BVAX40D5NE912884', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', cmt_t: 91, pbt_t: 23, tara_t: 9.9, tag_numero: '0022 1408 3317', tag_operadora: 'PAMCARD TAG VELOE', seguro_validade: dia(31), venc_ipva: dia(160), exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana', rastreamento_tipo: 'telemonitorado', ultimo_motorista_id: 'p04' },
    { id: 'v03', placa: 'AYK8813', tipo_veiculo_id: 6, marca: 'MERCEDES-BENZ', modelo: 'Axor 2036', ano_fabricacao: 2012, ano_modelo: 2012, cor: 'Vermelha', renavam: '00470021938', chassi: '9BM958074CB802216', proprietario_posse_id: 'p08', proprietario_documento_id: 'p08', situacao_operacional: 'ativo', situacao_cadastro: 'normal', cmt_t: 50, pbt_t: 16, tara_t: 7.1, exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Cambé', ultimo_motorista_id: 'p08' },
    { id: 'v04', placa: 'RTU1F45', tipo_veiculo_id: 7, marca: 'DAF', modelo: 'XF 530 FTT', ano_fabricacao: 2023, ano_modelo: 2024, cor: 'Branca', renavam: '01344572018', chassi: '9AFX530T0PR118450', proprietario_posse_id: 'p11', proprietario_documento_id: 'p10', situacao_operacional: 'arrendado', situacao_cadastro: 'pendente', cmt_t: 80, pbt_t: 23, tara_t: 9.6, tag_numero: '0031 5502 8812', tag_operadora: 'PAMCARD TAG CONECTCAR', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Maringá', ultimo_motorista_id: 'p06' },
    { id: 'v05', placa: 'MLC3D08', tipo_veiculo_id: 7, marca: 'SCANIA', modelo: 'G 410 6x2', ano_fabricacao: 2019, ano_modelo: 2019, cor: 'Prata', renavam: '01170352291', chassi: '9BSG6X20003871150', proprietario_posse_id: 'p10', proprietario_documento_id: 'p10', situacao_operacional: 'parado', situacao_cadastro: 'normal', cmt_t: 60, pbt_t: 23, tara_t: 9.1, exercicio_doc: 2025, uf_emplacamento: 'PR', cidade_emplacamento: 'Londrina' },
    { id: 'v11', placa: 'BRA7G33', tipo_veiculo_id: 11, marca: 'RANDON', modelo: 'Furgão SR 3E', ano_fabricacao: 2021, ano_modelo: 2021, cor: 'Branca', renavam: '01284419027', chassi: '9ADB1243XMM441872', proprietario_posse_id: 'p01', proprietario_documento_id: 'p01', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 45, tara_t: 8.4, comprimento_m: 15.4, largura_m: 2.6, altura_m: 2.9, tipo_assoalho: 'madeira', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Arapongas' },
    { id: 'v12', placa: 'QHX2A61', tipo_veiculo_id: 10, marca: 'LIBRELATO', modelo: 'Graneleiro 3E', ano_fabricacao: 2022, ano_modelo: 2022, cor: 'Branca', renavam: '01311097845', chassi: '9EP04123XN1007734', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 45, tara_t: 7.8, tipo_assoalho: 'ferro', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana' },
    { id: 'v13', placa: 'QHX2A62', tipo_veiculo_id: 18, marca: 'LIBRELATO', modelo: 'Dolly 2E', ano_fabricacao: 2022, ano_modelo: 2022, cor: 'Branca', renavam: '01311097912', chassi: '9EP02120XN1007781', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 12, tara_t: 3.1, exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana' },
    { id: 'v14', placa: 'QHX2A63', tipo_veiculo_id: 10, marca: 'LIBRELATO', modelo: 'Graneleiro 3E', ano_fabricacao: 2022, ano_modelo: 2022, cor: 'Branca', renavam: '01311098003', chassi: '9EP04123XN1007790', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 45, tara_t: 7.8, tipo_assoalho: 'ferro', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana' },
    { id: 'v15', placa: 'AZB5527', tipo_veiculo_id: 14, marca: 'FACCHINI', modelo: 'Basculante 3E', ano_fabricacao: 2013, ano_modelo: 2013, cor: 'Vermelha', renavam: '00512276349', chassi: '94UBS0330DF062214', proprietario_posse_id: 'p08', proprietario_documento_id: 'p08', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 40, tara_t: 8.9, tipo_assoalho: 'ferro', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Cambé' },
    { id: 'v16', placa: 'RTV6H10', tipo_veiculo_id: 8, marca: 'KRONE', modelo: 'Sider SD 3E', ano_fabricacao: 2023, ano_modelo: 2023, cor: 'Cinza', renavam: '01345120086', chassi: '9AA073SD0PR220419', proprietario_posse_id: 'p11', proprietario_documento_id: 'p10', situacao_operacional: 'arrendado', situacao_cadastro: 'pendente', pbt_t: 45, tara_t: 8.1, exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Maringá' },
    { id: 'v17', placa: 'MLD9B44', tipo_veiculo_id: 11, marca: 'GUERRA', modelo: 'Furgão 3E', ano_fabricacao: 2018, ano_modelo: 2018, cor: 'Branca', renavam: '01088265412', chassi: '9AGBF3330JR301157', proprietario_posse_id: 'p10', proprietario_documento_id: 'p10', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 45, tara_t: 8.7, exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Londrina' },
    { id: 'v18', placa: 'RTX3C58', tipo_veiculo_id: 10, marca: 'RANDON', modelo: 'Graneleiro 3E', ano_fabricacao: 2024, ano_modelo: 2024, cor: 'Branca', renavam: '01362240915', chassi: '9ADG1243XRM556201', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 45, tara_t: 7.6, tipo_assoalho: 'ferro', exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana' },
    { id: 'v19', placa: 'RTX3C59', tipo_veiculo_id: 18, marca: 'RANDON', modelo: 'Dolly 2E', ano_fabricacao: 2024, ano_modelo: 2024, cor: 'Branca', renavam: '01362241008', chassi: '9ADD1220XRM556244', proprietario_posse_id: 'p09', proprietario_documento_id: 'p09', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 12, tara_t: 3.0, exercicio_doc: 2026, uf_emplacamento: 'PR', cidade_emplacamento: 'Apucarana' },
    { id: 'v21', placa: 'BCP0E72', tipo_veiculo_id: 31, marca: 'VOLKSWAGEN', modelo: 'Constellation 24.280', ano_fabricacao: 2020, ano_modelo: 2020, cor: 'Branca', renavam: '01201983355', chassi: '9536G8241LR021648', proprietario_posse_id: 'p01', proprietario_documento_id: 'p01', situacao_operacional: 'ativo', situacao_cadastro: 'normal', pbt_t: 23, tara_t: 8.2, exercicio_doc: 2025, uf_emplacamento: 'PR', cidade_emplacamento: 'Arapongas' },
  ];

  const conjuntos = [
    { id: 'c01', cavalo_id: 'v01', motorista_id: 'p01', inicio: dia(-40), itens: ['v11'] },
    { id: 'c02', cavalo_id: 'v02', motorista_id: 'p04', inicio: dia(-12), itens: ['v12', 'v13', 'v14'] },
    { id: 'c03', cavalo_id: 'v03', motorista_id: 'p08', inicio: dia(-95), itens: ['v15'] },
    { id: 'c04', cavalo_id: 'v04', motorista_id: 'p06', inicio: dia(-3), itens: ['v16'] },
  ];
  const conjuntosHistorico = [
    { id: 'c00', cavalo_id: 'v02', motorista_id: 'p02', inicio: dia(-70), fim: dia(-12), itens: ['v17'] },
  ];

  const tiposArquivo = ['ANTT', 'ASSINATURA', 'CARIMBO', 'CND', 'CNH', 'COMP. RESIDÊNCIA', 'CONTRATO', 'CRV / DUT', 'CRLV', 'DOC PESSOAL', 'FOTO', 'FOTO CONJUNTO', 'LOGO', 'OUTROS'];
  const arquivos = [
    { id: 'a01', tipo: 'CNH', pessoa_id: 'p01', nome_original: 'cnh-edson.pdf', tamanho_bytes: 412000, validade: dia(412), validado_em: quando(900), validado_por: 'Rafaela' },
    { id: 'a02', tipo: 'COMP. RESIDÊNCIA', pessoa_id: 'p01', nome_original: 'conta-luz-set.pdf', tamanho_bytes: 188000, validado_em: quando(900), validado_por: 'Rafaela' },
    { id: 'a03', tipo: 'CNH', pessoa_id: 'p02', nome_original: 'cnh-claudio.jpg', tamanho_bytes: 902000, validade: dia(18) },
    { id: 'a04', tipo: 'COMP. RESIDÊNCIA', pessoa_id: 'p02', nome_original: 'agua-agosto.pdf', tamanho_bytes: 140000 },
    { id: 'a05', tipo: 'CNH', pessoa_id: 'p03', nome_original: 'cnh-reinaldo.jpg', tamanho_bytes: 760000, validade: dia(-6) },
    { id: 'a06', tipo: 'CNH', pessoa_id: 'p04', nome_original: 'cnh-silvana.pdf', tamanho_bytes: 398000, validade: dia(780), validado_em: quando(300), validado_por: 'Rafaela' },
    { id: 'a07', tipo: 'COMP. RESIDÊNCIA', pessoa_id: 'p04', nome_original: 'internet-set.pdf', tamanho_bytes: 205000 },
    { id: 'a08', tipo: 'CNH', pessoa_id: 'p06', nome_original: 'cnh-juliano.pdf', tamanho_bytes: 377000, validade: dia(1040) },
    { id: 'a09', tipo: 'COMP. RESIDÊNCIA', pessoa_id: 'p06', nome_original: 'aluguel-recibo.pdf', tamanho_bytes: 96000 },
    { id: 'a10', tipo: 'CNH', pessoa_id: 'p08', nome_original: 'cnh-otavio.pdf', tamanho_bytes: 420000, validade: dia(46) },
    { id: 'a11', tipo: 'COMP. RESIDÊNCIA', pessoa_id: 'p08', nome_original: 'conta-luz.pdf', tamanho_bytes: 177000 },
    { id: 'a12', tipo: 'ANTT', pessoa_id: 'p09', nome_original: 'rntrc-tsc.pdf', tamanho_bytes: 120000, validade: dia(530) },
    { id: 'a13', tipo: 'CRLV', veiculo_id: 'v01', nome_original: 'crlv-bra2e19.pdf', tamanho_bytes: 230000, validade: dia(160) },
    { id: 'a14', tipo: 'CRLV', veiculo_id: 'v02', nome_original: 'crlv-qht4c27.pdf', tamanho_bytes: 241000, validade: dia(160) },
    { id: 'a15', tipo: 'CONTRATO', veiculo_id: 'v16', nome_original: 'contrato-arrendamento-rtv6h10.pdf', tamanho_bytes: 655000, validade: dia(300), restrito: true },
    { id: 'a16', tipo: 'FOTO CONJUNTO', veiculo_id: 'v02', nome_original: 'rodotrem-lateral.jpg', tamanho_bytes: 1830000 },
  ];

  const enderecos = [
    { pessoa_id: 'p01', tipo: 'residencial', cep: '86700000', logradouro: 'Rua das Perdizes', numero: '312', bairro: 'Jardim Bandeirantes', cidade: 'Arapongas', uf: 'PR', principal: true },
    { pessoa_id: 'p02', tipo: 'residencial', cep: '86800000', logradouro: 'Rua Ponta Grossa', numero: '1048', bairro: 'Vila Nova', cidade: 'Apucarana', uf: 'PR', principal: true },
    { pessoa_id: 'p12', tipo: 'residencial', cep: '86600000', logradouro: 'Rua Ceará', numero: '93', bairro: 'Centro', cidade: 'Rolândia', uf: 'PR', principal: true },
    { pessoa_id: 'p09', tipo: 'comercial', cep: '86800000', logradouro: 'Rodovia BR-376, km 254', numero: 's/n', bairro: 'Parque Industrial', cidade: 'Apucarana', uf: 'PR', principal: true },
  ];
  const telefones = [
    { pessoa_id: 'p01', numero: '43998401122', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p02', numero: '43996612708', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p03', numero: '49991208833', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p04', numero: '43999051470', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p06', numero: '44998772214', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p07', numero: '67996330045', tipo: 'celular', whatsapp: false, principal: true },
    { pessoa_id: 'p08', numero: '43991117650', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p12', numero: '43999214567', tipo: 'celular', whatsapp: true, principal: true },
    { pessoa_id: 'p09', numero: '4334221800', tipo: 'comercial', whatsapp: false, principal: true, contato: 'Recepção' },
  ];
  const referencias = [
    { motorista_id: 'p01', tipo: 'comercial', nome: 'Transportadora Vale do Pirapó', telefone: '4432261100', dt_referencia: dia(-400), observacao: 'Trabalhou 6 anos, saiu por conta própria.' },
    { motorista_id: 'p01', tipo: 'pessoal', nome: 'Wagner Lopes', telefone: '43998120056', dt_referencia: dia(-400) },
    { motorista_id: 'p03', tipo: 'comercial', nome: 'Oeste Cargas Ltda', telefone: '4933220917', dt_referencia: dia(-2), observacao: 'Aguardando retorno do RH.' },
  ];
  const bancos = { '001': 'Banco do Brasil', '104': 'Caixa Econômica Federal', '237': 'Bradesco', '341': 'Itaú', '748': 'Sicredi', '756': 'Sicoob', '260': 'Nubank' };
  const contas = [
    { pessoa_id: 'p01', banco_codigo: '748', tipo: 'corrente', agencia: '0712', conta: '38104', conta_digito: '6', favorecido_nome: 'Edson Ramos Figueira', favorecido_documento: null, principal: true },
    { pessoa_id: 'p09', banco_codigo: '341', tipo: 'corrente', agencia: '1408', conta: '22719', conta_digito: '0', favorecido_nome: 'Transportes Serra do Cadeado Ltda', favorecido_documento: null, principal: true },
    { pessoa_id: 'p10', banco_codigo: '756', tipo: 'corrente', agencia: '3309', conta: '104422', conta_digito: '8', favorecido_nome: 'Patrícia Okamoto', favorecido_documento: cpf('905117364'), principal: true },
  ];
  // documentos do favorecido iguais aos da pessoa quando não informados
  contas.forEach((c) => {
    const p = pessoas.find((x) => x.id === c.pessoa_id);
    if (!c.favorecido_documento) c.favorecido_documento = p.cpf || p.cnpj;
    c.titular_confere = c.favorecido_documento === (p.cpf || p.cnpj);
  });
  const pix = [
    { pessoa_id: 'p01', tipo: 'cpf', chave: pessoas[0].cpf, principal: true, descricao: 'Recebimento de frete' },
    { pessoa_id: 'p09', tipo: 'cnpj', chave: pessoas[8].cnpj, principal: true },
  ];

  const usuarios = [
    { user_id: 'u1', nome: 'Matheus', email: 'matheus@prisa.exemplo', papel: 'admin', ativo: true, ultimo_acesso: quando(0.2) },
    { user_id: 'u2', nome: 'Rafaela', email: 'rafaela@prisa.exemplo', papel: 'operacao', ativo: true, ultimo_acesso: quando(3) },
    { user_id: 'u3', nome: 'Denílson', email: 'denilson@prisa.exemplo', papel: 'operacao', ativo: true, ultimo_acesso: quando(26) },
    { user_id: 'u4', nome: 'Carla', email: 'carla@prisa.exemplo', papel: 'financeiro', ativo: true, ultimo_acesso: quando(50) },
    { user_id: 'u5', nome: 'Henrique', email: 'henrique@prisa.exemplo', papel: 'leitura', ativo: false, ultimo_acesso: quando(700) },
    { user_id: 'u6', nome: null, email: 'novo.operador@prisa.exemplo', papel: null, ativo: false, ultimo_acesso: null },
  ];

  const auditoria = [
    { id: 9041, em: quando(0.4), usuario: 'Rafaela', tabela: 'motorista', registro_id: 'p02', acao: 'update', resumo: 'CNH: validade alterada' },
    { id: 9040, em: quando(0.9), usuario: 'Rafaela', tabela: 'arquivo', registro_id: 'a03', acao: 'visualizacao', resumo: 'Abriu cnh-claudio.jpg' },
    { id: 9039, em: quando(2.5), usuario: 'Denílson', tabela: 'conjunto', registro_id: 'c04', acao: 'insert', resumo: 'Conjunto RTU1F45 + RTV6H10 aberto' },
    { id: 9038, em: quando(2.6), usuario: 'Denílson', tabela: 'conjunto', registro_id: 'c00', acao: 'update', resumo: 'Conjunto anterior encerrado' },
    { id: 9037, em: quando(5), usuario: 'Carla', tabela: 'pessoa_conta_bancaria', registro_id: 'p10', acao: 'insert', resumo: 'Conta Sicoob cadastrada' },
    { id: 9036, em: quando(27), usuario: 'Matheus', tabela: 'perfil_usuario', registro_id: 'u5', acao: 'update', resumo: 'Usuário desativado' },
    { id: 9035, em: quando(29), usuario: 'Rafaela', tabela: 'veiculo', registro_id: 'v16', acao: 'insert', resumo: 'Veículo RTV6H10 cadastrado' },
    { id: 9034, em: quando(30), usuario: 'Rafaela', tabela: 'pessoa', registro_id: 'p07', acao: 'insert', resumo: 'Pessoa cadastrada' },
  ];

  // ---------- derivados (o banco calcula com views; aqui calculamos igual) ----------
  const pessoa = (id) => pessoas.find((p) => p.id === id);
  const veiculo = (id) => veiculos.find((v) => v.id === id);
  veiculos.forEach((v) => {
    const t = tipos[v.tipo_veiculo_id];
    v.tipo = t.nome; v.categoria = t.categoria; v.eixos = t.eixos; v.configuracao_cavalo = t.configuracao_cavalo || null;
    v.arrendado = v.proprietario_posse_id !== v.proprietario_documento_id;
    v.capacidade_carga_t = v.capacidade_carga_t ?? (v.pbt_t != null && v.tara_t != null ? +(v.pbt_t - v.tara_t).toFixed(1) : null);
  });
  const temArquivo = (campo, id, tipo) => arquivos.some((a) => a[campo] === id && a.tipo === tipo);

  // v_pendencias_documentos
  const pendencias = [];
  veiculos.filter((v) => v.arrendado && !temArquivo('veiculo_id', v.id, 'CONTRATO'))
    .forEach((v) => pendencias.push({ tipo_pendencia: 'veiculo_arrendado_sem_contrato', veiculo_id: v.id, texto: `Arrendado sem contrato anexado` }));
  arquivos.filter((a) => a.validade && a.validade < dia(0))
    .forEach((a) => pendencias.push({ tipo_pendencia: 'arquivo_vencido', arquivo_id: a.id, pessoa_id: a.pessoa_id, veiculo_id: a.veiculo_id, texto: `${a.tipo} vencido` }));
  motoristas.filter((m) => m.situacao_cadastro !== 'cancelado' && !temArquivo('pessoa_id', m.pessoa_id, 'CNH'))
    .forEach((m) => pendencias.push({ tipo_pendencia: 'motorista_sem_cnh', pessoa_id: m.pessoa_id, texto: 'Sem CNH anexada' }));
  motoristas.filter((m) => m.situacao_cadastro !== 'cancelado' && !temArquivo('pessoa_id', m.pessoa_id, 'COMP. RESIDÊNCIA'))
    .forEach((m) => pendencias.push({ tipo_pendencia: 'motorista_sem_comprovante', pessoa_id: m.pessoa_id, texto: 'Sem comprovante de residência' }));

  // v_vencimentos (próximos e vencidos)
  const vencimentos = [];
  const diasAte = (iso) => Math.round((new Date(iso + 'T00:00:00') - HOJE) / 864e5);
  motoristas.filter((m) => m.situacao_cadastro !== 'cancelado').forEach((m) => {
    if (m.cnh_validade) vencimentos.push({ tipo: 'CNH', pessoa_id: m.pessoa_id, data: m.cnh_validade });
    if (m.gr_validade) vencimentos.push({ tipo: 'Consulta de risco', pessoa_id: m.pessoa_id, data: m.gr_validade });
  });
  proprietarios.forEach((p) => { if (p.rntrc_validade) vencimentos.push({ tipo: 'RNTRC', pessoa_id: p.pessoa_id, data: p.rntrc_validade }); });
  veiculos.forEach((v) => {
    if (v.seguro_validade) vencimentos.push({ tipo: 'Seguro', veiculo_id: v.id, data: v.seguro_validade });
    if (v.venc_ipva) vencimentos.push({ tipo: 'IPVA', veiculo_id: v.id, data: v.venc_ipva });
  });
  vencimentos.forEach((x) => { x.dias = diasAte(x.data); });
  vencimentos.sort((a, b) => a.dias - b.dias);

  // documentos vencidos, sem repetir: vencimentos do cadastro + arquivos vencidos que não sejam o mesmo documento
  const documentosVencidos = vencimentos.filter((v) => v.dias < 0).map((v) => ({ ...v }));
  arquivos.filter((a) => a.validade && a.validade < dia(0)).forEach((a) => {
    const mesmo = documentosVencidos.some((v) => v.tipo === a.tipo && (v.pessoa_id || null) === (a.pessoa_id || null) && (v.veiculo_id || null) === (a.veiculo_id || null));
    if (!mesmo) documentosVencidos.push({ tipo: a.tipo, pessoa_id: a.pessoa_id, veiculo_id: a.veiculo_id, data: a.validade, dias: diasAte(a.validade), arquivo_id: a.id });
  });

  // capacidade do conjunto (v_conjunto_capacidade)
  function capacidadeConjunto(c) {
    const cav = veiculo(c.cavalo_id);
    const pecas = c.itens.map(veiculo);
    const tara = +(cav.tara_t + pecas.reduce((s, p) => s + (p.tara_t || 0), 0)).toFixed(1);
    const cap = +pecas.filter((p) => p.categoria === 'carreta').reduce((s, p) => s + (p.capacidade_carga_t || 0), 0).toFixed(1);
    const limite = cav.cmt_t != null ? +(cav.cmt_t - tara).toFixed(1) : null;
    return { cmt_t: cav.cmt_t, tara_total_t: tara, capacidade_total_t: cap, limite_t: limite, excede_cmt: limite != null && cap > limite };
  }
  conjuntos.forEach((c) => Object.assign(c, capacidadeConjunto(c)));

  // conferências: os números da tela precisam fechar
  console.assert(veiculos.filter((v) => v.arrendado).length === 2, 'dois veículos arrendados');
  console.assert(conjuntos[1].capacidade_total_t === +(37.2 + 37.2).toFixed(1), 'rodotrem: duas graneleiras de 37,2 t');
  console.assert(pendencias.filter((p) => p.tipo_pendencia === 'veiculo_arrendado_sem_contrato').length === 1, 'só RTU1F45 sem contrato');

  window.NILT = Object.assign(window.NILT || {}, {
    HOJE, dia, diasAte,
    dados: { pessoas, motoristas, proprietarios, veiculos, tipos, conjuntos, conjuntosHistorico, arquivos, tiposArquivo, enderecos, telefones, referencias, bancos, contas, pix, usuarios, auditoria, pendencias, vencimentos, documentosVencidos },
    pessoa, veiculo, capacidadeConjunto,
    usuarioAtual: usuarios[0],
  });
})();
