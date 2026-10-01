import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseBestGuitar2Option, collectProgressionChords, findSongTitleMatches, formatSundayDate, generateCompatibleGuitar2Options, isCompatibleGuitar2Option, normalizeSongTitle, sortSongsByTitle, soundingKey, transposeChord, transposeKey, transposeProgressionText } from '../src/music.ts'
import { normalizeDetectedChordText, parseImportedChordText } from '../src/chordImport.ts'
const expectedMinorPairs = [
  ['Em', 'Am', 7],
  ['Em', 'Bm', 5],
  ['Em', 'Cm', 4],
  ['Em', 'C#m', 3],
  ['Em', 'Dm', 2],
  ['Em', 'Em', 0],
]

const expectedMajorPairs = [
  ['E', 'A', 7],
  ['E', 'B', 5],
  ['E', 'C', 4],
  ['E', 'C#', 3],
  ['E', 'D', 2],
  ['E', 'E', 0],
]

test('Guitar 2 ignores repeated timing slashes and preserves them in display text', () => {
  for (const marker of ['//', '///', '////']) {
    const input = `${marker}A  A${marker}B  E`
    assert.deepEqual(collectProgressionChords(input), ['A', 'A', 'B', 'E'])
    assert.equal(transposeProgressionText(input, -2, 'auto'), `${marker}G  G${marker}A  D`)
  }
})

test('minor shape keys produce the correct sounding concert key', () => {
  for (const [concertKey, shapeKey, capo] of expectedMinorPairs) {
    assert.equal(soundingKey(shapeKey, capo, 'auto'), concertKey)
    assert.equal(isCompatibleGuitar2Option(concertKey, shapeKey, capo, 'auto'), true)
  }
})

test('major shape keys produce the correct sounding concert key', () => {
  for (const [concertKey, shapeKey, capo] of expectedMajorPairs) {
    assert.equal(soundingKey(shapeKey, capo, 'auto'), concertKey)
    assert.equal(isCompatibleGuitar2Option(concertKey, shapeKey, capo, 'auto'), true)
  }
})

test('generator respects quality and excludes invalid options', () => {
  const minorOptions = generateCompatibleGuitar2Options('E minor')
  const majorOptions = generateCompatibleGuitar2Options('E major')
  const minorKeys = minorOptions.map((option) => option.key)
  const majorKeys = majorOptions.map((option) => option.key)

  assert.ok(minorKeys.includes('Am'))
  assert.ok(minorKeys.includes('Bm'))
  assert.ok(minorKeys.includes('Dm'))
  assert.ok(!minorKeys.includes('A'))
  assert.ok(majorKeys.includes('A'))
  assert.ok(!majorKeys.includes('Am'))

  for (const option of minorOptions) {
    assert.equal(soundingKey(option.key, option.capo, 'auto'), 'Em')
  }

  for (const option of majorOptions) {
    assert.equal(soundingKey(option.key, option.capo, 'auto'), 'E')
  }
})

test('Guitar 2 options exclude the starting chord root by pitch', () => {
  assert.ok(!generateCompatibleGuitar2Options('Eb', 'auto', 'Eb').some((option) => option.key === 'Eb'))
  assert.ok(!generateCompatibleGuitar2Options('D#', 'auto', 'Eb').some((option) => option.key === 'D#'))
  assert.ok(!generateCompatibleGuitar2Options('Em', 'auto', 'Em').some((option) => option.key === 'Em'))
  assert.ok(!generateCompatibleGuitar2Options('C', 'auto', 'C/E').some((option) => option.key === 'C'))
  assert.ok(generateCompatibleGuitar2Options('Eb', 'auto', 'Eb').some((option) => option.key === 'Db'))
})

test('reverse direction examples do not accidentally validate', () => {
  assert.equal(soundingKey('Em', 7, 'auto'), 'Bm')
  assert.equal(soundingKey('Am', 5, 'auto'), 'Dm')
  assert.equal(soundingKey('Dm', 7, 'auto'), 'Am')
})

