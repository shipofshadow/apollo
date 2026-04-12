/**
 * VariationGallery
 *
 * Public-facing component that displays:
 *  - Variation selector tabs (with price shown on each tab)
 *  - Two-column card for the selected variation (slide-up on tab switch):
 *      Left  – cross-fade image carousel with expanding pill dots + thumbnails
 *      Right – description paragraph + specifications table
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ServiceVariation, ProductVariation } from '../types';
import { formatPrice } from '../utils/formatPrice';

type Variation = ServiceVariation | ProductVariation;

interface Props {
  variations: Variation[];
  selectedColor?: string | null;
  onSelectColor?: (color: string | null) => void;
  onVariationChange?: (variation: Variation) => void;
}

export default function VariationGallery({
  variations,
  selectedColor,
  onSelectColor,
  onVariationChange,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgIdx,    setImgIdx]    = useState(0);

  if (!variations || variations.length === 0) return null;

  const active = variations[activeIdx];
  const availableColors = Array.from(new Set([
    ...(active?.colors ?? []),
    ...Object.keys(active?.colorImages ?? {}),
  ])).filter(Boolean);

  const getColorImages = (color: string): string[] => {
    const map = active?.colorImages ?? {};
    const exact = map[color];
    if (Array.isArray(exact)) {
      return exact;
    }

    const normalized = color.trim().toLowerCase();
    const entry = Object.entries(map).find(([key]) => key.trim().toLowerCase() === normalized);
    if (entry && Array.isArray(entry[1])) {
      return entry[1];
    }
    return [];
  };

  const colorImages = selectedColor ? getColorImages(selectedColor) : [];
  const images = colorImages.length > 0 ? colorImages : (active?.images ?? []);

  useEffect(() => {
    if (active && onVariationChange) {
      onVariationChange(active);
    }
  }, [active, onVariationChange]);

  useEffect(() => {
    setImgIdx(0);
  }, [selectedColor, activeIdx]);

  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setImgIdx(i => (i + 1) % images.length);

  const selectVariation = (idx: number) => {
    setActiveIdx(idx);
    setImgIdx(0);
    if (onSelectColor) {
      onSelectColor(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Variation selector tabs ─────────────────────────────────────── */}
     <div className="grid grid-cols-2 gap-2">
        {variations.map((v, idx) => {
          const isActive = idx === activeIdx;
          return (
            <button
              key={v.id}
              onClick={() => selectVariation(idx)}
              className={`flex flex-col items-start w-full p-3 border rounded transition-colors text-left ${
                isActive
                  ? 'border-brand-orange bg-[#181818]'
                  : 'border-gray-800 bg-[#121212] hover:border-gray-600'
              }`}
            >
              <span className={`text-[0.90rem] font-bold uppercase tracking-widest mb-1 ${
                isActive ? 'text-brand-orange' : 'text-gray-500'
              }`}>
                {v.name}
              </span>
              <span className="text-gray-200 font-mono text-sm">
                {v.price ? formatPrice(v.price) : 'CONTACT'}
              </span>
            </button>
          );
        })}
      </div>
      {/* ── Selected variation card – animates in on tab switch ─────────── */}
      {active && (
        <div
          key={activeIdx}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] rounded-sm p-5 md:p-6 animate-slideUp shadow-[0_24px_50px_rgba(0,0,0,0.25)]"
        >
          {/* ── Left column – cross-fade image carousel ───────────────────── */}
          <div className="space-y-2">
            {images.length > 0 ? (
              <>
                {/* Main image — all images stacked, cross-fade via opacity */}
                <div className="relative aspect-[4/3] w-full rounded-sm overflow-hidden border border-white/[0.1] bg-brand-dark group shadow-[0_16px_30px_rgba(0,0,0,0.35)]">
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
                            ? 'border-brand-orange opacity-100 shadow-[0_0_0_2px_rgba(243,111,33,0.2)]'
                            : 'border-white/[0.07] opacity-50 hover:opacity-80 hover:border-white/25'
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.14em] font-bold text-gray-500">Selected Option</p>
              {active.price && (
                <span className="text-brand-orange font-bold text-sm">{formatPrice(active.price)}</span>
              )}
            </div>

            <h3 className="text-white text-xl font-display font-black uppercase tracking-tight leading-tight">
              {active.name}
            </h3>

            {active.description && (
              <p className="text-gray-400 text-sm leading-[1.75] font-light">{active.description}</p>
            )}

            {availableColors.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-gray-500">
                  Available Colors
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => {
                    const isActive = selectedColor === color;
                    const colorPreviewImages = getColorImages(color);
                    const previewUrl = colorPreviewImages[0] ?? active?.images?.[0] ?? null;
                    const hasPreview = Boolean(previewUrl);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onSelectColor?.(isActive ? null : color)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-sm text-xs font-bold uppercase tracking-widest transition-all ${
                          isActive
                            ? 'border-brand-orange bg-brand-orange/10 text-brand-orange shadow-[0_6px_16px_rgba(243,111,33,0.2)]'
                            : 'border-white/[0.1] text-gray-300 hover:border-brand-orange/40 hover:text-white hover:bg-white/[0.03]'
                        }`}
                      >
                        {hasPreview && (
                          <span className="relative w-6 h-6 rounded-sm overflow-hidden border border-white/10 shrink-0">
                            <img
                              src={previewUrl as string}
                              alt={`${color} preview`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {colorPreviewImages.length > 1 && (
                              <span className="absolute -top-px -right-px text-[9px] bg-black/75 text-white px-1 leading-4">
                                {colorPreviewImages.length}
                              </span>
                            )}
                          </span>
                        )}
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {active.specs && active.specs.length > 0 && (
              <div className="border border-white/[0.08] rounded-sm overflow-hidden bg-black/20">
                <div className="px-4 py-2 border-b border-white/[0.07] bg-black/20">
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

