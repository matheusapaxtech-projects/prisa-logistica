-- Migration 0901: privilégios padrão (default privileges) do papel postgres em public.
--
-- O Supabase cria o projeto com privilégios padrão que dão a anon e authenticated acesso total a
-- toda tabela, função e sequência futura criada pelo papel postgres em public:
--   tabelas   -> anon = arwdDxtm, authenticated = arwdDxtm
--   funções   -> anon = X (e PUBLIC = X, que é o padrão do Postgres)
--   sequências-> anon = rwU
-- Isso só é seguro enquanto cada migration lembrar de revogar. Esta migration troca o padrão por
-- "negado por padrão": objetos futuros nascem sem acesso para anon e sem os privilégios
-- perigosos (truncate, references, trigger, maintain) para authenticated. Objetos que já existem
-- NÃO mudam (default privileges só valem para objetos criados depois); os privilégios deles já
-- foram acertados na migration 0900.
--
-- Regras para as próximas migrations (decorrência desta):
--   * Tabela nova: nasce com select/insert/update/delete para authenticated (o RLS decide as
--     linhas) e sem nada para anon. Ligue o RLS e crie as políticas na mesma migration.
--   * Função nova (inclusive RPC e security definer): nasce SEM execute para anon e PUBLIC. Se um
--     usuário logado precisa chamá-la (RPC, ou helper usado em política RLS), escreva
--     explicitamente `grant execute on function public.<nome>(<args>) to authenticated;`.
--   * Sequência nova: nasce sem acesso para anon; authenticated e service_role mantêm rwU.
--   * Os defaults do papel supabase_admin em public (que o painel/CLI podem usar) não são
--     alterados aqui: o fluxo oficial deste projeto cria objetos via apply_migration como postgres.
--
-- Fluxo canônico de upload de documento (corrige o comentário da migration 0800, que descreve a
-- ordem inversa; depois da 0801 quem não é admin só enxerga um objeto do Storage se existir a
-- linha correspondente em public.arquivo):
--   1. A aplicação gera o id do arquivo (uuid) no cliente.
--   2. Insere a linha em public.arquivo com id e storage_path = 'pessoa/<pessoa_id>/<id>-<nome>'
--      (ou 'veiculo/<veiculo_id>/<id>-<nome>').
--   3. Envia o objeto ao bucket "documentos" exatamente nesse storage_path.
--   4. Se o envio falhar, a linha fica sem objeto: a tela deve avisar e permitir tentar de novo
--      (apagar a linha é exclusivo de admin).
--   Para ler: chamar registrar_visualizacao(arquivo_id) e só então gerar o link temporário.
--   A ser verificado na fase de UI: envio do objeto autenticado como "operacao".

-- Tabelas: anon perde tudo; authenticated perde só os privilégios que o RLS não controla bem.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger, maintain on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

-- Sequências: anon perde tudo.
alter default privileges for role postgres in schema public
  revoke select, update, usage on sequences from anon;

-- Funções: anon perde execute em public...
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
-- ...e PUBLIC perde execute em qualquer schema (PUBLIC não pode ser revogado por schema).
alter default privileges for role postgres
  revoke execute on functions from public;
