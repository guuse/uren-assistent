export interface HourEntrySuggestion {
  projectId: string
  projectServiceId: string
  hourTypeId: string
  startTime?: string
  endTime?: string
  reason: 'pattern' | 'last-week'
  occurrences: number
}
