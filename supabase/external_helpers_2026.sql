-- Externe Helfende aus der LMU-Helfendenliste fuer Manheim 2026.
-- Additiv: keine bestehenden Tabellen oder Daten werden geloescht.

alter table public.participants
  add column if not exists person_type text not null default 'student';

alter table public.participants
  add column if not exists external_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'participants_person_type_check'
      and conrelid = 'public.participants'::regclass
  ) then
    alter table public.participants
      add constraint participants_person_type_check
      check (person_type in ('student', 'external'));
  end if;
end $$;

update public.participants
set person_type = 'student'
where person_type is null;

with helper_rows(full_name, availability_from, availability_to, status, availability_note) as (
  values
    ('Heike Kümpel', date '2026-08-10', date '2026-08-14', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.'),
    ('Wolfram Söns', date '2026-08-03', date '2026-08-07', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.'),
    ('Elke Grossenbacher', date '2026-08-31', date '2026-09-04', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.'),
    ('Roland Unzner-Harring', null::date, null::date, 'zu_klären', 'Externe Helfende laut LMU-Helfendenliste; Zeitraum noch offen.'),
    ('Uli Pingen-Rosenburg', date '2026-08-03', date '2026-08-07', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste; gemeinsam mit Harald Rosenburg gemeldet.'),
    ('Harald Rosenburg', date '2026-08-03', date '2026-08-07', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste; gemeinsam mit Uli Pingen-Rosenburg gemeldet.'),
    ('Alice Lütkemeier', date '2026-08-24', date '2026-08-28', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.'),
    ('Georg Wirtz', null::date, null::date, 'zu_klären', 'Externe Helfende laut LMU-Helfendenliste; Zeitraum noch offen.'),
    ('Konrad Müller', null::date, null::date, 'zu_klären', 'Externe Helfende laut LMU-Helfendenliste; Angabe: eine Woche im August.'),
    ('Gerd Pütz', null::date, null::date, 'zu_klären', 'Externe Helfende laut LMU-Helfendenliste; Zeitraum noch offen.'),
    ('Erika Petmecky', null::date, null::date, 'zu_klären', 'Externe Helfende laut LMU-Helfendenliste; Zeitraum noch offen.'),
    ('Roland Brückner', date '2026-08-10', date '2026-08-14', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.'),
    ('Engelbert Kraus', date '2026-08-17', date '2026-08-21', 'zugesagt', 'Externe Helfende laut LMU-Helfendenliste.')
)
insert into public.participants
  (full_name, public_role, availability_from, availability_to, status, availability_note, source_note, person_type, external_source)
select
  full_name,
  'Externe Helfende',
  availability_from,
  availability_to,
  status,
  availability_note,
  'Import aus 2026_08_09_Grabung_Uni_Muenchen_Helfende.xlsx. Tatjana Hartung wurde bewusst nicht dupliziert.',
  'external',
  'LMU-Helfendenliste 2026'
from helper_rows
on conflict (full_name) do update
set
  public_role = excluded.public_role,
  availability_from = excluded.availability_from,
  availability_to = excluded.availability_to,
  status = excluded.status,
  availability_note = excluded.availability_note,
  source_note = excluded.source_note,
  person_type = excluded.person_type,
  external_source = excluded.external_source;

with contacts(full_name, email, internal_note) as (
  values
    ('Heike Kümpel', 'heike.kuempel@netcologne.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Wolfram Söns', 'wolfram@soens.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Elke Grossenbacher', 'bernina@netcologne.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Roland Unzner-Harring', 'unzner.harring@gmail.com', 'Kontakt aus LMU-Helfendenliste.'),
    ('Uli Pingen-Rosenburg', 'ulpiro@freenet.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Harald Rosenburg', 'ulpiro@freenet.de', 'Kontakt aus LMU-Helfendenliste; gemeinsame Kontaktadresse mit Uli Pingen-Rosenburg.'),
    ('Alice Lütkemeier', 'b.luetkemeier@unitybox.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Georg Wirtz', 'wirtzgeorg@online.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Konrad Müller', 'imikom@gmx.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Gerd Pütz', 'g.puetz@obb-consult.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Erika Petmecky', 'erikapetmecky@t-online.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Roland Brückner', 'brues@hotmail.de', 'Kontakt aus LMU-Helfendenliste.'),
    ('Engelbert Kraus', 'vuekraus@gmail.com', 'Kontakt aus LMU-Helfendenliste.')
)
insert into public.participant_private
  (participant_id, email, internal_note)
select
  participants.id,
  contacts.email,
  contacts.internal_note
from contacts
join public.participants participants
  on participants.full_name = contacts.full_name
on conflict (participant_id) do update
set
  email = excluded.email,
  internal_note = excluded.internal_note;
