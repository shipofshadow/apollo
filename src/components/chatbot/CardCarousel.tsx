import type { CardButton, CardData } from './types'

type CardCarouselProps = {
  cards?: CardData[]
  onButtonClick?: (button: CardButton, card: CardData, cardIndex: number) => void
}

export default function CardCarousel({ cards, onButtonClick }: CardCarouselProps) {
  if (!cards || cards.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto px-1 py-1">
      {cards.map((card, index) => (
        <div
          key={`${card.title || 'card'}-${index}`}
          className="w-56 min-w-56 overflow-hidden rounded-2xl border border-orange-200/70 bg-white shadow-[0_18px_38px_rgba(17,24,39,0.10)]"
        >
          {card.image_url ? (
            <img
              src={card.image_url}
              alt={card.title || 'Chat card image'}
              className="block h-32 w-full object-cover"
            />
          ) : (
            <div className="grid h-32 w-full place-items-center bg-slate-100 text-slate-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </div>
          )}

          <div className="space-y-2 p-3">
            {card.title && <div className="text-sm font-semibold normal-case tracking-normal text-slate-900">{card.title}</div>}
            {card.description && <div className="text-xs leading-5 text-slate-500">{card.description}</div>}

            {card.buttons && card.buttons.length > 0 && (
              <div className="space-y-2 pt-1">
                {card.buttons.map((button, buttonIndex) => (
                  <button
                    key={`${button.caption || button.label || button.text || 'button'}-${buttonIndex}`}
                    onClick={() => onButtonClick?.(button, card, index)}
                    className="w-full rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-600"
                  >
                    {button.caption || button.label || button.text || 'Select'}
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