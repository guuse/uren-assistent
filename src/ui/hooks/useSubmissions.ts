import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import { isDateSubmitted as dateInSubmissions } from '../../domain/entities/HourSubmission'
import type { HourSubmission } from '../../domain/entities/HourSubmission'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const day = dt.getDay()
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day))
  return toLocalDateString(dt)
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + days)
  return toLocalDateString(dt)
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

// The submitted status is fetched per visible month and cached, then reused across the
// calendar dropdown and the week sidebar. Source of truth is Simplicate's submission
// resource — never the per-entry `locked` flag. See docs/adr/0003.
export function useSubmissions() {
  const employeeId = useAppStore((s) => s.simplicateEmployeeId)

  const [submissions, setSubmissions] = useState<HourSubmission[]>([])
  const loadedMonths = useRef<Set<string>>(new Set())
  const inFlight = useRef<Set<string>>(new Set())

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const repoForCall = useCallback(async () => {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')
    return createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
  }, [])

  // Fetch + cache submission status for the month that `dateInMonth` falls in. Widened to
  // whole weeks (Monday of the 1st → Sunday after the last day) so weeks straddling a month
  // boundary are fully covered.
  const loadMonth = useCallback(
    async (dateInMonth: string) => {
      if (!employeeId) return
      const key = monthKey(dateInMonth)
      if (loadedMonths.current.has(key) || inFlight.current.has(key)) return
      inFlight.current.add(key)
      try {
        const first = `${key}-01`
        const lastDay = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate()
        const last = `${key}-${String(lastDay).padStart(2, '0')}`
        // GET /hours/submission wants exact q[start_date]/q[end_date]; cover the month's
        // whole weeks from the first Monday through the last Sunday.
        const from = mondayOf(first)
        const to = addDays(mondayOf(last), 6)
        const repo = await repoForCall()
        const { getSubmissions } = createUseCases(repo)
        const result = await getSubmissions.execute(employeeId, from, to)
        loadedMonths.current.add(key)
        setSubmissions((prev) => {
          // Replace any prior entries that overlap this range, then add the fresh ones.
          const kept = prev.filter((s) => s.endDate < from || s.startDate > to)
          return [...kept, ...result]
        })
      } catch (err) {
        console.error('[useSubmissions] loadMonth failed:', err)
      } finally {
        inFlight.current.delete(key)
      }
    },
    [employeeId, repoForCall],
  )

  const isDateSubmitted = useCallback(
    (date: string) => dateInSubmissions(date, submissions),
    [submissions],
  )

  // Re-fetch submission status for the month(s) spanning [from, to] — Simplicate is the
  // source of truth, so after a submit or withdraw we re-read rather than guess locally
  // (a per-day withdraw can split a week range in ways optimistic state can't track).
  const reloadRange = useCallback(
    async (from: string, to: string) => {
      loadedMonths.current.delete(monthKey(from))
      loadedMonths.current.delete(monthKey(to))
      await loadMonth(from)
      if (monthKey(to) !== monthKey(from)) await loadMonth(to)
    },
    [loadMonth],
  )

  const submit = useCallback(
    async (from: string, to: string): Promise<boolean> => {
      if (!employeeId) {
        setSubmitError('Geen medewerker bekend om uren voor in te dienen')
        return false
      }
      // Simplicate submits a whole timesheet week: start_date must be a Monday and
      // end_date must be a Sunday. Normalise any input range to its full Mon–Sun week.
      const start = mondayOf(from)
      const end = addDays(mondayOf(to), 6)
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const repo = await repoForCall()
        const { submitWeek } = createUseCases(repo)
        await submitWeek.execute(employeeId, start, end)
        await reloadRange(start, end)
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setSubmitError(`Indienen mislukt: ${msg}`)
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [employeeId, repoForCall, reloadRange],
  )

  return {
    loadMonth,
    isDateSubmitted,
    submit,
    isSubmitting,
    submitError,
    clearSubmitError: useCallback(() => setSubmitError(null), []),
  }
}
