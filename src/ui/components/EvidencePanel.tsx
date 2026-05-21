interface Props {
  rawTitles?: string[] | undefined
  rawUrls?: string[] | undefined
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + u.pathname
  } catch {
    return url
  }
}

export default function EvidencePanel({ rawTitles, rawUrls }: Props) {
  const hasTitles = rawTitles && rawTitles.length > 0
  const hasUrls = rawUrls && rawUrls.length > 0

  if (!hasTitles && !hasUrls) return null

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: '#1a1a2e', borderLeft: '3px solid #444' }}
    >
      <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Wat je deed</div>
      <ul className="flex flex-col gap-1.5">
        {hasUrls && rawUrls!.map((url, i) => (
          <li key={url} className="flex flex-col gap-0.5">
            <span className="text-xs font-mono" style={{ color: '#6c63ff' }}>
              {displayUrl(url)}
            </span>
            {hasTitles && rawTitles![i] && (
              <span className="text-gray-400 text-xs leading-tight pl-1">
                {truncate(rawTitles![i]!, 80)}
              </span>
            )}
          </li>
        ))}
        {hasTitles && !hasUrls && rawTitles!.map((title) => (
          <li key={title} className="text-gray-400 text-xs leading-tight">
            {truncate(title, 80)}
          </li>
        ))}
      </ul>
    </div>
  )
}
