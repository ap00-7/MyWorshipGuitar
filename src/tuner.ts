export type PitchDetection = {
  frequency: number
  confidence: number
}

export const GUITAR_STRINGS = [
  { number: 6, note: 'E', octave: 2, frequency: 82.4069 },
  { number: 5, note: 'A', octave: 2, frequency: 110 },
  { number: 4, note: 'D', octave: 3, frequency: 146.8324 },
  { number: 3, note: 'G', octave: 3, frequency: 195.9977 },
  { number: 2, note: 'B', octave: 3, frequency: 246.9417 },
  { number: 1, note: 'E', octave: 4, frequency: 329.6276 },
] as const

const MIN_FREQUENCY = 70
const MAX_FREQUENCY = 700
const MIN_RMS = 0.008
const YIN_THRESHOLD = 0.14

export function centsFromFrequency(frequency: number, targetFrequency: number) {
  return 1200 * Math.log2(frequency / targetFrequency)
}

export function frequencyToNote(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return { name: noteNames[(midi + 1200) % 12], octave: Math.floor(midi / 12) - 1, midi }
}

function rmsOf(buffer: Float32Array) {
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  return Math.sqrt(sum / buffer.length)
}

function refinedTau(values: Float32Array, tau: number) {
  if (tau <= 0 || tau >= values.length - 1) return tau
  const left = values[tau - 1]
  const middle = values[tau]
  const right = values[tau + 1]
  const denominator = left - 2 * middle + right
  return denominator === 0 ? tau : tau + 0.5 * (left - right) / denominator
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchDetection | null {
  if (buffer.length < 256 || rmsOf(buffer) < MIN_RMS) return null

  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY))
  const maxTau = Math.min(buffer.length - 2, Math.ceil(sampleRate / MIN_FREQUENCY))
  const difference = new Float32Array(maxTau + 1)
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    let sum = 0
    for (let index = 0; index < buffer.length - tau; index += 1) {
      const delta = buffer[index] - buffer[index + tau]
      sum += delta * delta
    }
    difference[tau] = sum
  }

  const cumulative = new Float32Array(maxTau + 1)
  let running = 0
  let bestTau = -1
  let bestValue = 1
  const candidates: { tau: number; value: number }[] = []
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    running += difference[tau]
    const value = running === 0 ? 1 : difference[tau] * tau / running
    cumulative[tau] = value
    if (value < bestValue) {
      bestValue = value
      bestTau = tau
    }
    if (tau > minTau && tau < maxTau && value < cumulative[tau - 1] && value <= cumulative[tau + 1] && value < YIN_THRESHOLD) {
      candidates.push({ tau, value })
    }
  }

  if (bestTau < 0 || bestValue > 0.32) return null
  const guitarCandidates = GUITAR_STRINGS.map((guitarString) => {
    const expectedTau = Math.round(sampleRate / guitarString.frequency)
    const startTau = Math.max(minTau, Math.floor(expectedTau * 0.94))
    const endTau = Math.min(maxTau, Math.ceil(expectedTau * 1.06))
    let tau = startTau
    for (let nextTau = startTau + 1; nextTau <= endTau; nextTau += 1) {
      if (cumulative[nextTau] < cumulative[tau]) tau = nextTau
    }
    return { tau, value: cumulative[tau] }
  })
    .filter((candidate) => candidate.value <= 0.32)
    .sort((a, b) => a.tau - b.tau)
  const guitarCandidate = guitarCandidates[0] ?? null
  const candidate = guitarCandidate ?? candidates[0] ?? { tau: bestTau, value: bestValue }
  let frequency = sampleRate / refinedTau(cumulative, candidate.tau)

  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null
  return { frequency, confidence: Math.max(0, Math.min(1, 1 - candidate.value)) }
}
