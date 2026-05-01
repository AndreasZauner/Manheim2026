-- Additive v2.1 preparation only.
-- Run this in Supabase SQL Editor when tasks/notes should be assignable
-- to the six new main areas. Existing categories remain untouched.

alter table public.tasks
  add column if not exists area_code text;

alter table public.notes
  add column if not exists area_code text;

comment on column public.tasks.area_code is
  'Optional v2.1 area key: leitstand, personal, feld_doku, infrastruktur, finanzen, verwaltung.';

comment on column public.notes.area_code is
  'Optional v2.1 area key: leitstand, personal, feld_doku, infrastruktur, finanzen, verwaltung.';
