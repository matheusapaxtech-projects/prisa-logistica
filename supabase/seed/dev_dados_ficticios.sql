-- =============================================================================================
-- SEED DE DESENVOLVIMENTO: DADOS FICTÍCIOS. NÃO É MIGRATION E NUNCA DEVE IR PARA PRODUÇÃO.
-- =============================================================================================
-- Reproduz os dados de demonstração do protótipo (prototipo/assets/dados.js e das páginas
-- motoristas.js, proprietarios.js e veiculos.js) no banco de desenvolvimento do NILT.
-- Rodar só com `execute_sql` do MCP supabase-nilt (ou psql) no ambiente de desenvolvimento.
-- Nomes, CPFs, CNPJs, placas, telefones e e-mails são inventados. Os documentos usam o mesmo
-- algoritmo de dígitos verificadores do protótipo; nenhum valor coincide com as fixtures dos
-- testes pgTAP (CPFs, CNPJ e placas TST listados em supabase/tests/README.md).
--
-- Reexecutável: todo insert usa `on conflict do nothing`; rodar de novo não duplica nada.
-- Datas relativas a current_date (vencimentos sempre "vivos"); created_at/updated_at = agora.
-- Não cria usuários (auth.users/perfil_usuario) nem objetos no Storage: as linhas de `arquivo`
-- apontam para caminhos que não existem (aceito na demo). A trilha de auditoria do protótipo
-- não é copiada: os próprios inserts já geram linhas em `auditoria` (usuario_id nulo).
--
-- IDS FIXOS: 00000000-0000-4000-8000-<12 dígitos>. O bloco do ID fica no último grupo:
--   pessoa                  ...000000000101 a ...000000000112   (pNN do protótipo = 100 + NN)
--                           ...000000000113 a ...000000000121   (Quadro: 113-114 clientes PJ, 115-121 motoristas)
--   motorista/proprietario  mesmo id da pessoa (chave = pessoa_id)
--   cliente                 mesmo id da pessoa (113, 114)
--   veiculo                 ...000000000201 a ...000000000221   (vNN = 200 + NN: 201-205, 211-219, 221)
--                           ...000000000222 a ...000000000237   (Quadro: cavalos 222-228, graneleiros 231-237)
--   conjunto                ...000000000301 a ...000000000305   (c01-c04 abertos; 305 = histórico c00 encerrado)
--                           ...000000000306 a ...000000000312   (Quadro: abertos)
--   conjunto_item           sem id próprio (chave conjunto_id + posicao)
--   arquivo                 ...000000000401 a ...000000000454   (aNN = 400 + NN: 401-416, 421, 431-436, 451-454)
--                           ...000000000455 a ...000000000457   (Quadro: canhotos das viagens 1208-1210)
--   pessoa_endereco         ...000000000501 em diante           (501-513; Quadro: 514-517 locais de coleta/descarga)
--   pedido                  ...000000001101 a ...000000001102
--   viagem                  ...000000001201 a ...000000001212   (uma por coluna do Quadro + 2 planejadas)
--   viagem_pausa            ...000000001301
--   viagem_ocorrencia       ...000000001401
--   viagem_evento           id gerado (bigint); só é gravado para viagem da seed sem nenhum evento
--   pessoa_telefone         ...000000000601 em diante           (601-613)
--   pessoa_email            ...000000000701 em diante           (701-706)
--   motorista_referencia    ...000000000801 em diante           (801-804)
--   pessoa_conta_bancaria   ...000000000901 em diante           (901-905)
--   pessoa_chave_pix        ...000000001001 em diante           (1001-1004)
--
-- LIMPEZA: supabase/seed/limpar_dados_ficticios.sql. Ordem: eventos/pausas/ocorrências/arquivos de
-- viagem -> viagem -> pedido -> cliente -> conjunto (cascade nos itens) -> veiculo -> pessoa (cascade em
-- motorista, proprietario, endereço, telefone, e-mail, referência, conta, Pix e arquivo) pelos
-- intervalos de id acima, e depois as linhas de `auditoria` cujo registro_id esteja nesses blocos.
-- =============================================================================================

begin;

