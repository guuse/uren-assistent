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
    <div className="h-full bg-[#faf8f4] text-[#3a3530] flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[#e8e2d9]">
        <button onClick={onBack} className="text-[#a09890] hover:text-[#3a3530] text-[12px] transition-colors cursor-pointer">← Terug</button>
        <div className="text-[#3a3530] font-bold text-[14px]">Instellingen</div>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        {(['templates', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white border border-[#e8e2d9] text-[#3a3530]' : 'text-[#a09890] hover:text-[#3a3530]'
            }`}>
            {t === 'templates' ? 'Templates' : 'Account'}
          </button>
        ))}
      </div>

      <div className="px-6 py-4 flex-1 overflow-y-auto">
        {tab === 'templates' && editing === null && (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-white rounded-xl p-4 flex justify-between items-center border border-[#e8e2d9]"
                style={{ borderLeft: `3px solid ${t.color}` }}>
                <div>
                  <div className="text-[#3a3530] text-sm font-medium">{t.name}</div>
                  <div className="text-[#a09890] text-xs">{t.type}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(t)} className="text-[#a09890] hover:text-[#3a3530] text-xs">Bewerken</button>
                  <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-300 text-xs">Verwijderen</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing('new')}
              className="border border-dashed border-[#e8e2d9] rounded-xl p-4 text-[#a09890] hover:text-[#3a3530] hover:border-[#c0b8b0] text-sm transition-colors">
              + Nieuw template
            </button>
          </div>
        )}

        {tab === 'templates' && editing !== null && (
          <div>
            <button onClick={() => setEditing(null)} className="text-[#a09890] hover:text-[#3a3530] text-sm mb-4">← Terug naar templates</button>
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
