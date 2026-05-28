-- Erweitert Teilnehmerstatus um abgesagt und vorhandene Statuseditor-Werte.

alter table public.participants
  drop constraint if exists participants_status_check;

alter table public.participants
  add constraint participants_status_check
  check (
    status in ('gesetzt','zugesagt','anzufragen','erweiterbar','unklar','abgesagt')
    or status = 'zu_kl' || chr(228) || 'ren'
    or status = 'zu_klÃ¤ren'
  );
