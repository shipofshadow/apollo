/**
 * VariationGallery
 *
 * Public-facing component that displays:
 *  - Variation selector tabs (with price shown on each tab)
 *  - Two-column card for the selected variation (slide-up on tab switch):
 *      Left  – cross-fade image carousel with expanding pill dots + thumbnails
 *      Right – description paragraph + specifications table
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ServiceVariation, ProductVariation } from '../types';

type Variation = ServiceVariation | ProductVariation;

interface Props {
  variations: Variation[];
}

export default function VariationGallery({ variations }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgIdx,    setImgIdx]    = useState(0);

  if (!variations || variations.length === 0) return null;

  const active = variations[activeIdx];
  const images = active?.images ?? [];

  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setImgIdx(i => (i + 1) % images.length);

  const selectVariation = (idx: number) => {
    setActiveIdx(idx);
    setImgIdx(0);
  };

  return (
    <div className="space-y-4">
      {/* ── Variation selector tabs ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {variations.map((v, idx) => (
          <button
            key={v.id}
            onClick={() => selectVariation(idx)}
            /* min-h-[3.5rem] keeps all tabs the same height whether or not a price sub-label is shown */
            className={`flex flex-col items-start min-h-[3.5rem] px-4 py-2.5 border rounded-sm cursor-pointer transition-all text-left ${
              idx === activeIdx
                ? 'border-brand-orange bg-brand-orange/10 shadow-[0_4px_16px_rgba(243,111,33,0.25)]'
                : 'border-white/[0.07] bg-brand-dark hover:border-white/20 hover:bg-brand-dark'
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-[0.08em] leading-tight ${
              idx === activeIdx ? 'text-brand-orange' : 'text-white'
            }`}>
              {v.name}
            </span>
            {v.price && (
              <span className="text-[0.7rem] font-semibold text-gray-500 mt-0.5">
                From {v.price}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Selected variation card – animates in on tab switch ─────────── */}
      {active && (
        <div
          key={activeIdx}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-brand-dark/40 border border-white/[0.07] rounded-sm p-5 animate-slideUp"
        >
          {/* ── Left column – cross-fade image carousel ───────────────────── */}
          <div className="space-y-2">
            {images.length > 0 ? (
              <>
                {/* Main image — all images stacked, cross-fade via opacity */}
                <div className="relative aspect-[4/3] w-full rounded-sm overflow-hidden border border-white/[0.07] bg-brand-dark group">
                  {images.map((url, i) => (
                    <img
                      key={url + i}
                      src={url}
                      alt={`${active.name} – image ${i + 1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                        i === imgIdx ? 'opacity-100' : 'opacity-0'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                  ))}

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImg}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-brand-darker/70 hover:bg-brand-orange border border-white/10 hover:border-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={nextImg}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-brand-darker/70 hover:bg-brand-orange border border-white/10 hover:border-brand-orange text-white rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Expanding pill dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setImgIdx(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 border-none cursor-pointer ${
                              i === imgIdx
                                ? 'w-5 bg-brand-orange'
                                : 'w-1.5 bg-white/30 hover:bg-white/60'
                            }`}
                            aria-label={`Go to image ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Counter badge */}
                  {images.length > 1 && (
                    <span className="absolute top-2.5 right-2.5 bg-brand-darker/75 backdrop-blur-sm text-white text-[0.65rem] font-bold tracking-wide px-2 py-0.5 rounded-sm z-10">
                      {imgIdx + 1} / {images.length}
                    </span>
                  )}
                </div>

                {/* Thumbnail strip */}
                {images.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIdx(i)}
                        className={`shrink-0 w-14 h-14 rounded-sm overflow-hidden border-[1.5px] transition-all ${
                          i === imgIdx
                            ? 'border-brand-orange opacity-100'
                            : 'border-white/[0.07] opacity-50 hover:opacity-80'
                        }`}
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-[4/3] w-full rounded-sm bg-brand-dark/60 border border-white/[0.07] flex items-center justify-center">
                <span className="text-gray-600 text-xs uppercase tracking-widest">No images</span>
              </div>
            )}
          </div>

          {/* ── Right column – description + specs ────────────────────────── */}
          <div className="flex flex-col gap-4">
            {active.description && (
              <p className="text-gray-400 text-sm leading-[1.75] font-light">{active.description}</p>
            )}

            {active.specs && active.specs.length > 0 && (
              <div className="border border-white/[0.07] rounded-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-white/[0.07] bg-brand-dark">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-gray-500">
                    Specifications
                  </span>
                </div>
                <table className="w-full">
                  <tbody>
                    {active.specs.map((spec, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? '' : 'bg-white/[0.02]'}
                      >
                        <td className="px-4 py-2.5 text-gray-500 text-xs font-medium w-[45%]">{spec.label}</td>
                        <td className="px-4 py-2.5 text-gray-200 text-xs">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

