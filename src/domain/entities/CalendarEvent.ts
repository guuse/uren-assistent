export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  attendees: string[]   // email addresses
  status: 'accepted' | 'tentative'
}
