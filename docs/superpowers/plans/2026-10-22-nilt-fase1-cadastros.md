# NILT Fase 1 — Banco de dados dos cadastros: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar no Supabase do NILT o banco da fase 1 (pessoa, motorista, proprietário, veículo, conjunto, arquivos, auditoria) com RLS por papel, bucket privado de documentos e validações, tudo versionado em migrations e coberto por testes pgTAP.

**Architecture:** Postgres do Supabase, schema `public`. Uma entidade `pessoa` (PF ou PJ) com papéis em tabelas 1:1 (`motorista`, `proprietario`). Listas configuráveis em tabelas de apoio com carga inicial; listas fixas em enums. Toda regra de acesso fica no banco (RLS + funções `security definer`). Toda alteração é gravada em `auditoria` por trigger genérico. Nenhuma tela nesta fase.

**Tech Stack:** Supabase Postgres 15+, pgTAP, Supabase Storage. Aplicação e testes pelo MCP `supabase-nilt` (ferramentas `apply_migration`, `execute_sql`, `get_advisors`, `list_tables`, `generate_typescript_types`).

**Spec:** `docs/superpowers/specs/2026-10-22-nilt-design.md` (seções 4.4, 5.1 a 5.4). Campos de referência do ATUA: `re-atua-mais-frete/evidence/EV-006`, `EV-007`, `EV-008`, `EV-010`.

## Global Constraints

- Projeto Supabase: `tkfpbpqbnasabtzatojk`, acessado **somente** pelo MCP `supabase-nilt`. Nunca usar o conector Supabase do claude.ai nesta tarefa (é outra conta).
- Toda mudança de esquema vai em arquivo `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql` **e** é aplicada com `apply_migration` usando o mesmo `<nome>`. Nunca alterar esquema com `execute_sql`.
- Nunca editar uma migration já aplicada; corrigir com uma migration nova.
- Nomes de tabelas, colunas e funções em português, `snake_case`, sem acento.
- Nenhum dado real (CPF, nome, placa) em migrations, testes ou commits. Em testes use CPFs válidos fictícios: `52998224725`, `11144477735`; CNPJ fictício válido: `11222333000181`.
- CPF e CNPJ guardados só com dígitos (`char(11)` / `char(14)`). Placa guardada em maiúsculas, sem hífen, 7 caracteres.
- RLS habilitado em **todas** as tabelas de `public`. Nenhuma tabela sem política.
- Bucket `documentos` sempre privado.
- Papéis do sistema (decisão do designer até a entrevista): `admin`, `operacao`, `financeiro`, `leitura`.

## Review Focus

- **Usuário logado sem perfil** (existe em `auth.users`, mas não em `perfil_usuario`): não lê nem grava nada. Teste em Task 3 (`test_sem_perfil_nao_le`).
- **CPF/CNPJ digitado com máscara** (`529.982.247-25`): deve ser aceito e guardado só com dígitos, não rejeitado. Teste em Task 2 (`test_normaliza_documento`) e Task 5 (`test_pessoa_cpf_com_mascara`).
- **Placa antiga com hífen e minúscula** (`abc-1234`): vira `ABC1234`; placa Mercosul (`ABC1D23`) aceita. Teste em Task 7 (`test_placa_normalizada`).
- **Mesmo veículo em dois conjuntos abertos ao mesmo tempo**: rejeitado. Teste em Task 8 (`test_veiculo_em_dois_conjuntos`).
- **Arquivo marcado como restrito**: só `admin` consegue ver o registro e o objeto no Storage. Teste em Task 9 (`test_arquivo_restrito_so_admin`).

---

## Estrutura de arquivos

```
.gitignore                                   (novo)
supabase/
  migrations/
    20261023000100_extensoes_e_utilitarios.sql   Task 1-2
    20261023000200_perfis_e_papeis.sql           Task 3
    20261023000300_auditoria.sql                 Task 4
    20261023000400_pessoa.sql                    Task 5
    20261023000500_motorista_proprietario.sql    Task 6
    20261023000600_veiculo.sql                   Task 7
    20261023000700_conjunto.sql                  Task 8
    20261023000800_arquivos.sql                  Task 9
  tests/
    README.md                 como rodar os testes pelo MCP
    _helpers.sql              funções de teste (criar usuário, agir como usuário)
    utilitarios.test.sql      Task 2
    perfis.test.sql           Task 3
    auditoria.test.sql        Task 4
    pessoa.test.sql           Task 5
    motorista_proprietario.test.sql  Task 6
    veiculo.test.sql          Task 7
    conjunto.test.sql         Task 8
    arquivos.test.sql         Task 9
  types/database.ts          Task 10 (gerado)
```

### Como os testes rodam (vale para todas as tasks)

Cada arquivo de teste é executado com **uma** chamada `execute_sql` do `supabase-nilt`, cujo `query` é o conteúdo de `_helpers.sql` seguido do conteúdo do arquivo. Formato de todo arquivo de teste:

