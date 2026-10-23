-- Task 10: ajustes finais de privilégios (fechamento da fase 1).
--
-- Contexto: get_advisors (security e performance) não apontou nada acionável antes desta migration:
--   * 7 WARN authenticated_security_definer_function_executable (helpers de RLS: intencional);
--   * 16 INFO unused_index (banco recém-criado, vazio: índices de FK ainda sem uso).
-- A varredura de privilégios (information_schema / pg_proc) mostrou o que os advisors não cobrem:
--   * `anon` tinha SELECT em todas as tabelas de public (grant padrão do Supabase) e privilégios
--     completos em perfil_usuario (a migration da Task 2 não revogou); `authenticated` tinha
--     TRUNCATE/REFERENCES/TRIGGER em perfil_usuario;
--   * fn_set_updated_at() (função de gatilho) era executável por public/anon/authenticated;
--   * sequences de public com USAGE/SELECT/UPDATE para anon.
--
-- Regras: listas explícitas de privilégios (nunca `revoke all`); authenticated mantém
-- select/insert/update/delete nas tabelas (as políticas RLS dependem disso) e select nas views;
-- execute em pode_ler/pode_editar/eh_admin/tem_papel/papel_atual/capacidade_carga/
-- arquivo_restrito/registrar_visualizacao não é tocado.

-- 1) Tabelas e views de public (relkind r, p, v, m, f): anon sem nenhum privilégio;
--    authenticated sem truncate/references/trigger/maintain.
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as alvo
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format(
      'revoke select, insert, update, delete, truncate, references, trigger, maintain on %s from anon',
      r.alvo);
    execute format(
      'revoke truncate, references, trigger, maintain on %s from authenticated',
      r.alvo);
  end loop;
end $$;

-- 2) Sequences de public: anon não precisa de nenhum acesso (authenticated e service_role seguem
--    como estão; o identity das tabelas não exige privilégio na sequence para o inserente).
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as alvo
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
  loop
    execute format('revoke select, update, usage on sequence %s from anon', r.alvo);
  end loop;
end $$;

-- 3) Função de gatilho: o gatilho dispara sem checar execute do usuário (a checagem é na criação
--    do gatilho, feita pelo dono). service_role e postgres mantêm o privilégio.
revoke execute on function public.fn_set_updated_at() from public, anon, authenticated;
