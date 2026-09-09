export type ChordImage = { name: string; dataUrl: string }

export type Section = {
  id: string
  name: string
  chordText: string
  guitar2ChordText?: string
  lines?: string[]
  chordLines?: string[]
  note?: string
}

export type Song = {
  id: string
  title: string
  artist: string
  key: string
  currentKey: string
  capo: number
  guitar2Capo: number
  bpm: number
  favorite: boolean
  tags: string[]
  notes: string
  sections: Section[]
  chordImage?: ChordImage
  lastPlayed?: string
}

const numericCapo = (value: unknown) => {
  const capo = Number(value)
  return Number.isFinite(capo) ? Math.min(12, Math.max(0, capo)) : 0
}

export const normalizeSection = (section: Partial<Section> & { id?: string; name?: string; chordText?: string; lines?: string[]; chordLines?: string[] }): Section => ({
  id: section.id?.trim() || '',
  name: section.name?.trim() || 'Section',
  chordText: section.chordText?.trim() ?? (Array.isArray(section.lines) ? section.lines.join('\n') : Array.isArray(section.chordLines) ? section.chordLines.join('\n') : ''),
  guitar2ChordText: section.guitar2ChordText?.trim() ?? '',
  lines: Array.isArray(section.lines) ? section.lines : undefined,
  chordLines: Array.isArray(section.chordLines) ? section.chordLines : undefined,
  note: section.note,
})

export const normalizeSong = (song: Partial<Song> & { id?: string }): Song => ({
  id: song.id?.trim() || '',
  title: song.title?.trim() || 'Untitled song',
  artist: song.artist?.trim() || 'Unknown artist',
  key: song.key || 'C',
  currentKey: song.currentKey || song.key || 'C',
  capo: numericCapo(song.capo),
  guitar2Capo: numericCapo(song.guitar2Capo),
  bpm: Number(song.bpm) || 72,
  favorite: Boolean(song.favorite),
  tags: Array.isArray(song.tags) ? song.tags : [],
  notes: song.notes || '',
  sections: Array.isArray(song.sections) && song.sections.length > 0 ? song.sections.map(normalizeSection) : [{ id: '', name: 'Verse 1', chordText: 'C G Am F\nC G C', guitar2ChordText: '' }],
  chordImage: song.chordImage,
  lastPlayed: song.lastPlayed,
})

export type Setlist = { id: string; name: string; date: string; songIds: string[]; description: string }

export type Settings = {
  theme: 'light' | 'dark'
  notation: 'sharps' | 'flats' | 'auto'
  fontSize: number
  simplify: boolean
  autoScrollSpeed: number
  chordDisplay?: 'grid' | 'arrow' | 'roman'
  chordSize?: 'small' | 'medium' | 'large' | 'xl'
}

export const demoSongs: Song[] = [
  {
    id: 'grace-forever',
    title: 'Grace Forever',
    artist: 'Demo Worship',
    key: 'C',
    currentKey: 'C',
    capo: 0,
    guitar2Capo: 0,
    bpm: 74,
    favorite: true,
    tags: ['Sunday', 'Acoustic'],
    notes: 'Start gently and build in the bridge.',
    sections: [
      { id: 'gf-1', name: 'Verse 1', chordText: 'C G Am F\nC G C' },
      { id: 'gf-2', name: 'Chorus', chordText: 'F C G Am\nF C G' },
      { id: 'gf-3', name: 'Bridge', chordText: 'Am F C G\nAm F G C' },
    ],
  },
  {
    id: 'open-heavens',
    title: 'Open Heavens',
    artist: 'Demo Worship',
    key: 'G',
    currentKey: 'G',
    capo: 0,
    guitar2Capo: 0,
    bpm: 82,
    favorite: false,
    tags: ['Upbeat'],
    notes: 'Open and spacious for the first verse.',
    sections: [
      { id: 'oh-1', name: 'Verse', chordText: 'G D Em C\nG D C' },
      { id: 'oh-2', name: 'Chorus', chordText: 'C G D Em\nC G D C' },
    ],
  },
]

export const defaultSettings: Settings = {
  theme: 'light',
  notation: 'auto',
  fontSize: 1,
  simplify: false,
  autoScrollSpeed: 1,
  chordDisplay: 'grid',
  chordSize: 'large',
}
