import { collectProgressionChords } from './music'

export type IntroSuggestion = {
  title: string
  chords: string
  pattern?: string
}

export function suggestIntros(chordText: string, guitar2Text = ''): IntroSuggestion[] {
  const chords = collectProgressionChords(chordText)
  if (!chords.length) return []

  const opening = chords.slice(0, Math.min(4, chords.length))
  const repeatedOpening = opening.length > 1 && opening[0] === opening[opening.length - 1]
    ? opening.slice(0, -1)
    : opening
  const simple = repeatedOpening.join(' → ')
  const arpeggio = repeatedOpening.slice(0, Math.min(4, repeatedOpening.length)).join(' → ')
  const leadIn = [chords[0], chords[0], chords[1] ?? chords[0]].join(' → ')
  const suggestions: IntroSuggestion[] = [
    { title: 'Simple strum', chords: simple, pattern: '↓  ↓↑  ↑↓↑' },
    { title: 'Arpeggio', chords: arpeggio, pattern: 'Bass → G → B → High E' },
    { title: 'Lead-in', chords: leadIn, pattern: 'Build gently into the opening chord' },
  ]

  const guitar2 = collectProgressionChords(guitar2Text)
  if (guitar2.length && guitar2.join('|') !== chords.join('|')) {
    suggestions.push({ title: 'Two-guitar intro', chords: `${simple}\nGuitar 2: ${guitar2.slice(0, 4).join(' → ')}`, pattern: 'Guitar 1 strum, Guitar 2 light arpeggio' })
  }

  return suggestions.map((suggestion) => ({ ...suggestion, chords: suggestion.chords }))
}
