// A submitted ("ingediende") period of hours in Simplicate. Submission locks the
// covered days: existing hours can no longer be changed, added, or deleted.
// Modelled as a closed date range [startDate, endDate] (inclusive), since the app
// submits a full Monday–Friday week. See CONTEXT.md → "Ingediende week".
export interface HourSubmission {
  startDate: string // YYYY-MM-DD (inclusive)
  endDate: string   // YYYY-MM-DD (inclusive)
  status?: string   // raw Simplicate status label, if provided
}

/** True when `date` (YYYY-MM-DD) falls within any of the given submissions. */
export function isDateSubmitted(date: string, submissions: HourSubmission[]): boolean {
  return submissions.some((s) => date >= s.startDate && date <= s.endDate)
}
