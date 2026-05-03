-- Additive policy for the "Offene Punkte" module.
-- Only admins may delete note entries. Tasks remain protected from deletion.

grant delete on public.notes to authenticated;

drop policy if exists "notes_delete_admin" on public.notes;
create policy "notes_delete_admin"
on public.notes for delete
to authenticated
using (public.current_user_role() = 'admin');
