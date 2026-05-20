// src/infrastructure/googlecalendar/GoogleCalendarRepository.ts
import type { IGoogleCalendarRepository } from '../../domain/repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { IKeychainRepository } from '../../domain/repositories/IKeychainRepository'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo'
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

interface GoogleEventAttendee {
  email: string
  self?: boolean
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction'
}

interface GoogleEventDateTime {
  dateTime?: string
  date?: string
}

interface GoogleEvent {
  id: string
  summary?: string
  start: GoogleEventDateTime
  end: GoogleEventDateTime
  attendees?: GoogleEventAttendee[]
  status?: string
}

interface GoogleEventsListResponse {
  items?: GoogleEvent[]
}

export class GoogleCalendarRepository implements IGoogleCalendarRepository {
  constructor(
    private readonly keychain: IKeychainRepository,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async hasCalendarScope(): Promise<boolean> {
    try {
      const token = await this.getValidToken()
      if (!token) return false
      const res = await fetch(`${TOKEN_INFO_URL}?access_token=${encodeURIComponent(token)}`)
      if (!res.ok) return false
      const data = await res.json() as { scope?: string }
      return (data.scope ?? '').includes(CALENDAR_SCOPE)
    } catch {
      return false
    }
  }

  async fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const token = await this.getValidToken()
    if (!token) return []

    const timeMin = new Date(startDate)
    timeMin.setHours(0, 0, 0, 0)
    const timeMax = new Date(endDate)
    timeMax.setHours(23, 59, 59, 999)

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    })

    const res = await fetch(`${CALENDAR_API_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`)

    const data = await res.json() as GoogleEventsListResponse
    const items = data.items ?? []

    return items
      .filter(ev => this.isAttending(ev))
      .map(ev => this.toCalendarEvent(ev))
      .filter((ev): ev is CalendarEvent => ev !== null)
  }

  private isAttending(ev: GoogleEvent): boolean {
    if (!ev.attendees) return true // solo events have no attendees array
    const self = ev.attendees.find(a => a.self)
    if (!self) return true
    return self.responseStatus === 'accepted' || self.responseStatus === 'tentative'
  }

  private toCalendarEvent(ev: GoogleEvent): CalendarEvent | null {
    const startStr = ev.start.dateTime ?? ev.start.date
    const endStr = ev.end.dateTime ?? ev.end.date
    if (!startStr || !endStr) return null

    const attendees = (ev.attendees ?? [])
      .filter(a => !a.self)
      .map(a => a.email)

    const selfAttendee = (ev.attendees ?? []).find(a => a.self)
    const status = (selfAttendee?.responseStatus === 'tentative' ? 'tentative' : 'accepted') as 'accepted' | 'tentative'

    return {
      id: ev.id,
      title: ev.summary ?? '(geen titel)',
      start: new Date(startStr),
      end: new Date(endStr),
      attendees,
      status,
    }
  }

  private async getValidToken(): Promise<string | null> {
    const token = await this.keychain.get('google-access-token')
    const expiryStr = await this.keychain.get('google-token-expiry')
    if (!token) return null

    const expiry = expiryStr ? Number(expiryStr) : 0
    if (Date.now() < expiry - 60_000) return token

    // Try to refresh
    const refreshToken = await this.keychain.get('google-refresh-token')
    if (!refreshToken) return null

    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { access_token: string; expires_in?: number }
      const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
      await this.keychain.set('google-access-token', data.access_token)
      await this.keychain.set('google-token-expiry', String(newExpiry))
      return data.access_token
    } catch {
      return null
    }
  }
}
