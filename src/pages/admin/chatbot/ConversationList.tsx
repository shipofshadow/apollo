type ConversationSummary = {
  session_id: string
  status?: string
  updated_at?: string
  last_message?: string
  message_count?: number
  customer_name?: string
  customerName?: string
  name?: string
}

type ConversationListProps = {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (sessionId: string) => void
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STATUS_COLORS = {
  bot: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  human: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
  closed: 'bg-gray-700/50 text-gray-300 border border-gray-600',
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">
        No conversations yet
      </div>
    )
  }

  return (
    <div className="space-y-1.5 p-2">
      {conversations.map((conv) => {
        const isSelected = conv.session_id === selectedId
        const statusKey = conv.status as keyof typeof STATUS_COLORS
        const statusColors = STATUS_COLORS[statusKey] || STATUS_COLORS.closed
        const needsAttention = conv.status === 'human'
        const customerName = (
          conv.customer_name ||
          conv.customerName ||
          conv.name ||
          ''
        ).trim()
        const title = customerName !== ''
          ? customerName
          : (conv.session_id ? conv.session_id.substring(0, 10) + '...' : 'Unknown')
        const subtitle = customerName !== ''
          ? (conv.session_id || 'Unknown session')
          : 'Customer not identified'
        const initial = (title.trim()[0] || '?').toUpperCase()

        return (
          <div
            key={conv.session_id}
            onClick={() => onSelect(conv.session_id)}
            className={`cursor-pointer rounded-md border px-3 py-2.5 transition-all duration-200 ${
              isSelected
                ? 'border-brand-orange/70 bg-brand-orange/10 shadow-[0_8px_20px_rgba(245,130,32,0.18)]'
                : 'border-gray-800 bg-gray-900/70 hover:border-gray-700 hover:bg-gray-800/70'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                  isSelected
                    ? 'border-brand-orange/60 bg-brand-orange/20 text-brand-orange'
                    : 'border-gray-700 bg-gray-900 text-gray-300'
                }`}>
                  {initial}
                </div>
                {needsAttention && (
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-brand-orange" />
                )}
                <div className="min-w-0 block overflow-hidden">
                  <div className="truncate text-[13px] font-semibold text-gray-100">{title}</div>
                  <div className="truncate font-mono text-[10px] text-gray-500">{subtitle}</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColors}`}>
                {conv.status || 'unknown'}
              </span>
            </div>

            {isSelected && customerName !== '' && (
              <div className="mb-1 truncate font-mono text-[10px] text-gray-500">{conv.session_id}</div>
            )}

            <div className="mb-0.5 truncate text-[11px] text-gray-400">
              {conv.last_message
                ? conv.last_message.substring(0, 40) + (conv.last_message.length > 40 ? '...' : '')
                : 'No recent messages'}
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{formatRelativeTime(conv.updated_at)}</span>
              {conv.message_count !== null && conv.message_count !== undefined && (
                <span>{conv.message_count} msgs</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}