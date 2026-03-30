import { useEffect, useMemo, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { fetchBeforeAfterItemsApi } from '../services/api';
import type { BeforeAfterItem } from '../types';

export type ComparisonCase = {
  id: number | string;
  title: string;
  beforeUrl: string;
  afterUrl: string;
  description?: string;
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


interface BeforeAfterShowcaseProps {
  cases?: ComparisonCase[];
}

export default function BeforeAfterShowcase({ cases: propCases }: BeforeAfterShowcaseProps) {
  const [loading, setLoading] = useState(!propCases);
  const [cases, setCases] = useState<ComparisonCase[]>(propCases || []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [splitPercent, setSplitPercent] = useState(52);

  useEffect(() => {
    if (propCases) return;
    let cancelled = false;
    fetchBeforeAfterItemsApi()
      .then(({ items }) => {
        if (cancelled) return;
        setCases(buildComparisonCases(items));
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [propCases]);

  const active = useMemo(() => {
    if (cases.length === 0) return null;
    return cases[Math.min(activeIndex, cases.length - 1)];
  }, [cases, activeIndex]);

  const selectCase = (idx: number) => {
    setActiveIndex(idx);
    setSplitPercent(52);
  };

  if (loading) return null;

  if (!active) return null;

  return (
    <section className="relative overflow-hidden py-16 md:py-20 border-y border-gray-800 bg-[radial-gradient(circle_at_10%_10%,rgba(243,111,33,0.14),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.06),transparent_30%),#0f0f0f]">
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-brand-orange/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-0 h-56 w-56 rounded-full bg-red-500/10 blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-brand-orange text-[11px] font-bold uppercase tracking-[0.22em] mb-3">
              Before & After
            </p>
            <h2 className="text-white text-3xl md:text-5xl font-display font-black uppercase tracking-tight leading-[0.95]">
              Slide To Compare
            </h2>
            <p className="text-gray-400 text-sm md:text-base mt-4 max-w-2xl">
              Drag the divider to view real check-in condition versus final finish on each project.
            </p>
          </div>

          <div className="self-start md:self-auto px-3 py-2 rounded-sm border border-gray-700 bg-black/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Viewing</p>
            <p className="text-sm font-semibold text-white">Case {activeIndex + 1} of {cases.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 md:gap-6 items-start">
          <div className="rounded-sm border border-gray-700 bg-black/60 backdrop-blur-sm overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
            <div className="relative aspect-[16/10] select-none">
              <img
                src={active.beforeUrl}
                alt={`${active.title} before`}
                className="absolute inset-0 w-full h-full object-cover"
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
                className="absolute top-0 bottom-0 w-0.5 bg-white/95 shadow-[0_0_20px_rgba(243,111,33,0.7)]"
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

            <div className="p-4 md:p-5 border-t border-gray-800 bg-brand-dark/90 space-y-3">
              <div>
                <p className="text-white text-sm md:text-base font-semibold leading-tight">{active.title}</p>
                {active.description && (
                  <p className="text-gray-400 text-xs md:text-sm mt-1.5 line-clamp-2">{active.description}</p>
                )}
              </div>

              <p className="text-[11px] text-gray-500">Drag the divider to compare before and after.</p>
            </div>
          </div>

          <div className="rounded-sm border border-gray-800 bg-brand-dark/80 p-2 md:p-3">
            <div className="mb-2 px-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Project Cases</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-1 gap-2">
              {cases.map((item, idx) => {
                const selected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectCase(idx)}
                    className={[
                      'group w-full text-left rounded-sm border overflow-hidden',
                      selected
                        ? 'border-brand-orange bg-brand-orange/10'
                        : 'border-gray-700 bg-brand-dark hover:border-gray-500',
                    ].join(' ')}
                  >
                    <div className="relative h-20 xl:h-16">
                      <img
                        src={item.afterUrl}
                        alt={`${item.title} preview`}
                        className="h-full w-full object-cover opacity-80 group-hover:opacity-95"
                        referrerPolicy="no-referrer"
                        draggable={false}
                      />
                      <span className="absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded-sm text-[9px] font-bold tracking-widest uppercase bg-black/75 border border-gray-700 text-gray-300">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className={`text-xs font-semibold line-clamp-2 ${selected ? 'text-white' : 'text-gray-200'}`}>
                        {item.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
