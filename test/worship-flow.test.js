import test from 'node:test'
import assert from 'node:assert/strict'

import { formatTransposedChordLine, noteIndex } from '../src/music.ts'
import { getWorshipFlowStartingChord, moveWorshipFlowSong, orderedWorshipFlowIds, resetWorshipFlowStartingChord, selectWorshipFlowSong, setWorshipFlowStartingChord } from '../src/worshipFlow.ts'

test('Worship Flow keeps only scheduled songs in its independent saved order', () => {
  assert.deepEqual(
    orderedWorshipFlowIds(['a', 'b', 'c', 'd'], ['c', 'a', 'c', 'outside']),
    ['c', 'a'],
  )
})

test('Worship Flow selection adds once and removes only from the flow', () => {
  assert.deepEqual(selectWorshipFlowSong(['c', 'a'], 'd', true), ['c', 'a', 'd'])
  assert.deepEqual(selectWorshipFlowSong(['c', 'a'], 'c', true), ['c', 'a'])
  assert.deepEqual(selectWorshipFlowSong(['c', 'a', 'd'], 'a', false), ['c', 'd'])
})

test('Worship Flow ordering moves selected songs without changing schedule IDs', () => {
  assert.deepEqual(moveWorshipFlowSong(['c', 'a', 'd'], 'd', -1), ['c', 'd', 'a'])
  assert.deepEqual(moveWorshipFlowSong(['c', 'a', 'd'], 'c', -1), ['c', 'a', 'd'])
  assert.deepEqual(moveWorshipFlowSong(['c', 'a', 'd'], 'missing', 1), ['c', 'a', 'd'])
})

test('Worship Flow starting chord preferences are isolated by Sunday and stable song ID', () => {
  const original = {}
  const preferences = setWorshipFlowStartingChord(original, 'sunday-1', 'song-b', 'A')

  assert.equal(getWorshipFlowStartingChord(preferences, 'sunday-1', 'song-a', 'C'), 'C')
  assert.equal(getWorshipFlowStartingChord(preferences, 'sunday-1', 'song-b', 'G'), 'A')
  assert.equal(getWorshipFlowStartingChord(preferences, 'sunday-2', 'song-b', 'G'), 'G')
  assert.deepEqual(original, {})
  assert.deepEqual(moveWorshipFlowSong(['song-a', 'song-b', 'song-c'], 'song-b', 1), ['song-a', 'song-c', 'song-b'])
  assert.equal(getWorshipFlowStartingChord(preferences, 'sunday-1', 'song-b', 'G'), 'A')
})

test('Worship Flow transposes only the selected song display without changing stored chords', () => {
  const songAProgression = 'C G Am F\nC G C'
  const songBProgression = 'G D Em C /'
  const selectedKey = 'A'
  const songBInterval = (noteIndex(selectedKey) - noteIndex('G') + 12) % 12

  assert.equal(formatTransposedChordLine(songAProgression.split('\n')[0], 0), 'C G Am F')
  assert.equal(formatTransposedChordLine(songBProgression, songBInterval), 'A E F#m D /')
  assert.equal(songAProgression, 'C G Am F\nC G C')
  assert.equal(songBProgression, 'G D Em C /')
})

test('Worship Flow Original restores only that song after preference restore and reordering', () => {
  const original = { 'sunday-1': { 'song-a': 'C', 'song-b': 'G' } }
  const savedPreference = setWorshipFlowStartingChord(original, 'sunday-1', 'song-b', 'A')
  const restoredPreferences = JSON.parse(JSON.stringify(savedPreference))
  const reorderedIds = moveWorshipFlowSong(['song-a', 'song-b', 'song-c'], 'song-b', 1)
  const originalProgression = 'G D Em C /\nG C'

  assert.deepEqual(reorderedIds, ['song-a', 'song-c', 'song-b'])
  assert.equal(getWorshipFlowStartingChord(restoredPreferences, 'sunday-1', 'song-b', 'G'), 'A')
  assert.equal(formatTransposedChordLine(originalProgression.split('\n')[0], (noteIndex('A') - noteIndex('G') + 12) % 12), 'A E F#m D /')

  const resetPreferences = resetWorshipFlowStartingChord(restoredPreferences, 'sunday-1', 'song-b')
  assert.equal(getWorshipFlowStartingChord(resetPreferences, 'sunday-1', 'song-b', 'G'), 'G')
  assert.equal(getWorshipFlowStartingChord(resetPreferences, 'sunday-1', 'song-a', 'C'), 'C')
  assert.equal(formatTransposedChordLine(originalProgression.split('\n')[0], 0), 'G D Em C /')
  assert.equal(originalProgression, 'G D Em C /\nG C')
  assert.deepEqual(restoredPreferences, { 'sunday-1': { 'song-a': 'C', 'song-b': 'A' } })
})
