create table if not exists public.worship_flow_songs (
  sunday_id uuid not null references public.sundays(id) on delete cascade,
  song_id uuid not null,
  position integer not null check (position >= 0),
  primary key (sunday_id, song_id),
  unique (sunday_id, position),
  constraint worship_flow_songs_scheduled_song_fk
    foreign key (sunday_id, song_id)
    references public.sunday_songs(sunday_id, song_id) on delete cascade
);

alter table public.worship_flow_songs enable row level security;
grant select on public.worship_flow_songs to anon, authenticated;
grant insert, delete on public.worship_flow_songs to authenticated;

drop policy if exists "public can read worship flow" on public.worship_flow_songs;
drop policy if exists "owner can insert worship flow" on public.worship_flow_songs;
drop policy if exists "owner can delete worship flow" on public.worship_flow_songs;
create policy "public can read worship flow" on public.worship_flow_songs
  for select using (true);
create policy "owner can insert worship flow" on public.worship_flow_songs
  for insert with check (public.is_worship_owner());
create policy "owner can delete worship flow" on public.worship_flow_songs
  for delete using (public.is_worship_owner());

create or replace function public.save_worship_flow(p_sunday_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit Worship Flow' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  if not exists (select 1 from public.sundays where id = p_sunday_id) then
    raise exception 'Sunday does not exist';
  end if;
  if cardinality(p_song_ids) <> (
    select count(distinct selected.song_id)
    from unnest(p_song_ids) as selected(song_id)
  ) then
    raise exception 'Song IDs must be non-null and unique';
  end if;
  if exists (
    select 1
    from unnest(p_song_ids) as selected(song_id)
    where not exists (
      select 1
      from public.sunday_songs scheduled
      where scheduled.sunday_id = p_sunday_id
        and scheduled.song_id = selected.song_id
    )
  ) then
    raise exception 'Every Worship Flow song must be scheduled for that Sunday';
  end if;

  delete from public.worship_flow_songs where sunday_id = p_sunday_id;
  insert into public.worship_flow_songs (sunday_id, song_id, position)
  select p_sunday_id, selected.song_id, selected.position - 1
  from unnest(p_song_ids) with ordinality as selected(song_id, position);
end;
$$;

create or replace function public.save_sunday_songs(p_sunday_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit the Sunday Schedule' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  if not exists (select 1 from public.sundays where id = p_sunday_id) then
    raise exception 'Sunday does not exist';
  end if;
  if cardinality(p_song_ids) <> (
    select count(distinct selected.song_id)
    from unnest(p_song_ids) as selected(song_id)
  ) then
    raise exception 'Song IDs must be non-null and unique';
  end if;
  if exists (
    select 1
    from unnest(p_song_ids) as selected(song_id)
    where not exists (
      select 1 from public.songs where id = selected.song_id
    )
  ) then
    raise exception 'Every scheduled song must exist';
  end if;

  delete from public.sunday_songs
  where sunday_id = p_sunday_id
    and song_id <> all (p_song_ids);
  update public.sunday_songs
  set position = -position - 1
  where sunday_id = p_sunday_id;
  insert into public.sunday_songs (sunday_id, song_id, position)
  select p_sunday_id, selected.song_id, selected.position - 1
  from unnest(p_song_ids) with ordinality as selected(song_id, position)
  on conflict (sunday_id, song_id)
  do update set position = excluded.position;
end;
$$;

revoke all on function public.save_worship_flow(uuid, uuid[]) from public, anon;
revoke all on function public.save_sunday_songs(uuid, uuid[]) from public, anon;
grant execute on function public.save_worship_flow(uuid, uuid[]) to authenticated;
grant execute on function public.save_sunday_songs(uuid, uuid[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'worship_flow_songs'
     ) then
    alter publication supabase_realtime add table public.worship_flow_songs;
  end if;
end;
$$;
