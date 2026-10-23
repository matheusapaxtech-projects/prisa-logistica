-- Executar precedido de _helpers.sql (que abre a transação). Ver README.md.
-- Migration dia_brasilia: v_vencimentos.dias e o arquivo_vencido de v_pendencias_documentos contam a partir
-- do dia de Brasília ((now() at time zone 'America/Sao_Paulo')::date), não do current_date do servidor.
-- O TimeZone da sessão vai para Pacific/Kiritimati (UTC+14): ali o current_date é outro dia em quase todo
-- horário, e as views precisam continuar no dia de Brasília. Só CPF fictício (52998224725). Sem DELETE.

create function tests.test_views_nao_usam_current_date() returns setof text language plpgsql as $$
begin
  return next ok(pg_get_viewdef('public.v_vencimentos'::regclass) !~* 'current_date'
             and pg_get_viewdef('public.v_vencimentos'::regclass) ~ 'America/Sao_Paulo',
                 'v_vencimentos conta os dias pelo dia de Brasília');
  return next ok(pg_get_viewdef('public.v_pendencias_documentos'::regclass) !~* 'current_date'
             and pg_get_viewdef('public.v_pendencias_documentos'::regclass) ~ 'America/Sao_Paulo',
                 'v_pendencias_documentos compara a validade com o dia de Brasília');
end $$;

create function tests.test_dias_pelo_dia_de_brasilia() returns setof text language plpgsql as $$
declare
  v_pes uuid;
  v_hoje uuid := gen_random_uuid();
  v_ontem uuid := gen_random_uuid();
  v_dias_rntrc int; v_dias_hoje int; v_dias_ontem int;
  v_venc_hoje bigint; v_venc_ontem bigint;
begin
  set local timezone = 'Pacific/Kiritimati';
  insert into public.pessoa (tipo, nome, cpf) values ('pf', 'Pessoa dia Brasília', '52998224725') returning id into v_pes;
  insert into public.proprietario (pessoa_id, rntrc_validade) values (v_pes, tests.hoje());
  insert into public.arquivo (id, tipo_arquivo_id, pessoa_id, storage_path, validade)
  values (v_hoje, 4, v_pes, format('pessoa/%s/%s-cnd.pdf', v_pes, v_hoje), tests.hoje()),
         (v_ontem, 4, v_pes, format('pessoa/%s/%s-cnd2.pdf', v_pes, v_ontem), tests.hoje() - 1);

  select dias into v_dias_rntrc from public.v_vencimentos where tipo = 'RNTRC' and pessoa_id = v_pes;
  select dias into v_dias_hoje from public.v_vencimentos where arquivo_id = v_hoje;
  select dias into v_dias_ontem from public.v_vencimentos where arquivo_id = v_ontem;
  select count(*) into v_venc_hoje from public.v_pendencias_documentos
   where tipo_pendencia = 'arquivo_vencido' and arquivo_id = v_hoje;
  select count(*) into v_venc_ontem from public.v_pendencias_documentos
   where tipo_pendencia = 'arquivo_vencido' and arquivo_id = v_ontem;

  return next is(v_dias_rntrc, 0, 'RNTRC que vence hoje (Brasília): dias = 0, qualquer que seja o fuso da sessão');
  return next is(v_dias_hoje, 0, 'arquivo que vence hoje (Brasília): dias = 0');
  return next is(v_dias_ontem, -1, 'arquivo que venceu ontem (Brasília): dias = -1');
  return next is(v_venc_hoje, 0::bigint, 'arquivo que vence hoje ainda não é "arquivo_vencido"');
  return next is(v_venc_ontem, 1::bigint, 'arquivo que venceu ontem é "arquivo_vencido"');
end $$;

select * from runtests('tests'::name, '^test_');
rollback;
