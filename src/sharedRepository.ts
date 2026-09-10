import type { Setlist, Song } from './data'
import { normalizeSong } from './data'
import { isSundayIso, toIsoDate } from './music'
import { supabase } from './supabaseClient'

export type SharedSnapshot = { songs: Song[]; setlists: Setlist[] }

type DbSong = {
  id: string
  title: string
  original_key: string
  current_key: string
  capo: number
  guitar2_capo?: number
  guitar2_customized?: boolean
  bpm: number
  favorite: boolean
  tags: string[]
  notes: string
  youtube_url?: string | null
  chord_image_path: string | null
  sections: Array<{ id: string; name: string; chord_text: string; guitar2_chord_text?: string; note: string | null; position?: number }>
}

type DbSunday = {
  id: string
  name: string
  service_date: string
  description: string
  sunday_songs: Array<{ position: number; song_id: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SONG_SELECT_WITH_GUITAR2_YOUTUBE = 'id,title,original_key,current_key,capo,guitar2_capo,guitar2_customized,bpm,favorite,tags,notes,youtube_url,chord_image_path,sections:song_sections(id,name,chord_text,guitar2_chord_text,note,position)'
const SONG_SELECT_BASE_YOUTUBE = 'id,title,original_key,current_key,capo,bpm,favorite,tags,notes,youtube_url,chord_image_path,sections:song_sections(id,name,chord_text,note,position)'
const SONG_SELECT_WITH_GUITAR2 = 'id,title,original_key,current_key,capo,guitar2_capo,guitar2_customized,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,guitar2_chord_text,note,position)'
const SONG_SELECT_BASE = 'id,title,original_key,current_key,capo,bpm,favorite,tags,notes,chord_image_path,sections:song_sections(id,name,chord_text,note,position)'

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

function isMissingGuitar2Column(error: unknown) {
  const text = JSON.stringify(error).toLowerCase()
  return text.includes('guitar2') || text.includes('42703')
}

function isMissingYoutubeColumn(error: unknown) {
  return JSON.stringify(error).toLowerCase().includes('youtube_url')
}

function mapDbSong(song: DbSong): Song {
  const client = requireSupabase()
  return normalizeSong({
    id: song.id,
    title: song.title,
    key: song.original_key,
    currentKey: song.current_key,
    capo: song.capo,
    guitar2Capo: song.guitar2_capo ?? 0,
    guitar2Customized: Boolean(song.guitar2_customized),
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags ?? [],
    notes: song.notes,
    youtubeUrl: song.youtube_url ?? '',
    chordImage: song.chord_image_path ? { name: song.chord_image_path, dataUrl: client.storage.from('chord-images').getPublicUrl(song.chord_image_path).data.publicUrl } : undefined,
    sections: (song.sections ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((section) => ({
        id: section.id,
        name: section.name,
        chordText: section.chord_text,
        guitar2ChordText: section.guitar2_chord_text ?? '',
        note: section.note ?? undefined,
      })),
  })
}

async function selectSongById(songId: string) {
  const client = requireSupabase()
  const selections = [SONG_SELECT_WITH_GUITAR2_YOUTUBE, SONG_SELECT_BASE_YOUTUBE, SONG_SELECT_WITH_GUITAR2, SONG_SELECT_BASE]
  for (const selection of selections) {
    const result = await client.from('songs').select(selection).eq('id', songId).single()
    if (!result.error && result.data) return result.data as unknown as DbSong
    if (result.error && !isMissingGuitar2Column(result.error) && !isMissingYoutubeColumn(result.error)) {
      throwIfError(result.error, 'Song was saved but could not be reloaded.')
    }
  }
  throw new Error('Song was saved but could not be reloaded.')
}

export async function loadSharedSnapshot(): Promise<SharedSnapshot> {
  const client = requireSupabase()
  const sundaysResult = await client.from('sundays').select('id,name,service_date,description,sunday_songs(song_id,position)').order('service_date', { ascending: false })
  throwIfError(sundaysResult.error, 'Unable to load Sunday schedule.')

  const selections = [SONG_SELECT_WITH_GUITAR2_YOUTUBE, SONG_SELECT_BASE_YOUTUBE, SONG_SELECT_WITH_GUITAR2, SONG_SELECT_BASE]
  let songsResult: { data: unknown; error: unknown } | undefined
  for (const selection of selections) {
    const result = await client.from('songs').select(selection).order('updated_at', { ascending: false })
    if (!result.error) {
      songsResult = result as unknown as { data: unknown; error: unknown }
      break
    }
    if (!isMissingGuitar2Column(result.error) && !isMissingYoutubeColumn(result.error)) throwIfError(result.error, 'Unable to load songs.')
  }
  if (!songsResult) throw new Error('Unable to load songs.')
  throwIfError(songsResult.error, 'Unable to load songs.')

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

function songUsesGuitar2(song: Song) {
  return song.guitar2Customized || song.guitar2Capo > 0 || song.sections.some((section) => Boolean(section.guitar2ChordText?.trim()))
}

async function replaceSections(songId: string, song: Song) {
  const client = requireSupabase()
  const { error: deleteError } = await client.from('song_sections').delete().eq('song_id', songId)
  throwIfError(deleteError, 'Unable to replace song sections.')

  if (!song.sections.length) return

  const withGuitar2 = song.sections.map((section, position) => ({
    song_id: songId,
    name: section.name,
    chord_text: section.chordText,
    guitar2_chord_text: section.guitar2ChordText ?? '',
    note: section.note ?? null,
    position,
  }))
  const { error: sectionError } = await client.from('song_sections').insert(withGuitar2)
  if (!sectionError) return
  if (!isMissingGuitar2Column(sectionError)) throwIfError(sectionError, 'Unable to save song sections.')
  if (songUsesGuitar2(song)) {
    throw new Error('Guitar 2 chords need the guitar2_chord_text column. Run the latest supabase/schema.sql in the Supabase SQL editor.')
  }

  const { error: fallbackError } = await client.from('song_sections').insert(withGuitar2.map(({ guitar2_chord_text: _ignored, ...section }) => section))
  throwIfError(fallbackError, 'Unable to save song sections.')
}

export async function upsertSharedSong(song: Song): Promise<Song> {
  const client = requireSupabase()
  const existingId = isUuid(song.id) ? song.id : undefined
  const songFields = {
    title: song.title,
    original_key: song.key,
    current_key: song.key,
    capo: song.capo,
    guitar2_capo: song.guitar2Capo,
    guitar2_customized: song.guitar2Customized,
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags,
    notes: song.notes,
    youtube_url: song.youtubeUrl || null,
  }
  const songFieldsBase = {
    title: song.title,
    original_key: song.key,
    current_key: song.key,
    capo: song.capo,
    bpm: song.bpm,
    favorite: song.favorite,
    tags: song.tags,
    notes: song.notes,
  }
  const { youtube_url: _youtubeUrl, ...songFieldsWithoutYoutube } = songFields

  async function writeSong(fields: Record<string, unknown>) {
    if (existingId) {
      const { data: current, error: currentError } = await client.from('songs').select('id, chord_image_path').eq('id', existingId).maybeSingle()
      throwIfError(currentError, 'Unable to load song before save.')
      if (current?.id) {
        const { data, error: songError } = await client.from('songs').update(fields).eq('id', existingId).select('id, chord_image_path').single()
        return { data, error: songError, existingImagePath: current.chord_image_path as string | null }
      }
      const { data, error: songError } = await client.from('songs').insert({ id: existingId, ...fields }).select('id').single()
      return { data, error: songError, existingImagePath: null }
    }
    const { data, error: songError } = await client.from('songs').insert(fields).select('id').single()
    return { data, error: songError, existingImagePath: null }
  }

  let result = await writeSong(songFields)
  if (result.error && isMissingYoutubeColumn(result.error)) {
    if (song.youtubeUrl) throw new Error('YouTube links need the youtube_url column. Run the additive migration in supabase/schema.sql.')
    result = await writeSong(songFieldsWithoutYoutube)
  }
  if (result.error && isMissingGuitar2Column(result.error)) {
    if (songUsesGuitar2(song)) {
      throw new Error('Guitar 2 data needs the guitar2_capo column. Run the latest supabase/schema.sql in the Supabase SQL editor.')
    }
    result = await writeSong(song.youtubeUrl ? songFields : songFieldsWithoutYoutube)
  }
  throwIfError(result.error, existingId ? 'Unable to update song.' : 'Unable to save song.')
  if (!result.data?.id) throw new Error('Song save did not return a database id.')

  const savedId = result.data.id as string
  let existingImagePath = result.existingImagePath
  const isNewDataUrl = Boolean(song.chordImage?.dataUrl?.startsWith('data:'))
  if (isNewDataUrl && song.chordImage?.dataUrl) {
    existingImagePath = await saveChordImage(savedId, song.chordImage.dataUrl)
  } else if (!song.chordImage && existingImagePath) {
    await removeChordImage(savedId, existingImagePath)
  }

  await replaceSections(savedId, song)
  return mapDbSong(await selectSongById(savedId))
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
  const date = toIsoDate(setlist.date)
  if (!date || !isSundayIso(date)) throw new Error('Sunday schedules must use a valid Sunday date.')
  const existingId = isUuid(setlist.id) ? setlist.id : undefined
  const sundayFields = {
    name: setlist.name,
    service_date: date,
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
    const { data: duplicate, error: duplicateError } = await client.from('sundays').select('id').eq('service_date', date).maybeSingle()
    throwIfError(duplicateError, 'Unable to check for an existing Sunday.')
    if (duplicate?.id) throw new Error('A Sunday schedule already exists for that date.')
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
