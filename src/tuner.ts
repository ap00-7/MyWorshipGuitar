export type PitchDetection = {
  frequency: number
  confidence: number
  clarity: number
  rms: number
}

export type GuitarString = {
  number: number
  note: string
  octave: number
  frequency: number
}

export const GUITAR_STRINGS = [
  { number: 6, note: 'E', octave: 2, frequency: 82.4069 },
  { number: 5, note: 'A', octave: 2, frequency: 110 },
  { number: 4, note: 'D', octave: 3, frequency: 146.8324 },
  { number: 3, note: 'G', octave: 3, frequency: 195.9977 },
  { number: 2, note: 'B', octave: 3, frequency: 246.9417 },
  { number: 1, note: 'E', octave: 4, frequency: 329.6276 },
] as const satisfies readonly GuitarString[]

export const TUNER_AUDIO = {
  minFrequency: 68,
  maxFrequency: 470,
  minRms: 0.008,
  yinThreshold: 0.24,
  minConfidence: 0.55,
  maxDetuneCents: 85,
} as const

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function centsFromFrequency(frequency: number, targetFrequency: number) {
  return 1200 * Math.log2(frequency / targetFrequency)
}

export function frequencyToNote(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  return { name: NOTE_NAMES[(midi % 12 + 12) % 12], octave: Math.floor(midi / 12) - 1, midi }
}

export function nearestString(frequency: number, strings: readonly GuitarString[] = GUITAR_STRINGS) {
  return strings.reduce((nearest, guitarString) => {
    const distance = Math.abs(centsFromFrequency(frequency, guitarString.frequency))
    const nearestDistance = Math.abs(centsFromFrequency(frequency, nearest.frequency))
    return distance < nearestDistance ? guitarString : nearest
  }, strings[0])
}

function rmsOf(buffer: Float32Array) {
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  return Math.sqrt(sum / buffer.length)
}

function parabolicPeak(values: Float32Array, index: number) {
  if (index <= 0 || index >= values.length - 1) return index
  const left = values[index - 1]
  const middle = values[index]
  const right = values[index + 1]
  const denominator = left - 2 * middle + right
  if (Math.abs(denominator) < 1e-9) return index
  return index + 0.5 * (left - right) / denominator
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizedDifference(buffer: Float32Array, maxTau: number) {
  const cmndf = new Float32Array(maxTau + 1)
  let runningDifference = 0
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let difference = 0
    const limit = buffer.length - tau
    for (let index = 0; index < limit; index += 1) {
      const delta = buffer[index] - buffer[index + tau]
      difference += delta * delta
    }
    runningDifference += difference
    cmndf[tau] = runningDifference === 0 ? 1 : difference * tau / runningDifference
  }
  return cmndf
}

type Candidate = { frequency: number; value: number }

function candidatesFromCmndf(cmndf: Float32Array, sampleRate: number, minTau: number, maxTau: number) {
  const candidates: Candidate[] = []
  for (let tau = minTau + 1; tau < maxTau; tau += 1) {
    const value = cmndf[tau]
    if (value <= cmndf[tau - 1] && value < cmndf[tau + 1]) {
      const refinedTau = parabolicPeak(cmndf, tau)
      candidates.push({ frequency: sampleRate / refinedTau, value })
    }
  }
  return candidates
}

function chooseCandidate(candidates: Candidate[], threshold: number) {
  const reliable = candidates.filter((candidate) => candidate.value <= threshold)
  if (!reliable.length) return null

  const guitarRangeCandidates = reliable.filter((candidate) => Math.abs(centsFromFrequency(candidate.frequency, nearestString(candidate.frequency).frequency)) <= TUNER_AUDIO.maxDetuneCents)
  const firstReliable = guitarRangeCandidates.sort((left, right) => right.frequency - left.frequency)[0] ?? reliable[0]
  const firstConfidence = 1 - firstReliable.value
  const octaveLower = guitarRangeCandidates.find((candidate) => (
    firstReliable.frequency / candidate.frequency > 1.85
    && firstReliable.frequency / candidate.frequency < 2.15
    && 1 - candidate.value >= firstConfidence - 0.18
  ))
  return octaveLower && octaveLower.frequency < firstReliable.frequency ? octaveLower : firstReliable
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchDetection | null {
  if (buffer.length < 2048 || sampleRate <= 0) return null

  let mean = 0
  for (const sample of buffer) mean += sample
  mean /= buffer.length

  const centered = new Float32Array(buffer.length)
  for (let index = 0; index < buffer.length; index += 1) centered[index] = buffer[index] - mean
  const rms = rmsOf(centered)
  if (rms < TUNER_AUDIO.minRms) return null

  const minTau = Math.max(2, Math.floor(sampleRate / TUNER_AUDIO.maxFrequency))
  const maxTau = Math.min(buffer.length - 2, Math.ceil(sampleRate / TUNER_AUDIO.minFrequency))
  if (maxTau <= minTau) return null

  const cmndf = normalizedDifference(centered, maxTau)
  const candidates = candidatesFromCmndf(cmndf, sampleRate, minTau, maxTau)
    .filter((candidate) => candidate.frequency >= TUNER_AUDIO.minFrequency && candidate.frequency <= TUNER_AUDIO.maxFrequency)
  const selected = chooseCandidate(candidates, TUNER_AUDIO.yinThreshold)
  if (!selected) return null

  const clarity = clamp(1 - selected.value, 0, 1)
  const confidence = clamp(clarity * Math.min(1, rms / 0.04), 0, 1)
  if (confidence < TUNER_AUDIO.minConfidence) return null
  return { frequency: selected.frequency, confidence, clarity, rms }
}
