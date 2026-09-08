import type { Setlist, Song } from './data'
import { normalizeSong } from './data'
import { supabase } from './supabaseClient'

export type SharedSnapshot = { songs: Song[]; setlists: Setlist[] }

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
  sunday_songs: Array<{ position: number; song_id: string }>
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

export async function loadSharedSnapshot(): Promise<SharedSnapshot> {
  const client = requireSupabase()
  const [songsResult, sundaysResult] = await Promise.all([
    client.from('songs').select('id,title,artist,original_key,current_key,capo,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,note,position)').order('updated_at', { ascending: false }),
    client.from('sundays').select('id,name,service_date,description,sunday_songs(song_id,position)').order('service_date', { ascending: false }),
  ])

  if (songsResult.error) throw songsResult.error
  if (sundaysResult.error) throw sundaysResult.error

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
  }))

  return { songs, setlists }
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

export async function upsertSunday(setlist: Setlist) {
  const client = requireSupabase()
  const { error: sundayError } = await client.from('sundays').upsert({
    id: setlist.id,
    name: setlist.name,
    service_date: setlist.date || new Date().toISOString().slice(0, 10),
    description: setlist.description,
  })
  if (sundayError) throw sundayError

  const { error: deleteError } = await client.from('sunday_songs').delete().eq('sunday_id', setlist.id)
  if (deleteError) throw deleteError

  if (setlist.songIds.length) {
    const { error: songsError } = await client.from('sunday_songs').insert(setlist.songIds.map((songId, position) => ({ sunday_id: setlist.id, song_id: songId, position })))
    if (songsError) throw songsError
  }
}

export async function deleteSunday(setlistId: string) {
  const client = requireSupabase()
  const { error } = await client.from('sundays').delete().eq('id', setlistId)
  if (error) throw error
}