```sql
begin;
-- (conteúdo de _helpers.sql é colado antes desta linha pelo executor)
create function tests.test_<nome>() returns setof text language plpgsql as $$
begin
  return next <assertiva pgTAP>;
end $$;
-- ... mais funções test_*
select * from runtests('tests'::name, '^test_');
rollback;
```

Passou: nenhuma linha começa com `not ok` e a última linha não contém `Looks like you failed`. Falhou: qualquer `not ok`.

---

### Task 1: Repositório, pastas e extensões

**Files:**
- Create: `.gitignore`, `supabase/migrations/20261023000100_extensoes_e_utilitarios.sql` (só a parte de extensões nesta task), `supabase/tests/README.md`, `supabase/tests/_helpers.sql`

**Interfaces:**
- Produces: schema `tests` (só dentro das transações de teste); `tests.criar_usuario(p_email text, p_papel text) returns uuid` (insere em `auth.users` e, se `p_papel` não for nulo, em `public.perfil_usuario` — só funciona depois da Task 3; antes disso use `p_papel => null`); `tests.como(p_uid uuid) returns void` (faz `set_config('role','authenticated',true)` e `set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true)`); `tests.como_servico() returns void` (volta para `postgres` com `reset role`).

- [ ] **Step 1:** Na raiz `Prisa Logistica`, rodar `git init -b main`. Criar `.gitignore` com: `re-atua-mais-frete/` (é um repositório próprio), `*.zip`, `node_modules/`, `.env*`.
- [ ] **Step 2:** Escrever a parte de extensões da migration 0100: `create extension if not exists pgtap with schema extensions;` e `create extension if not exists unaccent with schema extensions;`.
- [ ] **Step 3:** Escrever `_helpers.sql` com `create schema tests;` e as três funções da seção Interfaces. `criar_usuario` insere em `auth.users (id, email, aud, role)` com `gen_random_uuid()`, `'authenticated'`, `'authenticated'`.
- [ ] **Step 4:** Escrever `supabase/tests/README.md` com a seção "Como os testes rodam" acima.
- [ ] **Step 5:** Commit: `git add .gitignore .mcp.json supabase docs entrevista && git commit -m "chore: estrutura inicial do NILT (supabase, testes)"`. A migration 0100 ainda não é aplicada (termina na Task 2).

### Task 2: Utilitários de validação e normalização

**Files:**
- Modify: `supabase/migrations/20261023000100_extensoes_e_utilitarios.sql`
- Test: `supabase/tests/utilitarios.test.sql`

**Interfaces:**
- Produces:
  - `public.so_digitos(p text) returns text` immutable — remove tudo que não é dígito; `null` entra, `null` sai.
  - `public.cpf_valido(p text) returns boolean` immutable — aplica `so_digitos`; falso se não tiver 11 dígitos, se todos forem iguais, ou se os dois dígitos verificadores (módulo 11) não baterem.
  - `public.cnpj_valido(p text) returns boolean` immutable — idem com 14 dígitos e pesos do CNPJ.
  - `public.normalizar_placa(p text) returns text` immutable — `upper`, remove tudo que não é letra ou dígito.
  - `public.placa_valida(p text) returns boolean` immutable — `normalizar_placa(p) ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'`.
  - `public.fn_set_updated_at() returns trigger` — `new.updated_at := now(); new.updated_by := auth.uid();` (usado por todas as tabelas com essas colunas).

- [ ] **Step 1: Testes que falham** em `utilitarios.test.sql`:
  - `test_cpf_valido`: `ok(cpf_valido('52998224725'))`, `ok(cpf_valido('529.982.247-25'))`, `ok(not cpf_valido('52998224724'))`, `ok(not cpf_valido('11111111111'))`, `ok(not cpf_valido('123'))`.
  - `test_cnpj_valido`: `ok(cnpj_valido('11222333000181'))`, `ok(cnpj_valido('11.222.333/0001-81'))`, `ok(not cnpj_valido('11222333000180'))`, `ok(not cnpj_valido('00000000000000'))`.
  - `test_normaliza_documento`: `is(so_digitos('529.982.247-25'), '52998224725')`.
  - `test_placa`: `is(normalizar_placa('abc-1234'), 'ABC1234')`, `ok(placa_valida('ABC1D23'))`, `ok(not placa_valida('AB12345'))`.
- [ ] **Step 2:** Rodar `utilitarios.test.sql`. Esperado: erro "function cpf_valido does not exist".
- [ ] **Step 3:** Escrever as funções na migration 0100 e aplicar com `apply_migration` nome `extensoes_e_utilitarios`.
- [ ] **Step 4:** Rodar os testes. Esperado: todos `ok`.
- [ ] **Step 5:** Commit `feat(db): extensões e funções de validação de CPF, CNPJ e placa`.

### Task 3: Perfis de usuário e papéis

**Files:**
- Create: `supabase/migrations/20261023000200_perfis_e_papeis.sql`
- Test: `supabase/tests/perfis.test.sql`