test('all supported major/minor roots generate valid options', () => {
  const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  for (const root of roots) {
    const majorOptions = generateCompatibleGuitar2Options(`${root}`)
    assert.ok(majorOptions.length > 0)
    for (const option of majorOptions) {
      assert.equal(soundingKey(option.key, option.capo, 'auto'), root)
    }

    const minorOptions = generateCompatibleGuitar2Options(`${root}m`)
    assert.ok(minorOptions.length > 0)
    for (const option of minorOptions) {
      assert.equal(soundingKey(option.key, option.capo, 'auto'), `${root}m`)
    }
  }
})

test('transposeKey preserves major/minor quality', () => {
  assert.equal(transposeKey('Em', 2, 'auto'), 'F#m')
  assert.equal(transposeKey('Am', -1, 'auto'), 'G#m')
  assert.equal(transposeKey('E', 2, 'auto'), 'F#')
})

test('Guitar 2 transposition preserves timing markers and slash chords', () => {
  for (const marker of ['/', '//', '///', '////']) {
    assert.equal(transposeProgressionText(`${marker}A`, 2), `${marker}B`)
  }

  for (const marker of ['//', '///', '////']) {
    assert.equal(transposeProgressionText(`A${marker}B`, 2), `B${marker}C#`)
  }

  assert.equal(transposeChord('A/B', 2), 'B/C#')
  assert.equal(transposeChord('E/B', 2), 'F#/C#')
  assert.equal(transposeChord('D/A', 2), 'E/B')
  assert.equal(transposeChord('A/F#m', 2), 'B/G#m')
  assert.equal(transposeChord('A/F#m7', 2), 'B/G#m7')
  assert.equal(transposeChord('C#/G#m', 2), 'D#/A#m')
  assert.equal(transposeProgressionText('E/B A/B D/A', 2), 'F#/C# B/C# E/B')
  assert.equal(transposeProgressionText('A/F#m A/F#m7 C#/G#m', 2), 'B/G#m B/G#m7 D#/A#m')
  assert.equal(transposeProgressionText('E E E/B C#m', 2), 'F# F# F#/C# D#m')
})

test('Guitar 2 recommendation is deterministic and independent of option order', () => {
  const options = generateCompatibleGuitar2Options('Em')
  const progression = 'C G Am F\nC G C'
  const recommended = chooseBestGuitar2Option(options, progression, 0, 'auto')
  const shuffled = chooseBestGuitar2Option([...options].reverse(), progression, 0, 'auto')

  assert.ok(recommended)
  assert.deepEqual(shuffled, recommended)
  assert.equal(soundingKey(recommended.key, recommended.capo, 'auto'), 'Em')
})

test('detected chord text preserves slash chords and timing markers without guessing uncertain OCR corrections', () => {
  const sections = parseImportedChordText('VERSE 1\nE / / / B / C#m / /\nE / A/B / B/E / / /\n\nCHORUS\nA / E / B / C#m / /\nA/B\n//A\nA//B\nA///B\nA////B')

  assert.deepEqual(sections.map((section) => section.name), ['VERSE 1', 'CHORUS'])
  assert.equal(sections[0].chordText, 'E / / / B / C#m / /\nE / A/B / B/E / / /')
  assert.equal(sections[1].chordText, 'A / E / B / C#m / /\nA/B\n//A\nA//B\nA///B\nA////B')
  assert.equal(normalizeDetectedChordText('A/B'), 'A/B')
  assert.equal(normalizeDetectedChordText('A//B'), 'A//B')
  assert.equal(normalizeDetectedChordText('//A'), '//A')
  assert.equal(normalizeDetectedChordText('A///B'), 'A///B')
  assert.equal(normalizeDetectedChordText('E / / / B / C#m / /'), 'E / / / B / C#m / /')
})

