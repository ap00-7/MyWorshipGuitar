-- Worship Guitar V4 shared-data foundation.
-- Run in Supabase SQL editor, then create the owner account in Supabase Auth.
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  original_key text not null,
  capo integer not null default 0 check (capo between 0 and 12),
  bpm integer not null default 72,
  sections jsonb not null default '[]'::jsonb,
  notes text not null default '',
  chord_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sundays (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sunday Worship',
  service_date date not null,
  song_ids uuid[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.songs enable row level security;
alter table public.sundays enable row level security;

-- Public users can read shared chord sheets and Sunday plans.
create policy "public can read songs" on public.songs for select using (true);
create policy "public can read sundays" on public.sundays for select using (true);

-- Only the configured owner identity may write. Replace with the owner's Auth user id.
-- Keep this value in a database-side setting or replace it before applying policies.
create or replace function public.is_worship_owner() returns boolean
language sql stable security definer set search_path = public
as $$ select auth.uid() is not null and auth.uid() = current_setting('app.owner_user_id', true)::uuid $$;

create policy "owner can insert songs" on public.songs for insert with check (public.is_worship_owner());
create policy "owner can update songs" on public.songs for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete songs" on public.songs for delete using (public.is_worship_owner());
create policy "owner can insert sundays" on public.sundays for insert with check (public.is_worship_owner());
create policy "owner can update sundays" on public.sundays for update using (public.is_worship_owner()) with check (public.is_worship_owner());
create policy "owner can delete sundays" on public.sundays for delete using (public.is_worship_owner());

insert into storage.buckets (id, name, public) values ('chord-images', 'chord-images', true) on conflict (id) do nothing;
create policy "public can view chord images" on storage.objects for select using (bucket_id = 'chord-images');
create policy "owner can upload chord images" on storage.objects for insert with check (bucket_id = 'chord-images' and public.is_worship_owner());
create policy "owner can update chord images" on storage.objects for update using (bucket_id = 'chord-images' and public.is_worship_owner());
create policy "owner can delete chord images" on storage.objects for delete using (bucket_id = 'chord-images' and public.is_worship_owner());