-- pessoa (12: 8 PF motoristas/proprietários, 1 PF só proprietária, 3 PJ proprietárias)
insert into public.pessoa (id, tipo, nome, apelido, cpf, cnpj, situacao_cadastro, rg, rg_orgao, rg_uf, rg_emissao, nascimento, sexo, raca_cor, estado_civil, grau_instrucao, naturalidade, naturalidade_uf, nr_inss, situacao_cpf, dt_consulta_cpf, pai, mae, nr_dependentes, qualificacao_inss, nome_fantasia, fundacao, inscricao_estadual_isento, inscricao_estadual, inscricao_municipal, natureza_juridica, cnae_principal, optante_simples, dt_consulta_simples, dt_consulta_brasilapi) values
  ('00000000-0000-4000-8000-000000000101', 'pf', 'Edson Ramos Figueira', 'Edinho', '31826590498', null, 'normal', '8.421.336-2', 'SSP', 'PR', '1997-06-10', '1979-03-14', 'masculino', 'parda', 'casado', 'medio_completo', 'Arapongas', 'PR', '12765409831', 'regular', (current_date - 35), 'Osvaldo Figueira', 'Lurdes Ramos', null, 'qualificado', null, null, true, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000102', 'pf', 'Cláudio Bertoli Neto', 'Bertoli', '40719352606', null, 'normal', '9.110.205-7', 'SSP', 'PR', '2002-03-21', '1984-11-02', 'masculino', 'branca', 'solteiro', 'medio_completo', 'Apucarana', 'PR', null, 'regular', (current_date - 35), 'Cláudio Bertoli', 'Ivone Bertoli', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000103', 'pf', 'Reinaldo Toledo Paz', 'Paz', '22580411712', null, 'pendente', '10.442.871-0', 'SSP', 'SC', '2008-09-02', '1990-07-21', 'masculino', 'branca', 'casado', 'fundamental_completo', 'Chapecó', 'SC', null, 'regular', (current_date - 2), 'Hélio Paz', 'Marta Toledo', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000104', 'pf', 'Silvana Correia Machado', 'Sil', '51933726008', null, 'normal', '7.903.118-4', 'SSP', 'PR', '2005-01-17', '1987-01-30', 'feminino', 'parda', 'separado', 'medio_completo', 'Londrina', 'PR', null, 'regular', (current_date - 60), 'Jorge Machado', 'Rosa Correia', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000105', 'pf', 'Adilson Pereira Gaspar', 'Gaspar', '63041825201', null, 'cancelado', '5.220.774-1', 'SSP', 'SP', null, '1972-05-09', 'masculino', 'nao_informado', 'casado', 'fundamental_incompleto', 'Presidente Prudente', 'SP', null, 'regular', (current_date - 400), null, 'Neusa Pereira', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000106', 'pf', 'Juliano Mendes Arruda', 'Ju', '74209163813', null, 'normal', '11.320.506-9', 'SSP', 'PR', '2011-04-08', '1993-09-17', 'masculino', 'preta', 'solteiro', 'medio_incompleto', 'Maringá', 'PR', '20914477310', 'regular', (current_date - 90), 'Valter Arruda', 'Célia Mendes', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000107', 'pf', 'Marcos Vinícius Albuquerque', 'Albuquerque', '15362084933', null, 'pendente', '6.880.143-3', 'SSP', 'MS', null, '1982-12-05', 'masculino', 'parda', 'casado', 'medio_completo', 'Dourados', 'MS', null, 'regular', (current_date - 30), null, 'Joana Albuquerque', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000108', 'pf', 'Otávio Lacerda Fontana', 'Fontana', '86427510371', null, 'normal', '4.310.992-8', 'SSP', 'PR', '1988-11-30', '1969-04-27', 'masculino', 'branca', 'viuvo', 'fundamental_completo', 'Cambé', 'PR', '10288733419', 'regular', (current_date - 120), 'Ernesto Fontana', 'Ana Lacerda', 2, 'com_pendencia', null, null, true, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000112', 'pf', 'Gerson Vidal Prado', 'Gerson', '27614038517', null, 'normal', '6.114.902-5', 'SSP', 'PR', null, '1976-02-11', 'masculino', null, 'casado', 'medio_completo', 'Rolândia', 'PR', null, 'regular', null, null, 'Odete Vidal', null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000109', 'pj', 'Transportes Serra do Cadeado Ltda', null, null, '45321876000178', 'normal', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'TSC Transportes', '2009-08-11', null, '90544712-03', '48221-6', '206-2 Sociedade Empresária Limitada', '4930-2/02 Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional', false, (current_date - 45), now() - interval '1080 hours'),
  ('00000000-0000-4000-8000-000000000110', 'pj', 'Rodo Norte Pioneiro Logística Ltda', null, null, '28760519400101', 'normal', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Rodo Norte', '2015-02-23', null, '90711236-48', '1.204.773-0', '206-2 Sociedade Empresária Limitada', '4930-2/02 Transporte rodoviário de carga, intermunicipal, interestadual e internacional', true, (current_date - 200), now() - interval '4800 hours'),
  ('00000000-0000-4000-8000-000000000111', 'pj', 'Locadora de Implementos Ivaí Ltda', null, null, '61093452800199', 'pendente', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Ivaí Implementos', '2018-06-04', true, null, null, '206-2 Sociedade Empresária Limitada', '7719-5/99 Locação de outros meios de transporte não especificados anteriormente, sem condutor', false, null, now() - interval '29.6 hours')
on conflict do nothing;

-- motorista (8)
insert into public.motorista (pessoa_id, cnh_registro, cnh_formulario, cnh_seguranca, cnh_renach, cnh_categoria, cnh_validade, cnh_emissao, cnh_primeira_habilitacao, cnh_cidade_emissao, cnh_uf, cnh_observacao, situacao_cadastro, situacao_gr, gr_validade, qualificado_gmp, dt_qualificacao_gmp) values
  ('00000000-0000-4000-8000-000000000101', '04817265530', '2215548766', '73312658804', 'PR015544210', 'e', (current_date + 412), '2021-05-18', '1999-08-02', 'Apucarana', 'PR', 'EAR: exerce atividade remunerada.', 'normal', 'habilitado', (current_date + 64), true, '2024-08-19'),
  ('00000000-0000-4000-8000-000000000102', '05523190876', null, null, null, 'e', (current_date + 18), '2021-10-04', '2005-03-15', 'Apucarana', 'PR', 'EAR: exerce atividade remunerada.', 'normal', 'habilitado', (current_date + 9), null, null),
  ('00000000-0000-4000-8000-000000000103', '06612904417', null, null, null, 'd', (current_date - 6), '2016-09-22', '2010-01-11', 'Chapecó', 'SC', null, 'pendente', 'sem_consulta', null, null, null),
  ('00000000-0000-4000-8000-000000000104', '03990128745', null, null, null, 'e', (current_date + 780), '2023-02-14', '2008-06-30', 'Londrina', 'PR', null, 'normal', 'habilitado', (current_date + 120), null, null),
  ('00000000-0000-4000-8000-000000000105', '02218476650', null, null, null, 'e', (current_date - 210), '2014-01-08', '1994-11-19', 'Presidente Prudente', 'SP', null, 'cancelado', 'vencido', (current_date - 190), null, null),
  ('00000000-0000-4000-8000-000000000106', '07741230998', '2290417785', '61045522903', 'PR022918734', 'e', (current_date + 1040), '2024-04-02', '2014-02-20', 'Maringá', 'PR', null, 'normal', 'habilitado', (current_date + 27), null, null),
  ('00000000-0000-4000-8000-000000000107', '05107783342', null, null, null, 'e', (current_date + 301), '2020-07-29', '2003-09-08', 'Dourados', 'MS', null, 'pendente', 'sem_consulta', null, null, null),
  ('00000000-0000-4000-8000-000000000108', '01654490213', null, null, null, 'e', (current_date + 46), '2018-11-12', '1991-05-06', 'Cambé', 'PR', null, 'normal', 'habilitado', (current_date + 80), null, null)
on conflict do nothing;

-- proprietario (6; p11 sem RNTRC)
insert into public.proprietario (pessoa_id, rntrc, enquadramento_antt, rntrc_emissao, rntrc_validade, responsavel_nome, responsavel_telefone, responsavel_whatsapp, responsavel_email, autoriza_desconto_inss, alto_desempenho, qualificado_gmp, dt_qualificacao_gmp, situacao_cadastro, taxa_adm_valor, taxa_adm_percentual, regra_pgto_frete, limite_adiantamento_percentual, limite_adiantamento_valor, frete_empresa_motorista_valor, frete_empresa_motorista_percentual) values
  ('00000000-0000-4000-8000-000000000101', '052177340', 'tac', '2019-03-02', (current_date + 210), null, null, null, null, 'inss_sest_senat', false, true, '2024-03-11', 'normal', null, null, 'peso_chegada_se_menor', 80, 6000, null, 92),
  ('00000000-0000-4000-8000-000000000108', '048812295', 'tac', '2017-10-20', (current_date + 23), null, null, null, null, 'inss_sest_senat', false, false, null, 'normal', null, null, 'peso_saida', 70, null, null, null),
  ('00000000-0000-4000-8000-000000000109', '061190473', 'etc', '2020-05-14', (current_date + 530), 'Gilberto Saldanha', '43998127766', true, 'operacional@tsc.exemplo', default, true, true, '2023-08-30', 'normal', 35, 2.5, 'peso_chegada_com_tolerancia', 70, 15000, null, 88),
  ('00000000-0000-4000-8000-000000000110', '058834016', 'etc', '2021-01-09', (current_date - 12), 'Patrícia Okamoto', '43991540028', true, 'frota@rodonorte.exemplo', default, false, false, null, 'normal', null, 3, 'peso_saida', 60, 12000, null, null),
  ('00000000-0000-4000-8000-000000000112', '053390118', 'tac', '2018-04-12', (current_date + 340), null, null, null, null, 'inss_sest_senat', default, null, null, 'normal', null, null, 'peso_saida', null, null, null, null),
  ('00000000-0000-4000-8000-000000000111', null, 'etc_equiparado', null, null, 'Fábio Tanaka', '43988201174', false, null, default, false, false, null, 'pendente', null, null, null, null, null, null, null)
on conflict do nothing;

-- motorista_referencia (4)
insert into public.motorista_referencia (id, motorista_id, tipo, nome, telefone, dt_referencia, observacao) values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000101', 'comercial', 'Transportadora Vale do Pirapó', '4432261100', (current_date - 400), 'Trabalhou 6 anos, saiu por conta própria.'),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000101', 'pessoal', 'Wagner Lopes', '43998120056', (current_date - 400), null),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000103', 'comercial', 'Oeste Cargas Ltda', '4933220917', (current_date - 2), 'Aguardando retorno do RH.'),
  ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000104', 'comercial', 'Expresso Tibagi', '4333297000', (current_date - 180), 'Boa referência, 4 anos na empresa.')
on conflict do nothing;

-- pessoa_endereco
insert into public.pessoa_endereco (id, pessoa_id, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf, ponto_referencia, principal) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000101', 'residencial', '86700000', 'Rua das Perdizes', '312', null, 'Jardim Bandeirantes', 'Arapongas', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000102', 'residencial', '86800000', 'Rua Ponta Grossa', '1048', null, 'Vila Nova', 'Apucarana', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000112', 'residencial', '86600000', 'Rua Ceará', '93', null, 'Centro', 'Rolândia', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000109', 'comercial', '86800000', 'Rodovia BR-376, km 254', 's/n', null, 'Parque Industrial', 'Apucarana', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000103', 'residencial', '89801000', 'Rua Marechal Bormann', '1520', 'apto 32', 'Centro', 'Chapecó', 'SC', null, true),
  ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000104', 'residencial', '86010000', 'Rua Pará', '880', null, 'Centro', 'Londrina', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000105', 'residencial', '19010000', 'Rua Doutor José Foz', '211', null, 'Vila Marcondes', 'Presidente Prudente', 'SP', null, true),
  ('00000000-0000-4000-8000-000000000508', '00000000-0000-4000-8000-000000000106', 'residencial', '87013000', 'Avenida Brasil', '4410', 'casa 2', 'Zona 1', 'Maringá', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000509', '00000000-0000-4000-8000-000000000107', 'residencial', '79800000', 'Rua Hayel Bon Faker', '75', null, 'Jardim Água Boa', 'Dourados', 'MS', null, true),
  ('00000000-0000-4000-8000-000000000510', '00000000-0000-4000-8000-000000000108', 'residencial', '86181000', 'Rua Pernambuco', '602', null, 'Centro', 'Cambé', 'PR', 'em frente à praça da matriz', true),
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000101', 'correspondencia', '86700000', 'Caixa Postal 118', 's/n', null, 'Centro', 'Arapongas', 'PR', null, false),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000110', 'comercial', '86020000', 'Avenida Dez de Dezembro', '4410', 'Barracão 2', 'Jardim Piza', 'Londrina', 'PR', null, true),
  ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000111', 'comercial', '87013000', 'Avenida Colombo', '9120', null, 'Zona 7', 'Maringá', 'PR', null, true)
on conflict do nothing;

-- pessoa_telefone
insert into public.pessoa_telefone (id, pessoa_id, numero, tipo, contato, principal, whatsapp, restrito) values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000101', '43998401122', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000102', '43996612708', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000103', '49991208833', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000104', '43999051470', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000106', '44998772214', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000606', '00000000-0000-4000-8000-000000000107', '67996330045', 'celular', null, true, false, false),
  ('00000000-0000-4000-8000-000000000607', '00000000-0000-4000-8000-000000000108', '43991117650', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000608', '00000000-0000-4000-8000-000000000112', '43999214567', 'celular', null, true, true, false),
  ('00000000-0000-4000-8000-000000000609', '00000000-0000-4000-8000-000000000109', '4334221800', 'comercial', 'Recepção', true, false, false),
  ('00000000-0000-4000-8000-000000000610', '00000000-0000-4000-8000-000000000101', '4332524410', 'residencial', 'Esposa, Márcia', false, false, true),
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000105', '18997120334', 'celular', null, true, false, false),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000110', '4333271900', 'comercial', 'Frota', true, false, false),
  ('00000000-0000-4000-8000-000000000613', '00000000-0000-4000-8000-000000000111', '4430262215', 'comercial', 'Escritório', true, false, false)
