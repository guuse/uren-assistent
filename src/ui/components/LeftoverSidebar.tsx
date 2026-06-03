import { useState } from 'react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { useAppStore } from '../../store/appStore'

/**
 * Right-hand "leftover blocks" sidebar (see CONTEXT.md "Leftover block").
 * Design 2 — compact chips: a dense, scannable list whose actions appear on
 * hover. Auto-opens when leftovers exist; collapses to a thin rail with a count
 * badge. Each chip can be added to the day, booked directly, or dismissed.
 */

interface Props {
  leftovers: ClassifiedBlock[]
  onBook: (block: ClassifiedBlock) => void
  onDismiss: (block: ClassifiedBlock) => void
  readOnly?: boolean
}

interface ChipColors { swatch: string; badgeBg: string; badgeColor: string; name: string }

// One distinct shade per confidence level (matches DayTimeline's gradient) so
// 5 ≠ 4 and 2 ≠ 1 at a glance, not just in the badge number.
const CONF_COLORS: Record<1 | 2 | 3 | 4 | 5, ChipColors> = {
  5: { swatch: '#15803d', badgeBg: '#bbf7d0', badgeColor: '#15803d', name: '#14532d' },
  4: { swatch: '#22c55e', badgeBg: '#dcfce7', badgeColor: '#16a34a', name: '#166534' },
  3: { swatch: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706', name: '#78350f' },
  2: { swatch: '#ea580c', badgeBg: '#ffedd5', badgeColor: '#ea580c', name: '#7c2d12' },
  1: { swatch: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#ef4444', name: '#7f1d1d' },
}
const WARN_COLORS: ChipColors = { swatch: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706', name: '#d97706' }

function colorsFor(block: ClassifiedBlock): ChipColors {
  if (!block.projectId || !block.serviceId) return WARN_COLORS // missing project → amber warn
  return CONF_COLORS[block.confidence] ?? CONF_COLORS[1]
}

function reasonLabel(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return 'project ontbreekt'
  return block.leftoverReason === 'overflow' ? 'paste niet in dag' : 'suggestie'
}

function durationLabel(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `~${String(rounded).replace('.', ',')}u`
}

export function LeftoverSidebar({ leftovers, onBook, onDismiss, readOnly = false }: Props) {
  const projects = useAppStore(s => s.projects)
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  // Auto-open whenever a fresh set of leftovers appears (e.g. after "Verwerk dag"),
  // while still letting the user collapse manually. Done by adjusting state during
  // render when the leftover set changes (React's recommended pattern — no effect).
  const leftoverKey = leftovers.map(l => l.urlPattern).join('|')
  const [seenKey, setSeenKey] = useState(leftoverKey)
  if (leftoverKey !== seenKey) {
    setSeenKey(leftoverKey)
    if (leftovers.length > 0) setOpen(true)
  }

  if (leftovers.length === 0) return null

  const projectName = (id?: string): string =>
    id ? (projects.find(p => p.id === id)?.name ?? id) : ''

  // Collapsed rail: just a badge + label.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Niet-geplaatste blokken tonen"
        style={{
          width: 44, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 12,
          cursor: 'pointer',
        }}
      >
        <span style={{ background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>
          {leftovers.length}
        </span>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.3 }}>
          Niet geplaatst
        </span>
      </button>
    )
  }

  return (
    <div style={{ width: 288, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          Niet geplaatst
          <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '0 6px' }}>{leftovers.length}</span>
        </div>
        <button onClick={() => setOpen(false)} title="Inklappen" style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px', background: 'none', border: 'none' }}>
          »
        </button>
      </div>

      {/* Chips */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leftovers.map(block => {
          const t = colorsFor(block)
          const missing = !block.projectId || !block.serviceId
          const isHovered = hovered === block.urlPattern
          const showActions = !readOnly && (isHovered || missing)
          return (
            <div
              key={block.urlPattern}
              data-testid={`leftover-${block.urlPattern}`}
              onMouseEnter={() => setHovered(block.urlPattern)}
              onMouseLeave={() => setHovered(prev => (prev === block.urlPattern ? null : prev))}
              style={{
                display: 'flex', alignItems: 'stretch', gap: 8, background: 'var(--bg)',
                border: `1px ${missing ? 'dashed' : 'solid'} ${missing ? '#fcd34d' : 'var(--border)'}`,
                borderRadius: 6, padding: '6px 8px', position: 'relative',
              }}
            >
              <div style={{ width: 3, borderRadius: 2, background: t.swatch, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: missing ? '#d97706' : t.name, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {missing ? '⚠ ' : ''}{block.blockName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, overflow: 'hidden' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{durationLabel(block.hours)}</span>
                  <span style={{ background: t.badgeBg, color: t.badgeColor, fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '0 4px', flexShrink: 0 }}>
                    {block.confidence}/5
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {block.projectId ? projectName(block.projectId) : reasonLabel(block)}
                  </span>
                </div>
              </div>
              {showActions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <button data-testid={`leftover-book-${block.urlPattern}`} onClick={() => onBook(block)} title="Direct boeken" style={iconBtn('#fff', '#16a34a', true)}>✓</button>
                  <button data-testid={`leftover-dismiss-${block.urlPattern}`} onClick={() => onDismiss(block)} title="Negeren" style={iconBtn('var(--text-muted)', 'var(--bg)')}>✕</button>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', padding: '4px 0' }}>
          {readOnly ? 'week ingediend — alleen-lezen' : 'hover voor acties'}
        </div>
      </div>
    </div>
  )
}

function iconBtn(color: string, bg: string, filled = false): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 4, fontSize: 12, lineHeight: 1, cursor: 'pointer',
    border: filled ? 'none' : '1px solid var(--border)',
    background: filled ? bg : bg, color, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}
