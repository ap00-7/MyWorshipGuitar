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
const MAX_FREQUENCY = 400
const MIN_RMS = 0.01
const YIN_THRESHOLD = 0.18

export function centsFromFrequency(frequency: number, targetFrequency: number) {
  return 1200 * Math.log2(frequency / targetFrequency)
}

export function frequencyToNote(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return { name: noteNames[(midi + 1200) % 12], octave: Math.floor(midi / 12) - 1, midi }
}

export function nearestString(frequency: number) {
  return GUITAR_STRINGS.reduce((nearest, guitarString) => {
    const distance = Math.abs(centsFromFrequency(frequency, guitarString.frequency))
    const nearestDistance = Math.abs(centsFromFrequency(frequency, nearest.frequency))
    return distance < nearestDistance ? guitarString : nearest
  }, GUITAR_STRINGS[0])
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchDetection | null {
  if (!buffer.length || buffer.length < 2048 || sampleRate <= 0) return null

  let mean = 0
  for (const sample of buffer) mean += sample
  mean /= buffer.length

  const centered = new Float32Array(buffer.length)
  for (let index = 0; index < buffer.length; index += 1) centered[index] = buffer[index] - mean

  const signalRms = rmsOf(centered)
  if (signalRms < MIN_RMS) return null

  const minTau = Math.max(2, Math.ceil(sampleRate / MAX_FREQUENCY))
  const maxTau = Math.min(buffer.length - 2, Math.floor(sampleRate / MIN_FREQUENCY))
  if (maxTau <= minTau) return null

  const difference = new Float32Array(maxTau + 1)
  const yin = new Float32Array(maxTau + 1)
  let running = 0
  let bestTau = minTau
  let bestValue = Number.POSITIVE_INFINITY

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    let sum = 0
    for (let index = 0; index < buffer.length - tau; index += 1) {
      const delta = centered[index] - centered[index + tau]
      sum += delta * delta
    }

    difference[tau] = sum
    running += sum
    const value = running === 0 ? 1 : (sum / Math.max(running, 1)) * tau
    yin[tau] = value

    if (value < bestValue) {
      bestValue = value
      bestTau = tau
    }
  }

  const candidates: { tau: number; value: number; frequency: number }[] = []
  for (let tau = minTau + 1; tau < maxTau; tau += 1) {
    const value = yin[tau]
    const previous = yin[tau - 1]
    const next = yin[tau + 1]

    if (value < previous && value <= next && value < YIN_THRESHOLD) {
      const frequency = sampleRate / refinedTau(yin, tau)
      if (frequency >= MIN_FREQUENCY && frequency <= MAX_FREQUENCY) {
        candidates.push({ tau, value, frequency })
      }
    }
  }

  if (!candidates.length) return null

  const scoredCandidates = candidates.map((candidate) => {
    const target = nearestString(candidate.frequency)
    const offset = Math.abs(centsFromFrequency(candidate.frequency, target.frequency))
    const harmonicPenalty = Math.abs(Math.round(Math.log2(candidate.frequency / target.frequency))) > 0 ? 0.35 : 0
    return { ...candidate, offset, score: candidate.value + harmonicPenalty + offset / 1000 }
  })

  scoredCandidates.sort((a, b) => a.score - b.score)
  const preferred = scoredCandidates[0]

  if (preferred.offset > 250) return null

  const confidence = clamp(1 - preferred.value / YIN_THRESHOLD, 0, 1)
  return {
    frequency: preferred.frequency,
    confidence: confidence * (preferred.offset < 100 ? 1 : 0.85),
  }
}
