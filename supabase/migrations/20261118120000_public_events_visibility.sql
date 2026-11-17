create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  events_public boolean not null default false
);

insert into public.app_settings (id, events_public)
values (true, false)
on conflict (id) do nothing;

grant select on public.app_settings to anon, authenticated;
grant update on public.app_settings to authenticated;
alter table public.app_settings enable row level security;

create or replace function public.events_are_public()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select events_public from public.app_settings where id = true), false);
$$;

drop policy if exists "public can read app settings" on public.app_settings;
drop policy if exists "owner can update app settings" on public.app_settings;
create policy "public can read app settings" on public.app_settings
  for select using (true);
create policy "owner can update app settings" on public.app_settings
  for update using (public.is_worship_owner())
  with check (public.is_worship_owner());

drop policy if exists "public can read private sessions" on public.private_sessions;
drop policy if exists "users can read visible private sessions" on public.private_sessions;
create policy "users can read visible private sessions" on public.private_sessions
  for select using (public.is_worship_owner() or public.events_are_public());

drop policy if exists "public can read private session songs" on public.private_session_songs;
drop policy if exists "users can read visible private session songs" on public.private_session_songs;
create policy "users can read visible private session songs" on public.private_session_songs
  for select using (public.is_worship_owner() or public.events_are_public());

drop policy if exists "public can read event flow" on public.event_flow_songs;
create policy "public can read event flow" on public.event_flow_songs
  for select using (public.is_worship_owner() or public.events_are_public());

drop policy if exists "public can read event flow song occurrences" on public.event_flow_song_occurrences;
create policy "public can read event flow song occurrences" on public.event_flow_song_occurrences
  for select using (public.is_worship_owner() or public.events_are_public());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'app_settings'
     ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end
$$;
