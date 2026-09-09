export const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const keyOptions = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export type Notation = 'sharps' | 'flats' | 'auto'

export const GUITAR2_CAPO = 5
export const GUITAR2_SHIFT = -5

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

const chordTokenPattern = /^(?:[A-G](?:#|b)?(?:maj7|m7|maj9|m9|add9|sus[24]|dim|aug|7|9|11|13|6|m6|5)?(?:\/[A-G](?:#|b)?)?|[A-G](?:#|b)?m(?:7|9|6)?(?:\/[A-G](?:#|b)?)?)$/i

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
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => chordTokenPattern.test(part))
}

export function extractChordLines(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((line) => parseChordProgression(line).join(' '))
    .filter((line) => line.length > 0)
}

export function transposeChord(chord: string, interval: number, notation: Notation = 'auto') {
  const match = chord.match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/)
  if (!match) return chord

  const root = transposeNote(match[1], interval, notation)
  const bass = match[3] ? `/${transposeNote(match[3], interval, notation)}` : ''
  return `${root}${match[2]}${bass}`
}

export function transposeProgressionText(text: string, interval: number, notation: Notation = 'auto') {
  return text.split('\n').map((line) => {
    if (!line.trim()) return line
    return line.split(/(\s+)/).map((part) => {
      if (!part.trim() || /^\s+$/.test(part)) return part
      return chordTokenPattern.test(part) ? transposeChord(part, interval, notation) : part
    }).join('')
  }).join('\n')
}

export function suggestGuitar2Progression(guitar1Text: string, notation: Notation = 'auto') {
  return transposeProgressionText(guitar1Text, GUITAR2_SHIFT, notation)
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
