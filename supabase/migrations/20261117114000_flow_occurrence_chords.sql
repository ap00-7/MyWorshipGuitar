alter table public.worship_flow_song_occurrences
  add column if not exists starting_chord_override text;
alter table public.event_flow_song_occurrences
  add column if not exists starting_chord_override text;

update public.worship_flow_song_occurrences occurrence
set starting_chord_override = scheduled.starting_chord_override
from public.sunday_songs scheduled
where occurrence.sunday_id = scheduled.sunday_id
  and occurrence.song_id = scheduled.song_id
  and occurrence.starting_chord_override is null
  and scheduled.starting_chord_override is not null;

update public.event_flow_song_occurrences occurrence
set starting_chord_override = assigned.starting_chord_override
from public.private_session_songs assigned
where occurrence.private_session_id = assigned.private_session_id
  and occurrence.song_id = assigned.song_id
  and occurrence.starting_chord_override is null
  and assigned.starting_chord_override is not null;

create or replace function public.save_worship_flow(p_sunday_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sunday_id uuid;
  v_position_offset integer;
  v_base_position_offset integer;
  v_new_membership_position integer;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit Worship Flow' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  select id into v_sunday_id
  from public.sundays
  where id = p_sunday_id
  for update;
  if not found then
    raise exception 'Sunday does not exist';
  end if;
  if exists (
    select 1
    from unnest(p_song_ids) as selected(song_id)
    where selected.song_id is null
  ) then
    raise exception 'Song IDs cannot contain null values';
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

  select coalesce(max(position), 0) + cardinality(p_song_ids) + 1
  into v_base_position_offset
  from public.worship_flow_songs
  where sunday_id = p_sunday_id;
  update public.worship_flow_songs
  set position = position + v_base_position_offset
  where sunday_id = p_sunday_id;
  select coalesce(max(position), -1) + 1
  into v_new_membership_position
  from public.worship_flow_songs
  where sunday_id = p_sunday_id;
  with unique_songs as (
    select selected.song_id, min(selected.ordinality) as first_ordinal
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
    group by selected.song_id
  )
  insert into public.worship_flow_songs (sunday_id, song_id, position)
  select
    p_sunday_id,
    unique_songs.song_id,
    v_new_membership_position + (row_number() over (order by unique_songs.first_ordinal) - 1)::integer
  from unique_songs
  where not exists (
    select 1
    from public.worship_flow_songs membership
    where membership.sunday_id = p_sunday_id
      and membership.song_id = unique_songs.song_id
  );

  select coalesce(max(position), 0) + cardinality(p_song_ids) + 1
  into v_position_offset
  from public.worship_flow_song_occurrences
  where sunday_id = p_sunday_id;
  update public.worship_flow_song_occurrences
  set position = position + v_position_offset
  where sunday_id = p_sunday_id;

  with old_occurrences as (
    select
      position as shifted_position,
      song_id,
      row_number() over (partition by song_id order by position) as occurrence_number
    from public.worship_flow_song_occurrences
    where sunday_id = p_sunday_id
  ),
  new_occurrences as (
    select
      selected.song_id,
      (selected.ordinality - 1)::integer as new_position,
      row_number() over (partition by selected.song_id order by selected.ordinality) as occurrence_number
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
  ),
  retained_occurrences as (
    select old_occurrences.shifted_position, new_occurrences.new_position
    from old_occurrences
    join new_occurrences using (song_id, occurrence_number)
  )
  update public.worship_flow_song_occurrences occurrence
  set position = retained_occurrences.new_position
  from retained_occurrences
  where occurrence.sunday_id = p_sunday_id
    and occurrence.position = retained_occurrences.shifted_position;

  delete from public.worship_flow_song_occurrences
  where sunday_id = p_sunday_id
    and position >= v_position_offset;

  with selected as (
    select selected.song_id, (selected.ordinality - 1)::integer as position
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
  )
  insert into public.worship_flow_song_occurrences (sunday_id, song_id, position)
  select p_sunday_id, selected.song_id, selected.position
  from selected
  where not exists (
    select 1
    from public.worship_flow_song_occurrences occurrence
    where occurrence.sunday_id = p_sunday_id
      and occurrence.position = selected.position
  );

  with unique_songs as (
    select selected.song_id, min(selected.ordinality) as first_ordinal
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
    group by selected.song_id
  ),
  ordered_memberships as (
    select
      song_id,
      (row_number() over (order by first_ordinal) - 1)::integer as new_position
    from unique_songs
  )
  update public.worship_flow_songs membership
  set position = ordered_memberships.new_position
  from ordered_memberships
  where membership.sunday_id = p_sunday_id
    and membership.song_id = ordered_memberships.song_id;

  delete from public.worship_flow_songs membership
  where membership.sunday_id = p_sunday_id
    and not (membership.song_id = any (p_song_ids));
end;
$$;

create or replace function public.save_event_flow(p_private_session_id uuid, p_song_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_position_offset integer;
  v_base_position_offset integer;
  v_new_membership_position integer;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can edit Event Flow' using errcode = '42501';
  end if;
  if p_song_ids is null then
    raise exception 'Song IDs cannot be null';
  end if;
  if exists (
    select 1
    from unnest(p_song_ids) as selected(song_id)
    where selected.song_id is null
  ) then
    raise exception 'Song IDs cannot contain null values';
  end if;
  select id into v_session_id
  from public.private_sessions
  where id = p_private_session_id
  for update;
  if not found then
    raise exception 'Event does not exist';
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

  select coalesce(max(position), 0) + cardinality(p_song_ids) + 1
  into v_base_position_offset
  from public.event_flow_songs
  where private_session_id = v_session_id;
  update public.event_flow_songs
  set position = position + v_base_position_offset
  where private_session_id = v_session_id;
  select coalesce(max(position), -1) + 1
  into v_new_membership_position
  from public.event_flow_songs
  where private_session_id = v_session_id;
  with unique_songs as (
    select selected.song_id, min(selected.ordinality) as first_ordinal
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
    group by selected.song_id
  )
  insert into public.event_flow_songs (private_session_id, song_id, position)
  select
    v_session_id,
    unique_songs.song_id,
    v_new_membership_position + (row_number() over (order by unique_songs.first_ordinal) - 1)::integer
  from unique_songs
  where not exists (
    select 1
    from public.event_flow_songs membership
    where membership.private_session_id = v_session_id
      and membership.song_id = unique_songs.song_id
  );

  select coalesce(max(position), 0) + cardinality(p_song_ids) + 1
  into v_position_offset
  from public.event_flow_song_occurrences
  where private_session_id = v_session_id;
  update public.event_flow_song_occurrences
  set position = position + v_position_offset
  where private_session_id = v_session_id;

  with old_occurrences as (
    select
      position as shifted_position,
      song_id,
      row_number() over (partition by song_id order by position) as occurrence_number
    from public.event_flow_song_occurrences
    where private_session_id = v_session_id
  ),
  new_occurrences as (
    select
      selected.song_id,
      (selected.ordinality - 1)::integer as new_position,
      row_number() over (partition by selected.song_id order by selected.ordinality) as occurrence_number
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
  ),
  retained_occurrences as (
    select old_occurrences.shifted_position, new_occurrences.new_position
    from old_occurrences
    join new_occurrences using (song_id, occurrence_number)
  )
  update public.event_flow_song_occurrences occurrence
  set position = retained_occurrences.new_position
  from retained_occurrences
  where occurrence.private_session_id = v_session_id
    and occurrence.position = retained_occurrences.shifted_position;

  delete from public.event_flow_song_occurrences
  where private_session_id = v_session_id
    and position >= v_position_offset;

  with selected as (
    select selected.song_id, (selected.ordinality - 1)::integer as position
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
  )
  insert into public.event_flow_song_occurrences (private_session_id, song_id, position)
  select v_session_id, selected.song_id, selected.position
  from selected
  where not exists (
    select 1
    from public.event_flow_song_occurrences occurrence
    where occurrence.private_session_id = v_session_id
      and occurrence.position = selected.position
  );

  with unique_songs as (
    select selected.song_id, min(selected.ordinality) as first_ordinal
    from unnest(p_song_ids) with ordinality as selected(song_id, ordinality)
    group by selected.song_id
  ),
  ordered_memberships as (
    select
      song_id,
      (row_number() over (order by first_ordinal) - 1)::integer as new_position
    from unique_songs
  )
  update public.event_flow_songs membership
  set position = ordered_memberships.new_position
  from ordered_memberships
  where membership.private_session_id = v_session_id
    and membership.song_id = ordered_memberships.song_id;

  delete from public.event_flow_songs membership
  where membership.private_session_id = v_session_id
    and not (membership.song_id = any (p_song_ids));
end;
$$;

create or replace function public.set_worship_flow_song_starting_chord(
  p_sunday_id uuid,
  p_occurrence_index integer,
  p_song_id uuid,
  p_starting_chord_override text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sunday_id uuid;
  v_position integer;
  v_song_id uuid;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can set a Worship Flow starting chord' using errcode = '42501';
  end if;
  if p_occurrence_index is null or p_occurrence_index < 0 then
    raise exception 'Flow occurrence index cannot be negative';
  end if;
  select id into v_sunday_id
  from public.sundays
  where id = p_sunday_id
  for update;
  if not found then
    raise exception 'Sunday does not exist';
  end if;
  select position, song_id
  into v_position, v_song_id
  from public.worship_flow_song_occurrences
  where sunday_id = p_sunday_id
  order by position
  limit 1
  offset p_occurrence_index
  for update;
  if not found or v_song_id <> p_song_id then
    raise exception 'This song copy is no longer in the selected Worship Flow';
  end if;

  update public.worship_flow_song_occurrences
  set starting_chord_override = p_starting_chord_override
  where sunday_id = p_sunday_id
    and position = v_position;
end;
$$;

create or replace function public.set_event_flow_song_starting_chord(
  p_private_session_id uuid,
  p_occurrence_index integer,
  p_song_id uuid,
  p_starting_chord_override text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_position integer;
  v_session_id uuid;
  v_song_id uuid;
begin
  if not public.is_worship_owner() then
    raise exception 'Only the worship owner can set an Event Flow starting chord' using errcode = '42501';
  end if;
  if p_occurrence_index is null or p_occurrence_index < 0 then
    raise exception 'Flow occurrence index cannot be negative';
  end if;
  select id into v_session_id
  from public.private_sessions
  where id = p_private_session_id
  for update;
  if not found then
    raise exception 'Event does not exist';
  end if;
  select position, song_id
  into v_position, v_song_id
  from public.event_flow_song_occurrences
  where private_session_id = p_private_session_id
  order by position
  limit 1
  offset p_occurrence_index
  for update;
  if not found or v_song_id <> p_song_id then
    raise exception 'This song copy is no longer in the selected Event Flow';
  end if;

  update public.event_flow_song_occurrences
  set starting_chord_override = p_starting_chord_override
  where private_session_id = p_private_session_id
    and position = v_position;
end;
$$;

revoke all on function public.set_worship_flow_song_starting_chord(uuid, integer, uuid, text) from public, anon;
revoke all on function public.set_event_flow_song_starting_chord(uuid, integer, uuid, text) from public, anon;
grant execute on function public.set_worship_flow_song_starting_chord(uuid, integer, uuid, text) to authenticated;
grant execute on function public.set_event_flow_song_starting_chord(uuid, integer, uuid, text) to authenticated;
