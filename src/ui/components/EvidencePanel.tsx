interface Props {
  rawTitles?: string[] | undefined
  rawUrls?: string[] | undefined
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + u.pathname
  } catch {
    return url
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function EvidencePanel({ rawTitles, rawUrls }: Props) {
  const hasUrls = rawUrls && rawUrls.length > 0
  const hasTitles = rawTitles && rawTitles.length > 0

  if (!hasUrls && !hasTitles) return null

  const items = hasUrls ? rawUrls!.slice(0, 5) : rawTitles!.slice(0, 5)

  return (
    <div className="bg-[#2a2622] border border-[#2e2a26] rounded-lg px-3 py-2.5">
      <div className="text-[#4a4540] text-[9px] font-semibold uppercase tracking-[0.07em] mb-1.5">
        Wat je deed
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item} className="flex items-center gap-1.5 min-w-0">
            <span className="w-[3px] h-[3px] rounded-full bg-[#4a4540] flex-shrink-0" />
            <span className="text-[#7a7268] text-[10px] truncate">
              {hasUrls ? displayUrl(item) : truncate(item, 80)}
              {hasUrls && hasTitles && rawTitles![i] && (
                <span className="text-[#4a4540]"> — {truncate(rawTitles![i]!, 50)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
