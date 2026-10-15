import test from 'node:test'
import assert from 'node:assert/strict'

import { moveWorshipFlowSong, orderedWorshipFlowIds, selectWorshipFlowSong } from '../src/worshipFlow.ts'

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
