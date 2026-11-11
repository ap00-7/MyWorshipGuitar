export const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export type Notation = 'sharps' | 'flats' | 'auto'

const flatNames: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
}

const chordTokenPattern = /^(?:[A-G](?:#|b)?(?:maj7|m7|maj9|m9|add9|sus[24]|dim|aug|7|9|11|13|6|m6|5)?(?:\/[A-G](?:#|b)?)?|[A-G](?:#|b)?m(?:7|9|6)?(?:\/[A-G](?:#|b)?)?)$/i
const progressionTokenPattern = /[A-G](?:#|b)?(?:maj7|maj9|m(?:7|9|6)?|add9|sus[24]|dim|aug|7|9|11|13|6|5)?(?:\/[A-G](?:#|b)?)?|\/+/gi

export function normalizeKey(key: string) {
  const value = key.replace('b', '#')
  return chromatic.includes(value) ? value : 'C'
}

export function parseChordProgression(input: string) {
  if (!input) return []

  const cleaned = input
    .replace(/[|]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, ' ')
    .trim()

  if (!cleaned) return []

  const tokens: string[] = []
  for (const part of cleaned.split(/\s+/).filter(Boolean)) {
    const partTokens: string[] = []
    let cursor = 0
    progressionTokenPattern.lastIndex = 0
    let match = progressionTokenPattern.exec(part)
    while (match && match.index === cursor) {
      partTokens.push(match[0])
      cursor = progressionTokenPattern.lastIndex
      match = progressionTokenPattern.exec(part)
    }

    if (cursor === part.length && partTokens.length > 0) tokens.push(...partTokens)
  }

  return tokens.filter((token) => token === '/' || /^\/+$/.test(token) || chordTokenPattern.test(token))
}

export function extractChordLines(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((line) => parseChordProgression(line).join(' '))
    .filter((line) => line.length > 0)
}

export function transposeNote(note: string, interval: number, notation: Notation = 'auto') {
  const index = chromatic.indexOf(normalizeKey(note))
  const result = chromatic[(index + interval + 120) % 12]
  return notation === 'flats' || (notation === 'auto' && flatNames[result]) ? flatNames[result] ?? result : result
}

export function transposeChord(chord: string, interval: number, notation: Notation = 'auto') {
  const match = chord.match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/)
  if (!match) return chord

  const root = transposeNote(match[1], interval, notation)
  const bass = match[3] ? `/${transposeNote(match[3], interval, notation)}` : ''
  return `${root}${match[2]}${bass}`
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
