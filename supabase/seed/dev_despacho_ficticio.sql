-- =============================================================================================
-- SEED DE DESENVOLVIMENTO: CENÁRIO FICTÍCIO DO DESPACHO. NÃO É MIGRATION E NUNCA DEVE IR PARA PRODUÇÃO.
-- =============================================================================================
-- Dois pedidos saindo do norte do Paraná e oito motoristas livres por perto, para ver o Despacho
-- (/despacho): ranking, apto × pendente, lote sugerido e contratar. Rodar só no banco local:
--   docker exec -i supabase_db_nilt psql -U postgres -d postgres < supabase/seed/dev_despacho_ficticio.sql
-- Nomes, documentos, placas e telefones são inventados (CPF e CNPJ com dígito verificador calculado aqui).
-- Reexecutável: ids fixos 00000000-0000-4000-9000-… e `on conflict do nothing`. As disponibilidades são
-- renovadas a cada execução (as horas de "avisou que está livre" contam a partir de agora).
--
-- Casos: Valdir sem consulta na gerenciadora (pendente), Luiz com o conjunto ainda não aprovado (pendente),
-- Cláudio recusado pela gerenciadora (pendente, trava legal), Sérgio a 114 km; os demais aptos.

begin;

create function pg_temp.dv(base text, pesos int[]) returns text language sql immutable as $$
  select (case when r < 2 then 0 else 11 - r end)::text
  from (select sum(substr(base, i, 1)::int * pesos[i]) % 11 as r from generate_series(1, length(base)) i) x;
$$;
create function pg_temp.cpf(n9 text) returns text language sql immutable as $$
  select n9 || d1 || pg_temp.dv(n9 || d1, array[11,10,9,8,7,6,5,4,3,2])
  from (select pg_temp.dv(n9, array[10,9,8,7,6,5,4,3,2]) as d1) x;
$$;
create function pg_temp.cnpj(n12 text) returns text language sql immutable as $$
  select n12 || d1 || pg_temp.dv(n12 || d1, array[6,5,4,3,2,9,8,7,6,5,4,3,2])
  from (select pg_temp.dv(n12, array[5,4,3,2,9,8,7,6,5,4,3,2]) as d1) x;
$$;
create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- cliente e locais
insert into public.pessoa (id, tipo, nome, nome_fantasia, cnpj, situacao_cadastro) values
  (pg_temp.id(1), 'pj', 'Cooperativa Agrícola Exemplo do Norte', 'Coop Exemplo', pg_temp.cnpj('907001230001'), 'normal'),
  (pg_temp.id(2), 'pj', 'Cerealista Fictícia do Vale Ltda', 'Cerealista Vale', pg_temp.cnpj('907001240001'), 'normal')
on conflict do nothing;
insert into public.cliente (pessoa_id) values (pg_temp.id(1)), (pg_temp.id(2)) on conflict do nothing;
insert into public.pessoa_endereco (id, pessoa_id, tipo, cidade, uf) values
  (pg_temp.id(11), pg_temp.id(1), 'coleta_descarga', 'Mandaguari', 'PR'),
  (pg_temp.id(12), pg_temp.id(1), 'coleta_descarga', 'Bonito', 'MS'),
  (pg_temp.id(13), pg_temp.id(2), 'coleta_descarga', 'Arapongas', 'PR'),
  (pg_temp.id(14), pg_temp.id(2), 'coleta_descarga', 'Rio Verde', 'GO')
on conflict do nothing;

-- pedidos (coleta amanhã)
insert into public.pedido (id, tomador_id, remetente_id, destinatario_id, local_coleta_id, local_descarga_id, produto,
                           peso_total_kg, frete_empresa_valor, frete_empresa_tipo, tipo_carga_antt, coleta_prevista) values
  (pg_temp.id(21), pg_temp.id(1), pg_temp.id(1), pg_temp.id(1), pg_temp.id(11), pg_temp.id(12), 'Milho a granel',
   150000, 287.60, 'por_tonelada', 'granel_solido', (now() at time zone 'America/Sao_Paulo')::date + 1),
  (pg_temp.id(22), pg_temp.id(2), pg_temp.id(2), pg_temp.id(2), pg_temp.id(13), pg_temp.id(14), 'Soja a granel',
   76000, 305.00, 'por_tonelada', 'granel_solido', (now() at time zone 'America/Sao_Paulo')::date + 1)
on conflict do nothing;

-- transportadoras (donas de alguns cavalos)
insert into public.pessoa (id, tipo, nome, cnpj, situacao_cadastro) values
  (pg_temp.id(31), 'pj', 'Transportes Exemplo Ivaí Ltda', pg_temp.cnpj('907002310001'), 'normal'),
  (pg_temp.id(32), 'pj', 'Rodoviário Fictício Pioneiro S.A.', pg_temp.cnpj('907002320001'), 'normal')
on conflict do nothing;

