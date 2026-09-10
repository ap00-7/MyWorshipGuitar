-- Worship Guitar shared data and owner-only write policy.
-- Run this in a fresh Supabase project's SQL Editor.

do $$
begin
  create type public.app_role as enum ('owner', 'user');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  original_key text not null,
  current_key text not null,
  capo integer not null default 0 check (capo between 0 and 12),
  bpm integer not null default 72,
  favorite boolean not null default false,
  tags text[] not null default '{}',
  notes text not null default '',
  chord_image_path text,
  guitar2_capo integer not null default 0 check (guitar2_capo between 0 and 12),
  guitar2_customized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.song_sections (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  name text not null,
  chord_text text not null default '',
  guitar2_chord_text text not null default '',
  note text,
  position integer not null default 0,
  unique (song_id, position)
);

create table if not exists public.sundays (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sunday Worship',
  service_date date not null default current_date,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sundays_service_date_unique on public.sundays(service_date);

create table if not exists public.sunday_songs (
  sunday_id uuid not null references public.sundays(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  primary key (sunday_id, song_id),
  unique (sunday_id, position)
);

create table if not exists public.chord_library (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  root text not null,
  type text not null,
  notes text[] not null default '{}',
  strings integer[] not null,
  fingers text[] not null,
  difficulty text not null default 'Beginner',
  base_fret integer not null default 1
);

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.songs, public.song_sections, public.sundays, public.sunday_songs, public.chord_library to anon, authenticated;
grant insert, update, delete on public.songs, public.song_sections, public.sundays, public.sunday_songs, public.chord_library to authenticated;
grant update on public.profiles to authenticated;

create or replace function public.is_worship_owner()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.song_sections enable row level security;
alter table public.sundays enable row level security;
alter table public.sunday_songs enable row level security;
alter table public.chord_library enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "public can read songs" on public.songs;
drop policy if exists "public can read song sections" on public.song_sections;
drop policy if exists "public can read sundays" on public.sundays;
drop policy if exists "public can read sunday songs" on public.sunday_songs;
drop policy if exists "public can read chord library" on public.chord_library;
create policy "users can read own profile" on public.profiles for select using (id = auth.uid());
create policy "public can read songs" on public.songs for select using (true);
create policy "public can read song sections" on public.song_sections for select using (true);
create policy "public can read sundays" on public.sundays for select using (true);
create policy "public can read sunday songs" on public.sunday_songs for select using (true);
create policy "public can read chord library" on public.chord_library for select using (true);

drop policy if exists "owner can insert songs" on public.songs;
drop policy if exists "owner can update songs" on public.songs;
drop policy if exists "owner can delete songs" on public.songs;
drop policy if exists "owner can insert song sections" on public.song_sections;
drop policy if exists "owner can update song sections" on public.song_sections;
drop policy if exists "owner can delete song sections" on public.song_sections;
drop policy if exists "owner can insert sundays" on public.sundays;
drop policy if exists "owner can update sundays" on public.sundays;
drop policy if exists "owner can delete sundays" on public.sundays;
drop policy if exists "owner can insert sunday songs" on public.sunday_songs;
drop policy if exists "owner can update sunday songs" on public.sunday_songs;
drop policy if exists "owner can delete sunday songs" on public.sunday_songs;
drop policy if exists "owner can insert chord library" on public.chord_library;
drop policy if exists "owner can update chord library" on public.chord_library;
drop policy if exists "owner can delete chord library" on public.chord_library;
create policy "owner can insert songs" on public.songs for insert with check (public.is_worship_owner());
create policy "owner can update songs" on public.songs for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete songs" on public.songs for delete using (public.is_worship_owner());
create policy "owner can insert song sections" on public.song_sections for insert with check (public.is_worship_owner());
create policy "owner can update song sections" on public.song_sections for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete song sections" on public.song_sections for delete using (public.is_worship_owner());
create policy "owner can insert sundays" on public.sundays for insert with check (public.is_worship_owner());
create policy "owner can update sundays" on public.sundays for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete sundays" on public.sundays for delete using (public.is_worship_owner());
create policy "owner can insert sunday songs" on public.sunday_songs for insert with check (public.is_worship_owner());
create policy "owner can update sunday songs" on public.sunday_songs for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete sunday songs" on public.sunday_songs for delete using (public.is_worship_owner());
create policy "owner can insert chord library" on public.chord_library for insert with check (public.is_worship_owner());
create policy "owner can update chord library" on public.chord_library for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete chord library" on public.chord_library for delete using (public.is_worship_owner());

insert into storage.buckets (id, name, public)
values ('chord-images', 'chord-images', true)
on conflict (id) do nothing;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

drop policy if exists "public can view chord images" on storage.objects;
drop policy if exists "owner can upload chord images" on storage.objects;
drop policy if exists "owner can update chord images" on storage.objects;
drop policy if exists "owner can delete chord images" on storage.objects;
create policy "public can view chord images" on storage.objects for select using (bucket_id = 'chord-images');
create policy "owner can upload chord images" on storage.objects for insert with check (bucket_id = 'chord-images' and public.is_worship_owner());
create policy "owner can update chord images" on storage.objects for update using (bucket_id = 'chord-images' and public.is_worship_owner());
create policy "owner can delete chord images" on storage.objects for delete using (bucket_id = 'chord-images' and public.is_worship_owner());

-- Additive updates for existing projects created before Guitar 2 columns existed.
alter table public.songs add column if not exists guitar2_capo integer not null default 0;
alter table public.songs add column if not exists guitar2_customized boolean not null default false;
alter table public.song_sections add column if not exists guitar2_chord_text text not null default '';

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_touch_updated_at on public.songs;
create trigger songs_touch_updated_at before update on public.songs
for each row execute procedure public.touch_updated_at();

drop trigger if exists sundays_touch_updated_at on public.sundays;
create trigger sundays_touch_updated_at before update on public.sundays
for each row execute procedure public.touch_updated_at();
