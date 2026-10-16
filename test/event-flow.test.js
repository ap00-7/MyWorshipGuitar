import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  moveEventFlowSong,
  orderedEventFlowIds,
  selectEventFlowSong,
} from '../src/worshipFlow.ts'
import { formatTransposedChordLine, noteIndex } from '../src/music.ts'

test('Event Flow is restricted to songs assigned to the selected event', () => {
  const assignedIds = ['song-a', 'song-b', 'song-c', 'song-d']
  assert.deepEqual(orderedEventFlowIds(assignedIds, ['song-c', 'song-a', 'outside', 'song-c']), ['song-c', 'song-a'])
  assert.deepEqual(orderedEventFlowIds(['other-event-song'], ['song-c', 'song-a']), [])
})

test('owners can select and deselect without mutating event assignments', () => {
  const assignedIds = ['song-a', 'song-b', 'song-c']
  const flowIds = ['song-c', 'song-a']
  const selected = selectEventFlowSong(flowIds, 'song-b', true)
  const deselected = selectEventFlowSong(selected, 'song-a', false)

  assert.deepEqual(selected, ['song-c', 'song-a', 'song-b'])
  assert.deepEqual(deselected, ['song-c', 'song-b'])
  assert.deepEqual(assignedIds, ['song-a', 'song-b', 'song-c'])
  assert.deepEqual(selectEventFlowSong(deselected, 'song-b', true), ['song-c', 'song-b'])
})

test('Event Flow order is independent of assignment order and supports reordering', () => {
  const assignedIds = ['song-a', 'song-b', 'song-c']
  const reordered = moveEventFlowSong(['song-c', 'song-a', 'song-b'], 'song-a', 1)

  assert.deepEqual(reordered, ['song-c', 'song-b', 'song-a'])
  assert.deepEqual(assignedIds, ['song-a', 'song-b', 'song-c'])
})

test('each event has independent selection and ordering', () => {
  const flows = {
    youth: ['song-c', 'song-a'],
    prayer: ['song-b'],
  }
  const updatedYouth = moveEventFlowSong(flows.youth, 'song-c', 1)

  assert.deepEqual(updatedYouth, ['song-a', 'song-c'])
  assert.deepEqual(flows.prayer, ['song-b'])
  assert.deepEqual(flows.youth, ['song-c', 'song-a'])
})

test('removing a flow selection does not delete its song or event assignment', () => {
  const assigned = [{ id: 'song-a', title: 'Song A' }, { id: 'song-b', title: 'Song B' }]
  const flow = selectEventFlowSong(['song-a', 'song-b'], 'song-a', false)

  assert.deepEqual(flow, ['song-b'])
  assert.deepEqual(assigned.map((song) => song.id), ['song-a', 'song-b'])
})

test('flow performance uses existing transposition and preserves timing markers', () => {
  const storedProgression = 'G D Em C /'
  const interval = (noteIndex('A') - noteIndex('G') + 12) % 12
  assert.equal(formatTransposedChordLine(storedProgression, interval), 'A E F#m D /')
  assert.equal(storedProgression, 'G D Em C /')
})

test('missing, duplicate, and stale event flow IDs are removed on event changes', () => {
  assert.deepEqual(orderedEventFlowIds([], ['old-event-song']), [])
  assert.deepEqual(orderedEventFlowIds(['song-a'], ['song-a', 'song-b', 'song-a']), ['song-a'])
})

test('database persistence restricts writes to owners and assigned songs', () => {
  const migration = readFileSync('supabase/migrations/20261016_event_flow.sql', 'utf8')
  assert.match(migration, /foreign key \(private_session_id, song_id\)\s+references public\.private_session_songs\(private_session_id, song_id\) on delete cascade/)
  assert.match(migration, /for insert with check \(public\.is_worship_owner\(\)\)/)
  assert.match(migration, /for delete using \(public\.is_worship_owner\(\)\)/)
  assert.match(migration, /Only the worship owner can edit Event Flow/)
  assert.match(migration, /Every Event Flow song must be assigned to that event/)
  assert.match(migration, /alter publication supabase_realtime add table public\.event_flow_songs/)
})

test('the application subscribes to Event Flow changes through shared Realtime refresh', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /table: 'event_flow_songs'[\s\S]*?refreshAfterRealtime/)
  assert.match(app, /table: 'private_session_songs'[\s\S]*?refreshAfterRealtime/)
})
