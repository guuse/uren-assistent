import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { Template } from '../../domain/entities/Template'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

export interface UseBookingOptions {
  initialDate?: string       // YYYY-MM-DD, overrides Monday calculation
  initialStartTime?: string  // HH:mm, overrides template.startTime
  initialEndTime?: string    // HH:mm, overrides template.endTime
}

export function useBooking(template: Template, options: UseBookingOptions = {}) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const projects = useAppStore((s) => s.projects)
  const allHourTypes = useAppStore((s) => s.hourTypes)

  const [projectId, setProjectId] = useState(template.projectId ?? '')
  const [serviceId, setServiceId] = useState(template.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(template.hourTypeId ?? '')
  const [note, setNote] = useState(template.defaultNote ?? '')
  const [startTime, setStartTime] = useState<string>(
    options.initialStartTime ?? template.startTime ?? '09:00'
  )
  const [endTime, setEndTime] = useState<string>(
    options.initialEndTime ?? template.endTime ?? '09:30'
  )
  const [weekStartDate, setWeekStartDate] = useState(() => {
    if (options.initialDate) return options.initialDate
    // Default to this Monday
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    return today.toISOString().split('T')[0]!
  })
  const [services, setServices] = useState<{ id: string; name: string; hourTypeIds: string[] }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filter hour types to those available on the selected service
  const selectedService = services.find((s) => s.id === serviceId)
  const hourTypes = selectedService
    ? allHourTypes.filter((ht) => selectedService.hourTypeIds.includes(ht.id))
    : allHourTypes

  const missingFields = [
    !projectId && 'project',
    !serviceId && 'dienst',
    !hourTypeId && 'urensoort',
  ].filter(Boolean)

  async function loadServices(pid: string) {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return
    const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const svc = await repo.getServices(pid)
    setServices(svc)
  }

  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setServiceId('')
    setHourTypeId('')
    await loadServices(pid)
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    const svc = services.find((s) => s.id === id)
    if (svc && hourTypeId && !svc.hourTypeIds.includes(hourTypeId)) {
      setHourTypeId('')
    }
  }

  async function book() {
    if (!simplicateEmployeeId) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { bookTemplate } = createUseCases(simplicateRepo)

      const effectiveTemplate = { ...template, startTime, endTime }

      await bookTemplate.execute({
        template: effectiveTemplate,
        employeeId: simplicateEmployeeId,
        note,
        weekStartDate,
        overrides: { projectId, serviceId, hourTypeId },
      })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Boeken mislukt')
    }
  }

  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId: handleServiceChange,
    hourTypeId, setHourTypeId,
    note, setNote,
    startTime, setStartTime,
    endTime, setEndTime,
    weekStartDate, setWeekStartDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects,
    hourTypes,
    book,
  }
}
