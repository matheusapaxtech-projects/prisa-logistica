-- =============================================================================================
-- SÓ PARA O SUPABASE LOCAL (`supabase start` / `supabase db reset`). NUNCA RODAR NA NUVEM.
-- =============================================================================================
-- Motorista de teste do app (app-motorista/): login teste.motorista@nilt.test, senha nilt-local-123 (o botão
-- "Entrar como motorista de teste" do app só aparece com EXPO_PUBLIC_LOGIN_TESTE=1). Usa o motorista fictício
-- Marcos Fictício Pereira (dev_dados_ficticios.sql): celular liberado no app, carreta graneleira, check-in em
-- Maringá/PR e o pedido fictício ...0021 (coleta em Mandaguari/PR) publicado no app.
-- Carregado depois de local_usuarios.sql pela ordem de `[db.seed]` em supabase/config.toml.

do $$
declare
  v_uid uuid := 'e2e00000-0000-4000-8000-000000000004';
  v_mot uuid := '00000000-0000-4000-9000-000000000101';
  v_ped uuid := '00000000-0000-4000-9000-000000000021';
begin
  if not exists (select 1 from public.motorista where pessoa_id = v_mot) then
    raise notice 'motorista fictício % não existe: pulei o motorista do app', v_mot;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', 'teste.motorista@nilt.test',
    '5543999990001', extensions.crypt('nilt-local-123', extensions.gen_salt('bf')), now(), now(),
    '{"provider":"email","providers":["email","phone"]}', '{}', now(), now(),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_uid, v_uid::text, 'email',
    jsonb_build_object('sub', v_uid::text, 'email', 'teste.motorista@nilt.test', 'email_verified', true),
    now(), now(), now()
  ) on conflict do nothing;

  insert into public.motorista_acesso_app (motorista_id, celular)
  values (v_mot, '5543999990001') on conflict (motorista_id) do nothing;
  insert into public.perfil_usuario (user_id, nome, papel, motorista_id)
  values (v_uid, 'Marcos', 'motorista', v_mot) on conflict (user_id) do nothing;

  update public.veiculo set tipo_carroceria = 'graneleiro'
   where tipo_carroceria is null
     and id in (select i.veiculo_id from public.conjunto_item i join public.conjunto c on c.id = i.conjunto_id
                where c.motorista_id = v_mot and c.fim is null);

  insert into public.motorista_disponibilidade (motorista_id, cidade, latitude, longitude, livre_ate, origem)
  values (v_mot, 'Maringá/PR', -23.42, -51.93, now() + interval '3 days', 'app');

  if exists (select 1 from public.pedido where id = v_ped and situacao = 'aberto')
     and not exists (select 1 from public.frete_oferta where pedido_id = v_ped and encerrada_em is null) then
    insert into public.frete_oferta (pedido_id, frete_motorista_por_t, coleta_latitude, coleta_longitude, coleta_uf,
                                     carrocerias, observacao)
    values (v_ped, 135.50, -23.46, -51.83, 'PR', '{graneleiro}', 'Carregamento a partir das 7 h.');
  end if;
end $$;