**Interfaces:**
- Consumes: `tests.criar_usuario`, `tests.como`, `fn_set_updated_at`.
- Produces:
  - `type public.app_papel as enum ('admin','operacao','financeiro','leitura')`.
  - Tabela `public.perfil_usuario (user_id uuid pk references auth.users on delete cascade, nome text not null, papel app_papel not null, ativo boolean not null default true, created_at, updated_at timestamptz, updated_by uuid)`.
  - `public.papel_atual() returns app_papel` — `security definer`, `stable`, `set search_path = public`; papel do `auth.uid()` se `ativo`, senão `null`.
  - `public.tem_papel(variadic p app_papel[]) returns boolean` — `security definer`, `stable`; `coalesce(papel_atual() = any(p), false)`.
  - Atalhos usados nas políticas: `public.pode_ler() = tem_papel('admin','operacao','financeiro','leitura')`, `public.pode_editar() = tem_papel('admin','operacao')`, `public.eh_admin() = tem_papel('admin')`.
  - RLS em `perfil_usuario`: select se `user_id = auth.uid()` ou `eh_admin()`; insert/update/delete só `eh_admin()`.

- [ ] **Step 1: Testes que falham:**
  - `test_papel_atual`: cria usuário `op@exemplo.test` com papel `operacao`; `tests.como(uid)`; `is(papel_atual(), 'operacao'::app_papel)`.
  - `test_sem_perfil_nao_le`: cria usuário sem perfil; `tests.como(uid)`; `ok(not pode_ler())`; `is((select count(*) from perfil_usuario), 0::bigint)`.
  - `test_inativo_sem_acesso`: usuário `operacao` com `ativo=false`; `ok(not pode_editar())`.
  - `test_so_admin_altera_perfil`: como `operacao`, `throws_ok($$update perfil_usuario set papel='admin'$$)` ou `is(rowcount)` = 0 linhas afetadas; como `admin`, update afeta 1 linha.
- [ ] **Step 2:** Rodar. Esperado: falha por tipo/tabela inexistente.
- [ ] **Step 3:** Escrever a migration 0200; aplicar como `perfis_e_papeis`.
- [ ] **Step 4:** Rodar. Esperado: todos `ok`.
- [ ] **Step 5:** Commit `feat(db): perfis de usuário, papéis e funções de permissão`.

### Task 4: Auditoria

**Files:**
- Create: `supabase/migrations/20261023000300_auditoria.sql`
- Test: `supabase/tests/auditoria.test.sql`

**Interfaces:**
- Produces:
  - Tabela `public.auditoria (id bigint generated always as identity pk, tabela text not null, registro_id text not null, acao text not null check (acao in ('insert','update','delete','visualizacao')), dados_antes jsonb, dados_depois jsonb, usuario_id uuid, em timestamptz not null default now())`; índice em `(tabela, registro_id)`.
  - `public.fn_auditoria() returns trigger` — `security definer`; grava `TG_TABLE_NAME`, a chave primária do registro (coluna `id`, ou `pessoa_id` quando a tabela não tem `id`) como texto, `to_jsonb(old)`, `to_jsonb(new)`, `auth.uid()`.
  - `public.auditar(p_tabela regclass) returns void` — cria `after insert or update or delete ... for each row execute function fn_auditoria()` na tabela; as próximas tasks chamam `select auditar('public.<tabela>')` para cada tabela principal.
  - RLS: select só `eh_admin()`; nenhuma política de insert/update/delete (só o trigger grava).

