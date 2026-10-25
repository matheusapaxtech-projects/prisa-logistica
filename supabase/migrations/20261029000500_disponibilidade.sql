-- Migration 20261029000500: disponibilidade dos motoristas (motor de despacho, rotina 1, "Estou livre").
--
-- Sem o app do motorista, a operação registra o que ele avisa (WhatsApp, telefone): onde está e até quando
-- está livre. Vale o registro mais recente do motorista; disponibilidade vencida (livre_ate no passado) não
-- entra no ranking. É o "check-in" do motor (tipos.ts, CheckIn): posição, quando, livre desde e livre até.
-- motorista_disponibilidade = cidade ("Cidade/UF") com latitude/longitude da lista de municípios da tela.
-- Leitura: quem lê o sistema. Registro e encerramento: admin e operação (pode_editar). Exclusão: só admin.

create table public.motorista_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motorista (pessoa_id) on delete cascade,
  cidade text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  livre_desde timestamptz not null default now(),
  livre_ate timestamptz not null default now() + interval '24 hours',
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint motorista_disponibilidade_cidade check (btrim(cidade) <> ''),
  constraint motorista_disponibilidade_latitude check (latitude between -35 and 6),
  constraint motorista_disponibilidade_longitude check (longitude between -75 and -28),
  constraint motorista_disponibilidade_periodo check (livre_ate > livre_desde)
);

create index motorista_disponibilidade_motorista_idx on public.motorista_disponibilidade (motorista_id, created_at desc);

create trigger motorista_disponibilidade_set_updated_at
  before update on public.motorista_disponibilidade
  for each row execute function public.fn_set_updated_at();

revoke truncate, references, trigger on public.motorista_disponibilidade from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.motorista_disponibilidade from anon;
alter table public.motorista_disponibilidade enable row level security;
create policy motorista_disponibilidade_select on public.motorista_disponibilidade
  for select to authenticated using ((select public.pode_ler()));
create policy motorista_disponibilidade_insert on public.motorista_disponibilidade
  for insert to authenticated with check ((select public.pode_editar()));
create policy motorista_disponibilidade_update on public.motorista_disponibilidade
  for update to authenticated using ((select public.pode_editar())) with check ((select public.pode_editar()));
create policy motorista_disponibilidade_delete on public.motorista_disponibilidade
  for delete to authenticated using ((select public.eh_admin()));
select public.auditar('public.motorista_disponibilidade');

-- A disponibilidade mais recente de cada motorista (o ranking descarta a vencida), com o histórico com a
-- Prisa que o ranking usa (viagens finalizadas e ocorrências registradas). security_invoker: vale o RLS.
create view public.v_motorista_livre
with (security_invoker = true) as
select distinct on (d.motorista_id)
  d.id, d.motorista_id, d.cidade, d.latitude, d.longitude, d.livre_desde, d.livre_ate, d.observacao, d.created_at,
  (select count(*)::integer from public.viagem v
    where v.motorista_id = d.motorista_id and v.status_campo = 'frete_finalizado') as viagens_finalizadas,
  (select count(*)::integer from public.viagem_ocorrencia o join public.viagem v on v.id = o.viagem_id
    where v.motorista_id = d.motorista_id) as ocorrencias
from public.motorista_disponibilidade d
order by d.motorista_id, d.created_at desc;

revoke select on public.v_motorista_livre from anon;
grant select on public.v_motorista_livre to authenticated;