on conflict do nothing;

-- pessoa_email
insert into public.pessoa_email (id, pessoa_id, email, principal, recebe_cte, observacao) values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000101', 'edson.figueira@exemplo.com', true, true, null),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000104', 'silvana.machado@exemplo.com', true, false, 'Prefere WhatsApp.'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000108', 'fontana.transportes@exemplo.com', true, true, null),
  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000109', 'fiscal@tsc.exemplo', true, true, 'Recebe CT-e e contrato de frete'),
  ('00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000109', 'operacional@tsc.exemplo', false, false, null),
  ('00000000-0000-4000-8000-000000000706', '00000000-0000-4000-8000-000000000110', 'frota@rodonorte.exemplo', true, true, null)
on conflict do nothing;

-- pessoa_conta_bancaria (titular_confere é calculado pelo gatilho)
insert into public.pessoa_conta_bancaria (id, pessoa_id, banco_codigo, tipo, agencia, conta, conta_digito, favorecido_nome, favorecido_documento, principal) values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000101', '748', 'corrente', '0712', '38104', '6', 'Edson Ramos Figueira', '31826590498', true),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000109', '341', 'corrente', '1408', '22719', '0', 'Transportes Serra do Cadeado Ltda', '45321876000178', true),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000110', '756', 'corrente', '3309', '104422', '8', 'Patrícia Okamoto', '90511736444', true),
  ('00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-000000000104', '104', 'poupanca', '1873', '00041127', '3', 'Rosa Correia', '60411298300', true),
  ('00000000-0000-4000-8000-000000000905', '00000000-0000-4000-8000-000000000106', '260', 'corrente', '0001', '8812047', '1', 'Juliano Mendes Arruda', '74209163813', true)
on conflict do nothing;

-- pessoa_chave_pix (ligada à conta principal da pessoa)
insert into public.pessoa_chave_pix (id, pessoa_id, tipo, chave, conta_id, principal, descricao) values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000101', 'cpf', '31826590498', '00000000-0000-4000-8000-000000000901', true, 'Recebimento de frete'),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000109', 'cnpj', '45321876000178', '00000000-0000-4000-8000-000000000902', true, null),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000104', 'celular', '43999051470', '00000000-0000-4000-8000-000000000904', true, 'Celular da Silvana'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000106', 'aleatoria', '7f3c2a91-0be4-4d6e-9a51-c28d04e7b113', '00000000-0000-4000-8000-000000000905', true, null)
on conflict do nothing;

