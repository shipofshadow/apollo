import type { QuickReplyOption } from './types'

type QuickRepliesProps = {
  options?: QuickReplyOption[]
  onSelect: (value: string) => void
  disabled: boolean
}

export default function QuickReplies({ options, onSelect, disabled }: QuickRepliesProps) {
  if (!options || options.length === 0) return null

  return (
    <div className={`mt-2 flex w-full flex-wrap gap-2 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {options.map((option) => (
        <button
          key={`${option.label}-${option.value}`}
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          className="max-w-full rounded-full border border-brand-orange px-3 py-2 text-xs font-semibold text-brand-orange transition hover:bg-orange-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}