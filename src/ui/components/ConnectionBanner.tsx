// src/ui/components/ConnectionBanner.tsx
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'

const SERVICE_LABELS: Record<string, string> = {
  copilot: 'GitHub Copilot token',
  github: 'GitHub token',
  linear: 'Linear API key',
}

export default function ConnectionBanner() {
  const tokenStatuses = useAppStore(s => s.tokenStatuses)
  const [dismissed, setDismissed] = useState(false)

  const failed = (Object.keys(tokenStatuses) as Array<keyof typeof tokenStatuses>).filter(
    k => tokenStatuses[k] === 'fail'
  )

  if (failed.length === 0 || dismissed) return null

  const labels = failed.map(k => SERVICE_LABELS[k] ?? k).join(', ')

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#3a1a10] border-b border-[#6b2a18] text-[#f0a090] text-sm">
      <span className="shrink-0">⚠</span>
      <span className="flex-1">
        Verbinding mislukt voor: <strong>{labels}</strong>. Controleer je tokens in Instellingen.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-[#f0a090] hover:text-white transition-colors leading-none"
        aria-label="Sluiten"
      >
        ✕
      </button>
    </div>
  )
}
