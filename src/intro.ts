import { collectProgressionChords } from './music'

export type IntroSuggestion = {
  title: string
  chords: string
}

function chooseIntroChords(chords: string[], maxLength = 4): string[] {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const chord of chords) {
    if (!chord || seen.has(chord)) continue
    seen.add(chord)
    unique.push(chord)
  }

  if (!unique.length) return []

  const counts = new Map<string, number>()
  for (const chord of chords) {
    counts.set(chord, (counts.get(chord) ?? 0) + 1)
  }

  const ranked = unique
    .map((chord) => ({ chord, count: counts.get(chord) ?? 0 }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      return chords.indexOf(left.chord) - chords.indexOf(right.chord)
    })
    .map((entry) => entry.chord)

  const intro = [...ranked]
  if (intro.length < maxLength) {
    for (const chord of unique) {
      if (!intro.includes(chord)) intro.push(chord)
      if (intro.length >= maxLength) break
    }
  }

  return intro.slice(0, maxLength)
}

function introFromProgression(chords: string[], fallbacks: string[] = []): string {
  const intro = chooseIntroChords(chords, 4)
  if (intro.length) return intro.join(' → ')
  return fallbacks.join(' → ') || 'C → G → F'
}

export function suggestIntros(chordText: string, guitar2Text = ''): IntroSuggestion[] {
  const chords = collectProgressionChords(chordText)
  if (!chords.length) return []

  const songIntro = introFromProgression(chords)
  const tonalCenter = chooseIntroChords(chords.filter((chord) => !chord.includes('7') && !chord.includes('m') && chord.length <= 3), 3)
  const leadIn = tonalCenter.length >= 2 ? `${tonalCenter[0]} → ${tonalCenter[1]} → ${chords[0] ?? tonalCenter[0]}` : songIntro
  const cadence = chooseIntroChords(chords.filter((chord, index) => index < chords.length && !chord.includes('m') && !chord.includes('7')), 3)
  const arpeggio = chooseIntroChords(chords, 4)

  const suggestions: IntroSuggestion[] = [
    { title: 'Simple strum', chords: songIntro },
    { title: 'Lead-in', chords: leadIn },
    { title: 'Cadence', chords: cadence.length ? cadence.join(' → ') : songIntro },
    { title: 'Arpeggio', chords: arpeggio.join(' → ') },
  ]

  const guitar2 = collectProgressionChords(guitar2Text)
  if (guitar2.length && guitar2.join('|') !== chords.join('|')) {
    const guitar2Intro = introFromProgression(guitar2, chooseIntroChords(chords, 4))
    suggestions.push({ title: 'Two-guitar intro', chords: `${songIntro}\nGuitar 2: ${guitar2Intro}` })
  }

  return suggestions
}
