import type { Setlist, Song, WorshipEvent } from './data'
import { normalizeSong } from './data'
import { supabase } from './supabaseClient'

export type SharedSnapshot = { songs: Song[]; setlists: Setlist[]; events: WorshipEvent[] }

type DbSong = {
  id: string
  title: string
  artist: string
  original_key: string
  current_key: string
  capo: number
  bpm: number
  favorite: boolean
  tags: string[]
  notes: string
  chord_image_path: string | null
  sections: Array<{ id: string; name: string; chord_text: string; note: string | null }>
}

type DbSunday = {
  id: string
  name: string
  service_date: string
  description: string
  sunday_songs: Array<{ position: number; song_id: string; starting_chord_override: string | null }>
}

type DbEvent = {
  id: string
  name: string
  event_date: string
  description: string
  event_songs: Array<{ position: number; song_id: string; starting_chord_override: string | null }>
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

export async function loadSharedSnapshot(): Promise<SharedSnapshot> {
  const client = requireSupabase()
  const [songsResult, sundaysResult, eventsResult] = await Promise.all([
    client.from('songs').select('id,title,artist,original_key,current_key,capo,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,note,position)').order('updated_at', { ascending: false }),
    client.from('sundays').select('id,name,service_date,description,sunday_songs(song_id,position,starting_chord_override)').order('service_date', { ascending: false }),
    client.from('events').select('id,name,event_date,description,event_songs(song_id,position,starting_chord_override)').order('event_date', { ascending: false }),
  ])

  if (songsResult.error) throw songsResult.error
  if (sundaysResult.error) throw sundaysResult.error
  if (eventsResult.error) throw eventsResult.error

  const songs = ((songsResult.data ?? []) as unknown as DbSong[]).map((song) => normalizeSong({
    id: song.id,
    title: song.title,
    artist: song.artist,
    key: song.original_key,
    currentKey: song.current_key,
    capo: song.capo,
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags ?? [],
    notes: song.notes,
    chordImage: song.chord_image_path ? { name: song.chord_image_path, dataUrl: client.storage.from('chord-images').getPublicUrl(song.chord_image_path).data.publicUrl } : undefined,
    sections: (song.sections ?? []).map((section) => ({ id: section.id, name: section.name, chordText: section.chord_text, note: section.note ?? undefined })),
  }))

  const setlists = ((sundaysResult.data ?? []) as unknown as DbSunday[]).map((sunday) => ({
    id: sunday.id,
    name: sunday.name,
    date: sunday.service_date,
    description: sunday.description,
    songIds: (sunday.sunday_songs ?? []).sort((a, b) => a.position - b.position).map((item) => item.song_id),
    startingChordOverrides: Object.fromEntries((sunday.sunday_songs ?? []).filter((item) => item.starting_chord_override).map((item) => [item.song_id, item.starting_chord_override as string])),
  }))

  const events = ((eventsResult.data ?? []) as unknown as DbEvent[]).map((event) => ({
    id: event.id,
    name: event.name,
    date: event.event_date,
    description: event.description,
    songIds: (event.event_songs ?? []).sort((a, b) => a.position - b.position).map((item) => item.song_id),
    startingChordOverrides: Object.fromEntries((event.event_songs ?? []).filter((item) => item.starting_chord_override).map((item) => [item.song_id, item.starting_chord_override as string])),
  }))

  return { songs, setlists, events }
}

export async function upsertSharedSong(song: Song) {
  const client = requireSupabase()
  const imagePath = `songs/${song.id}`
  if (song.chordImage?.dataUrl) {
    const response = await fetch(song.chordImage.dataUrl)
    const imageBlob = await response.blob()
    const { error: uploadError } = await client.storage.from('chord-images').upload(imagePath, imageBlob, { upsert: true, contentType: imageBlob.type || 'image/jpeg' })
    if (uploadError) throw uploadError
  } else {
    const { error: removeError } = await client.storage.from('chord-images').remove([imagePath])
    if (removeError) throw removeError
  }

  const { error: songError } = await client.from('songs').upsert({
    id: song.id,
    title: song.title,
    artist: song.artist,
    original_key: song.key,
    current_key: song.currentKey,
    capo: song.capo,
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags,
    notes: song.notes,
    chord_image_path: song.chordImage?.dataUrl ? imagePath : null,
  })
  if (songError) throw songError

  const { error: deleteError } = await client.from('song_sections').delete().eq('song_id', song.id)
  if (deleteError) throw deleteError

  const sections = song.sections.map((section, position) => ({
    id: section.id,
    song_id: song.id,
    name: section.name,
    chord_text: section.chordText,
    note: section.note ?? null,
    position,
  }))
  if (sections.length) {
    const { error: sectionError } = await client.from('song_sections').insert(sections)
    if (sectionError) throw sectionError
  }
}

export async function deleteSharedSong(songId: string) {
  const client = requireSupabase()
  const { error: removeError } = await client.storage.from('chord-images').remove([`songs/${songId}`])
  if (removeError) throw removeError
  const { error } = await client.from('songs').delete().eq('id', songId)
  if (error) throw error
}

async function syncSongAssignments(table: 'sunday_songs' | 'event_songs', parentColumn: 'sunday_id' | 'event_id', parentId: string, songIds: string[], startingChordOverrides: Record<string, string> = {}) {
  const client = requireSupabase()
  const { data, error: loadError } = await client.from(table).select('song_id,position').eq(parentColumn, parentId)
  if (loadError) throw loadError

  const existing = (data ?? []) as Array<{ song_id: string; position: number }>
  if (existing.length === songIds.length && existing.every((item, index) => songIds[index] === item.song_id)) return

  const desiredIds = new Set(songIds)
  const removedIds = existing.filter((item) => !desiredIds.has(item.song_id)).map((item) => item.song_id)
  if (removedIds.length) {
    const { error } = await client.from(table).delete().eq(parentColumn, parentId).in('song_id', removedIds)
    if (error) throw error
  }

  const retained = existing.filter((item) => desiredIds.has(item.song_id))
  const maxPosition = existing.reduce((max, item) => Math.max(max, item.position), -1)
  const temporaryBase = maxPosition + songIds.length + 1
  for (const [index, item] of retained.entries()) {
    const { error } = await client.from(table).update({ position: temporaryBase + index }).eq(parentColumn, parentId).eq('song_id', item.song_id)
    if (error) throw error
  }

  const retainedIds = new Set(retained.map((item) => item.song_id))
  const newRows = songIds.flatMap((songId, position) => retainedIds.has(songId) ? [] : [{ [parentColumn]: parentId, song_id: songId, position, starting_chord_override: startingChordOverrides[songId] ?? null }])
  if (newRows.length) {
    const { error } = await client.from(table).insert(newRows)
    if (error) throw error
  }

  for (const [position, songId] of songIds.entries()) {
    if (!retainedIds.has(songId)) continue
    const { error } = await client.from(table).update({ position }).eq(parentColumn, parentId).eq('song_id', songId)
    if (error) throw error
  }
}

export async function upsertSunday(setlist: Setlist) {
  const client = requireSupabase()
  const { error } = await client.from('sundays').upsert({
    id: setlist.id,
    name: setlist.name,
    service_date: setlist.date || new Date().toISOString().slice(0, 10),
    description: setlist.description,
  })
  if (error) throw error
  await syncSongAssignments('sunday_songs', 'sunday_id', setlist.id, setlist.songIds, setlist.startingChordOverrides)
}

export async function setSundaySongStartingChord(sundayId: string, songId: string, startingChord: string | null) {
  const client = requireSupabase()
  const { data, error } = await client.from('sunday_songs').update({ starting_chord_override: startingChord }).eq('sunday_id', sundayId).eq('song_id', songId).select('song_id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This song is no longer assigned to the selected Sunday.')
}

export async function upsertEvent(event: WorshipEvent) {
  const client = requireSupabase()
  const { error } = await client.from('events').upsert({
    id: event.id,
    name: event.name,
    event_date: event.date || new Date().toISOString().slice(0, 10),
    description: event.description,
  })
  if (error) throw error
  await syncSongAssignments('event_songs', 'event_id', event.id, event.songIds, event.startingChordOverrides)
}

export async function setEventSongStartingChord(eventId: string, songId: string, startingChord: string | null) {
  const client = requireSupabase()
  const { data, error } = await client.from('event_songs').update({ starting_chord_override: startingChord }).eq('event_id', eventId).eq('song_id', songId).select('song_id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This song is no longer assigned to the selected event.')
}

export async function deleteSunday(setlistId: string) {
  const client = requireSupabase()
  const { error } = await client.from('sundays').delete().eq('id', setlistId)
  if (error) throw error
}

export async function deleteEvent(eventId: string) {
  const client = requireSupabase()
  const { error } = await client.from('events').delete().eq('id', eventId)
  if (error) throw error
}
