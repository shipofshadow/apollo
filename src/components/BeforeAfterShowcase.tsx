import { useEffect, useMemo, useState } from 'react';
import { Loader2, MoveHorizontal } from 'lucide-react';
import { fetchBeforeAfterItemsApi } from '../services/api';
import type { BeforeAfterItem } from '../types';
import heroImage from '../assets/hero.png';

type ComparisonCase = {
  id: number | string;
  title: string;
  beforeUrl: string;
  afterUrl: string;
  description?: string;
  synthetic?: boolean;
};

function buildComparisonCases(items: BeforeAfterItem[]): ComparisonCase[] {
  return items
    .filter(item => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      beforeUrl: item.beforeImageUrl,
      afterUrl: item.afterImageUrl,
    }))
    .slice(0, 8);
}

const FALLBACK_CASES: ComparisonCase[] = [
  {
    id: 'fallback-1',
    title: 'Headlight Restoration Preview',
    beforeUrl: heroImage,
    afterUrl: heroImage,
    synthetic: true,
  },
  {
    id: 'fallback-2',
    title: 'Retrofit Beam Alignment Preview',
    beforeUrl: heroImage,
    afterUrl: heroImage,
    synthetic: true,
  },
];

export default function BeforeAfterShowcase() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ComparisonCase[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [splitPercent, setSplitPercent] = useState(52);

  useEffect(() => {
    let cancelled = false;
    fetchBeforeAfterItemsApi()
      .then(({ items }) => {
        if (cancelled) return;
        const built = buildComparisonCases(items);
        setCases(built.length > 0 ? built : FALLBACK_CASES);
      })
      .catch(() => {
        if (!cancelled) setCases(FALLBACK_CASES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(() => {
    if (cases.length === 0) return null;
    return cases[Math.min(activeIndex, cases.length - 1)];
  }, [cases, activeIndex]);

  if (loading) {
    return (
      <section className="py-20 bg-brand-darker border-y border-gray-800">
        <div className="container mx-auto px-4 md:px-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
        </div>
      </section>
    );
  }

  if (!active) return null;

  return (
    <section className="py-20 bg-brand-darker border-y border-gray-800">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mb-8">
          <p className="text-brand-orange text-[11px] font-bold uppercase tracking-[0.22em] mb-3">
            Interactive Transformation
          </p>
          <h2 className="text-white text-3xl md:text-5xl font-display font-black uppercase tracking-tight">
            Drag To Reveal The Finish
          </h2>
          <p className="text-gray-400 text-sm md:text-base mt-4">
            Slide left and right to compare check-in condition versus final output. Customers can instantly see the craftsmanship.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="relative rounded-sm border border-gray-700 overflow-hidden bg-black">
            <div className="relative aspect-[16/10] select-none">
              <img
                src={active.beforeUrl}
                alt={`${active.title} before`}
                className="absolute inset-0 w-full h-full object-cover"
                style={active.synthetic ? { filter: 'grayscale(1) contrast(0.9) brightness(0.7)' } : undefined}
                referrerPolicy="no-referrer"
                draggable={false}
              />

              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
              >
                <img
                  src={active.afterUrl}
                  alt={`${active.title} after`}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/95 shadow-[0_0_20px_rgba(243,111,33,0.6)]"
                style={{ left: `${splitPercent}%` }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-white bg-brand-orange text-white flex items-center justify-center shadow-lg">
                  <MoveHorizontal className="w-4 h-4" />
                </div>
              </div>

              <div className="absolute left-3 top-3 bg-black/70 border border-gray-700 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Before
              </div>
              <div className="absolute right-3 top-3 bg-black/70 border border-gray-700 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-300">
                After
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-col-resize"
                aria-label="Before and after comparison slider"
              />
            </div>

            <div className="px-4 py-3 border-t border-gray-800 bg-brand-dark/90">
              <p className="text-white text-sm font-semibold truncate">{active.title}</p>
              {active.description && (
                <p className="text-gray-400 text-xs mt-1 line-clamp-2">{active.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {cases.map((item, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setSplitPercent(52);
                  }}
                  className={[
                    'w-full text-left rounded-sm border px-3 py-3 transition-colors',
                    selected
                      ? 'border-brand-orange bg-brand-orange/10'
                      : 'border-gray-700 bg-brand-dark hover:border-gray-500',
                  ].join(' ')}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-1">
                    Case {idx + 1}
                  </p>
                  <p className="text-sm text-gray-200 line-clamp-2">{item.title}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
