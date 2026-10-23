-- Migration nomes_usuarios: nome de quem fez (conferiu um documento, alterou um registro) para
-- quem não é administrador.
--
-- O RLS de perfil_usuario só mostra ao não admin a própria linha, mas a ficha precisa dizer
-- "quem validou e quando" (spec 5.1). Esta função devolve SÓ user_id e nome dos ids pedidos
-- (nada de e-mail, papel ou situação), e só para quem pode ler o sistema (pode_ler()).
-- Escolha documentada: sem pode_ler() (sem perfil, perfil desativado, anon) a função devolve
-- conjunto vazio em vez de erro, para a tela simplesmente não mostrar nomes.
-- Inclui perfis desativados: o nome de quem conferiu no passado continua aparecendo.
--
-- security definer de propósito (lê perfil_usuario por cima do RLS); o WARN do advisor
-- `authenticated_security_definer_function_executable` para esta função é esperado.

create function public.nomes_usuarios(p_ids uuid[])
returns table (user_id uuid, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.nome
  from public.perfil_usuario p
  where p.user_id = any (p_ids)
    and (select public.pode_ler())
$$;

comment on function public.nomes_usuarios(uuid[]) is
  'Nomes (só user_id e nome) dos usuários pedidos, para mostrar quem conferiu/alterou. '
  'Vazio para quem não tem pode_ler(). security definer: passa por cima do RLS de perfil_usuario.';

revoke execute on function public.nomes_usuarios(uuid[]) from public, anon;
grant execute on function public.nomes_usuarios(uuid[]) to authenticated;
