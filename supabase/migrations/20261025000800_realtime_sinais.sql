-- Sinais do Quadro em tempo real (Ruling R18) e privilégios de viagem_ocorrencia.
--
-- Tempo real = spec 3.5: o cartão "muda de coluna ou de sinal ... em poucos segundos". O sinal de
--              ocorrência aberta vem de viagem_ocorrencia e o de canhoto de arquivo (viagem_id), então
--              as duas entram na publicação supabase_realtime (o Quadro escuta e recarrega). O Realtime
--              aplica a RLS de select de cada tabela a quem escuta.
-- Ocorrência = authenticated só escreve as colunas da tela: insere (viagem_id, tipo, descricao) e atualiza
--              (resolvida_em, resolvida_por, resolucao, descricao). aberta_em/aberta_por ficam com o
--              padrão (now(), auth.uid()) e viagem_id não muda depois. Quem resolve é sempre o usuário
--              da sessão: um gatilho grava resolvida_por = auth.uid() quando resolvida_em passa de nulo
--              para preenchido (o valor mandado pela tela é ignorado). As políticas de RLS não mudam.

-- ---------------------------------------------------------------------------
-- Tempo real
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.viagem_ocorrencia;
alter publication supabase_realtime add table public.arquivo;

-- ---------------------------------------------------------------------------
-- viagem_ocorrencia: privilégios por coluna
-- ---------------------------------------------------------------------------
revoke insert, update on public.viagem_ocorrencia from authenticated;
grant insert (viagem_id, tipo, descricao) on public.viagem_ocorrencia to authenticated;
grant update (resolvida_em, resolvida_por, resolucao, descricao) on public.viagem_ocorrencia to authenticated;

-- ---------------------------------------------------------------------------
-- viagem_ocorrencia: quem resolve é o usuário da sessão
-- ---------------------------------------------------------------------------
create function public.fn_ocorrencia_resolvida_por()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sem sessão (papel de serviço, migrations): vale o que veio.
  if auth.uid() is null then
    return new;
  end if;
  if new.resolvida_em is null then
    new.resolvida_por := null;            -- aberta: ninguém resolveu
  elsif old.resolvida_em is null then
    new.resolvida_por := auth.uid();      -- acabou de ser resolvida: quem resolveu é quem está logado
  else
    new.resolvida_por := old.resolvida_por; -- já resolvida: quem resolveu não muda
  end if;
  return new;
end $$;

revoke execute on function public.fn_ocorrencia_resolvida_por() from public, anon, authenticated;

create trigger ocorrencia_resolvida_por
  before update on public.viagem_ocorrencia
  for each row execute function public.fn_ocorrencia_resolvida_por();
