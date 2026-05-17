export interface SimplicateProjectResponse {
  id: string
  name: string
  organization: { name: string }
}

export interface SimplicateServiceResponse {
  id: string
  name: string
  project: { id: string }
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

export interface SimplicateApiListResponse<T> {
  data: T[]
}

export interface SimplicateApiSingleResponse<T> {
  data: T
}
