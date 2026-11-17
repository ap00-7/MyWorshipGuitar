export type WorshipFlowStartingChordPreferences = Record<string, Record<string, string>>

export function orderedWorshipFlowIds(scheduledIds: string[], flowIds: string[]) {
  const scheduled = new Set(scheduledIds)
  return flowIds.filter((songId) => scheduled.has(songId))
}

export const orderedEventFlowIds = orderedWorshipFlowIds

export function getWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, flowId: string, occurrenceIndex: number, defaultKey: string) {
  return preferences[flowId]?.[String(occurrenceIndex)] ?? defaultKey
}

export function setWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, flowId: string, occurrenceIndex: number, key: string): WorshipFlowStartingChordPreferences {
  return {
    ...preferences,
    [flowId]: {
      ...preferences[flowId],
      [String(occurrenceIndex)]: key,
    },
  }
}

export function resetWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, flowId: string, occurrenceIndex: number): WorshipFlowStartingChordPreferences {
  const flowPreferences = { ...preferences[flowId] }
  delete flowPreferences[String(occurrenceIndex)]
  const next = { ...preferences }
  if (Object.keys(flowPreferences).length) next[flowId] = flowPreferences
  else delete next[flowId]
  return next
}

export function reconcileWorshipFlowStartingChords(preferences: WorshipFlowStartingChordPreferences, flowId: string, previousSongIds: string[], nextSongIds: string[], previousFlowId = flowId): WorshipFlowStartingChordPreferences {
  const previousOccurrences = new Map<string, number[]>()
  previousSongIds.forEach((songId, index) => {
    const positions = previousOccurrences.get(songId) ?? []
    positions.push(index)
    previousOccurrences.set(songId, positions)
  })

  const nextPreferences: Record<string, string> = {}
  const occurrenceCounts = new Map<string, number>()
  nextSongIds.forEach((songId, index) => {
    const occurrenceNumber = occurrenceCounts.get(songId) ?? 0
    occurrenceCounts.set(songId, occurrenceNumber + 1)
    const previousIndex = previousOccurrences.get(songId)?.[occurrenceNumber]
    const startingChord = previousIndex === undefined ? undefined : preferences[previousFlowId]?.[String(previousIndex)]
    if (startingChord) nextPreferences[String(index)] = startingChord
  })

  const next = { ...preferences }
  if (previousFlowId !== flowId) delete next[previousFlowId]
  if (Object.keys(nextPreferences).length) next[flowId] = nextPreferences
  else delete next[flowId]
  return next
}

export function selectWorshipFlowSong(flowIds: string[], songId: string, selected: boolean) {
  if (selected) return flowIds.includes(songId) ? flowIds : [...flowIds, songId]
  return flowIds.filter((id) => id !== songId)
}

export const selectEventFlowSong = selectWorshipFlowSong

export function moveWorshipFlowSong(flowIds: string[], songId: string, direction: -1 | 1, sourceIndex?: number) {
  const index = sourceIndex !== undefined && flowIds[sourceIndex] === songId ? sourceIndex : flowIds.indexOf(songId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= flowIds.length) return flowIds
  const next = [...flowIds]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const moveEventFlowSong = moveWorshipFlowSong

export function duplicateWorshipFlowSong(flowIds: string[], songId: string, sourceIndex = flowIds.lastIndexOf(songId)) {
  if (sourceIndex < 0 || flowIds[sourceIndex] !== songId) return flowIds
  const next = [...flowIds]
  next.splice(sourceIndex + 1, 0, songId)
  return next
}

export const duplicateEventFlowSong = duplicateWorshipFlowSong
