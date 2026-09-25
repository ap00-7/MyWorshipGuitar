export const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const keyOptions = ['A', 'Am', 'A#', 'A#m', 'B', 'Bm', 'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m']
export const startingChordOptions = ['A', 'Am', 'A#', 'A#m', 'B', 'Bm', 'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m']

export function sortSongsByTitle<T extends { title?: string | null }>(songs: T[]) {
  return [...songs].sort((left, right) => {
    const leftTitle = String(left.title ?? '').trim().toLocaleLowerCase()
    const rightTitle = String(right.title ?? '').trim().toLocaleLowerCase()
    return leftTitle.localeCompare(rightTitle)
  })
}

export type Notation = 'sharps' | 'flats' | 'auto'

const PRACTICAL_CAPOS = Array.from({ length: 8 }, (_, index) => index)
const OPEN_MAJOR = new Set(['C', 'G', 'D', 'A', 'E'])
const OPEN_MINOR = new Set(['Am', 'Em', 'Dm'])
const OPEN_SEVENTH = new Set(['C7', 'G7', 'D7', 'A7', 'E7', 'B7', 'Cmaj7', 'Dmaj7', 'Fmaj7', 'Amaj7', 'Emaj7'])
const OPEN_SUS = new Set(['Dsus2', 'Dsus4', 'Asus2', 'Asus4', 'Esus4', 'Csus2', 'Csus4', 'Gsus4', 'Gsus2'])
const BARRE_FRIENDLY = new Set(['Bm', 'F#m', 'C#m', 'F', 'Bm7', 'F#m7', 'C#m7'])

const noteIndexByName: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
}

const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const chordComponentPattern = String.raw`[A-G](?:#|b)?(?:maj7|maj9|m7|m9|add(?:9|11|13)|sus[24]|dim7?|aug|maj|m6|m|7|9|11|13|6|5|no[35]|\([^)]+\))?`
const chordComponentAtStartPattern = new RegExp(`^${chordComponentPattern}`)
const chordTokenPartsPattern = new RegExp(`^(${chordComponentPattern})(?:/(${chordComponentPattern}))?$`)

function splitChordPart(part: string) {
  const chords: string[] = []
  const pieces: string[] = []
  let remaining = part

  const prefixMatch = remaining.match(new RegExp('^/+'))
  if (prefixMatch) {
    pieces.push(prefixMatch[0])
    remaining = remaining.slice(prefixMatch[0].length)
  }

  while (remaining) {
    const chordMatch = remaining.match(chordComponentAtStartPattern)
    if (!chordMatch) return { chords: [] as string[], pieces: [] as string[] }

    let chord = chordMatch[0]
    remaining = remaining.slice(chord.length)

    const slashMatch = remaining.match(new RegExp('^/+'))
    if (slashMatch?.[0] === '/') {
      const nextChord = remaining.slice(1).match(chordComponentAtStartPattern)
      if (nextChord) {
        chord += `/${nextChord[0]}`
        remaining = remaining.slice(nextChord[0].length + 1)
      }
    }

    chords.push(chord)
    pieces.push(chord)

    const timingMatch = remaining.match(new RegExp('^/{2,}'))
    if (timingMatch) {
      pieces.push(timingMatch[0])
      remaining = remaining.slice(timingMatch[0].length)
    }
  }

  return { chords, pieces }
}

function parseChordToken(token: string) {
  const match = token.match(chordTokenPartsPattern)
  if (!match) return null
  return { main: match[1], bass: match[2], suffix: '' }
}

function formatChordPart(part: string, transform: (chord: string) => string) {
  const parsed = splitChordPart(part)
  if (!parsed.chords.length) return null
  return parsed.pieces.map((piece) => piece.startsWith('/') ? piece : transform(piece)).join('')
}

export function noteIndex(note: string) {
  return noteIndexByName[note] ?? noteIndexByName[note.charAt(0)] ?? 0
}

export function noteAccidental(note: string): 'sharp' | 'flat' | 'natural' {
  if (note.includes('#')) return 'sharp'
  if (note.length >= 2 && note.endsWith('b')) return 'flat'
  return 'natural'
}

