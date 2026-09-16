import test from 'node:test'
import assert from 'node:assert/strict'

import { generateCompatibleGuitar2Options, isCompatibleGuitar2Option, soundingKey, transposeKey } from '../src/music.ts'

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
