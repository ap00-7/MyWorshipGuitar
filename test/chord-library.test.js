import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { barreSegments, fretboardRow, guitarStringNames, guitarStringNumbers, guitarStringState, stringIndicator } from '../src/chordDiagram.ts'

const source = readFileSync(resolve('src/v5.tsx'), 'utf8')
const dataStart = source.indexOf('const chordDatabase = useMemo<ChordDefinition[]>(() => [')
const dataEnd = source.indexOf('\n  ], [', dataStart)
const dataSource = source.slice(dataStart, dataEnd)
const chordDefinitions = [...dataSource.matchAll(
  /\{ name: '([^']+)', root: '([^']+)', type: '([^']+)', notes: \[([^\]]*)\], strings: \[([^\]]*)\], fingers: \[([^\]]*)\], difficulty: '([^']+)', baseFret: (\d+)(?:, barre: (\d+))? \}/g,
)].map(([, name, root, type, notes, strings, fingers, difficulty, baseFret, barre]) => ({
  name,
  root,
  type,
  notes: [...notes.matchAll(/'([^']+)'/g)].map(([, note]) => note),
  strings: strings.split(',').map((value) => Number(value.trim())),
  fingers: [...fingers.matchAll(/'([^']+)'/g)].map(([, finger]) => finger),
  difficulty,
  baseFret: Number(baseFret),
  barre: barre ? Number(barre) : undefined,
}))

const pitchClasses = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const standardTuning = [4, 9, 2, 7, 11, 4]