-- veiculo (15; capacidade_carga_t fica nula: o banco usa pbt_t - tara_t)
insert into public.veiculo (id, placa, tipo_veiculo_id, marca_id, modelo, cor, ano_fabricacao, ano_modelo, renavam, chassi, nr_certificado_doc, exercicio_doc, nr_registro_crlv, dt_emissao_crlv, nr_seguranca_crlv, cidade_emplacamento, uf_emplacamento, proprietario_posse_id, proprietario_documento_id, situacao_operacional, situacao_cadastro, recebedor_valores, tag_numero, tag_operadora_id, seguradora, apolice, seguro_validade, tipo_assoalho, comprimento_m, largura_m, altura_m, cmt_t, pbt_t, tara_t, rastreador_empresa, rastreador_modelo, rastreador_numero, rastreamento_tipo, rastreador_observacao, pgr_sm_automatica, nr_frota, ultimo_motorista_id, venc_ipva, potencia_motor, hp, litros_tanque, aquisicao, vl_compra, vl_mercado, km_inicial, nr_motor, media_padrao_carregado, media_padrao_vazio, unidade_operacional_id) values
  ('00000000-0000-4000-8000-000000000201', 'BRA2E19', 7, (select id from public.marca_veiculo where nome = 'SCANIA'), 'R 450 A6x4', 'Branca', 2021, 2022, '01283746590', '9BSR6X40003947712', '263418907521', 2026, '021938475612', '2026-02-11', '86412093571', 'Arapongas', 'PR', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101', 'ativo', 'normal', 'proprietario', '0014 7751 2290', (select id from public.operadora_tag where nome = 'PAMCARD TAG SEM PARAR'), 'Rota Sul Seguros (fictícia)', '1180023457', (current_date + 142), null, null, null, null, 74, 23, 9.4, 'Onixsat', 'OX-300', '771205', 'rastreador', 'Botão de pânico na cabine; bloqueio de combustível ativo.', true, '014', '00000000-0000-4000-8000-000000000101', (current_date + 160), '450 cv', 450, 700, '2021-09-14', 685000, 590000, 182340, 'DC13 148 7741229', 2.1, 2.9, 1),
  ('00000000-0000-4000-8000-000000000202', 'QHT4C27', 7, (select id from public.marca_veiculo where nome = 'VOLVO'), 'FH 540 6x4', 'Azul', 2022, 2023, '01309821446', '9BVAX40D5NE912884', '263419112086', 2026, '021940018833', '2026-01-27', '86412558014', 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', 'proprietario', '0022 1408 3317', (select id from public.operadora_tag where nome = 'PAMCARD TAG VELOE'), 'Vigia Seguros (fictícia)', '7730019284', (current_date + 31), null, null, null, null, 91, 23, 9.9, 'Monitora Cargas (fictícia)', 'MC-Tele 4', '33018-7', 'telemonitorado', null, true, '022', '00000000-0000-4000-8000-000000000104', (current_date + 160), '540 cv', 540, 900, '2022-11-03', 912000, 820000, 96410, 'D13K 540 0029184', 1.8, 2.6, 1),
  ('00000000-0000-4000-8000-000000000203', 'AYK8813', 6, (select id from public.marca_veiculo where nome = 'MERCEDES-BENZ'), 'Axor 2036', 'Vermelha', 2012, 2012, '00470021938', '9BM958074CB802216', '142207753019', 2026, '020114376620', '2026-03-04', '86411027735', 'Cambé', 'PR', '00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000108', 'ativo', 'normal', 'motorista', null, null, null, null, null, null, null, null, null, 50, 16, 7.1, null, null, null, null, null, null, '007', '00000000-0000-4000-8000-000000000108', null, '360 cv', 360, 480, null, null, null, 811200, 'OM457 LA 0410332', 2.4, 3.1, 1),
  ('00000000-0000-4000-8000-000000000204', 'RTU1F45', 7, (select id from public.marca_veiculo where nome = 'DAF'), 'XF 530 FTT', 'Branca', 2023, 2024, '01344572018', '9AFX530T0PR118450', '263420781154', 2026, '021951130047', '2026-04-18', '86413300926', 'Maringá', 'PR', '00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000110', 'arrendado', 'pendente', 'proprietario', '0031 5502 8812', (select id from public.operadora_tag where nome = 'PAMCARD TAG CONECTCAR'), 'Rota Sul Seguros (fictícia)', '1180027719', null, null, null, null, null, 80, 23, 9.6, 'Onixsat', 'OX-300', '771988', 'rastreador', 'SM aberta à mão até o PGR do arrendatário ser aprovado.', false, '031', '00000000-0000-4000-8000-000000000106', null, '530 cv', 530, 860, '2023-12-01', null, null, 41020, 'MX13 530 3318820', 1.9, 2.7, 1),
  ('00000000-0000-4000-8000-000000000205', 'MLC3D08', 7, (select id from public.marca_veiculo where nome = 'SCANIA'), 'G 410 6x2', 'Prata', 2019, 2019, '01170352291', '9BSG6X20003871150', '142211830467', 2025, '020177302215', '2025-03-22', null, 'Londrina', 'PR', '00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000110', 'parado', 'normal', 'proprietario', null, null, null, null, null, null, null, null, null, 60, 23, 9.1, null, null, null, null, null, null, '019', null, null, null, 410, 600, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000211', 'BRA7G33', 11, (select id from public.marca_veiculo where nome = 'RANDON'), 'Furgão SR 3E', 'Branca', 2021, 2021, '01284419027', '9ADB1243XMM441872', '263418907633', 2026, '021938476001', '2026-02-11', '86412093602', 'Arapongas', 'PR', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101', 'ativo', 'normal', 'proprietario', null, null, null, null, null, 'madeira', 15.4, 2.6, 2.9, null, 45, 8.4, null, null, null, null, null, null, '014-A', null, null, null, null, null, '2021-09-14', 248000, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000212', 'QHX2A61', 10, (select id from public.marca_veiculo where nome = 'LIBRELATO'), 'Graneleiro 3E', 'Branca', 2022, 2022, '01311097845', '9EP04123XN1007734', '263419112190', 2026, '021940019004', '2026-01-27', null, 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', 'proprietario', null, null, null, null, null, 'ferro', null, null, null, null, 45, 7.8, null, null, null, null, null, null, '022-A', null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000213', 'QHX2A62', 18, (select id from public.marca_veiculo where nome = 'LIBRELATO'), 'Dolly 2E', 'Branca', 2022, 2022, '01311097912', '9EP02120XN1007781', '263419112204', 2026, '021940019005', '2026-01-27', null, 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', 'proprietario', null, null, null, null, null, null, null, null, null, null, 12, 3.1, null, null, null, null, null, null, '022-D', null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000214', 'QHX2A63', 10, (select id from public.marca_veiculo where nome = 'LIBRELATO'), 'Graneleiro 3E', 'Branca', 2022, 2022, '01311098003', '9EP04123XN1007790', '263419112218', 2026, '021940019006', '2026-01-27', null, 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', 'proprietario', null, null, null, null, null, 'ferro', null, null, null, null, 45, 7.8, null, null, null, null, null, null, '022-B', null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000215', 'AZB5527', 14, (select id from public.marca_veiculo where nome = 'FACCHINI'), 'Basculante 3E', 'Vermelha', 2013, 2013, '00512276349', '94UBS0330DF062214', '142207753126', 2026, '020114377008', '2026-03-04', null, 'Cambé', 'PR', '00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000108', 'ativo', 'normal', 'motorista', null, null, null, null, null, 'ferro', null, null, null, null, 40, 8.9, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000216', 'RTV6H10', 8, (select id from public.marca_veiculo where nome = 'KRONE'), 'Sider SD 3E', 'Cinza', 2023, 2023, '01345120086', '9AA073SD0PR220419', '263420781260', 2026, '021951130155', '2026-04-18', null, 'Maringá', 'PR', '00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000110', 'arrendado', 'pendente', 'proprietario', null, null, null, null, null, 'madeira', 15.5, 2.6, 2.8, null, 45, 8.1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000217', 'MLD9B44', 11, (select id from public.marca_veiculo where nome = 'GUERRA'), 'Furgão 3E', 'Branca', 2018, 2018, '01088265412', '9AGBF3330JR301157', '142210098341', 2026, null, null, null, 'Londrina', 'PR', '00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000110', 'ativo', 'normal', 'proprietario', null, null, null, null, null, 'madeira', null, null, null, null, 45, 8.7, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1),
  ('00000000-0000-4000-8000-000000000218', 'RTX3C58', 10, (select id from public.marca_veiculo where nome = 'RANDON'), 'Graneleiro 3E', 'Branca', 2024, 2024, '01362240915', '9ADG1243XRM556201', null, 2026, null, null, null, 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', null, null, null, null, null, null, 'ferro', null, null, null, null, 45, 7.6, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000219', 'RTX3C59', 18, (select id from public.marca_veiculo where nome = 'RANDON'), 'Dolly 2E', 'Branca', 2024, 2024, '01362241008', '9ADD1220XRM556244', null, 2026, null, null, null, 'Apucarana', 'PR', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', null, null, null, null, null, null, null, null, null, null, null, 12, 3, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000221', 'BCP0E72', 31, (select id from public.marca_veiculo where nome = 'VOLKSWAGEN'), 'Constellation 24.280', 'Branca', 2020, 2020, '01201983355', '9536G8241LR021648', '142209554410', 2025, '020160038812', '2025-02-19', null, 'Arapongas', 'PR', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101', 'ativo', 'normal', 'motorista', null, null, null, null, null, null, null, null, null, null, 23, 8.2, null, null, null, null, null, null, null, null, null, null, 280, 275, null, null, null, null, null, null, null, 1)
on conflict do nothing;

-- conjunto (4 abertos + 1 encerrado no histórico de QHT4C27)
insert into public.conjunto (id, cavalo_id, motorista_id, inicio, fim) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', (current_date - 40)::timestamptz, null),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000104', (current_date - 12)::timestamptz, null),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000108', (current_date - 95)::timestamptz, null),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000106', (current_date - 3)::timestamptz, null),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', (current_date - 70)::timestamptz, (current_date - 12)::timestamptz)
on conflict do nothing;

-- conjunto_item (posição 1 = primeira peça atrás do cavalo)
insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values
  ('00000000-0000-4000-8000-000000000301', 1, '00000000-0000-4000-8000-000000000211'),
  ('00000000-0000-4000-8000-000000000302', 1, '00000000-0000-4000-8000-000000000212'),
  ('00000000-0000-4000-8000-000000000302', 2, '00000000-0000-4000-8000-000000000213'),
  ('00000000-0000-4000-8000-000000000302', 3, '00000000-0000-4000-8000-000000000214'),
  ('00000000-0000-4000-8000-000000000303', 1, '00000000-0000-4000-8000-000000000215'),
  ('00000000-0000-4000-8000-000000000304', 1, '00000000-0000-4000-8000-000000000216'),
  ('00000000-0000-4000-8000-000000000305', 1, '00000000-0000-4000-8000-000000000217')
on conflict do nothing;

-- arquivo (27 linhas de metadados; storage_path aponta para objetos que não existem, aceito na demo)
insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, veiculo_id, storage_path, nome_original, mime, tamanho_bytes, numero, validade, restrito, validado_em) values
  ('00000000-0000-4000-8000-000000000401', 5, '00000000-0000-4000-8000-000000000101', null, 'pessoa/00000000-0000-4000-8000-000000000101/00000000-0000-4000-8000-000000000401-cnh-edson.pdf', 'cnh-edson.pdf', 'application/pdf', 412000, null, (current_date + 412), false, now() - interval '900 hours'),
  ('00000000-0000-4000-8000-000000000402', 6, '00000000-0000-4000-8000-000000000101', null, 'pessoa/00000000-0000-4000-8000-000000000101/00000000-0000-4000-8000-000000000402-conta-luz-set.pdf', 'conta-luz-set.pdf', 'application/pdf', 188000, null, null, false, now() - interval '900 hours'),
  ('00000000-0000-4000-8000-000000000403', 5, '00000000-0000-4000-8000-000000000102', null, 'pessoa/00000000-0000-4000-8000-000000000102/00000000-0000-4000-8000-000000000403-cnh-claudio.jpg', 'cnh-claudio.jpg', 'image/jpeg', 902000, null, (current_date + 18), false, null),
  ('00000000-0000-4000-8000-000000000404', 6, '00000000-0000-4000-8000-000000000102', null, 'pessoa/00000000-0000-4000-8000-000000000102/00000000-0000-4000-8000-000000000404-agua-agosto.pdf', 'agua-agosto.pdf', 'application/pdf', 140000, null, null, false, null),
  ('00000000-0000-4000-8000-000000000405', 5, '00000000-0000-4000-8000-000000000103', null, 'pessoa/00000000-0000-4000-8000-000000000103/00000000-0000-4000-8000-000000000405-cnh-reinaldo.jpg', 'cnh-reinaldo.jpg', 'image/jpeg', 760000, null, (current_date - 6), false, null),
  ('00000000-0000-4000-8000-000000000406', 5, '00000000-0000-4000-8000-000000000104', null, 'pessoa/00000000-0000-4000-8000-000000000104/00000000-0000-4000-8000-000000000406-cnh-silvana.pdf', 'cnh-silvana.pdf', 'application/pdf', 398000, null, (current_date + 780), false, now() - interval '300 hours'),
  ('00000000-0000-4000-8000-000000000407', 6, '00000000-0000-4000-8000-000000000104', null, 'pessoa/00000000-0000-4000-8000-000000000104/00000000-0000-4000-8000-000000000407-internet-set.pdf', 'internet-set.pdf', 'application/pdf', 205000, null, null, false, null),
  ('00000000-0000-4000-8000-000000000408', 5, '00000000-0000-4000-8000-000000000106', null, 'pessoa/00000000-0000-4000-8000-000000000106/00000000-0000-4000-8000-000000000408-cnh-juliano.pdf', 'cnh-juliano.pdf', 'application/pdf', 377000, null, (current_date + 1040), false, null),
  ('00000000-0000-4000-8000-000000000409', 6, '00000000-0000-4000-8000-000000000106', null, 'pessoa/00000000-0000-4000-8000-000000000106/00000000-0000-4000-8000-000000000409-aluguel-recibo.pdf', 'aluguel-recibo.pdf', 'application/pdf', 96000, null, null, false, null),
  ('00000000-0000-4000-8000-000000000410', 5, '00000000-0000-4000-8000-000000000108', null, 'pessoa/00000000-0000-4000-8000-000000000108/00000000-0000-4000-8000-000000000410-cnh-otavio.pdf', 'cnh-otavio.pdf', 'application/pdf', 420000, null, (current_date + 46), false, null),
  ('00000000-0000-4000-8000-000000000411', 6, '00000000-0000-4000-8000-000000000108', null, 'pessoa/00000000-0000-4000-8000-000000000108/00000000-0000-4000-8000-000000000411-conta-luz.pdf', 'conta-luz.pdf', 'application/pdf', 177000, null, null, false, null),
  ('00000000-0000-4000-8000-000000000412', 1, '00000000-0000-4000-8000-000000000109', null, 'pessoa/00000000-0000-4000-8000-000000000109/00000000-0000-4000-8000-000000000412-rntrc-tsc.pdf', 'rntrc-tsc.pdf', 'application/pdf', 120000, null, (current_date + 530), false, null),
  ('00000000-0000-4000-8000-000000000413', 9, null, '00000000-0000-4000-8000-000000000201', 'veiculo/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000413-crlv-bra2e19.pdf', 'crlv-bra2e19.pdf', 'application/pdf', 230000, null, (current_date + 160), false, null),
  ('00000000-0000-4000-8000-000000000414', 9, null, '00000000-0000-4000-8000-000000000202', 'veiculo/00000000-0000-4000-8000-000000000202/00000000-0000-4000-8000-000000000414-crlv-qht4c27.pdf', 'crlv-qht4c27.pdf', 'application/pdf', 241000, null, (current_date + 160), false, null),
  ('00000000-0000-4000-8000-000000000415', 7, null, '00000000-0000-4000-8000-000000000216', 'veiculo/00000000-0000-4000-8000-000000000216/00000000-0000-4000-8000-000000000415-contrato-arrendamento-rtv6h10.pdf', 'contrato-arrendamento-rtv6h10.pdf', 'application/pdf', 655000, null, (current_date + 300), true, null),
  ('00000000-0000-4000-8000-000000000416', 12, null, '00000000-0000-4000-8000-000000000202', 'veiculo/00000000-0000-4000-8000-000000000202/00000000-0000-4000-8000-000000000416-rodotrem-lateral.jpg', 'rodotrem-lateral.jpg', 'image/jpeg', 1830000, null, null, false, null),
  ('00000000-0000-4000-8000-000000000421', 10, '00000000-0000-4000-8000-000000000101', null, 'pessoa/00000000-0000-4000-8000-000000000101/00000000-0000-4000-8000-000000000421-rg-edson-frente-verso.pdf', 'rg-edson-frente-verso.pdf', 'application/pdf', 310000, '8.421.336-2', null, true, now() - interval '900 hours'),
  ('00000000-0000-4000-8000-000000000431', 11, null, '00000000-0000-4000-8000-000000000201', 'veiculo/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000431-bra2e19-lateral.jpg', 'bra2e19-lateral.jpg', 'image/jpeg', 1420000, null, null, false, now() - interval '880 hours'),
  ('00000000-0000-4000-8000-000000000432', 9, null, '00000000-0000-4000-8000-000000000211', 'veiculo/00000000-0000-4000-8000-000000000211/00000000-0000-4000-8000-000000000432-crlv-bra7g33.pdf', 'crlv-bra7g33.pdf', 'application/pdf', 226000, null, (current_date + 160), false, now() - interval '870 hours'),
  ('00000000-0000-4000-8000-000000000433', 9, null, '00000000-0000-4000-8000-000000000204', 'veiculo/00000000-0000-4000-8000-000000000204/00000000-0000-4000-8000-000000000433-crlv-rtu1f45.pdf', 'crlv-rtu1f45.pdf', 'application/pdf', 238000, null, (current_date + 160), false, null),
  ('00000000-0000-4000-8000-000000000434', 9, null, '00000000-0000-4000-8000-000000000216', 'veiculo/00000000-0000-4000-8000-000000000216/00000000-0000-4000-8000-000000000434-crlv-rtv6h10.pdf', 'crlv-rtv6h10.pdf', 'application/pdf', 231000, null, (current_date + 160), false, null),
  ('00000000-0000-4000-8000-000000000435', 9, null, '00000000-0000-4000-8000-000000000203', 'veiculo/00000000-0000-4000-8000-000000000203/00000000-0000-4000-8000-000000000435-crlv-ayk8813.jpg', 'crlv-ayk8813.jpg', 'image/jpeg', 845000, null, (current_date - 21), false, null),
  ('00000000-0000-4000-8000-000000000436', 9, null, '00000000-0000-4000-8000-000000000212', 'veiculo/00000000-0000-4000-8000-000000000212/00000000-0000-4000-8000-000000000436-crlv-qhx2a61.pdf', 'crlv-qhx2a61.pdf', 'application/pdf', 229000, null, (current_date + 160), false, null),
  ('00000000-0000-4000-8000-000000000451', 1, '00000000-0000-4000-8000-000000000101', null, 'pessoa/00000000-0000-4000-8000-000000000101/00000000-0000-4000-8000-000000000451-rntrc-edson.pdf', 'rntrc-edson.pdf', 'application/pdf', 134000, null, (current_date + 210), false, now() - interval '4800 hours'),
  ('00000000-0000-4000-8000-000000000452', 1, '00000000-0000-4000-8000-000000000110', null, 'pessoa/00000000-0000-4000-8000-000000000110/00000000-0000-4000-8000-000000000452-rntrc-rodo-norte.pdf', 'rntrc-rodo-norte.pdf', 'application/pdf', 118000, null, (current_date - 12), false, now() - interval '9120 hours'),
  ('00000000-0000-4000-8000-000000000453', 4, '00000000-0000-4000-8000-000000000110', null, 'pessoa/00000000-0000-4000-8000-000000000110/00000000-0000-4000-8000-000000000453-cnd-federal-rodo-norte.pdf', 'cnd-federal-rodo-norte.pdf', 'application/pdf', 96000, null, (current_date + 74), false, null),
  ('00000000-0000-4000-8000-000000000454', 7, '00000000-0000-4000-8000-000000000111', null, 'pessoa/00000000-0000-4000-8000-000000000111/00000000-0000-4000-8000-000000000454-contrato-social-ivai.pdf', 'contrato-social-ivai.pdf', 'application/pdf', 1240000, null, null, true, null)
on conflict do nothing;

-- =============================================================================================
-- QUADRO DA OPERAÇÃO (Task 5): clientes, locais, pedidos e viagens em todas as colunas
-- =============================================================================================
-- Gravado direto como postgres (as RPCs exigem usuário logado com perfil; a seed não tem). Cada viagem
-- tem a linha do tempo (viagem_evento) coerente com a coluna em que está: um evento por passagem até
-- ela (mais o de pagamento de saída, de = para), como iniciar_viagem/mover_viagem gravariam. status_desde
-- escalonado para alguns cartões ficarem âmbar/vermelho com os tempos-limite padrão (quadro_limite).
-- Tempos relativos a now(): rodar de novo não atualiza viagens que já existem (on conflict do nothing),
-- só envelhece os cartões. "Frete finalizado" só aparece no dia (Brasília) em que a seed rodou.
-- Cada cavalo/motorista está em uma única viagem ativa (o que iniciar_viagem garante).
--
-- Viagens (ids ...1201 a ...1212; viagem.numero é gerado pelo banco):
--   1201 Trânsito (liberada com exceção pelo admin: RTU1F45 com cadastro pendente)
--   1202 Aguardando carregamento            1203 Em carregamento (âmbar)
--   1204 Aguardando NF e pagamento (vermelho; pagamento de saída ainda não confirmado)
--   1205 Em rota (com ocorrência aberta)    1206 Pausa não programada (âmbar)
--   1207 Aguardando descarga                1208 Aguardando contagem de divergência (vermelho)
--   1209 Resolução de divergência na carga (âmbar; falta)
--   1210 Frete finalizado hoje              1211 Planejada apta    1212 Planejada com CNH vencida

-- pessoa: 2 clientes PJ e 7 motoristas PF
insert into public.pessoa (id, tipo, nome, apelido, cpf, cnpj, situacao_cadastro, nome_fantasia) values
  ('00000000-0000-4000-8000-000000000113', 'pj', 'Cooperativa Agroindustrial Vale do Ivaí (fictícia)', 'Coop Ivaí', null, '73418296000139', 'normal', 'Coop Ivaí'),
  ('00000000-0000-4000-8000-000000000114', 'pj', 'Terminal Graneleiro Litoral Ltda (fictício)', 'Terminal Litoral', null, '58230714000176', 'normal', 'Terminal Litoral'),
  ('00000000-0000-4000-8000-000000000115', 'pf', 'Valdir Souza Bueno', 'Valdir', '28476193564', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000116', 'pf', 'Rogério Antunes Lima', 'Rogério', '41709362804', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000117', 'pf', 'Anderson Pires Camargo', null, '53928410741', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000118', 'pf', 'Leandro Fagundes Rocha', 'Leco', '60281739404', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000119', 'pf', 'Paulo Henrique Duarte', 'PH', '73519628040', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000120', 'pf', 'Márcio Teixeira Lopes', 'Márcio', '84620357162', null, 'normal', null),
  ('00000000-0000-4000-8000-000000000121', 'pf', 'Sérgio Batista Moura', 'Serginho', '95731846219', null, 'normal', null)
on conflict do nothing;

-- cliente (a Coop Ivaí exige GR)
insert into public.cliente (pessoa_id, condicao_faturamento, email_xml, email_cobranca, exige_gr, gerenciadora, exige_sm, exigencias) values
  ('00000000-0000-4000-8000-000000000113', 'quinzenal', 'xml@coopivai.exemplo', 'financeiro@coopivai.exemplo', true, 'Rota Segura GR (fictícia)', false, 'Lona obrigatória; agendar descarga com 24h.'),
  ('00000000-0000-4000-8000-000000000114', 'por_cte', 'cte@terminallitoral.exemplo', null, false, null, false, null)
on conflict do nothing;

-- locais de coleta (Coop Ivaí) e de descarga (Terminal Litoral)
insert into public.pessoa_endereco (id, pessoa_id, tipo, cep, logradouro, numero, bairro, cidade, uf, principal, janela_atendimento, contato_local) values
  ('00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000113', 'coleta_descarga', '86700000', 'Rodovia PR-218, km 3', 's/n', 'Zona Rural', 'Arapongas', 'PR', false, 'seg a sáb 6h–18h', 'Balança: Joel'),
  ('00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000113', 'coleta_descarga', '86800000', 'Estrada do Pirapó', '1200', 'Distrito Industrial', 'Apucarana', 'PR', false, 'seg a sex 7h–17h', 'Portaria'),
  ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-000000000114', 'coleta_descarga', '83203000', 'Avenida Portuária', '4400', 'Dom Pedro II', 'Paranaguá', 'PR', false, '24h com agendamento', 'Pátio de triagem'),
  ('00000000-0000-4000-8000-000000000517', '00000000-0000-4000-8000-000000000114', 'coleta_descarga', '84043000', 'Rodovia BR-376, km 500', 's/n', 'Distrito Industrial', 'Ponta Grossa', 'PR', false, 'seg a sex 7h–19h', 'Recebimento')
on conflict do nothing;

-- motorista (7; o Serginho está com a CNH vencida). Datas no dia de Brasília.
insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade) values
  ('00000000-0000-4000-8000-000000000115', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 540), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 90)),
  ('00000000-0000-4000-8000-000000000116', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 610), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 75)),
  ('00000000-0000-4000-8000-000000000117', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 230), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 60)),
  ('00000000-0000-4000-8000-000000000118', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 905), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 110)),
  ('00000000-0000-4000-8000-000000000119', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 400), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 45)),
  ('00000000-0000-4000-8000-000000000120', 'e', ((now() at time zone 'America/Sao_Paulo')::date + 720), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 130)),
  ('00000000-0000-4000-8000-000000000121', 'e', ((now() at time zone 'America/Sao_Paulo')::date - 9), 'normal', 'habilitado', ((now() at time zone 'America/Sao_Paulo')::date + 20))
