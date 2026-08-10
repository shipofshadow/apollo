import { Sparkles, Wrench, CheckCircle2 } from 'lucide-react';
import type { ServiceTypeCategory } from '../types';

interface Props {
  selectedType: ServiceTypeCategory | null;
  onSelect: (type: ServiceTypeCategory) => void;
}

export default function ServiceTypeStep({ selectedType, onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 3 OF 8
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Select Service Type
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          Choose the service category being documented to automatically configure checklist items.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Headlights Option */}
        <button
          type="button"
          onClick={() => onSelect('headlights')}
          className={`p-6 sm:p-8 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer flex flex-col justify-between space-y-6 shadow-xl ${
            selectedType === 'headlights'
              ? 'bg-[#161616] border-brand-orange ring-2 ring-brand-orange/40 shadow-brand-orange/10'
              : 'bg-brand-darker border-gray-800/80 hover:border-gray-700 hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-4 rounded-2xl border transition-all ${
              selectedType === 'headlights'
                ? 'bg-brand-orange text-white border-brand-orange shadow-lg'
                : 'bg-brand-dark border-gray-800 text-brand-orange group-hover:scale-105'
            }`}>
              <Sparkles className="w-8 h-8" />
            </div>

            {selectedType === 'headlights' && (
              <span className="flex items-center gap-1 text-xs font-mono font-bold uppercase text-brand-orange bg-brand-orange/10 border border-brand-orange/30 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" /> Selected
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-display font-black text-white uppercase tracking-wide">
              HEADLIGHTS
            </h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Headlight retrofit, projector lens upgrades, DRL, and custom automotive lighting installations.
            </p>
          </div>
        </button>

        {/* Headunit Option */}
        <button
          type="button"
          onClick={() => onSelect('headunit')}
          className={`p-6 sm:p-8 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer flex flex-col justify-between space-y-6 shadow-xl ${
            selectedType === 'headunit'
              ? 'bg-[#161616] border-brand-orange ring-2 ring-brand-orange/40 shadow-brand-orange/10'
              : 'bg-brand-darker border-gray-800/80 hover:border-gray-700 hover:bg-[#141414]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-4 rounded-2xl border transition-all ${
              selectedType === 'headunit'
                ? 'bg-brand-orange text-white border-brand-orange shadow-lg'
                : 'bg-brand-dark border-gray-800 text-brand-orange group-hover:scale-105'
            }`}>
              <Wrench className="w-8 h-8" />
            </div>

            {selectedType === 'headunit' && (
              <span className="flex items-center gap-1 text-xs font-mono font-bold uppercase text-brand-orange bg-brand-orange/10 border border-brand-orange/30 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" /> Selected
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-display font-black text-white uppercase tracking-wide">
              HEADUNIT
            </h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Android headunit, Apple CarPlay/Android Auto integration, camera systems, and speaker upgrades.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