- [ ] **Step 1: Testes que falham:** `test_auditoria_grava_update`: cria tabela temporária `tests.t (id uuid pk default gen_random_uuid(), x int)`, `select auditar('tests.t')`, insere e atualiza como usuário `operacao`; `is((select count(*) from auditoria where tabela='t'), 2::bigint)`; `is((select dados_depois->>'x' from auditoria where acao='update'), '2')`. `test_auditoria_so_admin_le`: como `operacao`, `is(count(*) from auditoria, 0)`; como `admin`, `> 0`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0300; aplicar como `auditoria`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): auditoria genérica por trigger`.

### Task 5: Pessoa, contatos, contas e Pix

**Files:**
- Create: `supabase/migrations/20261023000400_pessoa.sql`
- Test: `supabase/tests/pessoa.test.sql`

**Interfaces:**
- Consumes: `so_digitos`, `cpf_valido`, `cnpj_valido`, `fn_set_updated_at`, `pode_ler`, `pode_editar`, `eh_admin`, `tem_papel`, `auditar`.
- Produces (todas com `id uuid pk default gen_random_uuid()`, `created_at`, `created_by uuid default auth.uid()`, `updated_at`, `updated_by`, trigger `fn_set_updated_at`, `auditar(...)`):
  - Enums: `tipo_pessoa ('pf','pj')`, `situacao_cadastro ('cancelado','pendente','normal')`, `sexo ('masculino','feminino')`, `raca_cor ('branca','preta','parda','amarela','indigena','nao_informado')`, `estado_civil ('solteiro','casado','separado','viuvo','outro')`, `grau_instrucao ('fundamental_incompleto','fundamental_completo','medio_incompleto','medio_completo','superior_incompleto','superior_completo')`, `situacao_cpf ('regular','titular_falecido','suspensa','pendente_regularizacao','cancelada_multiplicidade','nula','cancelada_oficio')`, `tipo_endereco ('residencial','comercial','coleta_descarga','cobranca','correspondencia')`, `tipo_telefone ('residencial','comercial','celular','fax','radio')`, `tipo_conta ('corrente','poupanca','salario')`, `tipo_chave_pix ('cpf','cnpj','celular','email','aleatoria')`, `uf` (as 27 siglas).
  - `pessoa`: `tipo tipo_pessoa not null`, `nome varchar(110) not null`, `apelido`, `cpf char(11) unique`, `cnpj char(14) unique`, `situacao_cadastro not null default 'pendente'`, `observacao`; PF: `rg varchar(20)`, `rg_orgao`, `rg_uf uf`, `rg_emissao date`, `nascimento date`, `sexo`, `raca_cor`, `estado_civil`, `grau_instrucao`, `naturalidade text`, `naturalidade_uf uf`, `nr_inss varchar(11)`, `situacao_cpf`, `dt_consulta_cpf date`, `pai varchar(80)`, `mae varchar(80)`, `nr_dependentes smallint`; PJ: `nome_fantasia`, `fundacao date`, `inscricao_estadual_isento boolean`, `inscricao_estadual`, `inscricao_municipal`, `natureza_juridica`, `cnae_principal`, `optante_simples boolean`, `dt_consulta_simples date`, `dados_brasilapi jsonb`, `dt_consulta_brasilapi timestamptz`.
    - Trigger `before insert or update`: `cpf := so_digitos(cpf)`, `cnpj := so_digitos(cnpj)`.
    - Checks: `(tipo='pf' and cpf is not null and cnpj is null) or (tipo='pj' and cnpj is not null and cpf is null)`; `cpf is null or cpf_valido(cpf)`; `cnpj is null or cnpj_valido(cnpj)`.
  - `pessoa_endereco` (`pessoa_id fk on delete cascade`, `tipo tipo_endereco`, `cep char(8)`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade not null`, `uf uf not null`, `ponto_referencia`, `latitude numeric(9,6)`, `longitude numeric(9,6)`, `principal boolean default false`).
  - `pessoa_telefone` (`pessoa_id`, `numero varchar(16) not null`, `ramal varchar(4)`, `contato varchar(100)`, `tipo tipo_telefone`, `principal`, `whatsapp boolean default false`, `restrito boolean default false`).
  - `pessoa_email` (`pessoa_id`, `email text not null`, `principal`, `recebe_cte boolean default false`, `observacao`).
  - `banco` (`codigo char(3) pk`, `nome text not null`) com carga: 001 Banco do Brasil, 033 Santander, 041 Banrisul, 077 Inter, 084 Sisprime, 085 Ailos, 104 Caixa Econômica Federal, 133 Cresol, 136 Unicred, 237 Bradesco, 260 Nubank, 290 PagSeguro, 336 C6 Bank, 341 Itaú, 348 XP, 403 Cora, 422 Safra, 707 Daycoval, 748 Sicredi, 756 Sicoob.
  - `pessoa_conta_bancaria` (`pessoa_id`, `banco_codigo fk banco`, `tipo tipo_conta`, `agencia varchar(5)`, `agencia_digito varchar(2)`, `conta varchar(20)`, `conta_digito varchar(2)`, `favorecido_nome`, `favorecido_documento varchar(14)`, `principal`, `swift`, `titular_confere boolean not null default false`). Trigger `before insert or update`: `favorecido_documento := so_digitos(...)`; `titular_confere := favorecido_documento = coalesce(pessoa.cpf, pessoa.cnpj)`.
  - `pessoa_chave_pix` (`pessoa_id`, `tipo tipo_chave_pix`, `chave text not null`, `conta_id fk pessoa_conta_bancaria null`, `principal`, `descricao varchar(30)`); unique `(tipo, chave)`.
  - Índice único parcial: no máximo um `principal = true` por `pessoa_id` em endereço, telefone, e-mail, conta e Pix.
  - RLS: select `pode_ler()`; insert/update `pode_editar()` (em `pessoa_conta_bancaria` e `pessoa_chave_pix`: `tem_papel('admin','operacao','financeiro')`); delete `eh_admin()`. `banco`: select `pode_ler()`, escrita `eh_admin()`.

