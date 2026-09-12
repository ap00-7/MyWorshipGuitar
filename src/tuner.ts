export type PitchDetection = {
  frequency: number
  confidence: number
}

const MIN_FREQUENCY = 55
const MAX_FREQUENCY = 520
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

export function detectPitch(buffer: Float32Array, sampleRate: number, targetFrequency?: number): PitchDetection | null {
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
  const targetCandidates = targetFrequency
    ? candidates
      .map((candidate) => ({ ...candidate, frequency: sampleRate / refinedTau(cumulative, candidate.tau) }))
      .filter((candidate) => candidate.frequency >= targetFrequency * 0.5 && candidate.frequency <= targetFrequency * 2)
      .sort((a, b) => Math.abs(Math.log2(a.frequency / targetFrequency)) - Math.abs(Math.log2(b.frequency / targetFrequency)))
    : []
  let targetCandidate: { tau: number; value: number } | null = null
  if (targetFrequency) {
    const expectedTau = Math.round(sampleRate / targetFrequency)
    const startTau = Math.max(minTau, Math.floor(expectedTau * 0.97))
    const endTau = Math.min(maxTau, Math.ceil(expectedTau * 1.03))
    for (let tau = startTau; tau <= endTau; tau += 1) {
      if (!targetCandidate || cumulative[tau] < targetCandidate.value) targetCandidate = { tau, value: cumulative[tau] }
    }
    if (!targetCandidate || targetCandidate.value > 0.32) targetCandidate = null
  }
  const candidate = targetCandidate ?? targetCandidates[0] ?? candidates[0] ?? { tau: bestTau, value: bestValue }
  let frequency = sampleRate / refinedTau(cumulative, candidate.tau)

  if (targetFrequency) {
    if (frequency > targetFrequency * 1.8 && frequency < targetFrequency * 2.2) frequency /= 2
    if (frequency < targetFrequency * 0.55 && frequency > targetFrequency * 0.45) frequency *= 2
  }

  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null
  return { frequency, confidence: Math.max(0, Math.min(1, 1 - candidate.value)) }
}