function pitchClass(note) {
  const [, letter, accidental = ''] = note.match(/^([A-G])([#b]?)$/) ?? []
  assert.ok(letter, `Unexpected note name: ${note}`)
  return (pitchClasses[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + 12) % 12
}

function chordFormula(chord) {
  switch (chord.type) {
    case 'Major':
    case 'Slash': return [0, 4, 7]
    case 'Minor': return [0, 3, 7]
    case '7': return [0, 4, 7, 10]
    case 'Maj7': return [0, 4, 7, 11]
    case 'm7': return [0, 3, 7, 10]
    case 'Sus2': return [0, 2, 7]
    case 'Sus4': return [0, 5, 7]
    case 'Add9': return [0, 2, 4, 7]
    case 'Dim': return chord.notes.length === 4 ? [0, 3, 6, 9] : [0, 3, 6]
    case 'Aug': return [0, 4, 8]
    case '6': return chord.name.slice(chord.root.length).startsWith('m6') ? [0, 3, 7, 9] : [0, 4, 7, 9]
    case '9': return [0, 2, 4, 7, 10]
    default: assert.fail(`No chord formula for ${chord.name} (${chord.type})`)
  }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left - right)
}

function requiredIntervals(chord) {
  switch (chord.type) {
    case 'Major':
    case 'Slash': return [0, 4]
    case 'Minor': return [0, 3]
    case '7': return [0, 4, 10]
    case 'Maj7': return [0, 4, 11]
    case 'm7': return [0, 3, 10]
    case 'Sus2': return [0, 2, 7]
    case 'Sus4': return [0, 5, 7]
    case 'Add9': return [0, 2, 4]
    case 'Dim': return [0, 3, 6]
    case 'Aug': return [0, 4, 8]
    case '6': return chord.name.slice(chord.root.length).startsWith('m6') ? [0, 3, 9] : [0, 4, 9]
    case '9': return [0, 2, 4, 10]
    default: assert.fail(`No required intervals for ${chord.name} (${chord.type})`)
  }
}

function soundingPitchClasses(chord) {
  return chord.strings.flatMap((fret, index) => fret < 0 ? [] : [(standardTuning[index] + fret) % 12])
}

test('the complete 148-chord inventory has unique names and valid six-string state/fingering data', () => {
  assert.equal(dataStart >= 0 && dataEnd > dataStart, true, 'Chord data source was not found')
  assert.equal(chordDefinitions.length, 148)
  assert.equal(new Set(chordDefinitions.map((chord) => chord.name)).size, chordDefinitions.length)

  for (const chord of chordDefinitions) {
    assert.equal(chord.strings.length, 6, `${chord.name}: expected six string positions`)
    assert.equal(chord.fingers.length, 6, `${chord.name}: expected six finger entries`)
    assert.ok(chord.baseFret >= 1, `${chord.name}: invalid base fret`)

    for (let index = 0; index < chord.strings.length; index += 1) {
      const position = chord.strings[index]
      const finger = chord.fingers[index]
      assert.ok(Number.isInteger(position) && position >= -1, `${chord.name}: invalid fret at string ${index + 1}`)
      assert.ok(position === -1 || position === 0 || (position >= chord.baseFret && position < chord.baseFret + 5), `${chord.name}: fret is outside its diagram`)
      assert.equal(guitarStringState(position), position < 0 ? 'muted' : position === 0 ? 'open' : 'fretted')

      if (position === -1) assert.equal(finger, 'x', `${chord.name}: muted string has a finger`)
      else if (position === 0) assert.equal(finger, '0', `${chord.name}: open string has a finger`)
      else assert.ok(['1', '2', '3', '4'].includes(finger), `${chord.name}: invalid fretting finger`)
    }

    const fretsByFinger = new Map()
    chord.fingers.forEach((finger, index) => {
      if (finger === 'x' || finger === '0') return
      const frets = fretsByFinger.get(finger) ?? new Set()
      frets.add(chord.strings[index])
      fretsByFinger.set(finger, frets)
    })
    for (const [finger, frets] of fretsByFinger) {
      assert.equal(frets.size, 1, `${chord.name}: finger ${finger} is assigned to different frets`)
    }

    if (chord.barre !== undefined) {
      assert.ok(chord.strings.some((position) => position === chord.barre), `${chord.name}: barre fret is not fretted`)
      assert.ok(chord.barre >= chord.baseFret && chord.barre < chord.baseFret + 5, `${chord.name}: barre is outside its diagram`)
      for (let index = 0; index < chord.strings.length; index += 1) {
        if (chord.strings[index] === chord.barre) {
          assert.equal(chord.fingers[index], '1', `${chord.name}: barre strings must use the index finger`)
        }
      }
    }
  }
})

test('all 148 definitions agree with established chord formulas and their sounding notes', () => {
  for (const chord of chordDefinitions) {
    const namedRoot = chord.name.match(/^([A-G](?:#|b)?)/)?.[1]
    assert.equal(chord.root, namedRoot, `${chord.name}: root metadata does not match its name`)
    const root = pitchClass(chord.root)
    const expected = uniqueSorted(chordFormula(chord).map((interval) => (root + interval) % 12))
    const declared = uniqueSorted(chord.notes.map(pitchClass))
    const sounding = uniqueSorted(soundingPitchClasses(chord))
    const required = requiredIntervals(chord).map((interval) => (root + interval) % 12)

    assert.deepEqual(declared, expected, `${chord.name}: declared notes do not match its chord formula`)
    assert.deepEqual(sounding.filter((note) => !expected.includes(note)), [], `${chord.name}: shape sounds a note outside its chord`)
    for (const note of required) assert.ok(sounding.includes(note), `${chord.name}: missing required chord tone ${note}`)

    const slashBass = chord.name.match(/\/([A-G](?:#|b)?)$/)
    if (slashBass) {
      assert.equal(soundingPitchClasses(chord)[0], pitchClass(slashBass[1]), `${chord.name}: incorrect bass note`)
    }
  }
})

test('suspension aliases resolve to the same chord shapes', () => {
  const byName = new Map(chordDefinitions.map((chord) => [chord.name, chord]))
  for (const [alias, canonical] of [['Asus', 'Asus4'], ['Csus', 'Csus4'], ['Dsus', 'Dsus4'], ['Esus', 'Esus4'], ['Gsus', 'Gsus4']]) {
    assert.deepEqual(byName.get(alias)?.strings, byName.get(canonical)?.strings, `${alias} should match ${canonical}`)
    assert.equal(byName.get(alias)?.type, 'Sus4')
  }
})

test('string indicators use distinct states in low-to-high-E order', () => {
  assert.deepEqual(guitarStringNames, ['Low E', 'A', 'D', 'G', 'B', 'High E'])
  assert.deepEqual(guitarStringNumbers, [6, 5, 4, 3, 2, 1])
  assert.equal(guitarStringState(-1), 'muted')
  assert.equal(guitarStringState(0), 'open')
  assert.equal(guitarStringState(3), 'fretted')
  assert.throws(() => guitarStringState(-2), RangeError)

  assert.deepEqual([-1, 0, 3, 0, 2, -1].map(stringIndicator), [
    { state: 'muted', label: 'X' },
    { state: 'open', label: 'O' },
    { state: 'fretted', label: '' },
    { state: 'open', label: 'O' },
    { state: 'fretted', label: '' },
    { state: 'muted', label: 'X' },
  ])
})

test('fret markers and barre segments map to their correct string and fretboard cells', () => {
  assert.equal(fretboardRow(-1, 1, 5), null)
  assert.equal(fretboardRow(0, 1, 5), null)
  assert.equal(fretboardRow(1, 1, 5), 1)
  assert.equal(fretboardRow(5, 1, 5), 5)
  assert.equal(fretboardRow(6, 2, 5), 5)
  assert.equal(fretboardRow(8, 3, 5), null)

  assert.deepEqual(
    barreSegments([-1, 4, 6, 6, 6, 4], ['x', '1', '3', '4', '2', '1'], 4, 4),
    [{ row: 1, firstColumn: 2, lastColumn: 7 }],
  )
  assert.deepEqual(
    barreSegments([-1, 3, 2, 0, 3, 3], ['x', '3', '2', '0', '4', '4'], 1),
    [{ row: 3, firstColumn: 5, lastColumn: 7 }],
  )
})
