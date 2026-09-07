export type ChordImage = { name: string; dataUrl: string }
export type Section = { id: string; name: string; lines: string[]; chordLines?: string[]; guitar2Lines?: string[]; note?: string }
export type Song = { id: string; title: string; artist: string; key: string; currentKey: string; capo: number; bpm: number; favorite: boolean; tags: string[]; notes: string; sections: Section[]; chordImage?: ChordImage; lastPlayed?: string }
export type Setlist = { id: string; name: string; date: string; songIds: string[]; description: string }
export type Settings = { theme: 'light' | 'dark'; notation: 'sharps' | 'flats' | 'auto'; fontSize: number; simplify: boolean; autoScrollSpeed: number; chordDisplay?: 'grid' | 'arrow' | 'roman'; chordSize?: 'small' | 'medium' | 'large' | 'xl' }
export const demoSongs: Song[] = [
  { id: 'grace-forever', title: 'Grace Forever', artist: 'Demo Worship', key: 'C', currentKey: 'C', capo: 0, bpm: 74, favorite: true, tags: ['Sunday', 'Acoustic'], notes: 'Start fingerpicking. Build through the bridge.', sections: [
    { id: 'gf-1', name: 'Verse 1', lines: ['C        G', 'Mercy meets me in the morning light', 'Am       F', 'Hope is singing through the quiet night'] },
    { id: 'gf-2', name: 'Chorus', lines: ['F        C', 'Grace forever, steady and bright', 'G        Am', 'You are with me through the longest night'] },
    { id: 'gf-3', name: 'Bridge', lines: ['Am       F       C       G', 'We will lift our grateful hearts'] , note: 'Build gradually. Guitar 2 enters here.' }
  ] },
  { id: 'open-heavens', title: 'Open Heavens', artist: 'Demo Worship', key: 'G', currentKey: 'G', capo: 0, bpm: 82, favorite: false, tags: ['Upbeat'], notes: 'Keep the verse open and light.', sections: [
    { id: 'oh-1', name: 'Verse', lines: ['G        D', 'We gather here with open hands', 'Em       C', 'A simple song, a faithful stand'] },
    { id: 'oh-2', name: 'Chorus', lines: ['C        G', 'Open heavens, breathe on us', 'D        Em', 'Lead us onward, lead us home'] }
  ] }
]
export const defaultSettings: Settings = { theme: 'light', notation: 'auto', fontSize: 1, simplify: false, autoScrollSpeed: 1, chordDisplay: 'grid', chordSize: 'large' }
