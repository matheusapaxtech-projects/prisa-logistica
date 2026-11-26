-- Migration 20261101000100: centros de custo e plano de contas (fase 1 do sistema do sócio).
--
-- centro_custo     departamentos (00) e subdepartamentos (00.00), como no sistema do sócio: cada módulo do menu é
--                  também um centro de custo com o mesmo código. Toda despesa, receita e (na fase do RH)
--                  funcionário leva um. O código nunca muda: renomeia ou desativa. Só o admin altera; quem lê o
--                  sistema vê. Sem exclusão.
-- fin_plano_conta  tipo de despesa/receita em dois níveis (grupo · conta). Os grupos são as linhas do DRE do
--                  sócio (receita, impostos sobre a receita, custo do frete, despesas operacionais, resultado
--                  financeiro, IRPJ/CSLL e fora do resultado). Cada conta diz se é de entrada, de saída ou das
--                  duas. Ids < 1000 são os da carga inicial (o código usa alguns: 1 frete CT-e, 20 frete de
--                  motoristas, 51 tarifa do cartão-frete); as contas novas do admin começam em 1000.

-- ---------------------------------------------------------------------------
-- Centro de custo: a tabela já existia (migration 20261023000600, sem carga, ligada a veiculo.centro_custo_id,
-- "a fase 2 define os centros de custo"). Ganha o código, a situação e os carimbos; o id continua a chave.
-- ---------------------------------------------------------------------------
alter table public.centro_custo
  add column codigo text,
  add column ativo boolean not null default true,
  add column created_at timestamptz not null default now(),
  add column created_by uuid default auth.uid(),
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid;

-- Centros que já existam sem código (não há carga, mas por garantia) vão para o departamento 99 "Outros".
do $$
begin
  if exists (select 1 from public.centro_custo where codigo is null) then
    insert into public.centro_custo (codigo, nome) values ('99', 'Outros (sem código)');
    update public.centro_custo c
       set codigo = '99.' || lpad(x.n::text, 2, '0')
      from (select id, row_number() over (order by id) as n from public.centro_custo where codigo is null) x
     where c.id = x.id;
  end if;
end $$;

alter table public.centro_custo
  alter column codigo set not null,
  add constraint centro_custo_codigo_unico unique (codigo),
  add constraint centro_custo_codigo_formato check (codigo ~ '^[0-9]{2}(\.[0-9]{2})?$'),
  add constraint centro_custo_nome_tamanho check (length(btrim(nome)) between 1 and 80);

comment on table public.centro_custo is
  'Departamentos (00) e subdepartamentos (00.00). O código não muda; desativar no lugar de excluir.';

-- O código não muda; o subdepartamento precisa do departamento; o nome fica sem espaços nas pontas.
create function public.fn_centro_custo_protege()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo then
    raise exception 'O código do centro de custo não muda. Renomeie ou desative o centro.';
  end if;
  if tg_op = 'INSERT' and length(new.codigo) = 5
     and not exists (select 1 from public.centro_custo c where c.codigo = left(new.codigo, 2)) then
    raise exception 'Crie primeiro o departamento %.', left(new.codigo, 2);
  end if;
  new.nome := btrim(new.nome);
  return new;
end $$;

revoke execute on function public.fn_centro_custo_protege() from public, anon, authenticated;

create trigger centro_custo_protege
  before insert or update on public.centro_custo
  for each row execute function public.fn_centro_custo_protege();

create trigger centro_custo_set_updated_at
  before update on public.centro_custo
  for each row execute function public.fn_set_updated_at();

-- Sem exclusão (desativa); leitura, inclusão e alteração ficam com as políticas da 0600 (todos leem, admin grava).
drop policy centro_custo_delete on public.centro_custo;

-- Carga inicial: os códigos do menu do sistema do sócio.
insert into public.centro_custo (codigo, nome) values
  ('01', 'Administrativo'),
  ('01.01', 'Financeiro e tesouraria'),
  ('01.02', 'Contas a pagar'),
  ('01.03', 'Contas a receber e cobrança'),
  ('01.04', 'Recursos humanos e DP'),
  ('01.05', 'Compras e suprimentos'),
  ('01.06', 'Patrimônio e instalações'),
  ('01.07', 'Jurídico e seguros'),
  ('01.08', 'TI e sistemas'),
  ('02', 'Comercial'),
  ('02.01', 'Prospecção e vendas'),
  ('02.02', 'Cadastro e análise de clientes'),
  ('02.03', 'Cálculo e cotação de frete'),
  ('02.04', 'Contratos e tabelas de frete'),
  ('02.05', 'Atendimento e pós-venda'),
  ('02.06', 'Faturamento comercial'),
  ('03', 'Operacional'),
  ('03.01', 'Planejamento e programação'),
  ('03.02', 'Expedição e coleta'),
  ('03.03', 'Tráfego e monitoramento'),
  ('03.04', 'Frota e manutenção'),
  ('03.05', 'Combustível e abastecimento'),
  ('03.06', 'Motoristas e agregados'),
  ('03.07', 'Armazenagem e distribuição'),
  ('03.08', 'Gestão de viagens e entregas'),
  ('03.09', 'Segurança e gerenciamento de riscos'),
  ('04', 'Fiscal'),
  ('04.01', 'Emissão de documentos fiscais'),
  ('04.02', 'Escrituração e apuração'),
  ('04.03', 'Retenções e tributos'),
  ('04.04', 'Obrigações acessórias'),
  ('04.05', 'Auditoria e conformidade fiscal');

