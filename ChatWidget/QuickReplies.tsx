import type { QuickReplyOption } from './ChatWidget'

type QuickRepliesProps = {
  options?: QuickReplyOption[]
  onSelect: (value: string) => void
  disabled: boolean
}

export default function QuickReplies({ options, onSelect, disabled }: QuickRepliesProps) {
  if (!options || options.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 0',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
      }}
    >
      {options.map((option, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(option.value)}
          disabled={disabled}
          style={{
            flex: '1 1 auto',
            minWidth: '100px',
            background: 'white',
            border: '1.5px solid #f36f21',
            color: '#df5e18',
            borderRadius: 20,
            padding: '8px 14px',
            fontSize: 13,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#fff3ea'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white'
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