on conflict do nothing;

-- veiculo: 7 cavalos (222-228) e 7 graneleiros (231-237) da TSC Transportes, CRLV do exercício do ano.
-- Placas fictícias com o prefixo TST da regra do projeto, no formato Mercosul (TST1B01…, TST2C01…): não
-- colidem com as dos testes pgTAP, que geram TST + 4 dígitos (TST0001…).
insert into public.veiculo (id, placa, tipo_veiculo_id, modelo, proprietario_posse_id, proprietario_documento_id, situacao_operacional, situacao_cadastro, exercicio_doc, cmt_t, pbt_t, tara_t, unidade_operacional_id) values
  ('00000000-0000-4000-8000-000000000222', 'TST1B01', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 1),
  ('00000000-0000-4000-8000-000000000223', 'TST1B02', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 1),
  ('00000000-0000-4000-8000-000000000224', 'TST1B03', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 2),
  ('00000000-0000-4000-8000-000000000225', 'TST1B04', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 2),
  ('00000000-0000-4000-8000-000000000226', 'TST1B05', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 3),
  ('00000000-0000-4000-8000-000000000227', 'TST1B06', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 3),
  ('00000000-0000-4000-8000-000000000228', 'TST1B07', 7, 'Cavalo 6x4 (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, 74, 23, 9.2, 1),
  ('00000000-0000-4000-8000-000000000231', 'TST2C01', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 1),
  ('00000000-0000-4000-8000-000000000232', 'TST2C02', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 1),
  ('00000000-0000-4000-8000-000000000233', 'TST2C03', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 2),
  ('00000000-0000-4000-8000-000000000234', 'TST2C04', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 2),
  ('00000000-0000-4000-8000-000000000235', 'TST2C05', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 3),
  ('00000000-0000-4000-8000-000000000236', 'TST2C06', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 3),
  ('00000000-0000-4000-8000-000000000237', 'TST2C07', 10, 'Graneleiro 3E (fictício)', '00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000109', 'ativo', 'normal', extract(year from (now() at time zone 'America/Sao_Paulo'))::int, null, 45, 7.8, 1)
on conflict do nothing;

-- conjunto (7 abertos: cavalo 222+i, graneleiro 231+i, motorista 115+i)
insert into public.conjunto (id, cavalo_id, motorista_id, inicio) values
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000222', '00000000-0000-4000-8000-000000000115', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000223', '00000000-0000-4000-8000-000000000116', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000224', '00000000-0000-4000-8000-000000000117', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000118', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000310', '00000000-0000-4000-8000-000000000226', '00000000-0000-4000-8000-000000000119', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000227', '00000000-0000-4000-8000-000000000120', (current_date - 30)::timestamptz),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000228', '00000000-0000-4000-8000-000000000121', (current_date - 30)::timestamptz)
on conflict do nothing;