-- motoristas: (n, nome, cpf, situação na gerenciadora, cidade, lat, lon, horas desde o aviso, eixos, dono)
create temp table m (n int, nome text, cpf9 text, gr text, cidade text, lat numeric, lon numeric, horas numeric, eixos int, dono int, aprovado boolean);
insert into m values
  (1, 'Marcos Fictício Pereira',  '907100001', 'habilitado',   'Maringá/PR',        -23.4205, -51.9333, 4,    9, 31,   true),
  (2, 'Valdir Exemplo Moreira',   '907100002', 'sem_consulta', 'Mandaguari/PR',     -23.5446, -51.6710, 0.3,  6, null, true),
  (3, 'João Teste da Silva',      '907100003', 'habilitado',   'Arapongas/PR',      -23.4152, -51.4259, 1,    9, null, true),
  (4, 'Luiz Exemplo Rocha',       '907100004', 'habilitado',   'Apucarana/PR',      -23.5510, -51.4609, 0.5,  9, null, false),
  (5, 'Cláudio Fictício Alves',   '907100005', 'recusado',     'Jandaia do Sul/PR', -23.6011, -51.6448, 1,    6, null, true),
  (6, 'Edson Exemplo Lopes',      '907100006', 'habilitado',   'Londrina/PR',       -23.3045, -51.1696, 2,    7, 32,   true),
  (7, 'Sérgio Teste Camargo',     '907100007', 'habilitado',   'Campo Mourão/PR',   -24.0463, -52.3780, 3,    6, null, true),
  (8, 'Paulo Fictício Kowalski',  '907100008', 'habilitado',   'Ponta Grossa/PR',   -25.0945, -50.1633, 1,    9, 31,   true);

insert into public.pessoa (id, tipo, nome, cpf, situacao_cadastro)
select pg_temp.id(100 + n), 'pf', nome, pg_temp.cpf(cpf9), 'normal' from m
on conflict do nothing;
insert into public.motorista (pessoa_id, cnh_categoria, cnh_validade, situacao_cadastro, situacao_gr, gr_validade, gr_gerenciadora, gr_consulta_em)
select pg_temp.id(100 + n), 'e', current_date + 400, 'normal', gr::public.situacao_gr,
       case when gr = 'sem_consulta' then null else current_date + 90 end,
       case when gr = 'sem_consulta' then null else 'Gerenciadora Exemplo' end,
       case when gr = 'sem_consulta' then null else current_date - 10 end
from m
on conflict do nothing;
insert into public.pessoa_telefone (pessoa_id, numero, whatsapp, principal)
select pg_temp.id(100 + n), '4399' || lpad((9000000 + n)::text, 7, '0'), true, true from m
where not exists (select 1 from public.pessoa_telefone t where t.pessoa_id = pg_temp.id(100 + m.n));

-- proprietários (RNTRC na ANTT): a transportadora ou o próprio motorista
insert into public.proprietario (pessoa_id, rntrc) select pg_temp.id(31), '000900031' on conflict do nothing;
insert into public.proprietario (pessoa_id, rntrc) select pg_temp.id(32), '000900032' on conflict do nothing;
insert into public.proprietario (pessoa_id, rntrc)
select pg_temp.id(100 + n), lpad((900100 + n)::text, 9, '0') from m where dono is null
on conflict do nothing;

-- veículos: cavalo trucado (3 eixos) + carretas. 9 eixos = 2 bitrens de 3 (25 t cada); 7 = 2 carretas de 2
-- (19 t); 6 = 1 graneleira trucada (32 t).
insert into public.veiculo (id, placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, situacao_cadastro, exercicio_doc, capacidade_carga_t)
select pg_temp.id(200 + n), 'DSP' || n || 'A' || lpad(n::text, 2, '0'), 7, coalesce(pg_temp.id(dono), pg_temp.id(100 + n)),
       coalesce(pg_temp.id(dono), pg_temp.id(100 + n)), 'normal', extract(year from current_date)::int, null
from m
on conflict do nothing;
insert into public.veiculo (id, placa, tipo_veiculo_id, proprietario_posse_id, proprietario_documento_id, situacao_cadastro, exercicio_doc, capacidade_carga_t)
select pg_temp.id(300 + n * 2 + k), 'DSP' || n || chr(65 + k) || lpad((10 + k)::text, 2, '0'),
       case eixos when 9 then 22 when 7 then 9 else 10 end,
       coalesce(pg_temp.id(dono), pg_temp.id(100 + n)), coalesce(pg_temp.id(dono), pg_temp.id(100 + n)), 'normal',
       extract(year from current_date)::int, case eixos when 9 then 25 when 7 then 19 else 32 end
from m cross join generate_series(1, 2) k
where k = 1 or eixos in (7, 9)
on conflict do nothing;

-- conjuntos abertos
insert into public.conjunto (id, cavalo_id, motorista_id, inicio, aprovado_em)
select pg_temp.id(400 + n), pg_temp.id(200 + n), pg_temp.id(100 + n), now() - interval '30 days', case when aprovado then now() end
from m
where not exists (select 1 from public.conjunto c where c.cavalo_id = pg_temp.id(200 + m.n) and c.fim is null)
on conflict do nothing;
insert into public.conjunto_item (conjunto_id, posicao, veiculo_id)
select pg_temp.id(400 + n), k, pg_temp.id(300 + n * 2 + k)
from m cross join generate_series(1, 2) k
where (k = 1 or eixos in (7, 9)) and exists (select 1 from public.conjunto c where c.id = pg_temp.id(400 + m.n))
on conflict do nothing;

-- disponibilidade renovada: "avisou que está livre" há `horas`, livre por 48 h
delete from public.motorista_disponibilidade where motorista_id in (select pg_temp.id(100 + n) from m);
insert into public.motorista_disponibilidade (motorista_id, cidade, latitude, longitude, livre_desde, livre_ate, created_at)
select pg_temp.id(100 + n), cidade, lat, lon, now() - make_interval(secs => horas * 3600), now() + interval '48 hours',
       now() - make_interval(secs => horas * 3600)
from m;

commit;
