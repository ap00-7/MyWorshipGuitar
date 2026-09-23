import test from 'node:test'
import assert from 'node:assert/strict'

import { centsFromFrequency, detectPitch, frequencyToNote, GUITAR_STRINGS, nearestString } from '../src/tuner.ts'

function sineSignal(frequencies, sampleRate = 48000, length = 8192) {
  const buffer = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate
    buffer[index] = frequencies.reduce((sample, [frequency, amplitude]) => sample + Math.sin(2 * Math.PI * frequency * time) * amplitude, 0)
  }
  return buffer
}

test('YIN detects each standard open guitar string', () => {
  for (const guitarString of GUITAR_STRINGS) {
    const result = detectPitch(sineSignal([[guitarString.frequency, 0.5]]), 48000)
    assert.ok(result, `expected a pitch for ${guitarString.note}${guitarString.octave}`)
    assert.ok(Math.abs(centsFromFrequency(result.frequency, guitarString.frequency)) < 3)
    assert.equal(frequencyToNote(result.frequency).name, guitarString.note)
    assert.equal(frequencyToNote(result.frequency).octave, guitarString.octave)
    assert.equal(nearestString(result.frequency).number, guitarString.number)
  }
})

test('cents preserve flat and sharp direction', () => {
  const target = GUITAR_STRINGS[0].frequency
  assert.ok(centsFromFrequency(82, target) < 0)
  assert.ok(centsFromFrequency(82.8, target) > 0)
  assert.ok(Math.abs(centsFromFrequency(target, target)) < 0.001)
})

test('YIN keeps the fundamental under strong octave harmonics', () => {
  for (const guitarString of [GUITAR_STRINGS[0], GUITAR_STRINGS[1], GUITAR_STRINGS[2]]) {
    const result = detectPitch(sineSignal([[guitarString.frequency, 0.35], [guitarString.frequency * 2, 0.8], [guitarString.frequency * 3, 0.3]]), 48000)
    assert.ok(result, `expected a harmonic-rich pitch for ${guitarString.note}${guitarString.octave}`)
    assert.ok(Math.abs(centsFromFrequency(result.frequency, guitarString.frequency)) < 5)
  }
})

test('silence is rejected by the amplitude gate', () => {
  assert.equal(detectPitch(new Float32Array(8192), 48000), null)
})
