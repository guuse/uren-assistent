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
  if (/harborn/i.test(hostname)) return { bg: '#1a3a1a', color: '#5a8a6a' }
  if (/^accounts\.|^auth\.|^login\.|^sso\./i.test(hostname))
    return { bg: '#3a2e10', color: '#a07848' }
  return { bg: '#252220', color: '#7a7268' }
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
    <div className="bg-[#1c1917] border border-[#2e2a26] rounded-lg overflow-hidden overflow-y-auto max-h-full min-h-0">
      {/* Kopregel */}
      <div className="px-3 py-[7px] border-b border-[#2e2a26] flex justify-between items-center">
        <span className="text-[#4a4540] text-[0.5625rem] uppercase tracking-[.08em] font-semibold">
          {hasMeetings ? 'Context' : "Bezochte pagina's"}
        </span>
        <span className="text-[#4a4540] text-[0.5625rem]">
          {hasMeetings
            ? timeLabel
            : `${urlList.length}${timeLabel ? ` · ${timeLabel}` : ''}`}
        </span>
      </div>

      {/* Browsing sub-label (alleen als meetings aanwezig) */}
      {hasMeetings && urlList.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
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
              <div key={i} className="flex gap-[10px] items-start">
                <div
                  className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
                  style={{ background: style.bg, color: style.color }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                    {host}{path}
                  </div>
                  {pageTitle && (
                    <div className="text-[#7a7268] text-[0.625rem] mt-[1px] truncate">
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
          <div className="border-t border-[#2e2a26] mx-3" />
          <div className="px-3 pt-2 pb-1">
            <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
              Agenda ({meetingList.length})
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px]">
            {meetingList.map((meeting) => {
              const statusConfig: Record<CalendarEvent['status'], { color: string; label: string }> = {
                accepted: { color: '#5a8a6a', label: '✓ accepted' },
                tentative: { color: '#a07848', label: '? tentative' },
              }
              const { color: statusColor, label: statusLabel } = statusConfig[meeting.status]
              const timeRange = `${formatTime(meeting.start)}–${formatTime(meeting.end)}`
              const attendees = attendeeLabel(meeting.attendees)
              return (
                <div key={meeting.id} className="flex gap-[10px] items-start">
                  <div
                    className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] mt-[1px] border border-[#2e2a26]"
                    style={{ background: '#1a2a3a' }}
                  >
                    📅
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-[5px]">
                      <span className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                        {meeting.title}
                      </span>
                      <span className="text-[0.5625rem] flex-shrink-0" style={{ color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-[#7a7268] text-[0.625rem] mt-[1px]">
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
          <div className="border-t border-[#2e2a26] mx-3" />
          <div className="px-3 pt-2 pb-1">
            <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
              GitHub commits ({commits.length})
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px] overflow-y-auto" style={{ maxHeight: '160px' }}>
            {commits.map((commit) => (
              <div key={commit.sha} className="flex gap-[10px] items-start">
                <div
                  className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
                  style={{ background: '#2a1e12', color: '#f48024' }}
                >
                  GH
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                    {commit.message}
                  </div>
                  <div className="text-[#7a7268] text-[0.625rem] mt-[1px] truncate">
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
          <div className="border-t border-[#2e2a26] mx-3" />
          <div className="px-3 pt-2 pb-1">
            <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
              Linear (deze week, afgerond)
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px]">
            {linearIssues.map((issue) => (
              <div key={issue.identifier} className="flex gap-[10px] items-start">
                <div
                  className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
                  style={{ background: '#1a1a2e', color: '#8b5cf6' }}
                >
                  LN
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                    {issue.identifier} · {issue.title}
                  </div>
                </div>
                <div className="text-[0.5625rem] flex-shrink-0" style={{ color: '#5a8a6a' }}>
                  ✓ done
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* LLM-samenvatting */}
      {summary && (
        <div className="border-t border-[#2e2a26] px-3 py-[9px] bg-[#1c1917] flex gap-2 items-start">
          <div className="w-[2px] flex-shrink-0 bg-[#5a8a6a] rounded-sm self-stretch" />
          <div>
            <div className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em] mb-[3px]">
              LLM samenvatting
            </div>
            <div className="text-[#94a3b8] text-[0.6875rem] leading-[1.5] italic">
              "{summary}"
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
