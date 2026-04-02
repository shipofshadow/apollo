import type { CardButton, CardData } from './ChatWidget'

type CardCarouselProps = {
  cards?: CardData[]
  onButtonClick?: (button: CardButton, card: CardData, cardIndex: number) => void
}

export default function CardCarousel({ cards, onButtonClick }: CardCarouselProps) {
  if (!cards || cards.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        gap: 10,
        padding: '4px 0',
      }}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            width: 200,
            minWidth: 200,
            border: '1px solid #fde7d7',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'white',
            boxShadow: '0 18px 38px rgba(17, 24, 39, 0.09)',
            flexShrink: 0,
          }}
        >
          {card.image_url ? (
            <img
              src={card.image_url}
              alt={card.title || ''}
              style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: 120,
                background: '#E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#9CA3AF">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </div>
          )}
          <div style={{ padding: 10 }}>
            {card.title && (
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}>
                {card.title}
              </div>
            )}
            {card.description && (
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.4 }}>
                {card.description}
              </div>
            )}
            {card.buttons && card.buttons.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {card.buttons.map((btn, j) => (
                  <button
                    key={j}
                    onClick={() => onButtonClick && onButtonClick(btn, card, i)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px',
                      marginTop: j > 0 ? 4 : 0,
                      background: '#f36f21',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                      textAlign: 'center',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#df5e18')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#f36f21')}
                  >
                    {btn.caption || btn.label || btn.text || 'Select'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
