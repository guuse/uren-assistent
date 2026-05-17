import { useState } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { TemplateForm } from './TemplateForm'
import { AccountSettings } from './AccountSettings'
import type { Template } from '../../../domain/entities/Template'

type Tab = 'templates' | 'account'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('templates')
  const [editing, setEditing] = useState<Template | null | 'new'>(null)
  const { templates, remove } = useTemplates()

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-6 flex items-center gap-4 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Terug</button>
        <div className="font-bold">Instellingen</div>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        {(['templates', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#2d2d44] text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t === 'templates' ? 'Templates' : 'Account'}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {tab === 'templates' && editing === null && (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-[#2d2d44] rounded-xl p-4 flex justify-between items-center"
                style={{ borderLeft: `3px solid ${t.color}` }}>
                <div>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.type}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(t)} className="text-gray-400 hover:text-white text-xs">Bewerken</button>
                  <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-300 text-xs">Verwijderen</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing('new')}
              className="border border-dashed border-gray-600 rounded-xl p-4 text-gray-500 hover:text-gray-400 hover:border-gray-500 text-sm transition-colors">
              + Nieuw template
            </button>
          </div>
        )}

        {tab === 'templates' && editing !== null && (
          <div>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white text-sm mb-4">← Terug naar templates</button>
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
