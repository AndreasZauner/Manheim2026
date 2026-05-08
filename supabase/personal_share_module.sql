-- Passwortgeschuetzte Nur-Lese-Freigabe fuer den vollstaendigen Personalstand.
-- Ausfuehren in Supabase SQL Editor nach dem Merge.

create extension if not exists pgcrypto;

create table if not exists public.personal_share_settings (
  id boolean primary key default true,
  password_hash text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (id = true)
);

insert into public.personal_share_settings (id, password_hash, is_active, updated_at)
values (true, crypt('Kerpen2026', gen_salt('bf')), true, now())
on conflict (id) do update
set password_hash = excluded.password_hash,
    is_active = true,
    updated_at = now();

create table if not exists public.participant_availability_slots (
  id bigserial primary key,
  participant_id bigint not null references public.participants(id) on delete cascade,
  availability_from date not null,
  availability_to date not null,
  order_index integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.participant_absences (
  id bigserial primary key,
  participant_id bigint not null references public.participants(id) on delete cascade,
  absence_from date not null,
  absence_to date not null,
  reason_type text not null check (reason_type in ('krank', 'anderer_grund')),
  reason_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.get_personal_share_snapshot(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  password_valid boolean;
  payload jsonb;
begin
  select exists (
    select 1
    from public.personal_share_settings settings
    where settings.id = true
      and settings.is_active = true
      and settings.password_hash = crypt(coalesce(p_password, ''), settings.password_hash)
  )
  into password_valid;

  if not password_valid then
    raise exception 'ungueltiges passwort' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'participants', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', participants.id,
        'full_name', participants.full_name,
        'public_role', participants.public_role,
        'status', participants.status,
        'availability_from', participants.availability_from,
        'availability_to', participants.availability_to,
        'availability_note', participants.availability_note,
        'source_note', participants.source_note,
        'private', jsonb_build_object(
          'phone', private_rows.phone,
          'email', private_rows.email,
          'internal_note', private_rows.internal_note
        ),
        'slots', coalesce((
          select jsonb_agg(jsonb_build_object(
            'availability_from', slots.availability_from,
            'availability_to', slots.availability_to,
            'order_index', slots.order_index
          ) order by slots.order_index, slots.availability_from)
          from public.participant_availability_slots slots
          where slots.participant_id = participants.id
        ), '[]'::jsonb),
        'absences', coalesce((
          select jsonb_agg(jsonb_build_object(
            'absence_from', absences.absence_from,
            'absence_to', absences.absence_to,
            'reason_type', absences.reason_type,
            'reason_note', absences.reason_note
          ) order by absences.absence_from)
          from public.participant_absences absences
          where absences.participant_id = participants.id
        ), '[]'::jsonb)
      )
      order by
        case
          when lower(coalesce(participants.public_role, '')) like '%grabungsleit%' then 0
          when lower(coalesce(participants.public_role, '')) like '%professor%' then 0
          when lower(coalesce(participants.public_role, '')) like '%technische%' then 1
          when lower(coalesce(participants.public_role, '')) like '%assist%' then 2
          when lower(coalesce(participants.public_role, '')) like '%schnitt%' then 3
          when lower(coalesce(participants.public_role, '')) like '%doku%' then 4
          when lower(coalesce(participants.public_role, '')) like '%logistik%' then 5
          when lower(coalesce(participants.public_role, '')) like '%teilnehm%' then 6
          else 9
        end,
        participants.availability_from nulls last,
        participants.full_name
    ), '[]'::jsonb)
  )
  into payload
  from public.participants participants
  left join public.participant_private private_rows
    on private_rows.participant_id = participants.id;

  return payload;
end;
$$;

revoke all on function public.get_personal_share_snapshot(text) from public;
grant execute on function public.get_personal_share_snapshot(text) to anon, authenticated;
