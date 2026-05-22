import { useState } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { TemplateForm } from './TemplateForm'
import { AccountSettings } from './AccountSettings'
import type { Template } from '../../../domain/entities/Template'

type Tab = 'templates' | 'account'

interface Props {
  onBack: () => void
  initialTab?: Tab
}

export function SettingsPage({ onBack, initialTab = 'templates' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [editing, setEditing] = useState<Template | null | 'new'>(null)
  const { templates, remove } = useTemplates()

  return (
    <div className="h-full bg-[#1c1917] text-[#e8e2d9] flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[#2e2a26]">
        <button onClick={onBack} className="text-[#7a7268] hover:text-[#e8e2d9] text-[12px] transition-colors cursor-pointer">← Terug</button>
        <div className="text-[#e8e2d9] font-bold text-[14px]">Instellingen</div>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        {(['templates', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#252220] border border-[#2e2a26] text-[#e8e2d9]' : 'text-[#7a7268] hover:text-[#e8e2d9]'
            }`}>
            {t === 'templates' ? 'Templates' : 'Account'}
          </button>
        ))}
      </div>

      <div className="px-6 py-4 flex-1 overflow-y-auto">
        {tab === 'templates' && editing === null && (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-[#252220] rounded-xl p-4 flex justify-between items-center border border-[#2e2a26]"
                style={{ borderLeft: `3px solid ${t.color}` }}>
                <div>
                  <div className="text-[#e8e2d9] text-sm font-medium">{t.name}</div>
                  <div className="text-[#7a7268] text-xs">{t.type}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(t)} className="text-[#7a7268] hover:text-[#e8e2d9] text-xs">Bewerken</button>
                  <button onClick={() => remove(t.id)} className="text-[#b85a3a] hover:text-[#c86a4a] text-xs">Verwijderen</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing('new')}
              className="border border-dashed border-[#2e2a26] rounded-xl p-4 text-[#7a7268] hover:text-[#e8e2d9] hover:border-[#3e3a36] text-sm transition-colors">
              + Nieuw template
            </button>
          </div>
        )}

        {tab === 'templates' && editing !== null && (
          <div>
            <button onClick={() => setEditing(null)} className="text-[#7a7268] hover:text-[#e8e2d9] text-sm mb-4">← Terug naar templates</button>
            {editing === 'new'
              ? <TemplateForm onDone={() => setEditing(null)} />
              : <TemplateForm initial={editing} onDone={() => setEditing(null)} />
            }
          </div>
        )}

        {tab === 'account' && <AccountSettings />}
      </div>
    </div>
  )
}
