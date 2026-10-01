import Tesseract from 'tesseract.js'

export type ImportedSection = {
  name: string
  chordText: string
}

export type ImportPreview = {
  text: string
  sections: ImportedSection[]
  warnings: string[]
}

const HEADER_NAMES = ['VERSE', 'VERSE 1', 'VERSE 2', 'VERSE 3', 'CHORUS', 'BRIDGE', 'INTRO', 'OUTRO', 'PRE-CHORUS', 'PRECHORUS', 'TAG', 'HOOK']

const outputLine = (value: string) => value.replace(/\r/g, '').replace(/\u00a0/g, ' ').trim()

export function normalizeDetectedChordText(rawText: string) {
  if (!rawText) return ''

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hasLikelyChordText(value: string) {
  const text = normalizeDetectedChordText(value)
  if (!text) return false

  const tokens = text.split(/\s+/).filter(Boolean)
  if (!tokens.length) return false

  const chordPattern = /^([A-G](?:#|b)?(?:maj7|maj9|m7|m9|m|add9|add11|add13|sus2|sus4|dim7?|aug|maj|7|9|11|13|6|5|no3|no5)?)(?:\/[A-G](?:#|b)?(?:maj7|maj9|m7|m9|m|add9|add11|add13|sus2|sus4|dim7?|aug|maj|7|9|11|13|6|5|no3|no5)?)?$/i
  const timingPattern = /^\/{1,4}$|^\/{1,4}[A-G](?:#|b)?/i
  const slashMarkerPattern = /^\/{1,4}$|^\/{1,4}[A-G]/i

  return tokens.some((token) => {
    const trimmed = token.trim()
    if (!trimmed) return false
    if (trimmed === '/' || /^\/+$/i.test(trimmed)) return true
    if (token === '//' || token === '///' || token === '////') return true
    if (timingPattern.test(trimmed)) return true
    if (slashMarkerPattern.test(trimmed) && trimmed.includes('/')) return true
    if (chordPattern.test(trimmed)) return true
    if (/^(?:[A-G](?:#|b)?[a-z]+)$/i.test(trimmed) && /^[A-G]/.test(trimmed)) return true
    return false
  })
}

function detectSectionName(line: string) {
  const trimmed = outputLine(line)
  if (!trimmed) return null
  const normalized = trimmed.toUpperCase().replace(/\s+/g, ' ')
  const sectionCandidate = HEADER_NAMES.find((header) => normalized === header || normalized.startsWith(`${header} `))
  if (sectionCandidate) return trimmed
  return null
}

export function parseImportedChordText(rawText: string): ImportedSection[] {
  const normalized = normalizeDetectedChordText(rawText)
  if (!normalized) return []

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (!blocks.length) return []

  const sections: ImportedSection[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => outputLine(line)).filter(Boolean)
    if (!lines.length) continue

    const heading = detectSectionName(lines[0])
    const contentLines = heading ? lines.slice(1) : lines
    const chordText = contentLines.map((line) => outputLine(line)).filter(Boolean).join('\n').trim()

    if (!chordText) {
      if (heading) sections.push({ name: heading, chordText: '' })
      continue
    }

    sections.push({
      name: heading || `Section ${sections.length + 1}`,
      chordText,
    })
  }

  if (!sections.length) return [{ name: 'Verse 1', chordText: normalized }]
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

  const text = normalizeDetectedChordText(status.data?.text ?? '')
  const sections = parseImportedChordText(text)
  const warnings: string[] = []

  if (!text || !hasLikelyChordText(text)) {
    throw new Error("Couldn't find any chords in this image.")
  }

  const suspicious = text.split(/\n/).filter((line) => /(?:[A-G](?:#|b)?(?:rn|n|m[bn]|8)|\b(?:rn|n)\b)/i.test(line))
  if (suspicious.length) {
    warnings.push('Review any unusual chord names before importing — OCR can misread sharps, minors, and timing slashes.')
  }

  return {
    text,
    sections,
    warnings,
  }
}
