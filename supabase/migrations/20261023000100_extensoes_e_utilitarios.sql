-- Migration 0100: extensões e utilitários de validação/normalização.

create extension if not exists pgtap with schema extensions;
create extension if not exists unaccent with schema extensions;