- [ ] **Step 1: Testes que falham:**
  - `test_pessoa_pf_exige_cpf_valido`: como `operacao`, `throws_ok` inserindo PF com cpf `52998224724`; `lives_ok` com `52998224725`.
  - `test_pessoa_cpf_com_mascara`: insere PF com `529.982.247-25`; `is(cpf, '52998224725')`.
  - `test_pessoa_pj_exige_cnpj`: PJ sem cnpj → `throws_ok`; PJ com cpf → `throws_ok`.
  - `test_cpf_duplicado`: segunda PF com o mesmo CPF → `throws_ok` (23505).
  - `test_titular_confere`: conta com `favorecido_documento` igual ao CPF da pessoa → `titular_confere = true`; diferente → `false`.
  - `test_leitura_nao_edita`: como `leitura`, insert em `pessoa` → `throws_ok` (42501 ou violação de RLS).
  - `test_financeiro_edita_conta`: como `financeiro`, insert em `pessoa_conta_bancaria` → `lives_ok`; insert em `pessoa` → `throws_ok`.
  - `test_um_principal`: dois telefones `principal=true` para a mesma pessoa → `throws_ok`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0400; aplicar como `pessoa`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): pessoa PF/PJ, contatos, contas bancárias e Pix`.

### Task 6: Motorista e proprietário

**Files:**
- Create: `supabase/migrations/20261023000500_motorista_proprietario.sql`
- Test: `supabase/tests/motorista_proprietario.test.sql`

**Interfaces:**
- Consumes: `pessoa`, enums da Task 5, helpers de permissão, `auditar`, `fn_set_updated_at`.
- Produces:
  - Enums: `categoria_cnh ('provisoria','a','b','c','d','e','ab','ac','ad','ae')`, `situacao_gr ('sem_consulta','habilitado','vencido')`, `tipo_referencia ('pessoal','comercial')`, `enquadramento_antt ('etc','tac','ctc','etc_equiparado')`, `desconto_inss ('nao','inss_sest_senat','sest_senat')`, `regra_pgto_frete ('peso_saida','peso_chegada','peso_chegada_se_menor','peso_chegada_com_tolerancia','peso_chegada_acima_tolerancia')`.
  - `motorista` (`pessoa_id uuid pk fk pessoa on delete cascade`, `cnh_registro varchar(11)`, `cnh_formulario varchar(10)`, `cnh_seguranca varchar(11)`, `cnh_renach varchar(11)`, `cnh_categoria`, `cnh_validade date`, `cnh_emissao date`, `cnh_primeira_habilitacao date`, `cnh_cidade_emissao`, `cnh_uf uf`, `cnh_observacao`, `situacao_cadastro default 'pendente'`, `situacao_gr default 'sem_consulta'`, `gr_validade date`, `qualificado_gmp boolean`, `dt_qualificacao_gmp date`, `radio`, timestamps). Trigger: a pessoa precisa ser `pf` (senão `raise exception 'motorista precisa ser pessoa física'`).
  - `motorista_referencia` (`id`, `motorista_id fk motorista`, `tipo tipo_referencia not null`, `nome not null`, `telefone varchar(16)`, `dt_referencia date`, `observacao`).
  - `proprietario` (`pessoa_id uuid pk fk pessoa`, `rntrc varchar(9)`, `enquadramento_antt`, `rntrc_emissao date`, `rntrc_validade date`, `responsavel_nome`, `responsavel_telefone varchar(16)`, `responsavel_whatsapp boolean`, `responsavel_email`, `autoriza_desconto_inss desconto_inss default 'nao'`, `alto_desempenho boolean default false`, `qualificado_gmp`, `dt_qualificacao_gmp`, `situacao_cadastro default 'pendente'`, `taxa_adm_valor numeric(12,2)`, `taxa_adm_percentual numeric(5,2)`, `regra_pgto_frete`, `limite_adiantamento_percentual numeric(5,2)`, `limite_adiantamento_valor numeric(12,2)`, timestamps). Trigger: `enquadramento_antt = 'tac'` só se a pessoa for `pf` (`raise exception 'TAC só para pessoa física'`).
  - View `public.v_motorista_situacao` (`security_invoker = true`): `pessoa_id`, `nome`, `cpf`, `cnh_validade`, `situacao_dados` = `'vencido'` se `cnh_validade < current_date` ou `gr_validade < current_date`, senão `'habilitado'`.
  - RLS como na Task 5 (ler `pode_ler`, gravar `pode_editar`, apagar `eh_admin`); `auditar` nas três tabelas.

- [ ] **Step 1: Testes que falham:**
  - `test_motorista_so_pf`: motorista ligado a pessoa PJ → `throws_ok` com a mensagem `motorista precisa ser pessoa física`.
  - `test_tac_so_pf`: proprietário PJ com `tac` → `throws_ok`; PF com `tac` → `lives_ok`.
  - `test_pessoa_motorista_e_proprietario`: a mesma pessoa PF entra em `motorista` e em `proprietario` → `lives_ok`.
  - `test_situacao_dados_vencida`: motorista com `cnh_validade = current_date - 1` → `v_motorista_situacao.situacao_dados = 'vencido'`; com `+30` → `'habilitado'`.
  - `test_referencia_tipo`: referência com tipo `'comercial'` → `lives_ok`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0500; aplicar como `motorista_proprietario`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): motorista, referências e proprietário`.

### Task 7: Veículo e listas de apoio