insert into public.conjunto_item (conjunto_id, posicao, veiculo_id) values
  ('00000000-0000-4000-8000-000000000306', 1, '00000000-0000-4000-8000-000000000231'),
  ('00000000-0000-4000-8000-000000000307', 1, '00000000-0000-4000-8000-000000000232'),
  ('00000000-0000-4000-8000-000000000308', 1, '00000000-0000-4000-8000-000000000233'),
  ('00000000-0000-4000-8000-000000000309', 1, '00000000-0000-4000-8000-000000000234'),
  ('00000000-0000-4000-8000-000000000310', 1, '00000000-0000-4000-8000-000000000235'),
  ('00000000-0000-4000-8000-000000000311', 1, '00000000-0000-4000-8000-000000000236'),
  ('00000000-0000-4000-8000-000000000312', 1, '00000000-0000-4000-8000-000000000237')
on conflict do nothing;

-- pedido (2): soja Arapongas → Paranaguá (tomador Coop Ivaí) e milho Apucarana → Ponta Grossa (tomador Terminal)
insert into public.pedido (id, tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id, produto, peso_total_kg, coleta_prevista, entrega_prevista, frete_empresa_valor, frete_empresa_tipo, observacao) values
  ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000516', 'Soja em grãos', 444000, ((now() at time zone 'America/Sao_Paulo')::date - 2), ((now() at time zone 'America/Sao_Paulo')::date + 5), 165, 'por_tonelada', 'Contrato de safra (fictício).'),
  ('00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000517', 'Milho em grãos', 222000, ((now() at time zone 'America/Sao_Paulo')::date - 4), ((now() at time zone 'America/Sao_Paulo')::date + 3), 98, 'por_tonelada', null)
