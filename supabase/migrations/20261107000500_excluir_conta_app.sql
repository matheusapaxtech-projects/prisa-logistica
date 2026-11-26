-- Migration 20261107000500: o motorista exclui a própria conta pelo app (exigência da Google Play e da Apple).
--
-- excluir_minha_conta() apaga o que é do app e mais nada:
-- - a última localização (motorista_posicao);
-- - o "estou livre" em vigor (encerrado, como em encerrar_checkin);
-- - os interesses em fretes ainda abertos (marcados como desistência);
-- - o acesso ao app (revogado: para voltar, a operação libera o celular de novo);
-- - o usuário do Auth (o perfil_usuario cai junto pelo on delete cascade).
-- revogar_acesso_app (operação) passa a apagar a última localização, como a política de privacidade promete.
-- O cadastro do motorista na Prisa (pessoa, motorista, veículos, viagens) fica: a Prisa é obrigada a guardar
-- os dados do transporte e do pagamento do frete (lei fiscal e ANTT). A política de privacidade diz isso.

create function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m uuid;
begin
  if v_uid is null then
    raise exception 'entre no app para excluir a conta' using errcode = '42501';
  end if;
  -- Ativo ou não: quem teve o acesso revogado também pode apagar a conta.
  select p.motorista_id into v_m from public.perfil_usuario p
   where p.user_id = v_uid and p.papel = 'motorista';
  if v_m is null and exists (select 1 from public.perfil_usuario p where p.user_id = v_uid) then
    raise exception 'só o motorista exclui a conta pelo app' using errcode = '42501';
  end if;

  if v_m is not null then
    delete from public.motorista_posicao where motorista_id = v_m;
    update public.motorista_disponibilidade
       set livre_desde = least(livre_desde, now() - interval '1 second'), livre_ate = now(), updated_by = v_uid
     where motorista_id = v_m and livre_ate > now();
    update public.frete_interesse i set desistiu_em = now()
      from public.frete_oferta o
     where o.id = i.oferta_id and o.encerrada_em is null
       and i.motorista_id = v_m and i.desistiu_em is null;
    update public.motorista_acesso_app set revogado_em = now(), revogado_por = v_uid
     where motorista_id = v_m and revogado_em is null;
  end if;

  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- A política de privacidade promete apagar a localização quando a Prisa encerra o acesso ao app: revogar passa a
-- apagar a última posição também.
create or replace function public.revogar_acesso_app(p_motorista uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_editar() then
    raise exception 'só administrador e operação revogam o app' using errcode = '42501';
  end if;
  update public.motorista_acesso_app set revogado_em = now(), revogado_por = (select auth.uid())
   where motorista_id = p_motorista and revogado_em is null;
  update public.perfil_usuario set ativo = false where motorista_id = p_motorista;
  delete from public.motorista_posicao where motorista_id = p_motorista;
end $$;
