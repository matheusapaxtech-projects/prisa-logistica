-- Criar o primeiro administrador do NILT.
--
-- Passo 1: no painel do Supabase, abra Authentication > Users e crie a conta
--          (e-mail e senha) de quem será administrador.
-- Passo 2: no SQL editor do painel, troque <nome> e <email> abaixo pelos dados reais
--          (o e-mail precisa ser o mesmo da conta criada no passo 1) e execute.
--
-- Roda uma única vez. Se o perfil já existir para o usuário, o comando falha por chave
-- duplicada (user_id) e nada é alterado. Se o e-mail não existir em Authentication > Users,
-- nenhuma linha é inserida e o bloco levanta um erro explicando o motivo.
do $$
declare
  v_linhas integer;
begin
  insert into public.perfil_usuario (user_id, nome, papel)
  select id, '<nome>', 'admin'
  from auth.users
  where email = '<email>';

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Nenhum administrador criado: não existe usuário com o e-mail informado em Authentication > Users. Crie a conta no passo 1 e confira se o e-mail está idêntico.';
  end if;
end $$;