-- ---------------------------------------------------------------------------
-- Plano de contas
-- ---------------------------------------------------------------------------
create type public.fin_grupo_plano as enum (
  'receita',
  'imposto_receita',
  'custo_frete',
  'despesa_operacional',
  'financeiro',
  'ir_csll',
  'fora_resultado'
);

create function public.rotulo_grupo_plano(p public.fin_grupo_plano)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'receita' then 'Receita'
    when 'imposto_receita' then 'Impostos sobre a receita'
    when 'custo_frete' then 'Custo do frete'
    when 'despesa_operacional' then 'Despesas operacionais'
    when 'financeiro' then 'Resultado financeiro'
    when 'ir_csll' then 'IRPJ e CSLL'
    when 'fora_resultado' then 'Fora do resultado'
  end
$$;

revoke execute on function public.rotulo_grupo_plano(public.fin_grupo_plano) from public, anon;
grant execute on function public.rotulo_grupo_plano(public.fin_grupo_plano) to authenticated;

create table public.fin_plano_conta (
  id integer primary key generated by default as identity (start with 1000),
  grupo public.fin_grupo_plano not null,
  nome text not null,
  entrada boolean not null default false,
  saida boolean not null default false,
  ordem smallint not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint fin_plano_conta_nome_tamanho check (length(btrim(nome)) between 1 and 80),
  constraint fin_plano_conta_natureza check (entrada or saida),
  unique (grupo, nome)
);

comment on table public.fin_plano_conta is
  'Tipo de despesa/receita em dois níveis (grupo = linha do DRE · conta). Desativar no lugar de excluir.';

create trigger fin_plano_conta_set_updated_at
  before update on public.fin_plano_conta
  for each row execute function public.fn_set_updated_at();

revoke truncate, references, trigger on public.fin_plano_conta from authenticated;
revoke select, insert, update, delete, truncate, references, trigger on public.fin_plano_conta from anon;

alter table public.fin_plano_conta enable row level security;

create policy fin_plano_conta_ver on public.fin_plano_conta
  for select to authenticated using ((select public.pode_financeiro()));
create policy fin_plano_conta_incluir on public.fin_plano_conta
  for insert to authenticated with check ((select public.eh_admin()));
create policy fin_plano_conta_alterar on public.fin_plano_conta
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));

select public.auditar('public.fin_plano_conta');

insert into public.fin_plano_conta (id, grupo, nome, entrada, saida, ordem) values
  (1, 'receita', 'Frete (CT-e)', true, false, 1),
  (2, 'receita', 'Outras receitas', true, false, 2),
  (10, 'imposto_receita', 'ICMS', false, true, 1),
  (11, 'imposto_receita', 'PIS e COFINS', false, true, 2),
  (12, 'imposto_receita', 'ISS e outros impostos sobre a receita', false, true, 3),
  (20, 'custo_frete', 'Frete de motoristas', false, true, 1),
  (21, 'custo_frete', 'Pedágio (vale-pedágio)', false, true, 2),
  (22, 'custo_frete', 'Seguro da carga', false, true, 3),
  (23, 'custo_frete', 'Gerenciadora de risco', false, true, 4),
  (24, 'custo_frete', 'INSS e SEST/SENAT do autônomo', false, true, 5),
  (30, 'despesa_operacional', 'Salários e encargos', false, true, 1),
  (31, 'despesa_operacional', 'Benefícios', false, true, 2),
  (32, 'despesa_operacional', 'Pró-labore', false, true, 3),
  (33, 'despesa_operacional', 'Aluguel e condomínio', false, true, 4),
  (34, 'despesa_operacional', 'Energia, água e telefone', false, true, 5),
  (35, 'despesa_operacional', 'Internet e sistemas', false, true, 6),
  (36, 'despesa_operacional', 'Contabilidade e jurídico', false, true, 7),
  (37, 'despesa_operacional', 'Material de escritório', false, true, 8),
  (38, 'despesa_operacional', 'Manutenção e conservação', false, true, 9),
  (39, 'despesa_operacional', 'Combustível e deslocamentos', false, true, 10),
  (40, 'despesa_operacional', 'Marketing', false, true, 11),
  (41, 'despesa_operacional', 'Impostos e taxas (não sobre a receita)', false, true, 12),
  (49, 'despesa_operacional', 'Outras despesas', false, true, 99),
  (50, 'financeiro', 'Tarifas bancárias', false, true, 1),
  (51, 'financeiro', 'Tarifa do cartão-frete', false, true, 2),
  (52, 'financeiro', 'Juros e multas pagos', false, true, 3),
  (53, 'financeiro', 'Deságio e tarifas do fomento', false, true, 4),
  (54, 'financeiro', 'IOF', false, true, 5),
  (55, 'financeiro', 'Rendimentos e juros recebidos', true, false, 6),
  (60, 'ir_csll', 'IRPJ', false, true, 1),
  (61, 'ir_csll', 'CSLL', false, true, 2),
  (70, 'fora_resultado', 'Empréstimo recebido', true, false, 1),
  (71, 'fora_resultado', 'Devolução de empréstimo', false, true, 2),
  (72, 'fora_resultado', 'Aporte de capital', true, false, 3),
  (73, 'fora_resultado', 'Devolução de capital', false, true, 4),
  (74, 'fora_resultado', 'Mútuo com empresas do grupo', true, true, 5),
  (75, 'fora_resultado', 'Transferência entre contas', true, true, 6);
