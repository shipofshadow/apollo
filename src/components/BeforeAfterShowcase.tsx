import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { MoveHorizontal, ChevronRight, Loader2 } from 'lucide-react';
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
  const [splitPercent, setSplitPercent] = useState(50);

  useEffect(() => {
    if (propCases) return;
    let cancelled = false;
    fetchBeforeAfterItemsApi()
      .then(({ items }) => {
        if (!cancelled) setCases(buildComparisonCases(items));
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [propCases]);

  const active = useMemo(() => cases[activeIndex] || null, [cases, activeIndex]);

  const selectCase = (idx: number) => {
    setActiveIndex(idx);
    setSplitPercent(50);
  };

  if (loading) return (
    <div className="h-[600px] flex items-center justify-center bg-brand-dark">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  );

  if (!active) return null;

  return (
    <section className="relative py-24 bg-[#0a0a0a] overflow-hidden border-y border-white/5">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-orange/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-[2px] bg-brand-orange" />
              <span className="text-brand-orange text-xs font-bold uppercase tracking-[0.3em]">
                Transformation Gallery
              </span>
            </div>
            <h2 className="text-white text-4xl md:text-6xl font-display font-black uppercase tracking-tighter leading-[0.9]">
              Visual <span className="text-brand-orange">Precision</span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base mt-6 leading-relaxed max-w-xl">
              Drag the interactive slider to analyze the meticulous attention to detail 
              and technical superiority of our automotive finishes.
            </p>
          </div>

          <div className="hidden lg:flex items-baseline gap-2 font-display italic">
            <span className="text-brand-orange text-6xl font-black">{activeIndex + 1}</span>
            <span className="text-gray-700 text-3xl font-black">/ {cases.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
          {/* Main Slider Area */}
          <div className="xl:col-span-8 flex flex-col">
            <div className="relative aspect-[16/10] xl:aspect-video rounded-sm border border-white/10 bg-black overflow-hidden shadow-2xl group">
              {/* Labels */}
              <div className="absolute top-6 left-6 z-30 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In-Take State</p>
                </div>
              </div>
              <div className="absolute top-6 right-6 z-30 pointer-events-none">
                <div className="bg-brand-orange/80 backdrop-blur-md border border-white/20 px-4 py-2 rounded-sm shadow-lg">
                  <p className="text-[10px] font-bold text-white uppercase tracking-widest">Final Finish</p>
                </div>
              </div>

              {/* Slider Images */}
              <div className="absolute inset-0 w-full h-full">
                <img
                  src={active.beforeUrl}
                  alt="Original"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>

              <div
                className="absolute inset-0 z-10 overflow-hidden border-r-2 border-white/50"
                style={{ width: `${splitPercent}%` }}
              >
                <img
                  src={active.afterUrl}
                  alt="Transformed"
                  className="absolute inset-0 w-full h-full object-cover max-w-none"
                  style={{ width: `${100 * (100 / splitPercent)}%` }}
                  draggable={false}
                />
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none flex items-center justify-center"
                style={{ left: `${splitPercent}%` }}
              >
                <div className="relative flex items-center justify-center w-1 h-full">
                   <div className="absolute w-12 h-12 rounded-full border-2 border-white bg-brand-orange text-white flex items-center justify-center shadow-[0_0_30px_rgba(243,111,33,0.6)] group-hover:scale-110 transition-transform cursor-col-resize pointer-events-auto">
                    <MoveHorizontal className="w-5 h-5" />
                    {/* Pulsing effect */}
                    <div className="absolute inset-0 rounded-full bg-brand-orange animate-ping opacity-20" />
                  </div>
                </div>
              </div>

              {/* Hidden Range Input */}
              <input
                type="range"
                min={0}
                max={100}
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-col-resize z-40"
              />
            </div>

            {/* Case Info Footer */}
            <div className="mt-6 p-6 bg-white/[0.02] border border-white/5 rounded-sm">
              <h3 className="text-white text-xl font-bold uppercase tracking-wide">{active.title}</h3>
              {active.description && (
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">{active.description}</p>
              )}
            </div>
          </div>

          {/* Sidebar Project List */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Project Selection</p>
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {cases.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectCase(idx)}
                    className={`group flex items-center gap-4 p-3 rounded-sm border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-brand-orange border-brand-orange' 
                        : 'bg-white/[0.03] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="relative w-20 h-14 shrink-0 overflow-hidden rounded-sm">
                      <img
                        src={item.afterUrl}
                        alt=""
                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${!isSelected && 'opacity-60'}`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-xs font-bold uppercase tracking-wide truncate ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                        {item.title}
                      </p>
                      <p className={`text-[10px] mt-1 ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                        Case Study 0{idx + 1}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-white translate-x-1' : 'text-gray-700'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(243, 111, 33, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 111, 33, 0.5);
        }
      `}</style>
    </section>
  );
}