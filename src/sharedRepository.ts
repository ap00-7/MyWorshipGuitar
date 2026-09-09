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
  sections: Array<{ id: string; name: string; chord_text: string; note: string | null; position?: number }>
}

type DbSunday = {
  id: string
  name: string
  service_date: string
  description: string
  sunday_songs: Array<{ position: number; song_id: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | undefined | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error
  if (error && typeof error === 'object') {
    const record = error as { message?: string; details?: string; hint?: string; code?: string }
    const message = [record.message, record.details, record.hint, record.code].filter(Boolean).join(' — ')
    if (message) return new Error(message)
  }
  return new Error(fallback)
}

function throwIfError(error: unknown, fallback: string) {
  if (error) throw toError(error, fallback)
}

function mapDbSong(song: DbSong): Song {
  const client = requireSupabase()
  return normalizeSong({
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
    sections: (song.sections ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((section) => ({ id: section.id, name: section.name, chordText: section.chord_text, note: section.note ?? undefined })),
  })
}

export async function loadSharedSnapshot(): Promise<SharedSnapshot> {
  const client = requireSupabase()
  const [songsResult, sundaysResult] = await Promise.all([
    client.from('songs').select('id,title,artist,original_key,current_key,capo,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,note,position)').order('updated_at', { ascending: false }),
    client.from('sundays').select('id,name,service_date,description,sunday_songs(song_id,position)').order('service_date', { ascending: false }),
  ])

  throwIfError(songsResult.error, 'Unable to load songs.')
  throwIfError(sundaysResult.error, 'Unable to load Sunday schedule.')

  const songs = ((songsResult.data ?? []) as unknown as DbSong[]).map(mapDbSong)

  const setlists = ((sundaysResult.data ?? []) as unknown as DbSunday[]).map((sunday) => ({
    id: sunday.id,
    name: sunday.name,
    date: sunday.service_date,
    description: sunday.description,
    songIds: (sunday.sunday_songs ?? []).sort((a, b) => a.position - b.position).map((item) => item.song_id),
  }))

  return { songs, setlists }
}

async function saveChordImage(songId: string, dataUrl: string) {
  const client = requireSupabase()
  const imagePath = `songs/${songId}`
  const response = await fetch(dataUrl)
  const imageBlob = await response.blob()
  const { error: uploadError } = await client.storage.from('chord-images').upload(imagePath, imageBlob, { upsert: true, contentType: imageBlob.type || 'image/jpeg' })
  throwIfError(uploadError, 'Unable to upload chord image.')
  const { error: pathError } = await client.from('songs').update({ chord_image_path: imagePath }).eq('id', songId)
  throwIfError(pathError, 'Unable to save chord image path.')
  return imagePath
}

async function removeChordImage(songId: string, imagePath: string | null) {
  if (!imagePath) return
  const client = requireSupabase()
  const { error: removeError } = await client.storage.from('chord-images').remove([imagePath])
  throwIfError(removeError, 'Unable to delete chord image.')
  const { error: pathError } = await client.from('songs').update({ chord_image_path: null }).eq('id', songId)
  throwIfError(pathError, 'Unable to clear chord image path.')
}

async function replaceSections(songId: string, song: Song) {
  const client = requireSupabase()
  const { error: deleteError } = await client.from('song_sections').delete().eq('song_id', songId)
  throwIfError(deleteError, 'Unable to replace song sections.')

  const sections = song.sections.map((section, position) => ({
    song_id: songId,
    name: section.name,
    chord_text: section.chordText,
    note: section.note ?? null,
    position,
  }))

  if (!sections.length) return

  const { error: sectionError } = await client.from('song_sections').insert(sections)
  throwIfError(sectionError, 'Unable to save song sections.')
}

export async function upsertSharedSong(song: Song): Promise<Song> {
  const client = requireSupabase()
  const existingId = isUuid(song.id) ? song.id : undefined
  const songFields = {
    title: song.title,
    artist: song.artist,
    original_key: song.key,
    current_key: song.currentKey,
    capo: song.capo,
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags,
    notes: song.notes,
  }

  let savedId: string
  let existingImagePath: string | null = null

  if (existingId) {
    const { data: current, error: currentError } = await client.from('songs').select('id, chord_image_path').eq('id', existingId).maybeSingle()
    throwIfError(currentError, 'Unable to load song before save.')

    if (current?.id) {
      const { data, error: songError } = await client.from('songs').update(songFields).eq('id', existingId).select('id, chord_image_path').single()
      throwIfError(songError, 'Unable to update song.')
      if (!data?.id) throw new Error('Song update did not return a database id.')
      savedId = data.id
      existingImagePath = current.chord_image_path
    } else {
      const { data, error: songError } = await client.from('songs').insert({ id: existingId, ...songFields }).select('id').single()
      throwIfError(songError, 'Unable to save song.')
      if (!data?.id) throw new Error('Song save did not return a database id.')
      savedId = data.id
    }
  } else {
    const { data, error: songError } = await client.from('songs').insert(songFields).select('id').single()
    throwIfError(songError, 'Unable to save song.')
    if (!data?.id) throw new Error('Song save did not return a database id.')
    savedId = data.id
  }

  const isNewDataUrl = Boolean(song.chordImage?.dataUrl?.startsWith('data:'))
  if (isNewDataUrl && song.chordImage?.dataUrl) {
    existingImagePath = await saveChordImage(savedId, song.chordImage.dataUrl)
  } else if (!song.chordImage && existingImagePath) {
    await removeChordImage(savedId, existingImagePath)
    existingImagePath = null
  }

  await replaceSections(savedId, song)

  const { data: saved, error: reloadError } = await client
    .from('songs')
    .select('id,title,artist,original_key,current_key,capo,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,note,position)')
    .eq('id', savedId)
    .single()
  throwIfError(reloadError, 'Song was saved but could not be reloaded.')
  if (!saved) throw new Error('Song was saved but could not be reloaded.')

  return mapDbSong(saved as unknown as DbSong)
}

export async function deleteSharedSong(songId: string) {
  const client = requireSupabase()
  const { data: current, error: currentError } = await client.from('songs').select('chord_image_path').eq('id', songId).maybeSingle()
  throwIfError(currentError, 'Unable to load song before delete.')
  if (current?.chord_image_path) {
    const { error: removeError } = await client.storage.from('chord-images').remove([current.chord_image_path])
    throwIfError(removeError, 'Unable to delete chord image.')
  }
  const { error } = await client.from('songs').delete().eq('id', songId)
  throwIfError(error, 'Unable to delete song.')
}

export async function upsertSunday(setlist: Setlist): Promise<Setlist> {
  const client = requireSupabase()
  const existingId = isUuid(setlist.id) ? setlist.id : undefined
  const sundayFields = {
    name: setlist.name,
    service_date: setlist.date || new Date().toISOString().slice(0, 10),
    description: setlist.description,
  }

  let savedId: string
  if (existingId) {
    const { data: current, error: currentError } = await client.from('sundays').select('id').eq('id', existingId).maybeSingle()
    throwIfError(currentError, 'Unable to load Sunday before save.')
    if (current?.id) {
      const { data, error: sundayError } = await client.from('sundays').update(sundayFields).eq('id', existingId).select('id').single()
      throwIfError(sundayError, 'Unable to update Sunday.')
      if (!data?.id) throw new Error('Sunday update did not return a database id.')
      savedId = data.id
    } else {
      const { data, error: sundayError } = await client.from('sundays').insert({ id: existingId, ...sundayFields }).select('id').single()
      throwIfError(sundayError, 'Unable to save Sunday.')
      if (!data?.id) throw new Error('Sunday save did not return a database id.')
      savedId = data.id
    }
  } else {
    const { data, error: sundayError } = await client.from('sundays').insert(sundayFields).select('id').single()
    throwIfError(sundayError, 'Unable to save Sunday.')
    if (!data?.id) throw new Error('Sunday save did not return a database id.')
    savedId = data.id
  }

  const { error: deleteError } = await client.from('sunday_songs').delete().eq('sunday_id', savedId)
  throwIfError(deleteError, 'Unable to replace Sunday songs.')

  if (setlist.songIds.length) {
    const { error: songsError } = await client.from('sunday_songs').insert(setlist.songIds.map((songId, position) => ({ sunday_id: savedId, song_id: songId, position })))
    throwIfError(songsError, 'Unable to save Sunday songs.')
  }

  return { ...setlist, id: savedId, date: sundayFields.service_date }
}

export async function deleteSunday(setlistId: string) {
  const client = requireSupabase()
  const { error } = await client.from('sundays').delete().eq('id', setlistId)
  throwIfError(error, 'Unable to delete Sunday.')
}