**Files:**
- Create: `supabase/migrations/20261023000600_veiculo.sql`
- Test: `supabase/tests/veiculo.test.sql`

**Interfaces:**
- Consumes: `normalizar_placa`, `placa_valida`, `proprietario`, helpers, `auditar`.
- Produces:
  - Enums: `categoria_veiculo ('cavalo','caminhao','carreta','dolly','outros')`, `configuracao_cavalo ('toco','trucado')`, `situacao_operacional ('ag_motorista','apreendido','arrendado','ativo','a_venda','devolvido','parado','sinistro','vendido')`, `recebedor_valores ('motorista','proprietario','posto')`, `tipo_assoalho ('madeira','ferro','misto')`, `tipo_rastreamento ('telemonitorado','rastreador','localizador')`.
  - `tipo_veiculo` (`id smallint pk`, `nome text unique`, `categoria categoria_veiculo`, `eixos smallint`, `configuracao_cavalo null`). Carga com os 33 tipos de `re-atua-mais-frete/evidence/EV-001`, mantendo o `id` do ATUA e esta classificação: `cavalo`+`toco` = 6 (CAVALO SIMPLES), 29 (TRACAO 2 EIXOS); `cavalo`+`trucado` = 7 (CAVALO TRUCADO), 27 (TRACAO 3 EIXOS); `dolly` = 18; `carreta` = 8, 9, 10, 11, 12, 14, 16, 22, 23, 24, 25, 28, 30, 33, 35, 36, 38; `caminhao` = 2, 3, 4, 5, 17, 31, 34, 37; `outros` = 1, 26, 32. `eixos` = número do nome (32 ESPECIAL CAMINHONETE = 2).
  - `marca_veiculo` (`id smallint pk`, `nome unique`) com as 42 marcas de EV-001, ids sequenciais em ordem alfabética.
  - `operadora_tag` (`id smallint pk`, `nome`) com 120 PAMCARD TAG CONECTCAR, 121 PAMCARD TAG MOVEMAIS, 122 PAMCARD TAG SEM PARAR, 123 PAMCARD TAG VELOE, 124 PAMCARD - TAGGY.
  - `unidade_operacional` (`id smallint pk`, `nome`) com 1 TERCEIRIZACAO, 2 FROTA PROPRIA, 3 PRISA APUCARANA. `centro_custo` (`id smallint pk`, `nome`) **sem carga** (a fase 2 define).
  - `veiculo`: `placa char(7) unique not null`, `tipo_veiculo_id not null`, `marca_id`, `modelo`, `cor`, `ano_fabricacao smallint`, `ano_modelo smallint`, `renavam varchar(11) unique`, `chassi varchar(25)`, `nr_certificado_doc varchar(20)`, `exercicio_doc smallint`, `nr_registro_crlv`, `dt_emissao_crlv date`, `nr_seguranca_crlv`, `cidade_emplacamento`, `uf_emplacamento uf`, `proprietario_posse_id fk proprietario not null`, `proprietario_documento_id fk proprietario not null`, `arrendado boolean generated always as (proprietario_posse_id <> proprietario_documento_id) stored`, `situacao_operacional default 'ativo'`, `situacao_cadastro default 'pendente'`, `recebedor_valores`, `tag_numero`, `tag_operadora_id fk operadora_tag`, `seguradora`, `apolice`, `seguro_validade date`, `tipo_assoalho`, `comprimento_m numeric(5,2)`, `largura_m numeric(5,2)`, `altura_m numeric(5,2)`, `cmt_t numeric(6,2)`, `pbt_t numeric(6,2)`, `tara_t numeric(6,2)`, `capacidade_carga_t numeric(6,2)` (informada; nula = usar `pbt_t - tara_t`), rastreador: `rastreador_empresa`, `rastreador_modelo`, `rastreador_numero`, `rastreamento_tipo`, `rastreador_observacao`, `pgr_sm_automatica boolean`; frota: `nr_frota`, `ultimo_motorista_id fk motorista`, `venc_ipva date`, `potencia_motor`, `hp smallint`, `litros_tanque numeric(6,1)`, `aquisicao date`, `vl_compra numeric(12,2)`, `vl_mercado numeric(12,2)`, `km_inicial integer`, `nr_motor`, `media_padrao_carregado numeric(5,2)`, `media_padrao_vazio numeric(5,2)`, `unidade_operacional_id`, `centro_custo_id`; `observacao`; timestamps.
    - Trigger `before insert or update`: `placa := normalizar_placa(placa)`. Check `placa_valida(placa)`.
  - `public.capacidade_carga(v veiculo) returns numeric` immutable: `coalesce(v.capacidade_carga_t, v.pbt_t - v.tara_t)`.
  - RLS como na Task 5 em `veiculo`; listas de apoio: ler `pode_ler`, gravar `eh_admin`; `auditar('public.veiculo')`.

