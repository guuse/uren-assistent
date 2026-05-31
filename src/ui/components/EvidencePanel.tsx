import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'
import type { LinearIssue } from '../../domain/entities/LinearIssue'

interface Props {
  rawUrls?: string[] | undefined
  rawTitles?: string[] | undefined
  urls?: string[] | undefined
  titles?: string[] | undefined
  summary?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
  meetings?: CalendarEvent[] | undefined
  commits?: GitHubCommit[]
  linearIssues?: LinearIssue[]
}

function displayUrl(url: string): { host: string; path: string } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return { host: u.hostname, path: u.pathname.replace(/\/$/, '') }
  } catch {
    return { host: url, path: '' }
  }
}

function domainStyle(hostname: string): { bg: string; color: string } {
  if (/^accounts\.|^auth\.|^login\.|^sso\./i.test(hostname))
    return { bg: 'var(--accent-light)', color: 'var(--accent)' }
  return { bg: 'var(--bg)', color: 'var(--text-muted)' }
}

/** Extract first name from email: "jan.de.vries@company.com" → "Jan" */
function firstName(email: string): string {
  const local = email.split('@')[0] ?? email
  const part = local.split(/[._]/)[0] ?? local
  return part.charAt(0).toUpperCase() + part.slice(1)
}

function formatTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function attendeeLabel(attendees: string[]): string {
  const names = attendees.slice(0, 3).map(firstName)
  const extra = attendees.length - 3
  return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ')
}

export default function EvidencePanel({
  rawUrls,
  rawTitles,
  urls,
  titles,
  summary,
  startTime,
  endTime,
  meetings,
  commits,
  linearIssues,
}: Props) {
  const urlList = rawUrls?.length ? rawUrls : urls ?? []
  const titleList = rawTitles?.length ? rawTitles : titles ?? []
  const meetingList = meetings?.length ? meetings : []
  const hasMeetings = meetingList.length > 0

  if (urlList.length === 0 && titleList.length === 0 && !summary && !hasMeetings) return null

  const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : ''

  return (
    <div style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }} className="rounded-lg overflow-hidden overflow-y-auto max-h-full min-h-0">
      {/* Kopregel */}
      <div className="px-3 py-[7px] flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {hasMeetings ? 'Context' : "Bezochte pagina's"}
        </span>
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>
          {hasMeetings
            ? timeLabel
            : `${urlList.length}${timeLabel ? ` · ${timeLabel}` : ''}`}
        </span>
      </div>

      {/* Browsing sub-label (alleen als meetings aanwezig) */}
      {hasMeetings && urlList.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <span style={{ color: 'var(--text-faint)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
            Browsing ({urlList.length})
          </span>
        </div>
      )}

      {/* URL-lijst */}
      {urlList.length > 0 && (
        <div className="overflow-y-auto px-3 py-2 flex flex-col gap-[7px]" style={{ maxHeight: '138px' }}>
          {urlList.map((url, i) => {
            const { host, path } = displayUrl(url)
            const style = domainStyle(host)
            const initial = host.replace(/^www\./, '')[0]?.toUpperCase() ?? '?'
            const pageTitle = titleList[i]
            return (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6 }}>
                <div
                  className="flex-shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px]"
                  style={{ background: style.bg, color: style.color }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {host}{path}
                  </div>
                  {pageTitle && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                      {pageTitle}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Scheidingslijn + Agenda-sectie */}
      {hasMeetings && (
        <>
          <div className="mx-3" style={{ borderBottom: '1px solid var(--border)' }} />
          <div className="px-3 pt-2 pb-1">
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 7 }}>
              Agenda ({meetingList.length})
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px]">
            {meetingList.map((meeting) => {
              const statusConfig: Record<CalendarEvent['status'], { color: string; label: string }> = {
                accepted: { color: 'var(--success)', label: '✓ accepted' },
                tentative: { color: 'var(--text-muted)', label: '? tentative' },
              }
              const { color: statusColor, label: statusLabel } = statusConfig[meeting.status]
              const timeRange = `${formatTime(meeting.start)}–${formatTime(meeting.end)}`
              const attendees = attendeeLabel(meeting.attendees)
              return (
                <div key={meeting.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6 }}>
                  <div
                    className="flex-shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[0.5625rem] mt-[1px]"
                    style={{ background: '#f0fdf4', color: '#16a34a' }}
                  >
                    📅
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-[5px]">
                      <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                        {meeting.title}
                      </span>
                      <span className="flex-shrink-0" style={{ fontSize: 9, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                      {timeRange}{attendees ? ` · ${attendees}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* GitHub commits sectie */}
      {commits && commits.length > 0 && (
        <>
          <div className="mx-3" style={{ borderBottom: '1px solid var(--border)' }} />
          <div className="px-3 pt-2 pb-1">
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 7 }}>
              GitHub commits ({commits.length})
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px] overflow-y-auto" style={{ maxHeight: '160px' }}>
            {commits.map((commit) => (
              <div key={commit.sha} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6 }}>
                <div
                  className="flex-shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px]"
                  style={{ background: '#fff7ed', color: '#ea580c' }}
                >
                  GH
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {commit.message}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                    {commit.repo} · {commit.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Linear issues sectie */}
      {linearIssues && linearIssues.length > 0 && (
        <>
          <div className="mx-3" style={{ borderBottom: '1px solid var(--border)' }} />
          <div className="px-3 pt-2 pb-1">
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 7 }}>
              Linear (deze week, afgerond)
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px]">
            {linearIssues.map((issue) => (
              <div key={issue.identifier} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6 }}>
                <div
                  className="flex-shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px]"
                  style={{ background: '#f5f3ff', color: '#7c3aed' }}
                >
                  LN
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {issue.identifier} · {issue.title}
                  </div>
                </div>
                <div className="flex-shrink-0" style={{ fontSize: 9, color: 'var(--success)' }}>
                  ✓ done
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* LLM-samenvatting */}
      {summary && (
        <div style={{ margin: 7, padding: '8px 10px', background: 'var(--surface)', borderRadius: 7, border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 4 }}>
            LLM samenvatting
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
            "{summary}"
          </div>
        </div>
      )}
    </div>
  )
}
