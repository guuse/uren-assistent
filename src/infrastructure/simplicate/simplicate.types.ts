export interface SimplicateProjectResponse {
  id: string
  name: string
  organization: { name: string }
  project_status: { label: string }
  end_date: string | null
}

export interface SimplicateServiceResponse {
  id: string
  name: string
  project_id: string
  write_hours_start_date: string | null  // YYYY-MM-DD or null
  write_hours_end_date: string | null    // YYYY-MM-DD or null
  hour_types: Array<{
    hourstype: {
      id: string
      label: string
      blocked: boolean
    }
  }>
}

export interface SimplicateHourTypeResponse {
  id: string
  label: string
}

export interface SimplicateEmployeeResponse {
  id: string
  name: string
  work_email: string
}

export interface SimplicateHourEntryResponse {
  id: string
  employee: { id: string }
  project: { id: string }
  projectservice: { id: string }
  type: { id: string }
  hours: number
  start_date: string   // "YYYY-MM-DD HH:mm:ss"
  end_date: string     // "YYYY-MM-DD HH:mm:ss"
  note: string
}

// Hours submission ("uren indienen"). GET /hours/submission returns one record per day
// in the queried range. Verified against the live API. See docs/adr/0003.
export interface SimplicateSubmissionResponse {
  employee_id?: string
  date?: string   // "YYYY-MM-DD"
  status?: string // e.g. "submitted", "approved", "open", "no_registrations"
}

export interface SimplicateApiListResponse<T> {
  data: T[]
}

export interface SimplicateApiSingleResponse<T> {
  data: T
}
