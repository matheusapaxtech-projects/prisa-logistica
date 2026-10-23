/* NILT — apoio das telas de veículo (veiculos.html, veiculo-novo.html, veiculo.html).
   Carrega depois de dados.js e antes do script da página. Tudo aqui é FICTÍCIO e usa os nomes de
   campo do banco (Task 7 do plano): na conversão para Next.js, as listas de apoio viram as tabelas
   tipo_veiculo, marca_veiculo, operadora_tag e unidade_operacional; os EXTRAS viram colunas de veiculo. */
(function () {
  const N = window.NILT;
  const D = N.dados;
  const dia = N.dia;
  const quando = (horas) => new Date(Date.now() - horas * 3600e3).toISOString();

  /* ---------- tipo_veiculo: os 33 tipos do ATUA (EV-001) com a classificação da Task 7 ---------- */
  const TIPOS = [
    [1, 'CARRO - 2 EIXOS', 'outros', 2], [2, 'TOCO 10 TON CARROCERIA - 2 EIXOS', 'caminhao', 2], [3, 'TOCO 10 TON FURGAO - 2 EIXOS', 'caminhao', 2],
    [4, 'TRUCK CARROCERIA - 3 EIXOS', 'caminhao', 3], [5, 'TRUCK FURGAO - 3 EIXOS', 'caminhao', 3], [6, 'CAVALO SIMPLES - 2 EIXOS', 'cavalo', 2, 'toco'],
    [7, 'CAVALO TRUCADO - 3 EIXOS', 'cavalo', 3, 'trucado'], [8, 'CARRETA SIDER - 3 EIXOS', 'carreta', 3], [9, 'CARRETA GRANELEIRO SIMPLES - 2 EIXOS', 'carreta', 2],
    [10, 'CARRETA GRANELEIRO TRUCADA - 3 EIXOS', 'carreta', 3], [11, 'CARRETA BAU - 3 EIXOS', 'carreta', 3], [12, 'BI-TREM - 2 EIXOS', 'carreta', 2],
    [14, 'CARRETA BASCULANTE - 3 EIXOS', 'carreta', 3], [16, 'CARRETA GRADE BAIXA SIMPLES - 2 EIXOS', 'carreta', 2], [17, 'TRUCK CARROCERIA - 4 EIXOS', 'caminhao', 4],
    [18, 'DOLLY - 2 EIXOS', 'dolly', 2], [22, 'BI-TREM - 3 EIXOS', 'carreta', 3], [23, 'CARRETA CONTEINER TRUCADA - 3 EIXOS', 'carreta', 3],
    [24, 'CARRETA CONTEINER SIMPLES - 2 EIXOS', 'carreta', 2], [25, 'CARRETA GRADE BAIXA TRUCADA - 3 EIXOS', 'carreta', 3], [26, 'MOTO - 2 EIXOS', 'outros', 2],
    [27, 'TRACAO CAMINHAO TRATOR - 3 EIXOS', 'cavalo', 3, 'trucado'], [28, 'CARGA SEMI-REBOQUE SIDER - 3 EIXOS', 'carreta', 3], [29, 'TRACAO CAMINHAO TRATOR - 2 EIXOS', 'cavalo', 2, 'toco'],
    [30, 'CARGA SEMI-REBOQUE ABERTA - 3 EIXOS', 'carreta', 3], [31, 'TRUCK - 3 EIXOS', 'caminhao', 3], [32, 'ESPECIAL CAMINHONETE', 'outros', 2],
    [33, 'CARGA SEMI-REBOQUE FECHADA - 3 EIXOS', 'carreta', 3], [34, 'CAMINHAO TRUCK - 4 EIXOS', 'caminhao', 4], [35, 'CARGA SEMI-REBOQUE ABERTA - 2 EIXOS', 'carreta', 2],
    [36, 'CARGA SEMI-REBOQUE - 4 EIXOS', 'carreta', 4], [37, 'BITRUCK - 4 EIXOS', 'caminhao', 4], [38, 'CARRETA 3 EIXOS VANDERLEIA - 3 EIXOS', 'carreta', 3],
  ].map(([id, nome, categoria, eixos, configuracao_cavalo]) => ({ id, nome, categoria, eixos, configuracao_cavalo: configuracao_cavalo || null }));

  const CATEGORIAS = { cavalo: 'Cavalo', carreta: 'Carreta', dolly: 'Dolly', caminhao: 'Caminhão', outros: 'Outros' };

  // marca_veiculo: as 42 marcas de EV-001, ids sequenciais em ordem alfabética
  const MARCAS = ['AGRALE', 'CARGO', 'CHARGER', 'DAF', 'DODGE', 'FACCHINI', 'FIAT', 'FNM', 'FORD', 'FRUEHAUF', 'GM', 'GOTTI', 'GUERRA', 'HONDA', 'HOWO', 'HYUNDAI', 'IDEROL', 'INTERNATIONAL', 'IVECO', 'KRONE', 'LAND ROVER', 'LIBRELATO', 'MAN', 'MERCEDES-BENZ', 'NAVISTAR', 'NEW-G', 'NISSAN', 'NOMA', 'OUTRAS', 'PASTRE', 'QUERRA', 'RANDON', 'RECRUSUL', 'RENAULT', 'RODOLINEA', 'RODOVIARIA', 'SCANIA', 'SCHIFFER', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO', 'YAMAHA']
    .map((nome, i) => ({ id: i + 1, nome }));

  const OPERADORAS_TAG = [
    { id: 120, nome: 'PAMCARD TAG CONECTCAR' }, { id: 121, nome: 'PAMCARD TAG MOVEMAIS' }, { id: 122, nome: 'PAMCARD TAG SEM PARAR' },
    { id: 123, nome: 'PAMCARD TAG VELOE' }, { id: 124, nome: 'PAMCARD - TAGGY' },
  ];
  const UNIDADES = [{ id: 1, nome: 'TERCEIRIZACAO' }, { id: 2, nome: 'FROTA PROPRIA' }, { id: 3, nome: 'PRISA APUCARANA' }];

  // enums do banco, na ordem da tela do ATUA
  const SITUACAO_OPERACIONAL = [['ag_motorista', 'Aguardando motorista'], ['apreendido', 'Apreendido'], ['arrendado', 'Arrendado'], ['ativo', 'Ativo'], ['a_venda', 'À venda'], ['devolvido', 'Devolvido'], ['parado', 'Parado'], ['sinistro', 'Sinistro'], ['vendido', 'Vendido']];
  const SITUACAO_CADASTRO = [['normal', 'Normal'], ['pendente', 'Pendente'], ['cancelado', 'Cancelado']];
  const RECEBEDOR = [['motorista', 'Motorista'], ['proprietario', 'Proprietário'], ['posto', 'Posto (CF)']];
  const ASSOALHO = [['madeira', 'Madeira'], ['ferro', 'Ferro'], ['misto', 'Misto']];
  const RASTREAMENTO = [['telemonitorado', 'Telemonitorado'], ['rastreador', 'Rastreador'], ['localizador', 'Localizador']];
  const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
  const ENQUADRAMENTO = { tac: 'TAC', etc: 'ETC', ctc: 'CTC', etc_equiparado: 'ETC equiparado' };

  /* ---------- colunas que dados.js ainda não traz (fictícias, nomes do banco) ---------- */
  const EXTRAS = {
    v01: { nr_certificado_doc: '263418907521', nr_registro_crlv: '021938475612', dt_emissao_crlv: '2026-02-11', nr_seguranca_crlv: '86412093571', seguradora: 'Rota Sul Seguros (fictícia)', apolice: '1180023457', recebedor_valores: 'proprietario', rastreador_modelo: 'OX-300', pgr_sm_automatica: true, rastreador_observacao: 'Botão de pânico na cabine; bloqueio de combustível ativo.', nr_frota: '014', unidade_operacional_id: 1, potencia_motor: '450 cv', hp: 450, litros_tanque: 700, aquisicao: '2021-09-14', vl_compra: 685000, vl_mercado: 590000, km_inicial: 182340, nr_motor: 'DC13 148 7741229', media_padrao_carregado: 2.1, media_padrao_vazio: 2.9 },
    v02: { nr_certificado_doc: '263419112086', nr_registro_crlv: '021940018833', dt_emissao_crlv: '2026-01-27', nr_seguranca_crlv: '86412558014', seguradora: 'Vigia Seguros (fictícia)', apolice: '7730019284', recebedor_valores: 'proprietario', rastreador_empresa: 'Monitora Cargas (fictícia)', rastreador_modelo: 'MC-Tele 4', rastreador_numero: '33018-7', pgr_sm_automatica: true, nr_frota: '022', unidade_operacional_id: 1, potencia_motor: '540 cv', hp: 540, litros_tanque: 900, aquisicao: '2022-11-03', vl_compra: 912000, vl_mercado: 820000, km_inicial: 96410, nr_motor: 'D13K 540 0029184', media_padrao_carregado: 1.8, media_padrao_vazio: 2.6 },
    v03: { nr_certificado_doc: '142207753019', nr_registro_crlv: '020114376620', dt_emissao_crlv: '2026-03-04', nr_seguranca_crlv: '86411027735', recebedor_valores: 'motorista', nr_frota: '007', unidade_operacional_id: 1, potencia_motor: '360 cv', hp: 360, litros_tanque: 480, km_inicial: 811200, nr_motor: 'OM457 LA 0410332', media_padrao_carregado: 2.4, media_padrao_vazio: 3.1 },
    v04: { nr_certificado_doc: '263420781154', nr_registro_crlv: '021951130047', dt_emissao_crlv: '2026-04-18', nr_seguranca_crlv: '86413300926', seguradora: 'Rota Sul Seguros (fictícia)', apolice: '1180027719', recebedor_valores: 'proprietario', rastreador_empresa: 'Onixsat', rastreador_modelo: 'OX-300', rastreador_numero: '771988', rastreamento_tipo: 'rastreador', pgr_sm_automatica: false, rastreador_observacao: 'SM aberta à mão até o PGR do arrendatário ser aprovado.', nr_frota: '031', unidade_operacional_id: 1, potencia_motor: '530 cv', hp: 530, litros_tanque: 860, aquisicao: '2023-12-01', km_inicial: 41020, nr_motor: 'MX13 530 3318820', media_padrao_carregado: 1.9, media_padrao_vazio: 2.7 },
    v05: { nr_certificado_doc: '142211830467', nr_registro_crlv: '020177302215', dt_emissao_crlv: '2025-03-22', recebedor_valores: 'proprietario', nr_frota: '019', unidade_operacional_id: 1, hp: 410, litros_tanque: 600 },
    v11: { nr_certificado_doc: '263418907633', nr_registro_crlv: '021938476001', dt_emissao_crlv: '2026-02-11', nr_seguranca_crlv: '86412093602', recebedor_valores: 'proprietario', nr_frota: '014-A', unidade_operacional_id: 1, aquisicao: '2021-09-14', vl_compra: 248000 },
    v12: { nr_certificado_doc: '263419112190', nr_registro_crlv: '021940019004', dt_emissao_crlv: '2026-01-27', recebedor_valores: 'proprietario', nr_frota: '022-A', unidade_operacional_id: 1 },
    v13: { nr_certificado_doc: '263419112204', nr_registro_crlv: '021940019005', dt_emissao_crlv: '2026-01-27', recebedor_valores: 'proprietario', nr_frota: '022-D', unidade_operacional_id: 1 },
    v14: { nr_certificado_doc: '263419112218', nr_registro_crlv: '021940019006', dt_emissao_crlv: '2026-01-27', recebedor_valores: 'proprietario', nr_frota: '022-B', unidade_operacional_id: 1 },
    v15: { nr_certificado_doc: '142207753126', nr_registro_crlv: '020114377008', dt_emissao_crlv: '2026-03-04', recebedor_valores: 'motorista', unidade_operacional_id: 1 },
    v16: { nr_certificado_doc: '263420781260', nr_registro_crlv: '021951130155', dt_emissao_crlv: '2026-04-18', recebedor_valores: 'proprietario', unidade_operacional_id: 1, tipo_assoalho: 'madeira', comprimento_m: 15.5, largura_m: 2.6, altura_m: 2.8 },
    v17: { nr_certificado_doc: '142210098341', recebedor_valores: 'proprietario', unidade_operacional_id: 1, tipo_assoalho: 'madeira' },
    v21: { nr_certificado_doc: '142209554410', nr_registro_crlv: '020160038812', dt_emissao_crlv: '2025-02-19', recebedor_valores: 'motorista', unidade_operacional_id: 1, hp: 280, litros_tanque: 275 },
  };

  /* ---------- veículos criados nesta sessão do protótipo (veiculo-novo.html) ---------- */
  const CHAVE = 'nilt.veiculos.novos';
  function lerNovos() { try { return JSON.parse(sessionStorage.getItem(CHAVE) || '[]'); } catch { return []; } }
  function guardarNovo(v) { try { const l = lerNovos(); l.push(v); sessionStorage.setItem(CHAVE, JSON.stringify(l)); return true; } catch { return false; } }

  const tipo = (id) => TIPOS.find((t) => t.id === +id);
  function derivar(v) {
    const t = tipo(v.tipo_veiculo_id);
    v.tipo = t.nome; v.categoria = t.categoria; v.eixos = t.eixos; v.configuracao_cavalo = t.configuracao_cavalo;
    v.arrendado = v.proprietario_posse_id !== v.proprietario_documento_id;
    v.capacidade_calculada_t = v.pbt_t != null && v.tara_t != null ? +(v.pbt_t - v.tara_t).toFixed(1) : null;
    return v;
  }

  lerNovos().forEach((v) => {
    if (D.veiculos.some((x) => x.id === v.id)) return;
    (v._arquivos || []).forEach((a) => D.arquivos.push(a));
    delete v._arquivos;
    D.veiculos.push(v);
  });
  D.veiculos.forEach((v) => {
    Object.entries(EXTRAS[v.id] || {}).forEach(([k, val]) => { if (v[k] == null) v[k] = val; });
    if (v.tag_operadora && !v.tag_operadora_id) v.tag_operadora_id = (OPERADORAS_TAG.find((o) => o.nome === v.tag_operadora) || {}).id;
    if (!v.marca_id) v.marca_id = (MARCAS.find((m) => m.nome === v.marca) || {}).id;
    // dados.js já calculou capacidade_carga_t = pbt - tara; aqui separamos o informado do calculado
    v.capacidade_informada = v.capacidade_informada ?? false;
    derivar(v);
  });

  /* ---------- arquivos e auditoria extras (fictícios) ---------- */
  [
    { id: 'a31', tipo: 'FOTO', veiculo_id: 'v01', nome_original: 'bra2e19-lateral.jpg', tamanho_bytes: 1420000, validado_em: quando(880), validado_por: 'Rafaela' },
    { id: 'a32', tipo: 'CRLV', veiculo_id: 'v11', nome_original: 'crlv-bra7g33.pdf', tamanho_bytes: 226000, validade: dia(160), validado_em: quando(870), validado_por: 'Rafaela' },
    { id: 'a33', tipo: 'CRLV', veiculo_id: 'v04', nome_original: 'crlv-rtu1f45.pdf', tamanho_bytes: 238000, validade: dia(160) },
    { id: 'a34', tipo: 'CRLV', veiculo_id: 'v16', nome_original: 'crlv-rtv6h10.pdf', tamanho_bytes: 231000, validade: dia(160) },
    { id: 'a35', tipo: 'CRLV', veiculo_id: 'v03', nome_original: 'crlv-ayk8813.jpg', tamanho_bytes: 845000, validade: dia(-21) },
    { id: 'a36', tipo: 'CRLV', veiculo_id: 'v12', nome_original: 'crlv-qhx2a61.pdf', tamanho_bytes: 229000, validade: dia(160) },
  ].forEach((a) => { if (!D.arquivos.some((x) => x.id === a.id)) D.arquivos.push(a); });

  const AUDIT_EXTRA = [
    { id: 8801, em: quando(2210), usuario: 'Rafaela', tabela: 'veiculo', registro_id: 'v01', acao: 'insert', resumo: 'Veículo BRA2E19 cadastrado' },
    { id: 8870, em: quando(310), usuario: 'Denílson', tabela: 'veiculo', registro_id: 'v01', acao: 'update', resumo: 'TAG: operadora alterada para PAMCARD TAG SEM PARAR' },
    { id: 8990, em: quando(21), usuario: 'Rafaela', tabela: 'arquivo', registro_id: 'a13', acao: 'visualizacao', resumo: 'Abriu crlv-bra2e19.pdf' },
    { id: 8802, em: quando(1980), usuario: 'Rafaela', tabela: 'veiculo', registro_id: 'v02', acao: 'insert', resumo: 'Veículo QHT4C27 cadastrado' },
    { id: 8960, em: quando(48), usuario: 'Carla', tabela: 'veiculo', registro_id: 'v02', acao: 'update', resumo: 'Seguro: apólice 7730019284 renovada' },
    { id: 8950, em: quando(122), usuario: 'Denílson', tabela: 'veiculo', registro_id: 'v04', acao: 'insert', resumo: 'Veículo RTU1F45 cadastrado' },
    { id: 8951, em: quando(119), usuario: 'Denílson', tabela: 'veiculo', registro_id: 'v04', acao: 'update', resumo: 'Proprietário documento (ANTT): Rodo Norte Pioneiro Logística Ltda; veículo passou a arrendado' },
    { id: 8952, em: quando(118), usuario: 'Denílson', tabela: 'veiculo', registro_id: 'v04', acao: 'update', resumo: 'Situação operacional: ativo → arrendado' },
    { id: 8961, em: quando(30), usuario: 'Matheus', tabela: 'arquivo', registro_id: 'a15', acao: 'visualizacao', resumo: 'Abriu contrato-arrendamento-rtv6h10.pdf (restrito)' },
    { id: 8930, em: quando(400), usuario: 'Rafaela', tabela: 'veiculo', registro_id: 'v05', acao: 'update', resumo: 'Situação operacional: ativo → parado' },
  ];
  AUDIT_EXTRA.forEach((a) => { if (!D.auditoria.some((x) => x.id === a.id)) D.auditoria.push(a); });
  // todo veículo tem ao menos o registro de cadastro
  D.veiculos.forEach((v, i) => {
    if (!D.auditoria.some((a) => a.tabela === 'veiculo' && a.registro_id === v.id && a.acao === 'insert'))
      D.auditoria.push({ id: 8700 + i, em: v.created_at || quando(1500 + i * 37), usuario: v.created_by_nome || 'Rafaela', tabela: 'veiculo', registro_id: v.id, acao: 'insert', resumo: `Veículo ${v.placa} cadastrado` });
  });

  /* ---------- ajudas de leitura ---------- */
  const ACENTOS = { BAU: 'baú', CAMINHAO: 'caminhão', TRACAO: 'tração', FURGAO: 'furgão', CONTEINER: 'contêiner' };
  function rotuloTipo(v) {
    const t = tipo(v.tipo_veiculo_id) || {};
    if (t.categoria === 'cavalo') return t.configuracao_cavalo === 'trucado' ? 'Cavalo trucado' : 'Cavalo toco';
    if (t.categoria === 'dolly') return 'Dolly';
    const s = (t.nome || '').replace(/\s*-\s*\d EIXOS$/, '').split(' ').map((w) => ACENTOS[w] || w.toLowerCase()).join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const nomeTipoLista = (t) => { const s = t.nome.split(' ').map((w) => ACENTOS[w] ? ACENTOS[w].toUpperCase() : w).join(' '); return s; };
  const sitOp = (s) => (SITUACAO_OPERACIONAL.find((x) => x[0] === s) || [s, s || '—'])[1];
  const nomeCurto = (p) => (p ? (p.tipo === 'pj' ? p.nome_fantasia || p.nome : p.nome) : '—');
  const proprietario = (id) => D.proprietarios.find((p) => p.pessoa_id === id);
  const marca = (v) => { const m = v.marca || (MARCAS.find((x) => x.id === +v.marca_id) || {}).nome || ''; if (m.length <= 3) return m; return m.charAt(0) + m.slice(1).toLowerCase().replace(/-(\w)/, (_, c) => '-' + c.toUpperCase()); };

  // onde o veículo está engatado agora: { conjunto, posicao (0 = cavalo), total }
  function conjuntoDe(v) {
    for (const c of D.conjuntos) {
      if (c.cavalo_id === v.id) return { conjunto: c, posicao: 0, total: c.itens.length };
      const i = c.itens.indexOf(v.id); if (i >= 0) return { conjunto: c, posicao: i + 1, total: c.itens.length };
    }
    return null;
  }
  const historicoDe = (v) => D.conjuntosHistorico.filter((c) => c.cavalo_id === v.id || c.itens.includes(v.id));
  const contratoDe = (v) => D.arquivos.find((a) => a.veiculo_id === v.id && a.tipo === 'CONTRATO');

  // números com vírgula (pt-BR) para campos de texto
  const num = (n, casas = 1) => (n == null || n === '' ? '' : (+n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: false }));
  const lerNum = (s) => { const t = String(s ?? '').trim().replace(/\./g, '').replace(',', '.'); return t === '' || isNaN(+t) ? null : +t; };
  const dinheiro = (n) => (n == null ? '' : (+n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  N.veic = { TIPOS, CATEGORIAS, MARCAS, OPERADORAS_TAG, UNIDADES, SITUACAO_OPERACIONAL, SITUACAO_CADASTRO, RECEBEDOR, ASSOALHO, RASTREAMENTO, UFS, ENQUADRAMENTO,
    tipo, derivar, rotuloTipo, nomeTipoLista, sitOp, nomeCurto, proprietario, marca, conjuntoDe, historicoDe, contratoDe, num, lerNum, dinheiro, lerNovos, guardarNovo };
})();
