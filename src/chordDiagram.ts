export const guitarStringNames = ['Low E', 'A', 'D', 'G', 'B', 'High E'] as const
export const guitarStringNumbers = [6, 5, 4, 3, 2, 1] as const

export type GuitarStringState = 'muted' | 'open' | 'fretted'

export function guitarStringState(position: number): GuitarStringState {
  if (position === -1) return 'muted'
  if (position === 0) return 'open'
  if (Number.isInteger(position) && position > 0) return 'fretted'
  throw new RangeError(`Invalid guitar string position: ${position}`)
}

export function stringIndicator(position: number): { state: GuitarStringState; label: 'X' | 'O' | '' } {
  const state = guitarStringState(position)
  return { state, label: state === 'muted' ? 'X' : state === 'open' ? 'O' : '' }
}

export function fretboardRow(position: number, baseFret: number, fretCount: number): number | null {
  if (guitarStringState(position) !== 'fretted') return null
  if (position < baseFret || position >= baseFret + fretCount) return null
  return position - baseFret + 1
}

export type BarreSegment = {
  row: number
  firstColumn: number
  lastColumn: number
}

export function barreSegments(strings: number[], fingers: string[], baseFret: number, barre?: number): BarreSegment[] {
  const segments: BarreSegment[] = []
  let index = 0

  while (index < strings.length) {
    let lastIndex = index
    let fret = strings[index]

    if (barre !== undefined) {
      if (strings[index] < barre) {
        index += 1
        continue
      }
      fret = barre
      while (lastIndex + 1 < strings.length && strings[lastIndex + 1] >= barre) lastIndex += 1
    } else {
      if (guitarStringState(strings[index]) !== 'fretted' || !fingers[index]) {
        index += 1
        continue
      }
      while (
        lastIndex + 1 < strings.length &&
        strings[lastIndex + 1] === strings[index] &&
        fingers[lastIndex + 1] === fingers[index]
      ) lastIndex += 1
      if (lastIndex === index) {
        index += 1
        continue
      }
    }

    if (lastIndex > index && fret >= baseFret && fret < baseFret + 5) {
      segments.push({
        row: fret - baseFret + 1,
        firstColumn: index + 1,
        lastColumn: lastIndex + 2,
      })
    }
    index = lastIndex + 1
  }

  return segments
}
