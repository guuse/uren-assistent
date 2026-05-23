interface Props {
  rawUrls?: string[] | undefined
  rawTitles?: string[] | undefined
  urls?: string[] | undefined
  titles?: string[] | undefined
  summary?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
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

export default function EvidencePanel({
  rawUrls,
  rawTitles,
  urls,
  titles,
  summary,
  startTime,
  endTime,
}: Props) {
  const urlList = rawUrls?.length ? rawUrls : urls ?? []
  const titleList = rawTitles?.length ? rawTitles : titles ?? []

  if (urlList.length === 0 && titleList.length === 0 && !summary) return null

  const timeLabel = startTime && endTime ? ` · ${startTime}–${endTime}` : ''

  return (
    <div className="bg-[#1c1917] border border-[#2e2a26] rounded-lg overflow-hidden">
      {/* Kopregel */}
      <div className="px-3 py-[7px] border-b border-[#2e2a26] flex justify-between items-center">
        <span className="text-[#4a4540] text-[0.5625rem] uppercase tracking-[.08em] font-semibold">
          Bezochte pagina's
        </span>
        <span className="text-[#4a4540] text-[0.5625rem]">
          {urlList.length}{timeLabel}
        </span>
      </div>

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