- [ ] **Step 1: Testes que falham:**
  - `test_placa_normalizada`: insert com `'abc-1234'` → `placa = 'ABC1234'`; `'ABC1D23'` → `lives_ok`; `'AB-12345'` → `throws_ok`.
  - `test_arrendado`: posse = documento → `arrendado = false`; posse ≠ documento → `true`.
  - `test_capacidade`: `pbt_t=45, tara_t=15, capacidade_carga_t=null` → `capacidade_carga(v) = 30`; com `capacidade_carga_t=28` → `28`.
  - `test_tipos_carregados`: `is(count(*) from tipo_veiculo, 33)`; `is(categoria from tipo_veiculo where id=18, 'dolly')`; `is(configuracao_cavalo where id=7, 'trucado')`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0600; aplicar como `veiculo`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): veículo, tipos, marcas, TAG e capacidade`.

### Task 8: Conjunto

**Files:**
- Create: `supabase/migrations/20261023000700_conjunto.sql`
- Test: `supabase/tests/conjunto.test.sql`

**Interfaces:**
- Consumes: `veiculo`, `tipo_veiculo`, `motorista`, `capacidade_carga`, helpers, `auditar`.
- Produces:
  - `conjunto` (`id`, `cavalo_id fk veiculo not null`, `motorista_id fk motorista null`, `inicio timestamptz not null default now()`, `fim timestamptz null`, `check (fim is null or fim > inicio)`, timestamps). Índice único parcial `(cavalo_id) where fim is null`.
  - `conjunto_item` (`conjunto_id fk conjunto on delete cascade`, `posicao smallint check (posicao between 1 and 5)`, `veiculo_id fk veiculo`, pk `(conjunto_id, posicao)`, unique `(conjunto_id, veiculo_id)`).
  - `public.validar_conjunto(p_conjunto uuid) returns void` — levanta exceção com estas mensagens exatas:
    - `'o cavalo do conjunto precisa ser da categoria cavalo'`
    - `'itens do conjunto precisam ser carreta ou dolly'`
    - `'posições do conjunto precisam começar em 1 e não ter buracos'`
    - `'dolly não pode ser a primeira nem a última peça'`
    - `'dois dollies não podem ficar seguidos'`
    - `'conjunto aceita no máximo 3 carretas'`
    - `'veículo já está em outro conjunto aberto'` (o cavalo ou um item já aparece em outro `conjunto` com `fim is null`)
  - Constraint triggers `deferrable initially deferred` em `conjunto` e `conjunto_item` que chamam `validar_conjunto` no fim da transação (a tela insere cabeçalho e itens na mesma transação).
  - View `public.v_conjunto_capacidade` (`security_invoker = true`): `conjunto_id`, `cavalo_id`, `cmt_t` do cavalo, `tara_total_t` (cavalo + itens), `capacidade_total_t` (soma de `capacidade_carga` das carretas), `excede_cmt boolean` = `capacidade_total_t > cmt_t - tara_total_t` (falso se `cmt_t` nulo).
  - RLS como na Task 5; `auditar` nas duas tabelas.

- [ ] **Step 1: Testes que falham** (cada um insere conjunto e itens e força a validação com `set constraints all immediate`):
  - `test_rodotrem_valido`: cavalo (tipo 7) + carreta (11) pos 1 + dolly (18) pos 2 + carreta (11) pos 3 → `lives_ok`.
  - `test_dolly_primeiro`: dolly na posição 1 → `throws_ok` com `'dolly não pode ser a primeira nem a última peça'`.
  - `test_dolly_ultimo`: carreta 1, dolly 2 → mesma mensagem.
  - `test_buraco_posicao`: posições 1 e 3 → `'posições do conjunto precisam começar em 1 e não ter buracos'`.
  - `test_base_nao_cavalo`: base tipo 11 (carreta) → `'o cavalo do conjunto precisa ser da categoria cavalo'`.
  - `test_veiculo_em_dois_conjuntos`: a mesma carreta em dois conjuntos abertos → `'veículo já está em outro conjunto aberto'`; depois de fechar o primeiro (`fim = now()`) → `lives_ok`.
  - `test_capacidade_excede`: cavalo `cmt_t=74, tara_t=9`; duas carretas `pbt_t=45, tara_t=8`; dolly `tara_t=3` → `capacidade_total_t = 74`, `tara_total_t = 28`, `excede_cmt = true`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0700; aplicar como `conjunto`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): conjunto com ordem de engate, validação e capacidade`.

### Task 9: Arquivos e Storage

**Files:**
- Create: `supabase/migrations/20261023000800_arquivos.sql`
- Test: `supabase/tests/arquivos.test.sql`

