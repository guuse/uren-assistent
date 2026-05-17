import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { Template } from '../../domain/entities/Template'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

export function useBooking(template: Template) {
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const hourTypes = useAppStore((s) => s.hourTypes)

  const [projectId, setProjectId] = useState(template.projectId ?? '')
  const [serviceId, setServiceId] = useState(template.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(template.hourTypeId ?? '')
  const [note, setNote] = useState(template.defaultNote ?? '')
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // Default to this Monday
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    return today.toISOString().split('T')[0]!
  })
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    await loadServices(pid)
  }

  async function book() {
    if (!user?.id) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { bookTemplate } = createUseCases(simplicateRepo)

      await bookTemplate.execute({
        template,
        employeeId: user.id,
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
    serviceId, setServiceId,
    hourTypeId, setHourTypeId,
    note, setNote,
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
