-- Erweiterte Statuswerte fuer den Personaleinsatz.
-- Nicht destruktiv fuer Daten: Die vorhandene Check-Constraint wird nur erweitert.

alter table public.participants
  drop constraint if exists participants_status_check;

alter table public.participants
  add constraint participants_status_check
  check (status in (
    'gesetzt',
    'zugesagt',
    'erweiterbar',
    'unklar',
    U&'zu_kl\00E4ren',
    'anzufragen',
    'abgesagt'
  ));

notify pgrst, 'reload schema';