**Interfaces:**
- Consumes: `pessoa`, `veiculo`, helpers, `auditoria`, `auditar`.
- Produces:
  - `tipo_arquivo` (`id smallint pk`, `nome unique`, `aplica_pessoa boolean`, `aplica_veiculo boolean`) com: ANTT, ASSINATURA, CARIMBO, CND, CNH, COMP. RESIDÊNCIA, CONTRATO, CRV / DUT, CRLV, DOC PESSOAL, FOTO, FOTO CONJUNTO, LOGO, OUTROS (ids 1 a 14 nessa ordem).
  - `arquivo` (`id`, `tipo_arquivo_id not null`, `pessoa_id fk pessoa null`, `veiculo_id fk veiculo null`, `check (num_nonnulls(pessoa_id, veiculo_id) = 1)`, `storage_path text unique not null`, `nome_original`, `mime`, `tamanho_bytes integer`, `numero`, `validade date`, `restrito boolean default false`, `validado_em timestamptz`, `validado_por uuid`, timestamps). Convenção de caminho: `pessoa/<pessoa_id>/<arquivo_id>-<nome>` ou `veiculo/<veiculo_id>/<arquivo_id>-<nome>`.
  - RLS em `arquivo`: select `pode_ler() and (not restrito or eh_admin())`; insert/update `pode_editar()`; delete `eh_admin()`.
  - Bucket `documentos` (`insert into storage.buckets (id, name, public) values ('documentos','documentos', false)`), limite 20 MB, tipos `application/pdf`, `image/jpeg`, `image/png`, `image/heic`.
  - Políticas em `storage.objects` para `bucket_id = 'documentos'`: select se `pode_ler()` e não existe `arquivo` com `storage_path = name and restrito and not eh_admin()`; insert `pode_editar()`; delete `eh_admin()`.
  - `public.registrar_visualizacao(p_arquivo uuid) returns void` — `security definer`; exige `pode_ler()`; insere em `auditoria` com `acao='visualizacao'`. A aplicação chama antes de gerar o link temporário.
  - View `public.v_pendencias_documentos` (`security_invoker = true`): uma linha por pendência com `tipo_pendencia` em `'veiculo_arrendado_sem_contrato'` (veículo `arrendado` sem arquivo CONTRATO), `'arquivo_vencido'` (`validade < current_date`), `'motorista_sem_cnh'` (motorista sem arquivo CNH), `'motorista_sem_comprovante'` (motorista sem COMP. RESIDÊNCIA).

- [ ] **Step 1: Testes que falham:**
  - `test_arquivo_um_dono`: arquivo com `pessoa_id` e `veiculo_id` → `throws_ok`; sem nenhum → `throws_ok`.
  - `test_arquivo_restrito_so_admin`: arquivo `restrito=true`; como `operacao` → `count = 0`; como `admin` → `count = 1`. Insere um objeto em `storage.objects (bucket_id, name)` com o mesmo caminho e verifica a mesma regra no select de `storage.objects`.
  - `test_bucket_privado`: `is(public from storage.buckets where id='documentos', false)`.
  - `test_pendencia_arrendado`: veículo arrendado sem CONTRATO aparece em `v_pendencias_documentos` com `'veiculo_arrendado_sem_contrato'`; após inserir arquivo CONTRATO, não aparece.
  - `test_visualizacao_auditada`: `registrar_visualizacao(id)` como `operacao` → 1 linha em `auditoria` com `acao='visualizacao'`; como usuário sem perfil → `throws_ok`.
- [ ] **Step 2:** Rodar; falha esperada.
- [ ] **Step 3:** Migration 0800; aplicar como `arquivos`.
- [ ] **Step 4:** Rodar; todos `ok`.
- [ ] **Step 5:** Commit `feat(db): arquivos, bucket privado e pendências de documentos`.

### Task 10: Verificação final e tipos

**Files:**
- Create: `supabase/types/database.ts`

- [ ] **Step 1:** Rodar **todos** os arquivos de teste, um por vez. Esperado: nenhum `not ok`.
- [ ] **Step 2:** `get_advisors` tipo `security` e tipo `performance`. Esperado: nenhum alerta de RLS desabilitado, política ausente, função com `search_path` mutável ou view sem `security_invoker`. Corrigir cada alerta com uma migration nova (`20261023000900_ajustes_advisors.sql`) e repetir o passo.
- [ ] **Step 3:** `list_tables` schema `public` com `verbose: true`: confirmar que todas as tabelas das Tasks 3 a 9 existem com RLS ligado.
- [ ] **Step 4:** `generate_typescript_types` e salvar a saída em `supabase/types/database.ts`.
- [ ] **Step 5:** Criar o primeiro administrador (passo do usuário, não do agente): o usuário cria a própria conta em *Authentication → Users* no painel do Supabase; depois o agente roda com `execute_sql` `insert into perfil_usuario (user_id, nome, papel) select id, '<nome do usuário>', 'admin' from auth.users where email = '<e-mail informado pelo usuário>';`, com o e-mail que o usuário digitar no chat.
- [ ] **Step 6:** Commit `chore(db): tipos gerados e verificação da fase 1`.

---

## Fora deste plano
- Telas do sistema web (plano próprio, depois deste).
- Papel e acesso do motorista pelo app (fase 6).
- Centros de custo, gerenciadora de risco e demais listas (fases 2 e 3).
- Consulta à BrasilAPI (é feita pela aplicação; aqui só existem as colunas `dados_brasilapi` e `dt_consulta_brasilapi`).
