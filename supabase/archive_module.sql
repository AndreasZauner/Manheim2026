-- Additive archive support for tasks and notes.
-- Normal lists keep archived rows out of the active workflow.
-- Admins can see and restore archived entries through the app archive.

alter table public.notes
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

alter table public.tasks
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

revoke delete on public.notes from authenticated;
drop policy if exists "notes_delete_admin" on public.notes;

drop policy if exists "notes_select_active" on public.notes;
create policy "notes_select_active"
on public.notes for select
to authenticated
using (
  public.current_user_is_active()
  and (coalesce(is_archived, false) = false or public.current_user_role() = 'admin')
);

drop policy if exists "tasks_select_active" on public.tasks;
create policy "tasks_select_active"
on public.tasks for select
to authenticated
using (
  public.current_user_is_active()
  and (coalesce(is_archived, false) = false or public.current_user_role() = 'admin')
);
