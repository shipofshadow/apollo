import { useState } from 'react'
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
  const [specsModalIndex, setSpecsModalIndex] = useState<number | null>(null)

  if (!cards || cards.length === 0) return null

  const modalCard = specsModalIndex !== null ? cards[specsModalIndex] : null
  const modalSpecs = modalCard ? splitSpecs(modalCard.specs_summary, modalCard.subtitle) : []

  return (
    <>
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

              <div className="space-y-2 pt-1 sm:pt-1.5">
                {specs.length > 0 && (
                  <button
                    onClick={() => setSpecsModalIndex(index)}
                    className="w-full rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100 sm:text-xs sm:tracking-wider"
                  >
                    Show Specs
                  </button>
                )}

                {card.buttons && card.buttons.length > 0 && (
                  <>
                    {card.buttons.map((button, buttonIndex) => (
                      <button
                        key={`${button.caption || button.label || button.text || 'button'}-${buttonIndex}`}
                        onClick={() => onButtonClick?.(button, card, index)}
                        className="w-full rounded-xl bg-brand-orange px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-orange-600 sm:text-xs sm:tracking-wider"
                      >
                        {button.caption || button.label || button.text || 'Select'}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {specsModalIndex !== null && modalCard && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setSpecsModalIndex(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSpecsModalIndex(null) }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="specs-modal-title"
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Specifications</p>
                {modalCard.title && (
                  <h3 id="specs-modal-title" className="mt-0.5 text-sm font-semibold text-slate-900">{modalCard.title}</h3>
                )}
              </div>
              <button
                onClick={() => setSpecsModalIndex(null)}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <ul className="space-y-2">
              {modalSpecs.map((spec, i) => (
                <li key={`${spec}-${i}`} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 text-orange-500">•</span>
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}