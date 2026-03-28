/**
 * VariationGallery
 *
 * Public-facing component that displays:
 *  - Variation selector tabs
 *  - Scrolling / paginated image carousel for the selected variation
 *  - Specs table for the selected variation
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ServiceVariation, ProductVariation } from '../types';

type Variation = ServiceVariation | ProductVariation;

interface Props {
  variations: Variation[];
}

export default function VariationGallery({ variations }: Props) {
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [imgIdx,     setImgIdx]     = useState(0);

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
    <div className="space-y-6">
      {/* ── Variation selector tabs ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {variations.map((v, idx) => (
          <button
            key={v.id}
            onClick={() => selectVariation(idx)}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest border transition-colors rounded-sm ${
              idx === activeIdx
                ? 'bg-brand-orange text-white border-brand-orange'
                : 'bg-transparent text-gray-400 border-gray-700 hover:border-brand-orange hover:text-white'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-6">
          {/* ── Variation price / description ───────────────────────────── */}
          {(active.price || active.description) && (
            <div className="flex flex-wrap items-center gap-4">
              {active.price && (
                <span className="bg-brand-orange/10 border border-brand-orange/30 text-brand-orange font-bold px-4 py-2 rounded-sm text-sm uppercase tracking-widest">
                  {active.price}
                </span>
              )}
              {active.description && (
                <p className="text-gray-400 text-sm leading-relaxed">{active.description}</p>
              )}
            </div>
          )}

          {/* ── Image carousel ──────────────────────────────────────────── */}
          {images.length > 0 && (
            <div className="space-y-3">
              {/* Main image */}
              <div className="relative aspect-video md:aspect-square w-full rounded-sm overflow-hidden border border-gray-800 bg-brand-dark group">
                <img
                  key={images[imgIdx]}
                  src={images[imgIdx]}
                  alt={`${active.name} – image ${imgIdx + 1}`}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  referrerPolicy="no-referrer"
                />

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImg}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImg}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-brand-orange text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Dot indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImgIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === imgIdx ? 'bg-brand-orange' : 'bg-white/40 hover:bg-white/70'
                          }`}
                          aria-label={`Go to image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Counter badge */}
                {images.length > 1 && (
                  <span className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-sm">
                    {imgIdx + 1} / {images.length}
                  </span>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`shrink-0 w-16 h-16 rounded-sm overflow-hidden border-2 transition-colors ${
                        i === imgIdx ? 'border-brand-orange' : 'border-gray-700 hover:border-gray-500'
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
            </div>
          )}

          {/* ── Specs table ─────────────────────────────────────────────── */}
          {active.specs && active.specs.length > 0 && (
            <div className="bg-brand-gray/20 border border-gray-800 rounded-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <h4 className="text-sm font-bold uppercase tracking-widest text-white">
                  Specifications
                </h4>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {active.specs.map((spec, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? 'bg-transparent' : 'bg-brand-dark/40'}
                    >
                      <td className="px-5 py-3 text-gray-400 font-bold w-2/5">{spec.label}</td>
                      <td className="px-5 py-3 text-white">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
