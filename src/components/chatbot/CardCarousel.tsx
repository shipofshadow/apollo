import type { CardButton, CardData } from './types'

type CardCarouselProps = {
  cards?: CardData[]
  onButtonClick?: (button: CardButton, card: CardData, cardIndex: number) => void
}

function parseSubtitle(subtitle?: string) {
  const text = (subtitle ?? '').trim()
  if (!text) {
    return { price: '', details: '', specsInline: '' }
  }

  const parts = text.split('|').map((p) => p.trim()).filter(Boolean)
  let price = ''
  let details = ''
  let specsInline = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (!price && lower.startsWith('price:')) {
      price = part.replace(/^price:\s*/i, '').trim()
      continue
    }
    if (!specsInline && lower.startsWith('specs:')) {
      specsInline = part.replace(/^specs:\s*/i, '').trim()
      continue
    }
    if (!details) details = part
  }

  return { price, details, specsInline }
}

function formatPesoPrice(price: string): string {
  const raw = price.trim()
  if (!raw) return ''
  if (/^₱|^PHP\s*/i.test(raw)) return raw

  const numeric = raw.replace(/,/g, '')
  if (/^\d+(\.\d+)?$/.test(numeric)) {
    const amount = Number(numeric)
    if (Number.isFinite(amount)) {
      return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
    }
  }

  return `₱${raw}`
}

function splitSpecs(specsSummary?: string, subtitle?: string): string[] {
  const merged = (specsSummary || parseSubtitle(subtitle).specsInline || '').trim()
  if (!merged) return []
  return merged
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function CardCarousel({ cards, onButtonClick }: CardCarouselProps) {
  if (!cards || cards.length === 0) return null

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-1 sm:gap-3">
      {cards.map((card, index) => {
        const parsed = parseSubtitle(card.subtitle)
        const displayPrice = formatPesoPrice(parsed.price)
        const specs = splitSpecs(card.specs_summary, card.subtitle)
        return (
        <div
          key={`${card.title || 'card'}-${index}`}
          className="w-[78vw] min-w-[78vw] max-w-[18.5rem] snap-start overflow-hidden rounded-2xl border border-orange-200/70 bg-white shadow-[0_14px_30px_rgba(17,24,39,0.10)] sm:w-64 sm:min-w-64 sm:max-w-none"
        >
          {card.image_url ? (
            <img
              src={card.image_url}
              alt={card.title || 'Chat card image'}
              className="block h-28 w-full object-cover sm:h-32"
            />
          ) : (
            <div className="grid h-28 w-full place-items-center bg-slate-100 text-slate-400 sm:h-32">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
            </div>
          )}

          <div className="space-y-2.5 p-2.5 sm:p-3">
            {card.title && (
              <div className="text-[13px] font-semibold normal-case tracking-normal text-slate-900 line-clamp-2 sm:text-sm">
                {card.title}
              </div>
            )}

            {displayPrice && (
              <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-800 sm:px-2.5 sm:text-[11px]">
                {displayPrice}
              </div>
            )}

            {(parsed.details || card.description) && (
              <p className="text-[11px] leading-4 text-slate-600 line-clamp-3 sm:text-xs sm:leading-5">
                {parsed.details || card.description}
              </p>
            )}

            {specs.length > 0 && (
              <div className="space-y-1 rounded-lg border border-orange-100 bg-orange-50/70 px-2 py-1.5 sm:px-2.5 sm:py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800/80">Specs</p>
                <ul className="space-y-1">
                  {specs.map((spec, specIndex) => (
                    <li key={`${spec}-${specIndex}`} className="text-[10px] leading-4 text-orange-900/90 sm:text-[11px]">
                      • {spec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.buttons && card.buttons.length > 0 && (
              <div className="space-y-2 pt-1 sm:pt-1.5">
                {card.buttons.map((button, buttonIndex) => (
                  <button
                    key={`${button.caption || button.label || button.text || 'button'}-${buttonIndex}`}
                    onClick={() => onButtonClick?.(button, card, index)}
                    className="w-full rounded-xl bg-brand-orange px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-orange-600 sm:text-xs sm:tracking-wider"
                  >
                    {button.caption || button.label || button.text || 'Select'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}