test('song titles sort alphabetically ignoring case and surrounding whitespace', () => {
  const songs = [
    { title: '  oceans  ' },
    { title: 'Amazing Grace' },
    { title: 'Blessed Assurance' },
    { title: 'above all' },
    { title: 'At the Cross' },
  ]

  assert.deepEqual(sortSongsByTitle(songs).map((song) => song.title.trim()), ['above all', 'Amazing Grace', 'At the Cross', 'Blessed Assurance', 'oceans'])
})

test('Sunday dates use correct ordinal suffixes including teen exceptions', () => {
  const expectedSuffixes = new Map([[1, '1ST'], [2, '2ND'], [3, '3RD'], [4, '4TH'], [10, '10TH'], [11, '11TH'], [12, '12TH'], [13, '13TH'], [21, '21ST'], [22, '22ND'], [23, '23RD'], [31, '31ST']])
  for (const [day, suffix] of expectedSuffixes) {
    const formatted = formatSundayDate(`2026-01-${String(day).padStart(2, '0')}`)
    assert.ok(formatted.split(/\s+/).includes(suffix), `${formatted} should include ${suffix}`)
  }
})

test('song title suggestions match exact, partial, keyword, case, and whitespace variations', () => {
  const songs = [{ title: 'Amazing Grace' }, { title: 'Amazing Love' }, { title: 'At the Cross' }, { title: 'Come Holy Spirit' }]
  assert.deepEqual(findSongTitleMatches(songs, 'Amazing Grace').map((song) => song.title), ['Amazing Grace'])
  assert.deepEqual(findSongTitleMatches(songs, 'Amazing').map((song) => song.title), ['Amazing Grace', 'Amazing Love'])
  assert.deepEqual(findSongTitleMatches(songs, 'cross').map((song) => song.title), ['At the Cross'])
  assert.deepEqual(findSongTitleMatches(songs, 'gRaCe').map((song) => song.title), ['Amazing Grace'])
  assert.deepEqual(findSongTitleMatches(songs, '  ama   grace  ').map((song) => song.title), ['Amazing Grace'])
  assert.ok(findSongTitleMatches(songs, 'a').length > 0)
  assert.deepEqual(findSongTitleMatches(songs, 'nonexistent'), [])
  const manySongs = Array.from({ length: 10 }, (_, index) => ({ title: `Amazing Song ${index + 1}` }))
  assert.equal(findSongTitleMatches(manySongs, 'amazing').length, 6)
  assert.equal(normalizeSongTitle('  Amazing   Grace  '), 'amazing grace')
})

test('imported chord text preserves slash chords and timing markers without splitting real slash chords', () => {
  const examples = [
    'E / / / B / C#m / /',
    'E / A/B / B/E / / /',
    'A/B',
    '//A',
    'A//B',
    'A///B',
    'C/E',
    'G/B',
    'D/F#',
    'A/F#m',
    'A/F#m7',
    'C#/G#m',
  ]

  for (const example of examples) {
    const normalized = normalizeDetectedChordText(example)
    assert.ok(normalized.length > 0)
    if (example.includes('/')) {
      assert.ok(normalized.includes('A/B') || normalized.includes('C/E') || normalized.includes('G/B') || normalized.includes('D/F#') || normalized.includes('A/F#m') || normalized.includes('A/F#m7') || normalized.includes('C#/G#m') || normalized.includes('//A') || normalized.includes('A//B') || normalized.includes('A///B') || normalized.includes('E / / / B / C#m / /'))
    }
  }

  assert.equal(normalizeDetectedChordText('A/B'), 'A/B')
  assert.equal(normalizeDetectedChordText('//A'), '//A')
  assert.equal(normalizeDetectedChordText('A//B'), 'A//B')
  assert.equal(normalizeDetectedChordText('A///B'), 'A///B')
  assert.equal(normalizeDetectedChordText('E / / / B / C#m / /'), 'E / / / B / C#m / /')
  assert.equal(normalizeDetectedChordText('E / A/B / B/E / / /'), 'E / A/B / B/E / / /')
})
