create table if not exists public.event_flow_songs (
  private_session_id uuid not null,
  song_id uuid not null,
  position integer not null check (position >= 0),
  primary key (private_session_id, song_id),
  unique (private_session_id, position),
  constraint event_flow_songs_assigned_song_fk
    foreign key (private_session_id, song_id)
    references public.private_session_songs(private_session_id, song_id) on delete cascade
);

alter table public.event_flow_songs enable row level security;
grant select on public.event_flow_songs to anon, authenticated;
grant insert, delete on public.event_flow_songs to authenticated;

drop policy if exists "public can read event flow" on public.event_flow_songs;
drop policy if exists "owner can insert event flow" on public.event_flow_songs;
drop policy if exists "owner can delete event flow" on public.event_flow_songs;
create policy "public can read event flow" on public.event_flow_songs
  for select using (true);
create policy "owner can insert event flow" on public.event_flow_songs
  for insert with check (public.is_worship_owner());
create policy "owner can delete event flow" on public.event_flow_songs
  for delete using (public.is_worship_owner());

create or replace function public.save_event_flow(p_private_session_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit Event Flow' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  select id into v_session_id
  from public.private_sessions
  where id = p_private_session_id
  for update;
  if not found then
    raise exception 'Event does not exist';
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
      from public.private_session_songs assigned
      where assigned.private_session_id = v_session_id
        and assigned.song_id = selected.song_id
    )
  ) then
    raise exception 'Every Event Flow song must be assigned to that event';
  end if;

  delete from public.event_flow_songs where private_session_id = v_session_id;
  insert into public.event_flow_songs (private_session_id, song_id, position)
  select v_session_id, selected.song_id, (selected.ordinality - 1)::integer
  from unnest(p_song_ids) with ordinality as selected(song_id, ordinality);
end;
$$;

create or replace function public.save_private_session_songs(p_private_session_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_song_id uuid;
  v_position integer;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit event songs' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  select id into v_session_id
  from public.private_sessions
  where id = p_private_session_id
  for update;
  if not found then
    raise exception 'Event does not exist';
  end if;
  if cardinality(p_song_ids) <> (
    select count(distinct selected.song_id)
    from unnest(p_song_ids) as selected(song_id)
  ) then
    raise exception 'Song IDs must be non-null and unique';
  end if;
  if exists (
    select 1
    from public.private_session_songs
    where private_session_id = v_session_id
      and position < 0
  ) then
    raise exception 'Existing event song positions are invalid';
  end if;
  if exists (
    select 1
    from unnest(p_song_ids) as selected(song_id)
    where not exists (
      select 1 from public.songs where id = selected.song_id
    )
  ) then
    raise exception 'Every event song must exist';
  end if;

  delete from public.private_session_songs assigned
  where assigned.private_session_id = v_session_id
    and not (assigned.song_id = any (p_song_ids));

  update public.private_session_songs assigned
  set position = -assigned.position - 1
  where assigned.private_session_id = v_session_id
    and assigned.song_id = any (p_song_ids);

  for v_song_id, v_position in
    select selected.song_id, (selected.ordinality - 1)::integer
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
  loop
    if exists (
      select 1
      from public.private_session_songs
      where private_session_id = v_session_id
        and song_id = v_song_id
    ) then
      update public.private_session_songs
      set position = v_position
      where private_session_id = v_session_id
        and song_id = v_song_id;
    else
      insert into public.private_session_songs (private_session_id, song_id, position)
      values (v_session_id, v_song_id, v_position);
    end if;
  end loop;
end;
$$;

revoke all on function public.save_event_flow(uuid, uuid[]) from public, anon;
grant execute on function public.save_event_flow(uuid, uuid[]) to authenticated;
revoke all on function public.save_private_session_songs(uuid, uuid[]) from public, anon;
grant execute on function public.save_private_session_songs(uuid, uuid[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event_flow_songs'
     ) then
    alter publication supabase_realtime add table public.event_flow_songs;
  end if;
end;
$$;
