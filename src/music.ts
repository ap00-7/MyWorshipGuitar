export const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const keyOptions = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export type Notation = 'sharps' | 'flats' | 'auto'

const PRACTICAL_CAPOS = [0, 1, 2, 3, 4, 5, 6, 7]
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
const chordTokenPattern = new RegExp(`^${chordComponentPattern}(?:/${chordComponentPattern})?$`)
const chordTokenPartsPattern = new RegExp(`^(${chordComponentPattern})(?:/(${chordComponentPattern}))?$`)

function splitChordPart(part: string) {
  const suffixMatch = part.match(/(\/+)?$/)
  const suffix = suffixMatch?.[1] ?? ''
  const core = suffix ? part.slice(0, -suffix.length) : part
  const chords: string[] = []
  let remaining = core

  while (remaining) {
    let match = ''
    for (let length = 1; length <= remaining.length; length += 1) {
      const candidate = remaining.slice(0, length)
      if (chordTokenPattern.test(candidate)) match = candidate
    }
    if (!match) return { chords: [] as string[], suffix: '' }
    chords.push(match)
    remaining = remaining.slice(match.length)
  }

  return { chords, suffix }
}

function parseChordToken(token: string) {
  const suffixMatch = token.match(/(\/+)?$/)
  const suffix = suffixMatch?.[1] ?? ''
  const core = suffix ? token.slice(0, -suffix.length) : token
  const match = core.match(chordTokenPartsPattern)
  if (!match) return null
  return { main: match[1], bass: match[2], suffix }
}

function formatChordPart(part: string, transform: (chord: string) => string) {
  const parsed = splitChordPart(part)
  if (!parsed.chords.length) return null
  return `${parsed.chords.map(transform).join('')}${parsed.suffix}`
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
  return sharpNames[noteIndex(key)] || 'C'
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

export function simplifyChord(chord: string) {
  return chord.replace(/(maj7|m7|7|sus[24]|add9|dim|aug|maj9|m9|9|6|m6|11|13|5)/gi, '').replace(/\/[A-G](?:#|b)?$/, '')
}

export function capoShapeKey(soundingKey: string, capo: number, notation: Notation) {
  return transposeNote(soundingKey, -capo, notation)
}

export function soundingKey(shapeKey: string, capo: number, notation: Notation) {
  return transposeNote(shapeKey, capo, notation)
}

export function shiftKey(key: string, amount: number, notation: Notation = 'auto') {
  return transposeNote(key, amount, notation)
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
