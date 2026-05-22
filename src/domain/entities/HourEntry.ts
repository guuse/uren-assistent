export interface HourEntry {
  id?: string
  employeeId: string
  projectId: string
  projectServiceId: string
  hourTypeId: string
  hours: number        // decimal, e.g. 0.5
  startDate: string   // YYYY-MM-DD
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  note: string
}
