export const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const flatNames: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' }

export type Notation = 'sharps' | 'flats' | 'auto'
export const chordPattern = /^[A-G](?:#|b)?(?:m|maj7|M7|m7|7|sus[24]?|add9|dim|aug)?(?:\/[A-G](?:#|b)?)?$/
export function parseChordProgression(input: string) {
  return input.replace(/[|,]/g, ' ').split(/\s+|\s*-\s*/).map((value) => value.trim()).filter((value) => chordPattern.test(value))
}
export function extractChordLines(lines: string[]) {
  return lines.filter((line) => parseChordProgression(line).length > 0 && parseChordProgression(line).length >= line.trim().split(/\s+/).length * .5).map((line) => parseChordProgression(line).join(' '))
}
export function formatChordLine(line: string, style: 'grid' | 'arrow' | 'roman' = 'grid') {
  const chords = parseChordProgression(line)
  if (style === 'arrow') return chords.join('  →  ')
  return chords.join('   ')
}
export function normalizeKey(key: string) {
  const value = key.replace('b', '#')
  return chromatic.includes(value) ? value : 'C'
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
export function transposeLine(line: string, interval: number, notation: Notation) {
  return line.split(/(\s+)/).map((part) => /^[A-G](?:#|b)?(?:m|maj7|m7|7|sus[24]?|add9|dim|aug)?(?:\/[A-G](?:#|b)?)?$/.test(part) ? transposeChord(part, interval, notation) : part).join('')
}
export function simplifyChord(chord: string) {
  return chord.replace(/(maj7|m7|7|sus[24]|add9|dim|aug)/g, '').replace(/\/[A-G](?:#|b)?$/, '')
}
export function capoShapeKey(soundingKey: string, capo: number, notation: Notation) { return transposeNote(soundingKey, -capo, notation) }
export function soundingKey(shapeKey: string, capo: number, notation: Notation) { return transposeNote(shapeKey, capo, notation) }
export function progressionToChords(key: string, progression: string, notation: Notation) {
  const scale = [0, 2, 4, 5, 7, 9, 11]
  return progression.split(/[-–\s]+/).filter(Boolean).map((degree) => {
    const match = degree.toLowerCase().match(/([iv]+)([°+]?)$/)
    if (!match) return degree
    const roman = match[1]
    const index = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'].indexOf(roman)
    if (index < 0) return degree
    const minor = roman === roman.toLowerCase() && !['i'].includes(roman) ? 'm' : ''
    return `${transposeNote(key, scale[index], notation)}${minor}${match[2] === '°' ? 'dim' : match[2] === '+' ? 'aug' : ''}`
  }).join('  ')
}
