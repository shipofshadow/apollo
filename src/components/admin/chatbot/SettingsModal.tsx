import { useEffect, useState } from 'react'
import { Palette, SlidersHorizontal, Volume2, Keyboard, Network, X } from 'lucide-react'
import type { SettingsState } from '../../../hooks/useSettings'

type SettingsModalProps = {
  open: boolean
  settings: SettingsState
  isSaving?: boolean
  onClose: () => void
  onSave: (next: SettingsState) => void
}

const COLOR_PRESETS = ['#fdba74', '#60a5fa', '#4ade80', '#f472b6', '#f87171', '#c084fc']

const POLLING_OPTIONS = [
  { label: 'Fast (2s)', value: 2000 },
  { label: 'Normal (5s)', value: 5000 },
  { label: 'Eco (10s)', value: 10000 },
]

export default function SettingsModal({ open, settings, isSaving = false, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState<SettingsState>(settings)

  useEffect(() => {
    if (open) {
      setDraft(settings)
    }
  }, [open, settings])

  if (!open) return null

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl border border-gray-800 bg-gray-900 text-gray-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-orange" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Chatbot Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-brand-orange" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Appearance</h3>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-gray-400">Agent name color (hex or Tailwind text class)</label>
              <input
                type="text"
                value={draft.agentColor}
                onChange={(e) => setDraft((prev) => ({ ...prev, agentColor: e.target.value }))}
                className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-orange"
                placeholder="#fdba74 or text-orange-300"
              />
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, agentColor: color }))}
                    className={`h-7 w-7 border ${draft.agentColor === color ? 'border-white' : 'border-gray-700'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Set color ${color}`}
                  />
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-brand-orange" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Behavior</h3>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between border border-gray-800 bg-gray-900 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-gray-300"><Volume2 className="h-4 w-4" /> Play sound on new message</span>
                <input
                  type="checkbox"
                  checked={draft.soundEnabled}
                  onChange={(e) => setDraft((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between border border-gray-800 bg-gray-900 px-3 py-2 text-sm">
                <span className="text-gray-300">Press Enter to send</span>
                <input
                  type="checkbox"
                  checked={draft.sendOnEnter}
                  onChange={(e) => setDraft((prev) => ({ ...prev, sendOnEnter: e.target.checked }))}
                />
              </label>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-brand-orange" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Network</h3>
            </div>
            <select
              value={draft.pollingInterval}
              onChange={(e) => setDraft((prev) => ({ ...prev, pollingInterval: Number(e.target.value) }))}
              className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-orange"
            >
              {POLLING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-brand-orange" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Chatbot AI Knowledge Base</h3>
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-gray-400">Chatbot-only KB text (facts, pricing, policies, limitations)</label>
              <textarea
                value={draft.adminKbText}
                onChange={(e) => setDraft((prev) => ({ ...prev, adminKbText: e.target.value }))}
                rows={6}
                className="w-full resize-y border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-orange"
                placeholder="Operating hours: 9AM-6PM. PMS starts at P2,500. We do NOT do body paint."
              />
              <p className="text-[11px] text-gray-500">
                This is used by the chatbot AI intent endpoint. Keep it factual and short; the bot answers from this KB and hands off when unsure.
              </p>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-700 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