export function normalizeKey(key: string) {
  const trimmed = String(key ?? '').trim()
  const rootMatch = trimmed.match(/^([A-G](?:#|b)?)/i)
  return (rootMatch ? rootMatch[1] : sharpNames[noteIndex(trimmed)] || 'C').replace(/m$/i, '')
}

export function keyQuality(key: string) {
  const trimmed = String(key ?? '').trim()
  if (/(?:^|\s)m$/i.test(trimmed) || /(?:^|\s)minor$/i.test(trimmed)) return 'minor'
  return /(?:^|\s)[A-G](?:#|b)?m$/i.test(trimmed) || /(?:^|\s)[A-G](?:#|b)?minor$/i.test(trimmed) ? 'minor' : 'major'
}

export function keyRoot(key: string) {
  const trimmed = String(key ?? '').trim()
  const rootMatch = trimmed.match(/^([A-G](?:#|b)?)/i)
  return normalizeKey(rootMatch ? rootMatch[1] : trimmed)
}

export function isEquivalentKey(left: string, right: string) {
  return keyRoot(left) === keyRoot(right) && keyQuality(left) === keyQuality(right)
}

function parseKey(key: string) {
  const trimmed = String(key ?? '').trim()
  const root = keyRoot(trimmed)
  const quality = keyQuality(trimmed)
  return { root, quality }
}

function spellNote(index: number, sourceNote: string, notation: Notation) {
  const next = (index + 120) % 12
  const family = notation === 'sharps' ? 'sharp' : notation === 'flats' ? 'flat' : noteAccidental(sourceNote)
  if (family === 'flat') return flatNames[next]
  return sharpNames[next]
}

export function transposeNote(note: string, interval: number, notation: Notation = 'auto') {
  const index = noteIndex(note)
  if (interval % 12 === 0) return note
  return spellNote(index + interval, note, notation)
}

export function parseChordProgression(input: string) {
  if (!input) return []

  const cleaned = input
    .replace(/[|]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+-\s+/g, ' ')
    .trim()

  if (!cleaned) return []

  return cleaned
    .split(/\s+/)
    .flatMap((part) => splitChordPart(part).chords)
}

export function extractChordLines(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((line) => parseChordProgression(line).join(' '))
    .filter((line) => line.length > 0)
}

export function transposeChord(chord: string, interval: number, notation: Notation = 'auto') {
  const parsed = parseChordToken(chord)
  if (!parsed) return chord

  const transposeComponent = (component: string) => {
    const match = component.match(/^([A-G](?:#|b)?)(.*)$/)
    if (!match) return component
    return `${transposeNote(match[1], interval, notation)}${match[2]}`
  }

  const bass = parsed.bass ? `/${transposeComponent(parsed.bass)}` : ''
  return `${transposeComponent(parsed.main)}${bass}${parsed.suffix}`
}

export function transposeProgressionText(text: string, interval: number, notation: Notation = 'auto') {
  return text.split('\n').map((line) => {
    if (!line.trim()) return line
    return line.split(/(\s+)/).map((part) => {
      if (!part.trim() || /^\s+$/.test(part)) return part
      return formatChordPart(part, (chord) => transposeChord(chord, interval, notation)) ?? part
    }).join('')
  }).join('\n')
}

export function formatTransposedChordLine(line: string, interval: number, notation: Notation = 'auto', simplify = false) {
  return line.split(/(\s+)/).map((part) => {
    if (!part.trim() || /^\s+$/.test(part)) return part
    return formatChordPart(part, (chord) => transposeChord(simplify ? simplifyChord(chord) : chord, interval, notation)) ?? part
  }).join('')
}

export function collectProgressionChords(text: string) {
  return text.split('\n').flatMap((line) => parseChordProgression(line))
}

function chordRootAndSymbol(chord: string) {
  const parsed = parseChordToken(chord)
  if (!parsed) return { root: 'C', symbol: chord, quality: '', bass: '' }
  const main = parsed.main.match(/^([A-G](?:#|b)?)(.*)$/)
  const bass = parsed.bass?.match(/^([A-G](?:#|b)?)/)
  if (!main) return { root: 'C', symbol: chord, quality: '', bass: '' }
  return { root: main[1], symbol: chord, quality: main[2], bass: bass?.[1] || '' }
}

function easyShapeName(chord: string) {
  const { root, quality } = chordRootAndSymbol(chord)
  const minor = /^m(?!aj)/.test(quality)
  return `${root}${minor ? 'm' : ''}`
}

export function shapePlayabilityScore(chord: string) {
  const { root, quality, bass } = chordRootAndSymbol(chord)
  const full = `${root}${quality}`
  const simple = easyShapeName(chord)
  let score = 5
  if (OPEN_MAJOR.has(root) && !/^m(?!aj)/.test(quality)) score = 12
  if (OPEN_MINOR.has(simple)) score = 12
  if (OPEN_SEVENTH.has(full) || OPEN_SUS.has(full)) score = 10
  if (BARRE_FRIENDLY.has(simple) || BARRE_FRIENDLY.has(full)) score = 4
  if (['Bb', 'B', 'F#', 'C#', 'G#', 'Eb', 'Ab', 'Gb'].includes(root) && !OPEN_SEVENTH.has(full)) score = 2
  if (bass && OPEN_MAJOR.has(bass)) score += 1
  if (bass && ['F#', 'Bb', 'C#', 'G#'].includes(bass)) score -= 2
  return score
}

export type Guitar2Arrangement = {
  capo: number
  text: string
  family: string
  different: boolean
}

export type Guitar2Option = {
  key: string
  capo: number
  sounding: string
}

function scoreArrangement(soundingChords: string[], guitar1Capo: number, capo: number, notation: Notation) {
  if (!soundingChords.length) return { capo, score: -Infinity, shapes: [] as string[], family: 'C' }
  const shapes = soundingChords.map((chord) => transposeChord(chord, -capo, notation))
  const playability = shapes.reduce((sum, chord) => sum + shapePlayabilityScore(chord), 0) / shapes.length
  const uniqueRoots = [...new Set(shapes.map((chord) => chordRootAndSymbol(chord).root))]
  const openFamily = uniqueRoots.filter((root) => OPEN_MAJOR.has(root)).length
  const sameCapo = capo === guitar1Capo
  const sourceShapes = soundingChords.map((chord) => transposeChord(chord, -guitar1Capo, notation))
  const differentCount = shapes.reduce((count, shape, index) => count + (shape !== sourceShapes[index] ? 1 : 0), 0)
  let score = playability * 10 + openFamily * 3 + differentCount * 8 - capo * 0.6
  if (sameCapo) score -= 35
  if (capo === 0 && guitar1Capo === 0) score -= 12
  return { capo, score, shapes, family: uniqueRoots[0] || 'C' }
}

export function suggestGuitar2Arrangement(guitar1Text: string, guitar1Capo = 0, notation: Notation = 'auto'): Guitar2Arrangement {
  const sounding = collectProgressionChords(guitar1Text).map((chord) => transposeChord(chord, guitar1Capo, notation))
  if (!sounding.length) return { capo: Math.min(5, Math.max(0, guitar1Capo === 5 ? 0 : 5)), text: guitar1Text, family: 'C', different: true }

  const ranked = PRACTICAL_CAPOS
    .map((capo) => scoreArrangement(sounding, guitar1Capo, capo, notation))
    .sort((a, b) => b.score - a.score)
  const chosen = ranked[0] ?? scoreArrangement(sounding, guitar1Capo, 5, notation)
  return {
    capo: chosen.capo,
    text: guitar2ProgressionAtCapo(guitar1Text, guitar1Capo, chosen.capo, notation),
    family: chosen.family,
    different: chosen.shapes.some((shape, index) => shape !== transposeChord(sounding[index], -guitar1Capo, notation)),
  }
}

export function suggestGuitar2Progression(guitar1Text: string, notation: Notation = 'auto', guitar1Capo = 0) {
  return suggestGuitar2Arrangement(guitar1Text, guitar1Capo, notation).text
}

export function guitar2ProgressionAtCapo(guitar1Text: string, guitar1Capo: number, guitar2Capo: number, notation: Notation = 'auto') {
  return transposeProgressionText(transposeProgressionText(guitar1Text, guitar1Capo, notation), -guitar2Capo, notation)
}

export function chooseBestGuitar2Option(options: Guitar2Option[], guitar1Text = '', guitar1Capo = 0, notation: Notation = 'auto') {
  if (!options.length) return null
  const soundingChords = collectProgressionChords(guitar1Text).map((chord) => transposeChord(chord, guitar1Capo, notation))
  const ranked = options.map((option) => {
    const shapes = soundingChords.length
      ? soundingChords.map((chord) => transposeChord(chord, -option.capo, notation))
      : [option.key]
    const playability = shapes.reduce((sum, chord) => sum + shapePlayabilityScore(chord), 0) / shapes.length
    const openFamily = shapes.filter((chord) => OPEN_MAJOR.has(chordRootAndSymbol(chord).root) || OPEN_MINOR.has(easyShapeName(chord))).length
    const highCapoPenalty = Math.max(0, option.capo - 3) * 1.5
    const sameAsGuitar1Penalty = option.capo === guitar1Capo ? 4 : 0
    const score = playability * 10 + openFamily * 2 - option.capo * 0.5 - highCapoPenalty - sameAsGuitar1Penalty
    return { option, score }
  })
  ranked.sort((left, right) => right.score - left.score || left.option.capo - right.option.capo || left.option.key.localeCompare(right.option.key))
  return ranked[0]?.option ?? null
}

export function simplifyChord(chord: string) {
  return chord.replace(/(maj7|m7|7|sus[24]|add9|dim|aug|maj9|m9|9|6|m6|11|13|5)/gi, '').replace(/\/[A-G](?:#|b)?$/, '')
}

export function capoShapeKey(soundingKey: string, capo: number, notation: Notation) {
  const { root, quality } = parseKey(soundingKey)
  return `${transposeNote(root, -capo, notation)}${quality === 'minor' ? 'm' : ''}`
}

export function soundingKey(shapeKey: string, capo: number, notation: Notation) {
  const { root, quality } = parseKey(shapeKey)
  return `${transposeNote(root, capo, notation)}${quality === 'minor' ? 'm' : ''}`
}

export function transposeKey(key: string, interval: number, notation: Notation = 'auto') {
  const { root, quality } = parseKey(key)
  return `${transposeNote(root, interval, notation)}${quality === 'minor' ? 'm' : ''}`
}

export function isCompatibleGuitar2Option(concertKey: string, shapeKey: string, capo: number, notation: Notation = 'auto') {
  return isEquivalentKey(soundingKey(shapeKey, capo, notation), concertKey)
}

export function generateCompatibleGuitar2Options(concertKey: string, notation: Notation = 'auto', excludedRoot?: string): Guitar2Option[] {
  const { root, quality } = parseKey(concertKey)
  const targetKey = `${root}${quality === 'minor' ? 'm' : ''}`
  const excludedPitch = excludedRoot ? noteIndex(keyRoot(excludedRoot)) : null

  return PRACTICAL_CAPOS
    .map((capo) => {
      const shapeKey = `${transposeNote(root, -capo, notation)}${quality === 'minor' ? 'm' : ''}`
      return {
        key: shapeKey,
        capo,
        sounding: soundingKey(shapeKey, capo, notation),
      }
    })
    .filter((option) => isCompatibleGuitar2Option(concertKey, option.key, option.capo, notation))
    .filter((option) => excludedPitch === null || noteIndex(keyRoot(option.key)) !== excludedPitch)
    .filter((option, index, options) => options.findIndex((candidate) => candidate.key === option.key && candidate.capo === option.capo) === index)
    .sort((left, right) => {
      if (left.key === targetKey && right.key !== targetKey) return 1
      if (left.key !== targetKey && right.key === targetKey) return -1
      const leftDistance = Math.abs(left.capo - 3)
      const rightDistance = Math.abs(right.capo - 3)
      return leftDistance - rightDistance || left.capo - right.capo
    })
}

export function shiftKey(key: string, amount: number, notation: Notation = 'auto') {
  return transposeKey(key, amount, notation)
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatLocalIsoDate(value)
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const iso = `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(`${iso}T00:00:00`)
  return Number.isNaN(parsed.getTime()) || formatLocalIsoDate(parsed) !== iso ? '' : iso
}

export function isIsoDate(value: string) {
  return Boolean(toIsoDate(value))
}

export function upcomingSundayIso(from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const weekday = date.getDay()
  const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday
  date.setDate(date.getDate() + daysUntilSunday)
  return formatLocalIsoDate(date)
}

export function parseLocalIsoDate(isoDate: string) {
  const iso = toIsoDate(isoDate)
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isSundayIso(isoDate: string) {
  return parseLocalIsoDate(isoDate)?.getDay() === 0
}

export function formatSundayDate(isoDate: string) {
  const date = parseLocalIsoDate(isoDate)
  if (!date) return isoDate
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export function formatSundayTitle(isoDate: string) {
  const date = parseLocalIsoDate(isoDate)
  if (!date) return 'Sunday'
  return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function nextUnusedSundayIso(existingDates: string[], from = upcomingSundayIso()) {
  const taken = new Set(existingDates.map((date) => toIsoDate(date)).filter(Boolean))
  const start = parseLocalIsoDate(from) ?? parseLocalIsoDate(upcomingSundayIso())
  if (!start) return upcomingSundayIso()
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  if (cursor.getDay() !== 0) {
    cursor.setDate(cursor.getDate() + ((7 - cursor.getDay()) % 7))
  }
  for (let index = 0; index < 52; index += 1) {
    const iso = formatLocalIsoDate(cursor)
    if (!taken.has(iso)) return iso
    cursor.setDate(cursor.getDate() + 7)
  }
  return formatLocalIsoDate(cursor)
}
