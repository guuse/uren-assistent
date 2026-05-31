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

// Hours submission ("uren indienen"). The exact response shape of GET /hours/submission
// is not published in the v2 reference, so this type is intentionally permissive: a record
// may describe a single submitted date (`date`) or a submitted range (`start_date`/`end_date`).
// Confirm against the live API and tighten if needed — see docs/adr/0003.
export interface SimplicateSubmissionResponse {
  date?: string         // "YYYY-MM-DD" — single-date status variant
  start_date?: string   // "YYYY-MM-DD[ HH:mm:ss]" — range variant
  end_date?: string     // "YYYY-MM-DD[ HH:mm:ss]" — range variant
  status?: string
  employee_id?: string
}

export interface SimplicateApiListResponse<T> {
  data: T[]
}

export interface SimplicateApiSingleResponse<T> {
  data: T
}
