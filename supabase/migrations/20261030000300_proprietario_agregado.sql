-- Migration proprietario_agregado: marcação de agregado no proprietário.
--
-- Agregado é o dono de caminhão que trabalha com a Prisa de forma fixa (contrato contínuo), ao
-- contrário do terceiro, que faz uma viagem avulsa. É uma marca do papel de proprietário: quando a
-- mesma pessoa também é motorista, a ficha do motorista mostra o selo lendo daqui.

alter table public.proprietario
  add column agregado boolean not null default false,
  add column agregado_desde date,
  -- Data de início só faz sentido para quem é agregado.
  add constraint proprietario_agregado_desde_so_agregado check (agregado or agregado_desde is null);

comment on column public.proprietario.agregado is
  'Proprietário agregado: presta serviço à Prisa de forma fixa (não é terceiro avulso).';
comment on column public.proprietario.agregado_desde is
  'Desde quando é agregado (opcional; só preenchido quando agregado = true).';
