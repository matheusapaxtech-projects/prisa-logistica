-- =============================================================================================
-- LIMPEZA ANTES DA PRODUÇÃO: APAGA OS DADOS FICTÍCIOS, O QUE OS TESTES E2E CRIARAM E OS USUÁRIOS DE TESTE.
-- =============================================================================================
-- Para o responsável pelo NILT rodar UMA VEZ, no SQL Editor do Supabase (projeto tkfpbpqbnasabtzatojk),
-- antes de começar a usar o sistema com dados reais. Ninguém roda isto automaticamente: não é
-- migration e não foi executado durante o desenvolvimento.
--
-- ANTES DE RODAR (nesta ordem):
--   1. Remova os objetos do Storage (o SQL não apaga arquivos do bucket):
--        dentro de web/:  node scripts/dev-seed-storage.mjs --limpar
--      (usa o administrador de teste, então rode ANTES deste script, que apaga esse usuário).
--      Remove os PDFs fictícios da seed e qualquer documento anexado a pessoas/veículos da seed
--      ou criados pelos testes E2E. A parte 2 abaixo para com erro se ainda sobrar objeto.
--   2. Crie o primeiro administrador real (supabase/criar-primeiro-admin.sql) e confira que ele
--      entra no sistema: depois desta limpeza os usuários de teste deixam de existir.
--   3. Rode o arquivo inteiro: só a PARTE 1 (prévia, só leitura) executa, porque a PARTE 2 está
--      dentro de um comentário /* … */. Confira as contagens: "bloqueios" precisam ser 0 e
--      "administradores reais ativos" precisa ser pelo menos 1.
--   4. Para apagar: selecione no editor só as linhas da PARTE 2, de `begin;` até `commit;` (sem as
--      linhas /* e */ que a cercam), e rode a seleção ("Run selected"). É uma transação: ou apaga
--      tudo, ou nada.
--
-- O QUE É APAGADO
--   Seed (supabase/seed/dev_dados_ficticios.sql, ids fixos 00000000-0000-4000-8000-<12 dígitos>):
--     pessoa ...000000000101 a ...121, veículo ...201 a ...237, conjunto ...301 a ...312; o resto da
--     seed (motorista, proprietário, endereços e locais de coleta/descarga, telefones, e-mails,
--     referências, contas, Pix e arquivos 401-454) sai em cascata com a pessoa ou o veículo.
--   Quadro da operação (seed e o que as telas/E2E criaram em cima dela):
--     pedido ...1101 a ...1102 e todo pedido cujo tomador, remetente ou destinatário seja pessoa desta
--     limpeza; viagem ...1201 a ...1212 e toda viagem desses pedidos ou de um conjunto desta limpeza, com
--     os eventos, pausas, ocorrências e arquivos (canhotos) dela; o papel cliente das pessoas da limpeza.
--     Ordem: eventos/pausas/ocorrências/arquivos de viagem → viagem → pedido → cliente → conjunto →
--     veículo → pessoa (viagem e pedido apontam para conjunto, local e cliente com on delete restrict).
--   Testes E2E (web/tests/e2e/*.spec.ts):
--     pessoas com nome "E2E Motorista …" ou "E2E Proprietário …" (prefixo "E2E "), veículos com
--     modelo "E2E Teste", e tudo o que pende deles (cascata). Conjuntos montados pelos testes sobre
--     veículos da seed (o montador remonta o cavalo da seed) também saem: todo conjunto cujo cavalo,
--     peça ou motorista esteja nesta limpeza. Sem isso o `on delete restrict` de conjunto/
--     conjunto_item impediria apagar os veículos.
--   Usuários de teste (auth.users + auth.identities + sessões em cascata + perfil_usuario):
--     e2e00000-0000-4000-8000-000000000001  teste.admin@nilt.test      (admin)
--     e2e00000-0000-4000-8000-000000000002  teste.semperfil@nilt.test  (sem perfil)
--     e2e00000-0000-4000-8000-000000000003  teste.operacao@nilt.test   (operacao)
--   Auditoria: as linhas sobre os registros apagados (inclusive as de "delete" que esta própria
--   limpeza gera) e as linhas de ações feitas pelos usuários de teste.
--
-- O QUE NÃO É APAGADO: catálogos (tipos de veículo, marcas, bancos, tipos de arquivo…), cadastros
-- reais e os usuários reais. Se algum cadastro real apontar para um proprietário/motorista da seed
-- (ex.: veículo real com proprietário "TSC Transportes"), a parte 2 para com erro de chave
-- estrangeira e nada é apagado: a prévia mostra esses casos em "bloqueios".
--
-- TRAVAS DA PARTE 2 (param com erro e não apagam nada):
--   - não existe administrador real ativo (perfil admin ativo fora dos 3 usuários de teste): sem ele
--     ninguém entraria no sistema depois da limpeza;
--   - algum conjunto da limpeza (escolhido porque o motorista é fictício) tem cavalo ou peça real:
--     troque o motorista desse conjunto pela tela antes de limpar;
--   - alguma viagem entra na limpeza só por usar um conjunto fictício, mas é de um pedido real: é uma
--     viagem real com veículo/motorista fictício; decida o que fazer com ela antes de limpar;
--   - ainda há documentos destes cadastros (ou canhotos destas viagens) no Storage.
-- =============================================================================================


-- =============================================================================================
-- PARTE 1: PRÉVIA (só leitura). Rode e confira antes da parte 2.
-- =============================================================================================
with
pessoas as (
  select id from public.pessoa
  where id between '00000000-0000-4000-8000-000000000101' and '00000000-0000-4000-8000-000000000121'
     or nome like 'E2E %'
),
veiculos as (
  select id from public.veiculo
  where id between '00000000-0000-4000-8000-000000000201' and '00000000-0000-4000-8000-000000000237'
     or modelo = 'E2E Teste'
),
conjuntos as (
  select c.id, c.fim from public.conjunto c
  where c.id between '00000000-0000-4000-8000-000000000301' and '00000000-0000-4000-8000-000000000312'
     or c.cavalo_id in (select id from veiculos)
     or c.motorista_id in (select id from pessoas)
     or exists (select 1 from public.conjunto_item i where i.conjunto_id = c.id and i.veiculo_id in (select id from veiculos))
),
pedidos as (
  select p.id from public.pedido p
  where p.id between '00000000-0000-4000-8000-000000001101' and '00000000-0000-4000-8000-000000001102'
     or p.tomador_id in (select id from pessoas)
     or p.remetente_id in (select id from pessoas)
     or p.destinatario_id in (select id from pessoas)
),
viagens as (
  select v.id, v.pedido_id from public.viagem v
  where v.id between '00000000-0000-4000-8000-000000001201' and '00000000-0000-4000-8000-000000001212'
     or v.pedido_id in (select id from pedidos)
     or v.conjunto_id in (select id from conjuntos)
),
usuarios as (
  select id from auth.users
  where id in ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000003')
)
select o_que, quantos from (values
  (1,  'pessoas (seed + E2E)',                (select count(*) from pessoas)),
  (2,  '  das quais E2E',                     (select count(*) from public.pessoa where nome like 'E2E %')),
  (3,  'motoristas (cascata)',                (select count(*) from public.motorista where pessoa_id in (select id from pessoas))),
  (4,  'proprietários (cascata)',             (select count(*) from public.proprietario where pessoa_id in (select id from pessoas))),
  (5,  'endereços/telefones/e-mails',         (select (select count(*) from public.pessoa_endereco where pessoa_id in (select id from pessoas))
                                                    + (select count(*) from public.pessoa_telefone where pessoa_id in (select id from pessoas))
                                                    + (select count(*) from public.pessoa_email where pessoa_id in (select id from pessoas)))),
  (6,  'referências',                         (select count(*) from public.motorista_referencia where motorista_id in (select id from pessoas))),
  (7,  'contas e chaves Pix',                 (select (select count(*) from public.pessoa_conta_bancaria where pessoa_id in (select id from pessoas))
                                                    + (select count(*) from public.pessoa_chave_pix where pessoa_id in (select id from pessoas)))),
  (8,  'veículos (seed + E2E)',               (select count(*) from veiculos)),
  (9,  '  dos quais E2E',                     (select count(*) from public.veiculo where modelo = 'E2E Teste')),
  (10, 'conjuntos (abertos + encerrados)',    (select count(*) from conjuntos)),
  (11, '  abertos',                           (select count(*) from conjuntos where fim is null)),
  (12, 'itens de conjunto',                   (select count(*) from public.conjunto_item where conjunto_id in (select id from conjuntos))),
  (13, 'arquivos (linhas, inclusive canhotos)', (select count(*) from public.arquivo where pessoa_id in (select id from pessoas) or veiculo_id in (select id from veiculos)
                                                                                    or viagem_id in (select id from viagens))),
  (14, 'objetos ainda no Storage (deve ser 0)', (select count(*) from storage.objects o
                                                  where o.bucket_id = 'documentos'
                                                    and o.name in (select a.storage_path from public.arquivo a
                                                                   where a.pessoa_id in (select id from pessoas) or a.veiculo_id in (select id from veiculos)
                                                                      or a.viagem_id in (select id from viagens)))),
  (15, 'usuários de teste',                   (select count(*) from usuarios)),
  (16, 'perfis dos usuários de teste',        (select count(*) from public.perfil_usuario where user_id in (select id from usuarios))),
  (17, 'auditoria feita pelos usuários de teste', (select count(*) from public.auditoria where usuario_id in (select id from usuarios))),
  (18, 'bloqueios: veículos reais ligados a pessoas da limpeza (deve ser 0)',
                                              (select count(*) from public.veiculo v
                                               where v.id not in (select id from veiculos)
                                                 and (v.proprietario_documento_id in (select id from pessoas)
                                                      or v.proprietario_posse_id in (select id from pessoas)
                                                      or v.ultimo_motorista_id in (select id from pessoas)))),
  (19, 'usuários que NÃO são de teste (ficam)', (select count(*) from auth.users where id not in (select id from usuarios))),
  (20, 'pessoas que ficam',                   (select count(*) from public.pessoa where id not in (select id from pessoas))),
  (21, 'veículos que ficam',                  (select count(*) from public.veiculo where id not in (select id from veiculos))),
  (22, 'bloqueios: conjuntos da limpeza com cavalo ou peça real (deve ser 0)',
                                              (select count(*) from conjuntos c
                                               where c.id in (select cj.id from public.conjunto cj
                                                              where cj.cavalo_id not in (select id from veiculos)
                                                                 or exists (select 1 from public.conjunto_item i
                                                                            where i.conjunto_id = cj.id
                                                                              and i.veiculo_id not in (select id from veiculos))))),
  (23, 'administradores reais ativos (deve ser 1 ou mais)',
                                              (select count(*) from public.perfil_usuario p
                                               where p.papel = 'admin' and p.ativo
                                                 and p.user_id not in (select id from usuarios))),
  (24, 'clientes (papel; a pessoa sai depois)', (select count(*) from public.cliente where pessoa_id in (select id from pessoas))),
  (25, 'pedidos',                             (select count(*) from pedidos)),
  (26, 'viagens',                             (select count(*) from viagens)),
  (27, 'eventos, pausas e ocorrências de viagem', (select (select count(*) from public.viagem_evento where viagem_id in (select id from viagens))
                                                    + (select count(*) from public.viagem_pausa where viagem_id in (select id from viagens))
                                                    + (select count(*) from public.viagem_ocorrencia where viagem_id in (select id from viagens)))),
  (28, 'bloqueios: viagens de pedido real em conjunto fictício (deve ser 0)',
                                              (select count(*) from viagens where pedido_id not in (select id from pedidos))),
  (29, 'pedidos que ficam',                   (select count(*) from public.pedido where id not in (select id from pedidos))),
  (30, 'viagens que ficam',                   (select count(*) from public.viagem where id not in (select id from viagens)))
) as t(ordem, o_que, quantos)
order by ordem;


-- =============================================================================================
-- PARTE 2: LIMPEZA (uma transação). Fica comentada de propósito: rodar o arquivo inteiro só mostra a
-- prévia. Para apagar, selecione de `begin;` até `commit;` (sem as linhas /* e */) e rode a seleção.
-- =============================================================================================
/* PARTE 2 — início do comentário

begin;

-- Alvos (mesmos critérios da prévia), guardados antes de apagar.
create temporary table limpeza_pessoa on commit drop as
  select id from public.pessoa
  where id between '00000000-0000-4000-8000-000000000101' and '00000000-0000-4000-8000-000000000121'
     or nome like 'E2E %';

create temporary table limpeza_veiculo on commit drop as
  select id from public.veiculo
  where id between '00000000-0000-4000-8000-000000000201' and '00000000-0000-4000-8000-000000000237'
     or modelo = 'E2E Teste';

create temporary table limpeza_conjunto on commit drop as
  select c.id from public.conjunto c
  where c.id between '00000000-0000-4000-8000-000000000301' and '00000000-0000-4000-8000-000000000312'
     or c.cavalo_id in (select id from limpeza_veiculo)
     or c.motorista_id in (select id from limpeza_pessoa)
     or exists (select 1 from public.conjunto_item i where i.conjunto_id = c.id and i.veiculo_id in (select id from limpeza_veiculo));

create temporary table limpeza_pedido on commit drop as
  select p.id from public.pedido p
  where p.id between '00000000-0000-4000-8000-000000001101' and '00000000-0000-4000-8000-000000001102'
     or p.tomador_id in (select id from limpeza_pessoa)
     or p.remetente_id in (select id from limpeza_pessoa)
     or p.destinatario_id in (select id from limpeza_pessoa);

create temporary table limpeza_viagem on commit drop as
  select v.id, v.pedido_id from public.viagem v
  where v.id between '00000000-0000-4000-8000-000000001201' and '00000000-0000-4000-8000-000000001212'
     or v.pedido_id in (select id from limpeza_pedido)
     or v.conjunto_id in (select id from limpeza_conjunto);

create temporary table limpeza_usuario on commit drop as
  select id from auth.users
  where id in ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000003');

-- Para a auditoria: (tabela, registro_id) de tudo o que vai sair, no formato do gatilho fn_auditoria
-- (chave primária; chave composta unida por ':').
create temporary table limpeza_registro (tabela text, registro_id text) on commit drop;
insert into limpeza_registro
  select 'pessoa', id::text from limpeza_pessoa
  union all select 'motorista', pessoa_id::text from public.motorista where pessoa_id in (select id from limpeza_pessoa)
  union all select 'proprietario', pessoa_id::text from public.proprietario where pessoa_id in (select id from limpeza_pessoa)
  union all select 'pessoa_endereco', id::text from public.pessoa_endereco where pessoa_id in (select id from limpeza_pessoa)
  union all select 'pessoa_telefone', id::text from public.pessoa_telefone where pessoa_id in (select id from limpeza_pessoa)
  union all select 'pessoa_email', id::text from public.pessoa_email where pessoa_id in (select id from limpeza_pessoa)
  union all select 'motorista_referencia', id::text from public.motorista_referencia where motorista_id in (select id from limpeza_pessoa)
  union all select 'pessoa_conta_bancaria', id::text from public.pessoa_conta_bancaria where pessoa_id in (select id from limpeza_pessoa)
  union all select 'pessoa_chave_pix', id::text from public.pessoa_chave_pix where pessoa_id in (select id from limpeza_pessoa)
  union all select 'veiculo', id::text from limpeza_veiculo
  union all select 'conjunto', id::text from limpeza_conjunto
  union all select 'conjunto_item', conjunto_id::text || ':' || posicao::text from public.conjunto_item where conjunto_id in (select id from limpeza_conjunto)
  union all select 'arquivo', id::text from public.arquivo
            where pessoa_id in (select id from limpeza_pessoa) or veiculo_id in (select id from limpeza_veiculo)
               or viagem_id in (select id from limpeza_viagem)
  union all select 'cliente', pessoa_id::text from public.cliente where pessoa_id in (select id from limpeza_pessoa)
  union all select 'pedido', id::text from limpeza_pedido
  union all select 'viagem', id::text from limpeza_viagem
  union all select 'viagem_pausa', id::text from public.viagem_pausa where viagem_id in (select id from limpeza_viagem)
  union all select 'viagem_ocorrencia', id::text from public.viagem_ocorrencia where viagem_id in (select id from limpeza_viagem)
  union all select 'perfil_usuario', id::text from limpeza_usuario;

-- Trava: precisa existir um administrador real ativo (fora dos usuários de teste), senão ninguém entra
-- no sistema depois da limpeza.
do $$
begin
  if not exists (
    select 1 from public.perfil_usuario p
    where p.papel = 'admin' and p.ativo
      and p.user_id not in (select id from limpeza_usuario)
      and p.user_id not in ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000002', 'e2e00000-0000-4000-8000-000000000003')
  ) then
    raise exception 'Não há administrador real ativo. Crie o primeiro administrador (supabase/criar-primeiro-admin.sql), confira que ele entra e só então rode a limpeza.';
  end if;
end $$;

-- Trava: um conjunto entra na limpeza também quando só o motorista é fictício; se o cavalo ou alguma
-- peça for real, apagar o conjunto apagaria um registro real. Troque o motorista pela tela antes.
do $$
begin
  if exists (
    select 1 from public.conjunto c
    where c.id in (select id from limpeza_conjunto)
      and (c.cavalo_id not in (select id from limpeza_veiculo)
           or exists (select 1 from public.conjunto_item i
                      where i.conjunto_id = c.id and i.veiculo_id not in (select id from limpeza_veiculo)))
  ) then
    raise exception 'Há conjunto com cavalo ou peça real e motorista fictício. Troque o motorista desse conjunto pela tela e rode de novo.';
  end if;
end $$;

-- Trava: uma viagem entra na limpeza só por usar um conjunto fictício, mas o pedido dela é real.
do $$
begin
  if exists (select 1 from limpeza_viagem where pedido_id not in (select id from limpeza_pedido)) then
    raise exception 'Há viagem de pedido real usando conjunto fictício (veículo ou motorista da seed). Resolva essa viagem pela tela e rode de novo.';
  end if;
end $$;

-- Trava: objetos do Storage precisam sair antes (node web/scripts/dev-seed-storage.mjs --limpar).
do $$
begin
  if exists (
    select 1 from storage.objects o
    join public.arquivo a on a.storage_path = o.name
    where o.bucket_id = 'documentos'
      and (a.pessoa_id in (select id from limpeza_pessoa) or a.veiculo_id in (select id from limpeza_veiculo)
           or a.viagem_id in (select id from limpeza_viagem))
  ) then
    raise exception 'Ainda há documentos destes cadastros no Storage. Rode antes, dentro de web/: node scripts/dev-seed-storage.mjs --limpar';
  end if;
end $$;

-- 0. Quadro da operação: o que pende da viagem (sairia em cascata; apagado antes, por clareza), a viagem
--    (aponta para pedido e conjunto com on delete restrict), o pedido (aponta para cliente e locais com
--    on delete restrict) e o papel cliente (aponta para a pessoa com on delete restrict).
delete from public.viagem_evento where viagem_id in (select id from limpeza_viagem);
delete from public.viagem_pausa where viagem_id in (select id from limpeza_viagem);
delete from public.viagem_ocorrencia where viagem_id in (select id from limpeza_viagem);
delete from public.arquivo where viagem_id in (select id from limpeza_viagem);
delete from public.viagem where id in (select id from limpeza_viagem);
delete from public.pedido where id in (select id from limpeza_pedido);
delete from public.cliente where pessoa_id in (select id from limpeza_pessoa);

-- 1. Conjuntos (os itens saem em cascata). Antes dos veículos e motoristas: on delete restrict.
delete from public.conjunto where id in (select id from limpeza_conjunto);

-- 2. Veículos (arquivos do veículo em cascata). Antes das pessoas: o veículo aponta para o
--    proprietário (documento e posse) e para o último motorista com on delete restrict.
delete from public.veiculo where id in (select id from limpeza_veiculo);

-- 3. Pessoas: motorista, proprietário, endereços, telefones, e-mails, referências, contas, Pix e
--    arquivos da pessoa saem em cascata.
delete from public.pessoa where id in (select id from limpeza_pessoa);

-- 4. Usuários de teste: perfil_usuario, auth.identities, sessões e fatores saem em cascata de
--    auth.users; identities apagadas explicitamente antes, por clareza.
delete from auth.identities where user_id in (select id from limpeza_usuario);
delete from public.perfil_usuario where user_id in (select id from limpeza_usuario);
delete from auth.users where id in (select id from limpeza_usuario);

-- 5. Auditoria por último (os deletes acima também geraram linhas, com as mesmas chaves).
delete from public.auditoria a
using limpeza_registro r
where a.tabela = r.tabela and a.registro_id = r.registro_id;
delete from public.auditoria where usuario_id in (select id from limpeza_usuario);

-- Conferência: tudo zerado (se algo sobrar, o erro desfaz a transação inteira).
do $$
begin
  if exists (select 1 from public.pessoa where id in (select id from limpeza_pessoa))
     or exists (select 1 from public.viagem where id in (select id from limpeza_viagem))
     or exists (select 1 from public.pedido where id in (select id from limpeza_pedido))
     or exists (select 1 from public.veiculo where id in (select id from limpeza_veiculo))
     or exists (select 1 from public.conjunto where id in (select id from limpeza_conjunto))
     or exists (select 1 from auth.users where id in (select id from limpeza_usuario)) then
    raise exception 'A limpeza não apagou tudo; nada foi alterado.';
  end if;
end $$;

commit;

PARTE 2 — fim do comentário */
