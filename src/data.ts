export type ChordImage = { name: string; dataUrl: string }

export type Section = {
  id: string
  name: string
  chordText: string
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
  bpm: number
  favorite: boolean
  tags: string[]
  notes: string
  sections: Section[]
  chordImage?: ChordImage
  lastPlayed?: string
}

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
