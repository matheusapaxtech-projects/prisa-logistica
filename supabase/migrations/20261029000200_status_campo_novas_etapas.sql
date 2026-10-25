-- Migration 20261029000200: as duas etapas do motor de despacho que faltavam no Quadro.
-- Fica sozinha porque o valor novo de um enum só pode ser usado depois de gravado (commit); as regras que
-- usam as etapas estão na 20261029000300.
alter type public.status_campo add value if not exists 'descarregando' after 'aguardando_descarga';
alter type public.status_campo add value if not exists 'aguardando_saldo' after 'resolucao_divergencia';
