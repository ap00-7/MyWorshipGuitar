import Tesseract from 'tesseract.js'
import { parseChordProgression } from './music.ts'

export type ImportedSection = {
  name: string
  chordText: string
}

export type ImportPreview = {
  text: string
  sections: ImportedSection[]
  warnings: string[]
}

const HEADER_NAMES = ['VERSE', 'CHORUS', 'BRIDGE', 'INTRO', 'OUTRO', 'PRE-CHORUS', 'PRECHORUS', 'TAG', 'HOOK']

const outputLine = (value: string) => value.replace(/\r/g, '').replace(/\u00a0/g, ' ').trim()

export function normalizeDetectedChordText(rawText: string) {
  if (!rawText) return ''

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractChordLine(value: string) {
  const tokens = outputLine(value).split(/\s+/).filter(Boolean)
  const chordTokens = tokens.flatMap((token) => {
    const candidate = token.replace(/^[([{]+|[,.;:!?)}\]]+$/g, '')
    return /^\/+$/.test(candidate) || candidate === '|' || candidate === '-' || parseChordProgression(candidate).length
      ? [candidate]
      : []
  })
  return parseChordProgression(chordTokens.join(' ')).length ? chordTokens.join(' ') : ''
}

function detectSectionName(line: string) {
  const trimmed = outputLine(line)
  if (!trimmed) return null
  const name = trimmed.replace(/^\[([^\]]+)\]$/, '$1').replace(/:\s*$/, '').trim()
  const normalized = name.toUpperCase().replace(/\s+/g, ' ')
  const sectionCandidate = HEADER_NAMES.find((header) => normalized === header || normalized.startsWith(`${header} `))
  if (sectionCandidate) return trimmed
  return null
}

export function parseImportedChordText(rawText: string): ImportedSection[] {
  const normalized = normalizeDetectedChordText(rawText)
  if (!normalized) return []

  const sections: ImportedSection[] = []
  let heading: string | null = null
  let chordLines: string[] = []

  const flushSection = () => {
    const validChordLines = chordLines.map(extractChordLine).filter(Boolean)
    const chordCount = validChordLines.reduce((count, line) => count + parseChordProgression(line).length, 0)
    if (chordCount >= 2) {
      sections.push({
        name: heading || `Section ${sections.length + 1}`,
        chordText: validChordLines.join('\n'),
      })
    }
    heading = null
    chordLines = []
  }

  for (const rawLine of normalized.split('\n')) {
    const line = outputLine(rawLine)
    if (!line) {
      if (!heading) flushSection()
      continue
    }

    const sectionName = detectSectionName(line)
    if (sectionName) {
      flushSection()
      heading = sectionName.replace(/^\[([^\]]+)\]$/, '$1').replace(/:\s*$/, '').trim()
    } else {
      chordLines.push(line)
    }
  }
  flushSection()

  return sections
}

export async function readChordSheetImage(file: File, onProgress?: (message: string, progress: number) => void): Promise<ImportPreview> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.')
  }

  const status = await Tesseract.recognize(file, 'eng', {
    logger: (message) => {
      if (onProgress && typeof message?.progress === 'number') {
        onProgress(message.status ?? 'Reading chords…', Math.min(1, Math.max(0, message.progress)))
      }
    },
  })

  const detectedText = normalizeDetectedChordText(status.data?.text ?? '')
  const sections = parseImportedChordText(detectedText)
  const warnings: string[] = []

  if (!sections.length) {
    throw new Error("Couldn't find any chords in this image.")
  }

  const text = sections.map((section) => `${section.name}\n${section.chordText}`).join('\n\n')
  const suspicious = detectedText.split(/\n/).filter((line) => /(?:[A-G](?:#|b)?(?:rn|n|m[bn]|8)|\b(?:rn|n)\b)/i.test(line))
  if (suspicious.length) {
    warnings.push('Review any unusual chord names before importing — OCR can misread sharps, minors, and timing slashes.')
  }
  const excludedTextDetected = detectedText.split('\n').some((line) => {
    const trimmed = outputLine(line)
    return trimmed && !detectSectionName(trimmed) && extractChordLine(trimmed) !== trimmed
  })
  if (excludedTextDetected) {
    warnings.push('Lyrics and other non-chord text were excluded. Review the detected chords before importing.')
  }

  return {
    text,
    sections,
    warnings,
  }
}
