import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntry } from '../../domain/entities/HourEntry'
import { useStarredProjects } from './useStarredProjects'
import type { SimplicateProject } from '../../domain/repositories/ISimplicateRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

function sortProjects(projects: SimplicateProject[], starredIds: ReadonlySet<string>): { sorted: SimplicateProject[]; lastStarredId: string | undefined } {
  const starred = projects
    .filter(p => starredIds.has(p.id))
    .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
  const rest = projects
    .filter(p => !starredIds.has(p.id))
    .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
  const lastStarredId = starred.length > 0 ? starred[starred.length - 1]!.id : undefined
  return { sorted: [...starred, ...rest], lastStarredId }
}

export function useBooking(initial: Partial<HourEntry> = {}) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const projects = useAppStore((s) => s.projects)
  const { starredIds, toggle: toggleStar } = useStarredProjects()
  const { sorted: sortedProjects, lastStarredId } = sortProjects(projects, starredIds)
  const allHourTypes = useAppStore((s) => s.hourTypes)

  const [projectId, setProjectId] = useState(initial.projectId ?? '')
  const [serviceId, setServiceId] = useState(initial.projectServiceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(initial.hourTypeId ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [startTime, setStartTime] = useState(initial.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial.endTime ?? '09:30')
  const [date, setDate] = useState(initial.startDate ?? new Date().toISOString().split('T')[0]!)
  const [services, setServices] = useState<{ id: string; name: string; hourTypeIds: string[] }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === serviceId)
  const hourTypes = selectedService
    ? allHourTypes.filter((ht) => selectedService.hourTypeIds.includes(ht.id))
    : allHourTypes

  const missingFields = [
    !projectId && 'project',
    !serviceId && 'dienst',
    !hourTypeId && 'urensoort',
  ].filter(Boolean)

  async function loadServices(pid: string, forDate: string) {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return
    const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const svc = await repo.getServices(pid, forDate)
    setServices(svc)
  }

  // Load services whenever projectId or date changes
  useEffect(() => {
    if (projectId) {
      loadServices(projectId, date)
    } else {
      setServices([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, date])

  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setServiceId('')
    setHourTypeId('')
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
      const useCases = createUseCases(simplicateRepo)

      const [hStart, mStart] = startTime.split(':').map(Number)
      const [hEnd, mEnd] = endTime.split(':').map(Number)
      const hours = Math.round(((hEnd! * 60 + mEnd!) - (hStart! * 60 + mStart!)) / 60 * 2) / 2

      if (initial.id) {
        const entry: HourEntry = {
          id: initial.id,
          employeeId: simplicateEmployeeId,
          projectId,
          projectServiceId: serviceId,
          hourTypeId,
          hours,
          startDate: date,
          startTime,
          endTime,
          note,
        }
        await useCases.updateHourEntry.execute(entry)
      } else {
        const entry: HourEntry = {
          employeeId: simplicateEmployeeId,
          projectId,
          projectServiceId: serviceId,
          hourTypeId,
          hours,
          startDate: date,
          startTime,
          endTime,
          note,
        }
        await useCases.bookHours.execute(entry)
      }

      setStatus('success')
    } catch (err) {
      setStatus('error')
      // Tauri's invoke rejects with the Rust error STRING (e.g. the Simplicate
      // API status + body), not an Error — surface it instead of hiding the real
      // reason behind a generic message.
      console.error('[useBooking] booking failed:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'string' && err.trim() ? err : 'Boeken mislukt'
      setErrorMessage(msg)
    }
  }

  async function deleteEntry(id: string) {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { deleteHourEntry } = createUseCases(simplicateRepo)

      await deleteHourEntry.execute(id)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }

  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId: handleServiceChange,
    hourTypeId, setHourTypeId,
    note, setNote,
    startTime, setStartTime,
    endTime, setEndTime,
    date, setDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects: sortedProjects,
    starredIds,
    toggleStar,
    lastStarredId,
    hourTypes,
    book,
    deleteEntry,
  }
}
