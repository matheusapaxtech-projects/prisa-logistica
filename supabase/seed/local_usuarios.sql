-- =============================================================================================
-- SÓ PARA O SUPABASE LOCAL (`supabase start` / `supabase db reset`). NUNCA RODAR NA NUVEM.
-- =============================================================================================
-- Cria os usuários de teste com os mesmos ids e e-mails do ambiente da nuvem
-- (ver "Antes de usar com dados reais" em web/README.md), já confirmados e com perfil:
--
--   teste.admin@nilt.test       admin       (também serve de login para desenvolver)
--   teste.semperfil@nilt.test   sem perfil
--   teste.operacao@nilt.test    operação
--   teste.financeiro@nilt.test  financeiro  (aprova o que o admin lança: quem lança não aprova)
--
-- Senha de todos: nilt-local-123 (só vale no banco da sua máquina; está em web/.env.test.example).
-- Carregado depois de dev_dados_ficticios.sql pela ordem de `[db.seed]` em supabase/config.toml.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('e2e00000-0000-4000-8000-000000000001'::uuid, 'teste.admin@nilt.test',     'Teste Admin',    'admin'),
      ('e2e00000-0000-4000-8000-000000000002'::uuid, 'teste.semperfil@nilt.test', null,             null),
      ('e2e00000-0000-4000-8000-000000000003'::uuid, 'teste.operacao@nilt.test',  'Teste Operação', 'operacao'),
      ('e2e00000-0000-4000-8000-000000000004'::uuid, 'teste.financeiro@nilt.test', 'Teste Financeiro', 'financeiro')
    ) as t(id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('nilt-local-123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    ) on conflict do nothing;

    if u.papel is not null then
      insert into public.perfil_usuario (user_id, nome, papel)
      values (u.id, u.nome, u.papel::public.app_papel)
      on conflict (user_id) do nothing;
    end if;
  end loop;
end $$;