on conflict do nothing;

-- viagem: 10 iniciadas (uma por coluna). liberacao_aptidao = aptidão do conjunto calculada agora (como
-- iniciar_viagem guarda); dentro deste insert nenhuma viagem ainda está ativa, então a própria viagem não
-- aparece como "cavalo em viagem".
insert into public.viagem (id, pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, status_campo, status_desde, iniciada_em, liberacao_justificativa, liberacao_aptidao, peso_saida_kg, chave_cte, chave_mdfe, pagamento_saida_em, peso_chegada_kg, divergencia, divergencia_descricao, finalizada_em) values
  ('00000000-0000-4000-8000-000000001201', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000106', 37000, 'transito', now() - interval '40 minutes', now() - interval '40 minutes', 'Cadastro do arrendamento em revisão; saída liberada pela diretoria (fictício)', (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000001202', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000104', 57000, 'aguardando_carregamento', now() - interval '50 minutes', now() - interval '180 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000001203', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000108', 31000, 'em_carregamento', now() - interval '150 minutes', now() - interval '300 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), null, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000001204', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000222', '00000000-0000-4000-8000-000000000115', 37000, 'aguardando_nf_pagamento', now() - interval '270 minutes', now() - interval '600 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000114') with ordinality as a(codigo, nivel, mensagem, n)), 36850, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000001205', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000223', '00000000-0000-4000-8000-000000000116', 37000, 'em_rota', now() - interval '180 minutes', now() - interval '1500 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), 37120, '41261046912078000183570010000012051195423956', '41261046912078000183580010000012051195423950', now() - interval '1150 minutes', null, null, null, null),
  ('00000000-0000-4000-8000-000000001206', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000224', '00000000-0000-4000-8000-000000000117', 37000, 'pausa', now() - interval '45 minutes', now() - interval '1600 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), 36940, '41261046912078000183570010000012061195503140', '41261046912078000183580010000012061195503144', now() - interval '1290 minutes', null, null, null, null),
  ('00000000-0000-4000-8000-000000001207', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000118', 37000, 'aguardando_descarga', now() - interval '60 minutes', now() - interval '2000 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000114') with ordinality as a(codigo, nivel, mensagem, n)), 37010, '41261046912078000183570010000012071195582331', '41261046912078000183580010000012071195582335', now() - interval '1650 minutes', null, null, null, null),
  ('00000000-0000-4000-8000-000000001208', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000310', '00000000-0000-4000-8000-000000000226', '00000000-0000-4000-8000-000000000119', 37000, 'aguardando_contagem', now() - interval '1560 minutes', now() - interval '3500 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000310', '00000000-0000-4000-8000-000000000114') with ordinality as a(codigo, nivel, mensagem, n)), 36980, '41261046912078000183570010000012081195661522', '41261046912078000183580010000012081195661526', now() - interval '3150 minutes', 36950, null, null, null),
  ('00000000-0000-4000-8000-000000001209', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000227', '00000000-0000-4000-8000-000000000120', 37000, 'resolucao_divergencia', now() - interval '1800 minutes', now() - interval '5000 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000114') with ordinality as a(codigo, nivel, mensagem, n)), 36800, '41261046912078000183570010000012091195740713', '41261046912078000183580010000012091195740717', now() - interval '4650 minutes', 36380, 'falta', 'Faltaram 420 kg na balança do terminal', null),
  ('00000000-0000-4000-8000-000000001210', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 37000, 'frete_finalizado', greatest(now() - interval '50 minutes', ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo'), now() - interval '1800 minutes', null, (select coalesce(jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nivel', a.nivel, 'mensagem', a.mensagem) order by a.n), '[]'::jsonb) from public.aptidao_viagem('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000113') with ordinality as a(codigo, nivel, mensagem, n)), 37050, '41261046912078000183570010000012101195819906', '41261046912078000183580010000012101195819900', now() - interval '1450 minutes', 37030, 'sem_divergencia', null, greatest(now() - interval '50 minutes', ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo'))
on conflict do nothing;

-- viagem: 2 planejadas (status_campo nulo)
insert into public.viagem (id, pedido_id, conjunto_id, cavalo_id, motorista_id, peso_previsto_kg, frete_motorista_valor, frete_motorista_tipo, observacao) values
  ('00000000-0000-4000-8000-000000001211', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 37000, 92, 'por_tonelada', 'Planejada apta: pode iniciar.'),
  ('00000000-0000-4000-8000-000000001212', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000228', '00000000-0000-4000-8000-000000000121', 37000, 95, 'por_tonelada', 'Planejada com trava: CNH do motorista vencida.')
on conflict do nothing;

-- viagem_evento (id gerado: só grava para as viagens da seed que ainda não têm nenhum evento)
insert into public.viagem_evento (viagem_id, de, para, em, motivo, dados)
select e.viagem_id::uuid, e.de::public.status_campo, e.para::public.status_campo, e.em, e.motivo, e.dados
from (values
  ('00000000-0000-4000-8000-000000001201', null, 'transito', now() - interval '40 minutes', 'Cadastro do arrendamento em revisão; saída liberada pela diretoria (fictício)', jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001201'))),
  ('00000000-0000-4000-8000-000000001202', null, 'transito', now() - interval '180 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001202'))),
  ('00000000-0000-4000-8000-000000001202', 'transito', 'aguardando_carregamento', now() - interval '50 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001203', null, 'transito', now() - interval '300 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001203'))),
  ('00000000-0000-4000-8000-000000001203', 'transito', 'aguardando_carregamento', now() - interval '220 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001203', 'aguardando_carregamento', 'em_carregamento', now() - interval '150 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001204', null, 'transito', now() - interval '600 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001204'))),
  ('00000000-0000-4000-8000-000000001204', 'transito', 'aguardando_carregamento', now() - interval '480 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001204', 'aguardando_carregamento', 'em_carregamento', now() - interval '400 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001204', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '270 minutes', null, '{"peso_saida_kg":36850}'::jsonb),
  ('00000000-0000-4000-8000-000000001205', null, 'transito', now() - interval '1500 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001205'))),
  ('00000000-0000-4000-8000-000000001205', 'transito', 'aguardando_carregamento', now() - interval '1380 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001205', 'aguardando_carregamento', 'em_carregamento', now() - interval '1300 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001205', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '1200 minutes', null, '{"peso_saida_kg":37120}'::jsonb),
  ('00000000-0000-4000-8000-000000001205', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '1150 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001205', 'aguardando_nf_pagamento', 'em_rota', now() - interval '180 minutes', null, '{"chave_cte":"41261046912078000183570010000012051195423956","chave_mdfe":"41261046912078000183580010000012051195423950"}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', null, 'transito', now() - interval '1600 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001206'))),
  ('00000000-0000-4000-8000-000000001206', 'transito', 'aguardando_carregamento', now() - interval '1500 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', 'aguardando_carregamento', 'em_carregamento', now() - interval '1400 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '1320 minutes', null, '{"peso_saida_kg":36940}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '1290 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', 'aguardando_nf_pagamento', 'em_rota', now() - interval '240 minutes', null, '{"chave_cte":"41261046912078000183570010000012061195503140","chave_mdfe":"41261046912078000183580010000012061195503144"}'::jsonb),
  ('00000000-0000-4000-8000-000000001206', 'em_rota', 'pausa', now() - interval '45 minutes', null, '{"pausa_tipo":"problema","pausa_programada":false}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', null, 'transito', now() - interval '2000 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001207'))),
  ('00000000-0000-4000-8000-000000001207', 'transito', 'aguardando_carregamento', now() - interval '1900 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', 'aguardando_carregamento', 'em_carregamento', now() - interval '1800 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '1700 minutes', null, '{"peso_saida_kg":37010}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '1650 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', 'aguardando_nf_pagamento', 'em_rota', now() - interval '1500 minutes', null, '{"chave_cte":"41261046912078000183570010000012071195582331","chave_mdfe":"41261046912078000183580010000012071195582335"}'::jsonb),
  ('00000000-0000-4000-8000-000000001207', 'em_rota', 'aguardando_descarga', now() - interval '60 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', null, 'transito', now() - interval '3500 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001208'))),
  ('00000000-0000-4000-8000-000000001208', 'transito', 'aguardando_carregamento', now() - interval '3400 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'aguardando_carregamento', 'em_carregamento', now() - interval '3300 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '3200 minutes', null, '{"peso_saida_kg":36980}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '3150 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'aguardando_nf_pagamento', 'em_rota', now() - interval '3000 minutes', null, '{"chave_cte":"41261046912078000183570010000012081195661522","chave_mdfe":"41261046912078000183580010000012081195661526"}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'em_rota', 'aguardando_descarga', now() - interval '1700 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001208', 'aguardando_descarga', 'aguardando_contagem', now() - interval '1560 minutes', null, '{"peso_chegada_kg":36950}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', null, 'transito', now() - interval '5000 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001209'))),
  ('00000000-0000-4000-8000-000000001209', 'transito', 'aguardando_carregamento', now() - interval '4900 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'aguardando_carregamento', 'em_carregamento', now() - interval '4800 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '4700 minutes', null, '{"peso_saida_kg":36800}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '4650 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'aguardando_nf_pagamento', 'em_rota', now() - interval '4500 minutes', null, '{"chave_cte":"41261046912078000183570010000012091195740713","chave_mdfe":"41261046912078000183580010000012091195740717"}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'em_rota', 'aguardando_descarga', now() - interval '3200 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'aguardando_descarga', 'aguardando_contagem', now() - interval '3000 minutes', null, '{"peso_chegada_kg":36380}'::jsonb),
  ('00000000-0000-4000-8000-000000001209', 'aguardando_contagem', 'resolucao_divergencia', now() - interval '1800 minutes', null, '{"divergencia":"falta","divergencia_descricao":"Faltaram 420 kg na balança do terminal"}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', null, 'transito', now() - interval '1800 minutes', null, jsonb_build_object('aptidao', (select x.liberacao_aptidao from public.viagem x where x.id = '00000000-0000-4000-8000-000000001210'))),
  ('00000000-0000-4000-8000-000000001210', 'transito', 'aguardando_carregamento', now() - interval '1700 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'aguardando_carregamento', 'em_carregamento', now() - interval '1600 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'em_carregamento', 'aguardando_nf_pagamento', now() - interval '1500 minutes', null, '{"peso_saida_kg":37050}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'aguardando_nf_pagamento', 'aguardando_nf_pagamento', now() - interval '1450 minutes', null, '{"tipo": "pagamento_saida"}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'aguardando_nf_pagamento', 'em_rota', now() - interval '1300 minutes', null, '{"chave_cte":"41261046912078000183570010000012101195819906","chave_mdfe":"41261046912078000183580010000012101195819900"}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'em_rota', 'aguardando_descarga', now() - interval '400 minutes', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'aguardando_descarga', 'aguardando_contagem', now() - interval '200 minutes', null, '{"peso_chegada_kg":37030}'::jsonb),
  ('00000000-0000-4000-8000-000000001210', 'aguardando_contagem', 'frete_finalizado', greatest(now() - interval '50 minutes', ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo'), null, '{"divergencia":"sem_divergencia"}'::jsonb)
) as e (viagem_id, de, para, em, motivo, dados)
where not exists (select 1 from public.viagem_evento x where x.viagem_id = e.viagem_id::uuid);

-- viagem_pausa: a pausa aberta da 1206 (não programada, a partir de Em rota)
insert into public.viagem_pausa (id, viagem_id, tipo, programada, coluna_origem, inicio) values
  ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000001206', 'problema', false, 'em_rota', now() - interval '45 minutes')
on conflict do nothing;

-- viagem_ocorrencia: uma aberta na 1205 (Em rota)
insert into public.viagem_ocorrencia (id, viagem_id, tipo, descricao, aberta_em) values
  ('00000000-0000-4000-8000-000000001401', '00000000-0000-4000-8000-000000001205', 'atraso', 'Fila na balança da BR-376 (fictício).', now() - interval '100 minutes')
on conflict do nothing;

-- arquivo: canhotos (tipo 15) das viagens que já passaram de Aguardando descarga (sem objeto no Storage)
insert into public.arquivo (id, tipo_arquivo_id, viagem_id, storage_path, nome_original, mime) values
  ('00000000-0000-4000-8000-000000000455', 15, '00000000-0000-4000-8000-000000001208', 'viagem/00000000-0000-4000-8000-000000001208/00000000-0000-4000-8000-000000000455-canhoto.jpg', 'canhoto.jpg', 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000456', 15, '00000000-0000-4000-8000-000000001209', 'viagem/00000000-0000-4000-8000-000000001209/00000000-0000-4000-8000-000000000456-canhoto.jpg', 'canhoto.jpg', 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000457', 15, '00000000-0000-4000-8000-000000001210', 'viagem/00000000-0000-4000-8000-000000001210/00000000-0000-4000-8000-000000000457-canhoto.jpg', 'canhoto.jpg', 'image/jpeg')
on conflict do nothing;

commit;
