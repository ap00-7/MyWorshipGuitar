export type WorshipFlowStartingChordPreferences = Record<string, Record<string, string>>

export function orderedWorshipFlowIds(scheduledIds: string[], flowIds: string[]) {
  const scheduled = new Set(scheduledIds)
  const seen = new Set<string>()
  return flowIds.filter((songId) => {
    if (!scheduled.has(songId) || seen.has(songId)) return false
    seen.add(songId)
    return true
  })
}

export const orderedEventFlowIds = orderedWorshipFlowIds

export function getWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, sundayId: string, songId: string, defaultKey: string) {
  return preferences[sundayId]?.[songId] ?? defaultKey
}

export function setWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, sundayId: string, songId: string, key: string): WorshipFlowStartingChordPreferences {
  return {
    ...preferences,
    [sundayId]: {
      ...preferences[sundayId],
      [songId]: key,
    },
  }
}

export function resetWorshipFlowStartingChord(preferences: WorshipFlowStartingChordPreferences, sundayId: string, songId: string): WorshipFlowStartingChordPreferences {
  const sundayPreferences = { ...preferences[sundayId] }
  delete sundayPreferences[songId]
  const next = { ...preferences }
  if (Object.keys(sundayPreferences).length) next[sundayId] = sundayPreferences
  else delete next[sundayId]
  return next
}

export function selectWorshipFlowSong(flowIds: string[], songId: string, selected: boolean) {
  if (selected) return flowIds.includes(songId) ? flowIds : [...flowIds, songId]
  return flowIds.filter((id) => id !== songId)
}

export const selectEventFlowSong = selectWorshipFlowSong

export function moveWorshipFlowSong(flowIds: string[], songId: string, direction: -1 | 1) {
  const index = flowIds.indexOf(songId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= flowIds.length) return flowIds
  const next = [...flowIds]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const moveEventFlowSong = moveWorshipFlowSong
