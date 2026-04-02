import type { CSSProperties } from 'react'
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
  const humanLabel =
    isHuman && typeof message.metadata?.agent_name === 'string' && message.metadata.agent_name.trim()
      ? message.metadata.agent_name.trim()
      : 'Agent'

  const bubbleStyle = isUser
    ? {
        background: 'linear-gradient(135deg, #f36f21, #df5e18)',
        color: 'white',
        borderRadius: '18px 18px 4px 18px',
        alignSelf: 'flex-end',
        maxWidth: '75%',
      }
    : {
        background: '#ffffff',
        color: '#2f3745',
        borderRadius: '18px 18px 18px 4px',
        boxShadow: '0 12px 30px rgba(8, 8, 8, 0.07)',
        alignSelf: 'flex-start',
        maxWidth: '75%',
      }

  const isCardMessage = message.message_type === 'card' && message.metadata?.cards
  const containerBubbleStyle = isCardMessage
    ? {
        ...bubbleStyle,
        maxWidth: '100%',
        width: '100%',
        padding: '8px',
      }
    : {
        ...bubbleStyle,
        padding: '9px 13px',
        wordBreak: 'break-word',
      }

  const sendValue = (value: string | number, display?: string) => {
    if (display !== undefined) {
      onQuickReply({ value: String(value), display: String(display) })
      return
    }
    onQuickReply(String(value))
  }

  const handleCardButtonClick = (btn: CardButton | string, card: CardData, cardIndex?: number) => {
    if (!onQuickReply || !btn) return

    if (typeof btn === 'string') {
      sendValue(btn, card?.title || btn)
      return
    }

    if (btn.payload) {
      try {
        const parsed = JSON.parse(btn.payload)
        const variantId = parsed?.variant_id ?? parsed?.variationId
        if (variantId !== undefined && variantId !== null) {
          const payloadForFlow = {
            ...parsed,
            variant_id: parsed?.variant_id ?? parsed?.variationId,
            variationId: parsed?.variationId ?? parsed?.variant_id,
            variationName: parsed?.variationName ?? parsed?.variant_name ?? card?.title,
            variant_name: parsed?.variant_name ?? parsed?.variationName ?? card?.title,
            title: card?.title || parsed?.title,
          }
          sendValue(JSON.stringify(payloadForFlow), card?.title || btn.caption || btn.label || btn.text)
          return
        }
        const serviceId = parsed?.service_id ?? parsed?.serviceId
        if (serviceId !== undefined && serviceId !== null) {
          const payloadForFlow = {
            ...parsed,
            service_id: parsed?.service_id ?? parsed?.serviceId,
            serviceId: parsed?.serviceId ?? parsed?.service_id,
            service_name: parsed?.service_name ?? parsed?.serviceName ?? card?.title,
            serviceName: parsed?.serviceName ?? parsed?.service_name ?? card?.title,
            title: card?.title || parsed?.title,
          }
          sendValue(JSON.stringify(payloadForFlow), card?.title || btn.caption || btn.label || btn.text)
          return
        }
        if (parsed && parsed.appointment_time !== undefined && parsed.appointment_time !== null) {
          sendValue(parsed.appointment_time, parsed.appointment_time)
          return
        }
        if (parsed && parsed.appointmentTime !== undefined && parsed.appointmentTime !== null) {
          sendValue(parsed.appointmentTime, parsed.appointmentTime)
          return
        }
      } catch {
        // Ignore parse errors and continue with fallback fields.
      }
      sendValue(btn.payload, card?.title || btn.caption || btn.label || btn.text)
      return
    }

    const caption = String(btn.caption || btn.label || btn.text || '').toLowerCase()
    const isBookNow = caption.includes('book')

    if ((btn.type === 'url' || btn.url) && btn.url && isBookNow) {
      try {
        const u = new URL(btn.url)
        const variantFromUrl =
          u.searchParams.get('variant_id') ||
          u.searchParams.get('variantId') ||
          u.searchParams.get('id')
        if (variantFromUrl) {
          sendValue(variantFromUrl, card?.title || btn.caption || btn.label || btn.text)
          return
        }
      } catch {
        // Ignore malformed URLs and fallback below.
      }

      const variantFromCard = card?.variant_id
      if (variantFromCard !== undefined && variantFromCard !== null) {
        sendValue(variantFromCard, card?.title || btn.caption || btn.label || btn.text)
        return
      }

      if (typeof cardIndex === 'number') {
        sendValue(cardIndex + 1, card?.title || btn.caption || btn.label || btn.text)
        return
      }
    }

    if ((btn.type === 'url' || btn.url) && btn.url) {
      window.open(btn.url, '_blank', 'noopener,noreferrer')
      return
    }

    sendValue(btn.value || btn.caption || btn.label || btn.text || '', card?.title)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        marginBottom: 8,
      }}
    >
      {isHuman && (
        <span
          style={{
            fontSize: 11,
            color: '#b54812',
            fontWeight: 600,
            marginBottom: 3,
            marginLeft: 4,
          }}
        >
          {humanLabel}
        </span>
      )}

      <div style={containerBubbleStyle as CSSProperties}>
        {isCardMessage ? (
          <div style={{ width: '100%', minWidth: 0 }}>
            <CardCarousel cards={message.metadata.cards} onButtonClick={handleCardButtonClick} />
          </div>
        ) : message.message_type === 'images' ? (
          (() => {
            const uploadedImages: string[] = Array.isArray(message.metadata?.uploaded_images)
              ? (message.metadata.uploaded_images as string[])
              : []
            return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
            {uploadedImages.map((url: string, idx: number) => (
              <a
                key={`${String(url)}-${idx}`}
                href={String(url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block' }}
              >
                <img
                  src={String(url)}
                  alt={`Uploaded vehicle ${idx + 1}`}
                  style={{
                    width: '76px',
                    height: '76px',
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    display: 'block',
                  }}
                />
              </a>
            ))}
            {message.content ? (
              <span style={{ gridColumn: '1 / -1', fontSize: 13, lineHeight: 1.4 }}>{message.content}</span>
            ) : null}
          </div>
            )
          })()
        ) : (
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>{message.content}</span>
        )}
      </div>

      {/* Button list for message_type === 'button' */}
      {message.message_type === 'button' && message.metadata?.buttons && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, width: '100%' }}>
          {message.metadata.buttons.map((btn: { label?: string; value?: string }, i: number) => (
            <button
              key={i}
              onClick={() => onQuickReply(String(btn.value || btn.label || ''))}
              disabled={quickRepliesDisabled}
              style={{
                background: 'white',
                border: '1.5px solid #f36f21',
                color: '#df5e18',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                cursor: quickRepliesDisabled ? 'not-allowed' : 'pointer',
                opacity: quickRepliesDisabled ? 0.5 : 1,
                textAlign: 'center',
                fontWeight: 500,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Quick replies shown below last bot message */}
      {message.message_type === 'quick_reply' && isQuickReplyActive && message.metadata?.options && (
        <QuickReplies
          options={message.metadata.options}
          onSelect={onQuickReply}
          disabled={quickRepliesDisabled}
        />
      )}

      <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, marginLeft: isUser ? 0 : 4, marginRight: isUser ? 4 : 0 }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  )
}
