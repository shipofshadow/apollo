import React from 'react'
import CardCarousel from './CardCarousel'
import QuickReplies from './QuickReplies'
import type { CardButton, CardData, ChatMessage } from './types'

type QuickReplyPayload = {
  value: string
  display?: string
}

type MessageBubbleProps = {
  message: ChatMessage
  isQuickReplyActive?: boolean
  onQuickReply: (value: string | QuickReplyPayload) => void
  quickRepliesDisabled: boolean
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const href = match[0]
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline break-all hover:opacity-80"
      >
        {href}
      </a>
    )
    last = match.index + href.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function formatTime(timestamp?: string) {
  if (!timestamp) return ''
  const now = new Date()
  const then = new Date(timestamp)
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function MessageBubble({ message, isQuickReplyActive = false, onQuickReply, quickRepliesDisabled }: MessageBubbleProps) {
  const isUser = message.sender === 'user'
  const isHuman = message.sender === 'human'
  const isCardMessage = message.message_type === 'card' && message.metadata?.cards
  const uploadedImages = Array.isArray(message.metadata?.uploaded_images) ? message.metadata.uploaded_images : []
  const humanLabel = isHuman && typeof message.metadata?.agent_name === 'string' && message.metadata.agent_name.trim()
    ? message.metadata.agent_name.trim()
    : 'Agent'

  const sendValue = (value: string | number, display?: string) => {
    if (display !== undefined) {
      onQuickReply({ value: String(value), display: String(display) })
      return
    }
    onQuickReply(String(value))
  }

  const handleCardButtonClick = (button: CardButton | string, card: CardData, cardIndex?: number) => {
    if (typeof button === 'string') {
      sendValue(button, card.title || button)
      return
    }

    if (button.payload) {
      try {
        const parsed = JSON.parse(button.payload)
        const variantId = parsed?.variant_id ?? parsed?.variationId
        if (variantId !== undefined && variantId !== null) {
          sendValue(JSON.stringify(parsed), card.title || button.caption || button.label || button.text)
          return
        }

        const serviceId = parsed?.service_id ?? parsed?.serviceId
        if (serviceId !== undefined && serviceId !== null) {
          sendValue(JSON.stringify(parsed), card.title || button.caption || button.label || button.text)
          return
        }

        if (parsed?.appointment_time !== undefined && parsed?.appointment_time !== null) {
          sendValue(parsed.appointment_time, parsed.appointment_time)
          return
        }
        if (parsed?.appointmentTime !== undefined && parsed?.appointmentTime !== null) {
          sendValue(parsed.appointmentTime, parsed.appointmentTime)
          return
        }
      } catch {
      }

      sendValue(button.payload, card.title || button.caption || button.label || button.text)
      return
    }

    const caption = String(button.caption || button.label || button.text || '').toLowerCase()
    const isBookNow = caption.includes('book')

    if ((button.type === 'url' || button.url) && button.url && isBookNow) {
      try {
        const url = new URL(button.url)
        const variantFromUrl = url.searchParams.get('variant_id') || url.searchParams.get('variantId') || url.searchParams.get('id')
        if (variantFromUrl) {
          sendValue(variantFromUrl, card.title || button.caption || button.label || button.text)
          return
        }
      } catch {
      }

      if (card.variant_id !== undefined && card.variant_id !== null) {
        sendValue(card.variant_id, card.title || button.caption || button.label || button.text)
        return
      }

      if (typeof cardIndex === 'number') {
        sendValue(cardIndex + 1, card.title || button.caption || button.label || button.text)
        return
      }
    }

    if ((button.type === 'url' || button.url) && button.url) {
      window.open(button.url, '_blank', 'noopener,noreferrer')
      return
    }

    sendValue(button.value || button.caption || button.label || button.text || '', card.title)
  }

  return (
    <div className={`mb-3 flex w-full flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {isHuman && <span className="mb-1 ml-1 text-[11px] font-semibold text-orange-300">{humanLabel}</span>}

      <div
        className={[
          'max-w-[84%] overflow-hidden',
          isCardMessage ? 'w-full max-w-full rounded-3xl bg-transparent p-0 shadow-none' : '',
          !isCardMessage && isUser ? 'rounded-[18px_18px_4px_18px] bg-gradient-to-br from-brand-orange to-orange-600 px-4 py-2.5 text-white' : '',
          !isCardMessage && !isUser ? 'rounded-[18px_18px_18px_4px] bg-white px-4 py-2.5 text-slate-800 shadow-[0_12px_30px_rgba(8,8,8,0.08)]' : '',
        ].join(' ')}
      >
        {isCardMessage ? (
          <CardCarousel cards={message.metadata.cards} onButtonClick={handleCardButtonClick} />
        ) : message.message_type === 'images' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
            {uploadedImages.map((url, index) => (
              <a key={`${url}-${index}`} href={String(url)} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={String(url)}
                  alt={`Uploaded vehicle ${index + 1}`}
                  className="block h-[76px] w-[76px] rounded-lg border border-slate-200 object-cover"
                />
              </a>
            ))}
            {message.content ? <span className="col-span-full text-sm leading-6">{message.content}</span> : null}
          </div>
        ) : (
          <span className="text-sm leading-6">{linkify(message.content ?? '')}</span>
        )}
      </div>

      {message.message_type === 'button' && message.metadata?.buttons && (
        <div className="mt-2 flex w-full max-w-[84%] flex-col gap-2">
          {message.metadata.buttons.map((button, index) => (
            <button
              key={`${button.label || button.value || 'button'}-${index}`}
              onClick={() => onQuickReply(String(button.value || button.label || ''))}
              disabled={quickRepliesDisabled}
              className="rounded-xl border border-brand-orange bg-white px-3 py-2 text-xs font-semibold text-brand-orange transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {button.label}
            </button>
          ))}
        </div>
      )}

      {message.message_type === 'quick_reply' && isQuickReplyActive && message.metadata?.options && (
        <QuickReplies options={message.metadata.options} onSelect={onQuickReply} disabled={quickRepliesDisabled} />
      )}

      <span className={`mt-1 text-[11px] text-slate-400 ${isUser ? 'mr-1' : 'ml-1'}`}>{formatTime(message.timestamp)}</span>
    </div>
  )
}