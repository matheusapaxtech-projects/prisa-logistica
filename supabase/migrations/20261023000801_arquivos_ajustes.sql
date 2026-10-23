-- Migration 0801: ajustes de segurança em arquivos (achados da revisão da 0800).
--
-- I1) arquivo_update: um UPDATE que não lê nenhuma coluna de arquivo (sem WHERE, ou WHERE que não
--     referencia colunas) não aplica a política de SELECT, então `operacao` conseguia desmarcar
--     `restrito` de todos os arquivos. Agora o USING também esconde linhas restritas de quem não é
--     admin. Não admin pode marcar um arquivo como restrito (with check só exige pode_editar),
--     mas nunca toca nem desmarca uma linha já restrita.
-- I2) Storage fail-closed: quando a linha de arquivo some (cascade ou exclusão), o objeto fica no
--     Storage. arquivo_restrito() passa a devolver true quando NÃO existe arquivo com aquele
--     storage_path; assim a política de select de storage.objects (inalterada) só deixa admin ver
--     objetos sem arquivo registrado.

alter policy arquivo_update on public.arquivo
  using ((select public.pode_editar()) and (not restrito or (select public.eh_admin())))
  with check ((select public.pode_editar()));

-- Objetos sem arquivo registrado são visíveis apenas para admin: no fluxo de upload, grave a
-- linha de arquivo logo depois de enviar o objeto. security definer, stable, search_path vazio e
-- grants iguais aos da 0800 (create or replace preserva os privilégios).
create or replace function public.arquivo_restrito(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.restrito from public.arquivo a where a.storage_path = p_path),
    true)
$$;

revoke execute on function public.arquivo_restrito(text) from public, anon;
grant execute on function public.arquivo_restrito(text) to authenticated;
