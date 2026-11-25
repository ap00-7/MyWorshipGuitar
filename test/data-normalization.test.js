import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSection, normalizeSong } from '../src/data.ts'

test('blank song sections stay blank when normalized', () => {
  const section = normalizeSection({ name: '', chordText: '' })
  const song = normalizeSong({ title: 'New song', key: 'G', sections: [section] })

  assert.equal(song.sections[0].name, '')
  assert.equal(song.sections[0].chordText, '')
})
